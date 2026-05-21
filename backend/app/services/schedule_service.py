"""
Brandflow AI - Schedule Service
=================================
Business logic for the post scheduling workflow.

Responsibilities:
    1. Validate the target post exists and is owned by the requesting user
    2. Write a schedule document to MongoDB (scheduled_posts collection)
    3. Dispatch the Celery task with the exact execution eta
    4. Return the schedule record to the route layer

Architecture position:
    ScheduleRoutes → ScheduleService → MongoDB (write schedule)
                                     → Celery (dispatch delayed task)
                                     → Redis (via Celery broker)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.schedule_schema import ScheduledPostDocument
from app.services.post_service import PostService

logger = logging.getLogger(__name__)


class ScheduleService:
    """
    Handles all scheduling logic for posts.

    Design principles:
    - Stateless (all inputs passed as arguments)
    - Validates post ownership before scheduling
    - Writes to MongoDB before dispatching the Celery task
    - Never blocks FastAPI — Celery handles the delayed execution
    """

    @staticmethod
    async def schedule_post(
        db: AsyncIOMotorDatabase,
        post_id: str,
        user_id: str,
        scheduled_time: datetime,
    ) -> dict:
        """
        Schedule a post for future automated execution.

        Flow:
        1. Validate the post exists and is owned by user (via PostService).
        2. Create a ScheduledPostDocument and insert it into MongoDB.
        3. Dispatch execute_scheduled_post Celery task with eta=scheduled_time.
        4. Update the schedule document with the Celery task ID.
        5. Update the post status to 'scheduled'.
        6. Return the schedule dict.

        Args:
            db:             Motor database instance (from FastAPI dependency).
            post_id:        MongoDB string ID of the post to schedule.
            user_id:        MongoDB string ID of the authenticated user.
            scheduled_time: UTC datetime when the task should execute.

        Returns:
            dict — the inserted schedule MongoDB document (with _id as string).

        Raises:
            HTTPException 400 — invalid post_id format.
            HTTPException 404 — post not found or not owned by user.
            HTTPException 503 — Redis/Celery broker not reachable.
        """
        # ── Step 1: Validate post ownership ────────────────────────────
        # PostService.get_post_by_id raises 400/404 if invalid/not found
        await PostService.get_post_by_id(db=db, post_id=post_id, user_id=user_id)

        # ── Step 2: Build and insert schedule document ──────────────────
        schedule_doc = ScheduledPostDocument(
            user_id=user_id,
            post_id=post_id,
            scheduled_time=scheduled_time,
            status="pending",
        )

        result = await db.scheduled_posts.insert_one(schedule_doc.to_dict())
        schedule_id = str(result.inserted_id)
        logger.info(f"Schedule document created: {schedule_id}")

        # ── Step 3: Dispatch Celery delayed task ────────────────────────
        # Ensure eta is timezone-aware (Celery requires this for UTC scheduling)
        eta = scheduled_time
        if eta.tzinfo is None:
            eta = eta.replace(tzinfo=timezone.utc)

        celery_task_id: Optional[str] = None

        try:
            from workers.tasks.scheduler_tasks import execute_scheduled_post
            task = execute_scheduled_post.apply_async(
                kwargs={
                    "schedule_id": schedule_id,
                    "post_id": post_id,
                    "user_id": user_id,
                },
                eta=eta,
                queue="scheduled",
            )
            celery_task_id = task.id
            logger.info(f"Celery task dispatched: task_id={celery_task_id} eta={eta.isoformat()}")

        except Exception as e:
            # Redis not running or Celery misconfigured — fail gracefully
            logger.error(f"Failed to dispatch Celery task: {e}")
            # Clean up the schedule document we just wrote
            await db.scheduled_posts.delete_one({"_id": result.inserted_id})
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Scheduling service is unavailable. "
                    "Make sure Redis is running and the Celery worker is started. "
                    f"Detail: {str(e)[:120]}"
                ),
            )

        # ── Step 4: Persist Celery task ID back to the schedule doc ────
        await db.scheduled_posts.update_one(
            {"_id": result.inserted_id},
            {"$set": {"celery_task_id": celery_task_id}},
        )

        # ── Step 5: Update post status → scheduled ──────────────────────
        from app.schemas.post import PostUpdate
        await PostService.update_post(
            db=db,
            post_id=post_id,
            update_data=PostUpdate(status="scheduled"),
            user_id=user_id,
        )

        # ── Step 6: Return schedule record ──────────────────────────────
        return {
            "schedule_id": schedule_id,
            "post_id": post_id,
            "user_id": user_id,
            "scheduled_time": scheduled_time,
            "status": "pending",
            "celery_task_id": celery_task_id,
        }

    @staticmethod
    async def get_user_schedules(
        db: AsyncIOMotorDatabase,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        """
        Retrieve all schedule records belonging to the authenticated user.

        Returns them sorted by scheduled_time descending (most recent first).
        """
        cursor = (
            db.scheduled_posts
            .find({"user_id": user_id})
            .sort("scheduled_time", -1)
            .skip(skip)
            .limit(limit)
        )

        schedules = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            schedules.append(doc)

        return schedules

    @staticmethod
    async def cancel_schedule(
        db: AsyncIOMotorDatabase,
        schedule_id: str,
        user_id: str,
    ) -> dict:
        """
        Cancel a pending schedule.

        Revokes the Celery task (best-effort — only works if the task
        hasn't been picked up yet) and marks the document as 'cancelled'.

        Args:
            db:          Motor database instance.
            schedule_id: MongoDB string ID of the schedule to cancel.
            user_id:     Owner user ID for ownership validation.

        Raises:
            HTTPException 400 — invalid schedule_id format.
            HTTPException 404 — schedule not found or not owned by user.
            HTTPException 409 — schedule already executed or failed.
        """
        # Validate schedule_id format
        try:
            oid = ObjectId(schedule_id)
        except InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid schedule ID format: '{schedule_id}'",
            )

        # Fetch schedule
        doc = await db.scheduled_posts.find_one({"_id": oid, "user_id": user_id})
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schedule not found or you don't have permission to cancel it.",
            )

        if doc.get("status") in ("executed", "failed"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel a schedule that is already '{doc['status']}'.",
            )

        # Revoke the Celery task (best-effort)
        if doc.get("celery_task_id"):
            try:
                from workers.celery_worker import celery_app
                celery_app.control.revoke(doc["celery_task_id"], terminate=True)
                logger.info(f"Celery task {doc['celery_task_id']} revoked.")
            except Exception as e:
                logger.warning(f"Could not revoke Celery task: {e}")

        # Mark as cancelled in MongoDB
        await db.scheduled_posts.update_one(
            {"_id": oid},
            {"$set": {"status": "cancelled"}},
        )

        return {"schedule_id": schedule_id, "status": "cancelled"}
