"""
Brandflow AI - Analytics Routes
=================================
FastAPI router for all analytics and monitoring endpoints.

All routes are:
    - JWT-protected via get_current_active_user dependency
    - User-scoped (never leak another user's data)
    - Thin — all logic delegated to AnalyticsService
    - Documented for Swagger with example responses

Endpoints:
    GET /analytics/overview    — Master dashboard summary
    GET /analytics/posts       — Post statistics + trend
    GET /analytics/generations — AI generation metrics
    GET /analytics/publishing  — Publishing stats + history
    GET /analytics/workers     — Celery worker health + history
    GET /analytics/activity    — Paginated activity feed
"""

import logging

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.connection import get_database
from app.dependencies.auth import get_current_active_user
from app.models.user import UserDocument
from app.schemas.analytics_schema import (
    AnalyticsOverviewResponse,
    GenerationAnalyticsResponse,
    PostStatsResponse,
    PublishStatsResponse,
    UserActivityResponse,
    WorkerHealthResponse,
)
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics & Monitoring"],
)


# ---------------------------------------------------------------------------
# GET /analytics/overview
# ---------------------------------------------------------------------------
@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get dashboard analytics overview",
    description=(
        "Returns a high-level summary of all platform activity for the "
        "authenticated user. Includes post lifecycle counts, publishing "
        "success rates, AI generation totals, and worker execution stats. "
        "This is the primary endpoint for the SaaS dashboard header cards."
    ),
    responses={
        200: {"description": "Analytics overview retrieved successfully"},
        401: {"description": "Missing or invalid JWT token"},
    },
)
async def get_overview(
    period_days: int = Query(
        default=30,
        ge=1,
        le=365,
        description="Lookback window in days for time-sensitive metrics",
    ),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> AnalyticsOverviewResponse:
    """
    **Dashboard overview — all key metrics in one call.**

    Example response:
    ```json
    {
      "success": true,
      "data": {
        "total_posts": 120,
        "published_posts": 95,
        "failed_posts": 5,
        "scheduled_posts": 20,
        "total_ai_generations": 98,
        "publishing_success_rate": 95.0,
        "instagram_connected": true
      }
    }
    ```
    """
    user_id = str(current_user.id)
    data = await AnalyticsService.get_overview(
        db=db, user_id=user_id, period_days=period_days
    )
    return AnalyticsOverviewResponse(success=True, data=data)


# ---------------------------------------------------------------------------
# GET /analytics/posts
# ---------------------------------------------------------------------------
@router.get(
    "/posts",
    response_model=PostStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get post statistics and daily trend",
    description=(
        "Returns post counts broken down by status (draft, scheduled, "
        "published, failed, etc.) plus a day-by-day creation trend for "
        "the last N days. The daily_trend array is graph-ready."
    ),
    responses={
        200: {"description": "Post statistics retrieved successfully"},
        401: {"description": "Missing or invalid JWT token"},
    },
)
async def get_post_stats(
    period_days: int = Query(
        default=30,
        ge=1,
        le=365,
        description="Number of days to include in the daily trend",
    ),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PostStatsResponse:
    """
    **Post lifecycle breakdown + daily creation trend.**

    Example `daily_trend` entry:
    ```json
    {"date": "2026-05-23", "count": 4}
    ```
    """
    user_id = str(current_user.id)
    data = await AnalyticsService.get_post_stats(
        db=db, user_id=user_id, period_days=period_days
    )
    return PostStatsResponse(success=True, data=data)


# ---------------------------------------------------------------------------
# GET /analytics/generations
# ---------------------------------------------------------------------------
@router.get(
    "/generations",
    response_model=GenerationAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get AI content generation analytics",
    description=(
        "Returns metrics about AI content generation events — success rate, "
        "average generation time, most used model, and a daily trend. "
        "Also returns the 10 most recent generation log entries."
    ),
    responses={
        200: {"description": "Generation analytics retrieved successfully"},
        401: {"description": "Missing or invalid JWT token"},
    },
)
async def get_generation_analytics(
    period_days: int = Query(
        default=30, ge=1, le=365, description="Trend lookback window in days"
    ),
    limit: int = Query(
        default=10, ge=1, le=50, description="Max recent generation logs to return"
    ),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GenerationAnalyticsResponse:
    """
    **AI generation usage metrics.**

    Tracks every call to Gemini AI including success/failure rates
    and average generation duration.
    """
    user_id = str(current_user.id)
    data = await AnalyticsService.get_generation_analytics(
        db=db, user_id=user_id, period_days=period_days, limit=limit
    )
    return GenerationAnalyticsResponse(success=True, data=data)


# ---------------------------------------------------------------------------
# GET /analytics/publishing
# ---------------------------------------------------------------------------
@router.get(
    "/publishing",
    response_model=PublishStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Instagram publishing statistics and history",
    description=(
        "Returns Instagram publishing metrics including success rate, "
        "average execution time, daily success/failure trend, and the "
        "most recent publish history records. Powers the publishing "
        "history table on the frontend dashboard."
    ),
    responses={
        200: {"description": "Publishing statistics retrieved successfully"},
        401: {"description": "Missing or invalid JWT token"},
    },
)
async def get_publish_stats(
    period_days: int = Query(
        default=30, ge=1, le=365, description="Trend lookback window in days"
    ),
    limit: int = Query(
        default=10, ge=1, le=50, description="Max recent publish log entries to return"
    ),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PublishStatsResponse:
    """
    **Instagram publishing stats + recent history.**

    Example `recent_history` entry:
    ```json
    {
      "post_id": "...",
      "platform": "instagram",
      "status": "success",
      "published_at": "2026-05-23T00:35:00Z",
      "execution_time_ms": 4100
    }
    ```
    """
    user_id = str(current_user.id)
    data = await AnalyticsService.get_publish_stats(
        db=db, user_id=user_id, period_days=period_days, limit=limit
    )
    return PublishStatsResponse(success=True, data=data)


# ---------------------------------------------------------------------------
# GET /analytics/workers
# ---------------------------------------------------------------------------
@router.get(
    "/workers",
    response_model=WorkerHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Celery worker health and task execution history",
    description=(
        "Returns Celery worker task execution metrics including success/failure "
        "counts, retry counts, average execution time, and recent task history. "
        "Powers the 'Worker Health' monitoring panel on the dashboard."
    ),
    responses={
        200: {"description": "Worker health data retrieved successfully"},
        401: {"description": "Missing or invalid JWT token"},
    },
)
async def get_worker_health(
    limit: int = Query(
        default=10, ge=1, le=50, description="Max recent task executions to return"
    ),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> WorkerHealthResponse:
    """
    **Celery worker monitoring — task success/failure/retry stats.**

    Tracks every `execute_scheduled_post` and `publish_to_instagram`
    task execution with timing and status data.
    """
    user_id = str(current_user.id)
    data = await AnalyticsService.get_worker_health(
        db=db, user_id=user_id, limit=limit
    )
    return WorkerHealthResponse(success=True, data=data)


# ---------------------------------------------------------------------------
# GET /analytics/activity
# ---------------------------------------------------------------------------
@router.get(
    "/activity",
    response_model=UserActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user activity feed",
    description=(
        "Returns a paginated, reverse-chronological activity feed for the "
        "authenticated user. Events include: post_generated, image_generated, "
        "post_scheduled, post_published, post_failed, instagram_connected. "
        "Powers the 'Recent Activity' panel on the dashboard."
    ),
    responses={
        200: {"description": "Activity feed retrieved successfully"},
        401: {"description": "Missing or invalid JWT token"},
    },
)
async def get_activity_feed(
    skip: int = Query(default=0, ge=0, description="Number of items to skip (pagination)"),
    limit: int = Query(
        default=20, ge=1, le=100, description="Max activity items to return"
    ),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserActivityResponse:
    """
    **Unified activity feed — all notable platform events.**

    Example event:
    ```json
    {
      "event_type": "post_published",
      "title": "Post Published to Instagram",
      "description": "@jituverse · just now",
      "created_at": "2026-05-23T00:35:00Z",
      "metadata": {"platform": "instagram", "instagram_post_id": "..."}
    }
    ```
    """
    user_id = str(current_user.id)
    items = await AnalyticsService.get_user_activity(
        db=db, user_id=user_id, skip=skip, limit=limit
    )
    return UserActivityResponse(success=True, count=len(items), data=items)
