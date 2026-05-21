"""
Brandflow AI - Schedule Routes
================================
HTTP layer for the post scheduling workflow.
All endpoints are JWT-protected and ownership-validated.

Endpoints:
    POST   /api/v1/schedule/schedule-post/{post_id}  — Schedule a post for future execution
    GET    /api/v1/schedule/my-schedules             — List all schedules for current user
    DELETE /api/v1/schedule/cancel/{schedule_id}     — Cancel a pending schedule

Design:
    - Routes stay thin — just auth, input validation, delegation, response.
    - All scheduling logic lives in ScheduleService.
    - All Celery dispatch logic lives in ScheduleService.
    - MongoDB access goes through ScheduleService and PostService.
"""

import logging

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.connection import get_database
from app.dependencies.auth import get_current_active_user
from app.models.user import UserDocument
from app.schemas.schedule_schema import SchedulePostRequest, SchedulePostResponse
from app.services.schedule_service import ScheduleService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/schedule",
    tags=["Scheduling & Automation"],
)


# ---------------------------------------------------------------------------
# POST /schedule/schedule-post/{post_id}
# ---------------------------------------------------------------------------
@router.post(
    "/schedule-post/{post_id}",
    response_model=SchedulePostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a post for future automated execution",
    responses={
        201: {"description": "Post scheduled and Celery task dispatched"},
        400: {"description": "Invalid post ID or scheduled_time in the past"},
        401: {"description": "Missing or invalid JWT token"},
        404: {"description": "Post not found or not owned by you"},
        503: {"description": "Scheduling service unavailable (Redis not running)"},
    },
)
async def schedule_post(
    post_id: str,
    request: SchedulePostRequest,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SchedulePostResponse:
    """
    Schedule a post for automatic execution at a future UTC datetime.

    **Workflow:**
    1. Validates the post exists and belongs to you.
    2. Creates a schedule record in MongoDB (`scheduled_posts` collection).
    3. Dispatches a Celery task with `eta=scheduled_time` to Redis.
    4. Updates the post status to `scheduled`.
    5. Returns immediately — the worker executes the task in the background.

    **Requirements:**
    - Redis must be running locally (`redis-server` or Docker).
    - Celery worker must be running in a separate terminal.

    **Celery worker command:**
    ```
    celery -A workers.celery_worker worker --loglevel=info -P solo
    ```

    **Example request body:**
    ```json
    { "scheduled_time": "2026-08-20T21:00:00Z" }
    ```

    **Note:** `scheduled_time` must be a future UTC datetime.
    Scheduling in the past will return HTTP 422.
    """
    user_id = str(current_user.id)

    schedule = await ScheduleService.schedule_post(
        db=db,
        post_id=post_id,
        user_id=user_id,
        scheduled_time=request.scheduled_time,
    )

    return SchedulePostResponse(
        success=True,
        message=f"Post scheduled successfully for {request.scheduled_time.isoformat()}.",
        schedule_id=schedule["schedule_id"],
        post_id=schedule["post_id"],
        user_id=schedule["user_id"],
        scheduled_time=schedule["scheduled_time"],
        status=schedule["status"],
        celery_task_id=schedule["celery_task_id"],
    )


# ---------------------------------------------------------------------------
# GET /schedule/my-schedules
# ---------------------------------------------------------------------------
@router.get(
    "/my-schedules",
    status_code=status.HTTP_200_OK,
    summary="List all scheduled posts for the current user",
)
async def get_my_schedules(
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    """
    Retrieve all schedule records for the authenticated user.

    Returns schedules sorted by scheduled_time descending.
    Use `skip` and `limit` for pagination.
    """
    user_id = str(current_user.id)
    schedules = await ScheduleService.get_user_schedules(
        db=db,
        user_id=user_id,
        skip=skip,
        limit=limit,
    )

    return {
        "success": True,
        "count": len(schedules),
        "data": schedules,
    }


# ---------------------------------------------------------------------------
# DELETE /schedule/cancel/{schedule_id}
# ---------------------------------------------------------------------------
@router.delete(
    "/cancel/{schedule_id}",
    status_code=status.HTTP_200_OK,
    summary="Cancel a pending scheduled post",
    responses={
        200: {"description": "Schedule cancelled successfully"},
        400: {"description": "Invalid schedule ID format"},
        404: {"description": "Schedule not found or not owned by you"},
        409: {"description": "Schedule already executed or failed"},
    },
)
async def cancel_schedule(
    schedule_id: str,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    """
    Cancel a pending scheduled post.

    Revokes the Celery task (best-effort) and marks the schedule as cancelled.
    Cannot cancel schedules that have already executed or failed.
    """
    user_id = str(current_user.id)
    result = await ScheduleService.cancel_schedule(
        db=db,
        schedule_id=schedule_id,
        user_id=user_id,
    )

    return {
        "success": True,
        "message": "Schedule cancelled successfully.",
        "schedule_id": result["schedule_id"],
        "status": result["status"],
    }
