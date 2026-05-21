"""
Brandflow AI - Scheduler Tasks
================================
Celery tasks for the scheduled post automation workflow.

These tasks run inside the Celery worker process (separate from FastAPI).
They are triggered by ScheduleService.apply_async(eta=scheduled_time).

Task architecture:
    execute_scheduled_post  — main automation task (triggered at scheduled time)
    mark_schedule_failed    — helper to handle failure recording

For Stair 10:
    The task simulates automation by updating MongoDB status to "executed".
    Instagram posting will be added in Stair 11.

IMPORTANT:
    - Tasks use a synchronous pymongo client (not Motor) because Celery
      workers run synchronously, not inside an asyncio event loop.
    - All MongoDB interaction here is direct and synchronous (pymongo).
    - Never import from app.main or FastAPI-dependent modules here.
"""

import logging
from datetime import datetime, timezone

import certifi
import pymongo
from celery import Task
from celery.utils.log import get_task_logger

from workers.celery_worker import celery_app

logger = get_task_logger(__name__)

# ---------------------------------------------------------------------------
# Synchronous MongoDB helper (Celery workers are sync — cannot use Motor)
# ---------------------------------------------------------------------------

def _get_sync_db():
    """
    Build a synchronous pymongo database connection for use inside Celery tasks.
    Uses certifi for Atlas TLS compatibility — same as the Motor connection.
    Credentials are loaded directly from environment to avoid importing FastAPI deps.
    """
    import os
    mongodb_uri = os.getenv(
        "MONGODB_URI",
        "mongodb://localhost:27017",
    )
    db_name = os.getenv("MONGODB_DB_NAME", "brandflow_ai")

    client = pymongo.MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=10000,
        tlsCAFile=certifi.where(),
    )
    return client[db_name]


# ---------------------------------------------------------------------------
# Base task class with retry support
# ---------------------------------------------------------------------------
class BaseSchedulerTask(Task):
    """Base class providing shared retry logic for all scheduler tasks."""
    abstract = True
    max_retries = 3
    default_retry_delay = 60  # 60 seconds between retries


# ---------------------------------------------------------------------------
# Main scheduled automation task
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    base=BaseSchedulerTask,
    name="workers.tasks.scheduler_tasks.execute_scheduled_post",
    queue="scheduled",
)
def execute_scheduled_post(self, schedule_id: str, post_id: str, user_id: str) -> dict:
    """
    Execute the automation workflow for a scheduled post.

    This task is triggered automatically by Celery at the exact `eta`
    datetime set during scheduling.

    Stair 10 behaviour:
        - Fetch the scheduled post document
        - Update the schedule status to 'executed'
        - Update the post status to 'executed'
        - Record the executed_at timestamp

    Stair 11 will extend this task with:
        - Fetching post content from MongoDB
        - Calling the Instagram Graph API
        - Publishing the post
        - Updating status to 'published'

    Args:
        schedule_id: MongoDB _id string of the scheduled_posts document.
        post_id:     MongoDB _id string of the post to execute.
        user_id:     MongoDB _id string of the owning user.

    Returns:
        dict with execution result summary.
    """
    from bson import ObjectId

    logger.info(
        f"[Celery] Executing scheduled task — "
        f"schedule_id={schedule_id} post_id={post_id} user_id={user_id}"
    )

    try:
        db = _get_sync_db()
        now = datetime.now(timezone.utc)

        # ── Step 1: Update schedule status → executed ─────────────────
        schedule_update = db.scheduled_posts.update_one(
            {"_id": ObjectId(schedule_id)},
            {
                "$set": {
                    "status": "executed",
                    "executed_at": now,
                }
            },
        )

        if schedule_update.matched_count == 0:
            logger.warning(f"[Celery] Schedule {schedule_id} not found in DB — may have been cancelled.")
            return {"status": "skipped", "reason": "schedule not found"}

        # ── Step 2: Update post status → executed ─────────────────────
        # (Stair 11 will change this to 'published' after Instagram posts)
        db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {
                "$set": {
                    "status": "executed",
                    "updated_at": now,
                }
            },
        )

        logger.info(
            f"[Celery] ✅ Scheduled task completed successfully. "
            f"schedule_id={schedule_id} post_id={post_id}"
        )

        return {
            "status": "executed",
            "schedule_id": schedule_id,
            "post_id": post_id,
            "executed_at": now.isoformat(),
        }

    except Exception as exc:
        logger.error(
            f"[Celery] ❌ Task failed for schedule_id={schedule_id}: {exc}",
            exc_info=True,
        )

        # Mark the schedule as failed in MongoDB
        try:
            db = _get_sync_db()
            db.scheduled_posts.update_one(
                {"_id": ObjectId(schedule_id)},
                {
                    "$set": {
                        "status": "failed",
                        "error_message": str(exc),
                        "executed_at": datetime.now(timezone.utc),
                    }
                },
            )
            # Mark post as failed too
            db.posts.update_one(
                {"_id": ObjectId(post_id)},
                {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}},
            )
        except Exception as db_err:
            logger.error(f"[Celery] Could not update failure status in DB: {db_err}")

        # Retry the task with exponential back-off
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
