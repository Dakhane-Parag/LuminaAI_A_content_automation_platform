"""
Brandflow AI - Instagram Publishing Tasks
==========================================
Celery tasks for automated Instagram post publishing.

These tasks run inside the Celery worker process (separate from FastAPI).
They are called by execute_scheduled_post in scheduler_tasks.py when
a scheduled time arrives.

Task:
    publish_to_instagram  — Full Meta Graph API publish pipeline

Architecture:
    - Synchronous (Celery workers are not in an asyncio event loop)
    - Uses pymongo directly (not Motor) for DB access
    - Uses InstagramService for all Meta API calls
    - Handles token validation, retry, and failure recording
"""

import logging
import os
from datetime import datetime, timezone

import certifi
import pymongo
from bson import ObjectId
from celery import Task
from celery.utils.log import get_task_logger

from app.services.instagram_service import InstagramAPIError, InstagramService
from workers.celery_worker import celery_app

logger = get_task_logger(__name__)


# ---------------------------------------------------------------------------
# Synchronous MongoDB helper
# ---------------------------------------------------------------------------
def _get_sync_db():
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "brandflow_ai")
    client = pymongo.MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=10000,
        tlsCAFile=certifi.where(),
    )
    return client[db_name]


# ---------------------------------------------------------------------------
# Base task with retry
# ---------------------------------------------------------------------------
class BaseInstagramTask(Task):
    abstract = True
    max_retries = 3
    default_retry_delay = 120  # 2 minutes between retries


# ---------------------------------------------------------------------------
# Main Instagram publish task
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    base=BaseInstagramTask,
    name="workers.tasks.instagram_tasks.publish_to_instagram",
    queue="scheduled",
)
def publish_to_instagram(
    self,
    schedule_id: str,
    post_id: str,
    user_id: str,
) -> dict:
    """
    Execute the full Instagram auto-publishing pipeline for a scheduled post.

    Flow:
        1. Fetch post document (caption, image_url, hashtags)
        2. Fetch user's Instagram credentials from MongoDB
        3. Validate Instagram is connected
        4. Mark post as 'publishing' (intermediate state)
        5. Call InstagramService.publish_post_sync (2-step Meta API flow)
        6. Update post status to 'published' + store instagram_post_id
        7. Update schedule document to 'executed'

    Error handling:
        - Token expired   → mark failed, log clear error message
        - Missing image   → mark failed, notify in error_message
        - API rate limit  → retry with countdown
        - Generic errors  → retry up to max_retries, then mark failed

    Args:
        schedule_id: MongoDB _id of the scheduled_posts document.
        post_id:     MongoDB _id of the post to publish.
        user_id:     MongoDB _id of the owning user.

    Returns:
        dict with publish result summary.
    """
    logger.info(
        f"[Instagram Task] Starting publish pipeline — "
        f"schedule_id={schedule_id} post_id={post_id} user_id={user_id}"
    )

    db = _get_sync_db()
    now = datetime.now(timezone.utc)

    # ── Step 1: Fetch post document ────────────────────────────────────
    post_doc = db.posts.find_one({"_id": ObjectId(post_id)})
    if not post_doc:
        logger.error(f"[Instagram Task] Post {post_id} not found in DB.")
        _mark_failed(db, schedule_id, post_id, "Post not found in database.")
        return {"status": "failed", "reason": "post not found"}

    image_url = post_doc.get("image_url")
    caption = post_doc.get("caption", "")
    hashtags = post_doc.get("hashtags", [])

    # Combine caption + hashtags
    if hashtags:
        hashtag_string = " ".join(
            f"#{tag.strip('#').strip()}" for tag in hashtags
        )
        full_caption = f"{caption}\n\n{hashtag_string}"
    else:
        full_caption = caption

    # ── Step 2: Validate image URL is present ─────────────────────────
    if not image_url:
        error_msg = (
            "Post has no image URL. Generate an image first via "
            "POST /api/v1/images/generate-image/{post_id} before scheduling."
        )
        logger.error(f"[Instagram Task] {error_msg}")
        _mark_failed(db, schedule_id, post_id, error_msg)
        return {"status": "failed", "reason": "missing image_url"}

    # ── Step 3: Fetch user Instagram credentials ───────────────────────
    user_doc = db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        _mark_failed(db, schedule_id, post_id, "User not found in database.")
        return {"status": "failed", "reason": "user not found"}

    if not user_doc.get("instagram_connected"):
        error_msg = (
            "Instagram is not connected for this user. "
            "Connect via POST /api/v1/oauth/instagram/connect-manual."
        )
        logger.error(f"[Instagram Task] {error_msg}")
        _mark_failed(db, schedule_id, post_id, error_msg)
        return {"status": "failed", "reason": "instagram not connected"}

    access_token = user_doc.get("instagram_access_token")
    instagram_business_id = user_doc.get("instagram_business_id")

    if not access_token or not instagram_business_id:
        error_msg = "Instagram credentials incomplete (missing token or business ID)."
        _mark_failed(db, schedule_id, post_id, error_msg)
        return {"status": "failed", "reason": "incomplete instagram credentials"}

    # ── Step 4: Mark post as 'publishing' ─────────────────────────────
    db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {"status": "publishing", "updated_at": now}},
    )

    # ── Step 5: Call Meta Graph API ────────────────────────────────────
    try:
        result = InstagramService.publish_post_sync(
            access_token=access_token,
            instagram_business_id=instagram_business_id,
            image_url=image_url,
            caption=full_caption,
        )

    except InstagramAPIError as e:
        logger.error(f"[Instagram Task] Instagram API error: {e} (code: {e.code})")

        # Check for token expiry (code 190) — don't retry, mark failed + clear token flag
        if e.code in (190, 102):
            error_msg = (
                "Meta access token has expired. "
                "Reconnect Instagram via POST /api/v1/oauth/instagram/connect-manual."
            )
            db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"instagram_connected": False}},
            )
            _mark_failed(db, schedule_id, post_id, error_msg)
            return {"status": "failed", "reason": "token expired"}

        # Rate limit (code 32, 4) — retry after delay
        if e.code in (4, 32):
            logger.warning(f"[Instagram Task] Rate limited. Retrying...")
            raise self.retry(exc=e, countdown=300)  # 5 minute wait

        # Other API errors — retry with back-off
        raise self.retry(exc=e, countdown=120 * (self.request.retries + 1))

    except Exception as exc:
        logger.error(f"[Instagram Task] Unexpected error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=120 * (self.request.retries + 1))

    # ── Step 6: Update post → published ───────────────────────────────
    published_at = result["published_at"]
    instagram_post_id = result["instagram_post_id"]

    db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {
            "$set": {
                "status": "published",
                "published_at": published_at,
                "instagram_post_id": instagram_post_id,
                "updated_at": published_at,
            }
        },
    )

    # ── Step 7: Update schedule → executed ────────────────────────────
    db.scheduled_posts.update_one(
        {"_id": ObjectId(schedule_id)},
        {
            "$set": {
                "status": "executed",
                "executed_at": published_at,
            }
        },
    )

    logger.info(
        f"[Instagram Task] ✅ Post published to Instagram! "
        f"instagram_post_id={instagram_post_id} post_id={post_id}"
    )

    return {
        "status": "published",
        "schedule_id": schedule_id,
        "post_id": post_id,
        "instagram_post_id": instagram_post_id,
        "published_at": published_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Helper — mark both schedule and post as failed
# ---------------------------------------------------------------------------
def _mark_failed(db, schedule_id: str, post_id: str, error_message: str) -> None:
    """Helper to consistently mark both schedule and post as failed."""
    now = datetime.now(timezone.utc)
    try:
        db.scheduled_posts.update_one(
            {"_id": ObjectId(schedule_id)},
            {
                "$set": {
                    "status": "failed",
                    "error_message": error_message,
                    "executed_at": now,
                }
            },
        )
        db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": {"status": "failed", "updated_at": now}},
        )
    except Exception as e:
        logger.error(f"[Instagram Task] Failed to record failure in DB: {e}")
