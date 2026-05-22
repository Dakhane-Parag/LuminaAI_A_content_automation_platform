"""
Brandflow AI - Analytics Service
==================================
Central analytics business logic layer.

Responsibilities:
    1. Calculate dashboard metrics via MongoDB aggregation pipelines
    2. Log analytics events (generation, publish, worker, activity)
    3. Provide granular history lists for frontend tables/charts

Architecture:
    - All read methods are async (Motor) — used by FastAPI routes
    - All write methods have both async (Motor) and sync (pymongo) variants
      so they can be called from both FastAPI context AND Celery worker context
    - Zero breaking changes to existing collections

Collections used:
    READ  (existing): posts, scheduled_posts, users
    READ+WRITE (new): generation_logs, publish_logs, worker_logs, user_activity

Design:
    - Aggregation pipelines keep queries efficient (O(log n) with indexes)
    - All user-scoped queries include user_id to prevent cross-user data leaks
    - Errors in log writes are swallowed with a warning — analytics must NEVER
      crash the main publishing pipeline
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import certifi
import pymongo
from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.analytics import (
    ActivityEventDocument,
    ActivityEventType,
    GenerationLogDocument,
    PublishLogDocument,
    WorkerLogDocument,
)
from app.schemas.analytics_schema import (
    AnalyticsOverviewData,
    GenerationAnalyticsData,
    GenerationLogItem,
    PostStatusBreakdown,
    PostStatsData,
    PublishLogItem,
    PublishStatsData,
    RecentActivityItem,
    UserActivityResponse,
    WorkerHealthData,
    WorkerLogItem,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sync MongoDB helper (for Celery worker context)
# ---------------------------------------------------------------------------
def _get_sync_db():
    """
    Build a synchronous pymongo connection for use inside Celery tasks.
    Identical pattern to instagram_tasks._get_sync_db().
    """
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "brandflow_ai")
    client = pymongo.MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=10000,
        tlsCAFile=certifi.where(),
    )
    return client[db_name]


class AnalyticsService:
    """
    Stateless analytics service.

    All public methods are classmethods — no instantiation required.
    Read methods are async (Motor). Write helpers have sync variants for Celery.
    """

    # =========================================================================
    # READ METHODS — called by FastAPI analytics routes
    # =========================================================================

    @classmethod
    async def get_overview(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        period_days: int = 30,
    ) -> AnalyticsOverviewData:
        """
        Compute the master dashboard overview metrics for a user.

        Aggregates data from:
          - posts collection (post lifecycle counts)
          - publish_logs collection (publishing stats)
          - generation_logs collection (AI usage)
          - users collection (instagram connection status)

        Args:
            db:          Motor database handle.
            user_id:     The authenticated user's ID string.
            period_days: Lookback window for time-sensitive metrics.

        Returns:
            AnalyticsOverviewData — fully populated summary.
        """
        since = datetime.now(timezone.utc) - timedelta(days=period_days)

        # ── 1. Post status breakdown (aggregation pipeline) ───────────────
        status_pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
        status_cursor = db.posts.aggregate(status_pipeline)
        status_counts: Dict[str, int] = {}
        async for doc in status_cursor:
            status_counts[doc["_id"]] = doc["count"]

        total_posts = sum(status_counts.values())
        published_posts = status_counts.get("published", 0)
        failed_posts = status_counts.get("failed", 0)
        scheduled_posts = status_counts.get("scheduled", 0)
        draft_posts = status_counts.get("draft", 0)
        cancelled_posts = status_counts.get("cancelled", 0)

        # ── 2. Publishing stats from publish_logs ─────────────────────────
        total_publish_attempts = await db.publish_logs.count_documents(
            {"user_id": user_id}
        )
        successful_publishes = await db.publish_logs.count_documents(
            {"user_id": user_id, "status": "success"}
        )
        failed_publishes = await db.publish_logs.count_documents(
            {"user_id": user_id, "status": "failed"}
        )

        # ── 3. AI generation stats from generation_logs ───────────────────
        total_ai_generations = await db.generation_logs.count_documents(
            {"user_id": user_id}
        )

        # ── 4. Worker execution count from worker_logs ────────────────────
        total_automations_executed = await db.worker_logs.count_documents(
            {"user_id": user_id}
        )

        # ── 5. Total images generated (posts that have image_url set) ─────
        total_images_generated = await db.posts.count_documents(
            {"user_id": user_id, "image_url": {"$exists": True, "$ne": None}}
        )

        # ── 6. Instagram connection status ────────────────────────────────
        user_doc = await db.users.find_one(
            {"_id": ObjectId(user_id)}, {"instagram_connected": 1}
        )
        instagram_connected = bool(
            user_doc and user_doc.get("instagram_connected", False)
        ) if user_doc else False

        # ── 7. Publishing success rate ─────────────────────────────────────
        success_rate = (
            round((successful_publishes / total_publish_attempts) * 100, 1)
            if total_publish_attempts > 0
            else 0.0
        )

        return AnalyticsOverviewData(
            total_posts=total_posts,
            draft_posts=draft_posts,
            scheduled_posts=scheduled_posts,
            published_posts=published_posts,
            failed_posts=failed_posts,
            cancelled_posts=cancelled_posts,
            total_ai_generations=total_ai_generations,
            total_automations_executed=total_automations_executed,
            total_images_generated=total_images_generated,
            total_publish_attempts=total_publish_attempts,
            successful_publishes=successful_publishes,
            failed_publishes=failed_publishes,
            publishing_success_rate=success_rate,
            instagram_connected=instagram_connected,
            period_days=period_days,
        )

    @classmethod
    async def get_post_stats(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        period_days: int = 30,
    ) -> PostStatsData:
        """
        Return post counts by status + a 30-day daily creation trend.

        The daily_trend list is graph-ready:
            [{"date": "2026-05-01", "count": 3}, ...]
        """
        # ── Status breakdown ──────────────────────────────────────────────
        status_pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
        status_cursor = db.posts.aggregate(status_pipeline)
        status_counts: Dict[str, int] = {}
        async for doc in status_cursor:
            status_counts[doc["_id"] or "unknown"] = doc["count"]

        breakdown = PostStatusBreakdown(
            draft=status_counts.get("draft", 0),
            scheduled=status_counts.get("scheduled", 0),
            published=status_counts.get("published", 0),
            failed=status_counts.get("failed", 0),
            cancelled=status_counts.get("cancelled", 0),
            publishing=status_counts.get("publishing", 0),
            executed=status_counts.get("executed", 0),
            ready=status_counts.get("ready", 0),
        )

        # ── Daily trend (last N days) ─────────────────────────────────────
        since = datetime.now(timezone.utc) - timedelta(days=period_days)
        trend_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at",
                        }
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
            {"$project": {"_id": 0, "date": "$_id", "count": 1}},
        ]
        trend_cursor = db.posts.aggregate(trend_pipeline)
        daily_trend = [doc async for doc in trend_cursor]

        # ── Most used tone and style ──────────────────────────────────────
        tone_pipeline = [
            {"$match": {"user_id": user_id, "tone": {"$ne": ""}}},
            {"$group": {"_id": "$tone", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]
        style_pipeline = [
            {"$match": {"user_id": user_id, "design_style": {"$ne": ""}}},
            {"$group": {"_id": "$design_style", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]
        top_tone_docs = [doc async for doc in db.posts.aggregate(tone_pipeline)]
        top_style_docs = [doc async for doc in db.posts.aggregate(style_pipeline)]

        most_used_tone = top_tone_docs[0]["_id"] if top_tone_docs else None
        most_used_style = top_style_docs[0]["_id"] if top_style_docs else None

        return PostStatsData(
            total=sum(status_counts.values()),
            by_status=breakdown,
            daily_trend=daily_trend,
            most_used_tone=most_used_tone,
            most_used_style=most_used_style,
        )

    @classmethod
    async def get_generation_analytics(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        period_days: int = 30,
        limit: int = 10,
    ) -> GenerationAnalyticsData:
        """
        Return AI generation metrics and recent generation history.
        """
        # ── Aggregate over generation_logs ────────────────────────────────
        agg_pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "successes": {
                        "$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}
                    },
                    "failures": {
                        "$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}
                    },
                    "avg_duration": {"$avg": "$duration_ms"},
                }
            },
        ]
        agg_docs = [doc async for doc in db.generation_logs.aggregate(agg_pipeline)]
        agg = agg_docs[0] if agg_docs else {}

        total = agg.get("total", 0)
        successes = agg.get("successes", 0)
        failures = agg.get("failures", 0)
        avg_duration = agg.get("avg_duration")
        success_rate = round((successes / total) * 100, 1) if total > 0 else 0.0

        # ── Most used model ────────────────────────────────────────────────
        model_pipeline = [
            {"$match": {"user_id": user_id, "model": {"$ne": ""}}},
            {"$group": {"_id": "$model", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]
        model_docs = [doc async for doc in db.generation_logs.aggregate(model_pipeline)]
        most_used_model = model_docs[0]["_id"] if model_docs else None

        # ── Daily trend ───────────────────────────────────────────────────
        since = datetime.now(timezone.utc) - timedelta(days=period_days)
        trend_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
            {"$project": {"_id": 0, "date": "$_id", "count": 1}},
        ]
        daily_trend = [doc async for doc in db.generation_logs.aggregate(trend_pipeline)]

        # ── Recent logs ───────────────────────────────────────────────────
        recent_cursor = (
            db.generation_logs
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        recent_logs = []
        async for doc in recent_cursor:
            recent_logs.append(GenerationLogItem(
                id=str(doc["_id"]),
                post_id=doc.get("post_id"),
                prompt=doc.get("prompt", ""),
                status=doc.get("status", ""),
                duration_ms=doc.get("duration_ms"),
                model=doc.get("model", ""),
                error_message=doc.get("error_message"),
                created_at=doc["created_at"],
            ))

        return GenerationAnalyticsData(
            total_generations=total,
            successful_generations=successes,
            failed_generations=failures,
            success_rate=success_rate,
            avg_duration_ms=round(avg_duration, 1) if avg_duration else None,
            most_used_model=most_used_model,
            daily_trend=daily_trend,
            recent_logs=recent_logs,
        )

    @classmethod
    async def get_publish_stats(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        period_days: int = 30,
        limit: int = 10,
    ) -> PublishStatsData:
        """
        Return Instagram publishing stats and recent publish history.
        """
        # ── Aggregate publish_logs ─────────────────────────────────────────
        agg_pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "successes": {
                        "$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}
                    },
                    "failures": {
                        "$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}
                    },
                    "avg_exec_time": {"$avg": "$execution_time_ms"},
                }
            },
        ]
        agg_docs = [doc async for doc in db.publish_logs.aggregate(agg_pipeline)]
        agg = agg_docs[0] if agg_docs else {}

        total = agg.get("total", 0)
        successes = agg.get("successes", 0)
        failures = agg.get("failures", 0)
        avg_exec = agg.get("avg_exec_time")
        success_rate = round((successes / total) * 100, 1) if total > 0 else 0.0

        # ── Daily trend ───────────────────────────────────────────────────
        since = datetime.now(timezone.utc) - timedelta(days=period_days)
        trend_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "success_count": {
                        "$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}
                    },
                    "fail_count": {
                        "$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}
                    },
                }
            },
            {"$sort": {"_id": 1}},
            {
                "$project": {
                    "_id": 0,
                    "date": "$_id",
                    "success_count": 1,
                    "fail_count": 1,
                }
            },
        ]
        daily_trend = [doc async for doc in db.publish_logs.aggregate(trend_pipeline)]

        # ── Recent publish history ─────────────────────────────────────────
        recent_cursor = (
            db.publish_logs
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        recent_history = []
        async for doc in recent_cursor:
            recent_history.append(PublishLogItem(
                id=str(doc["_id"]),
                post_id=doc.get("post_id", ""),
                schedule_id=doc.get("schedule_id", ""),
                platform=doc.get("platform", "instagram"),
                status=doc.get("status", ""),
                instagram_post_id=doc.get("instagram_post_id"),
                error_message=doc.get("error_message"),
                execution_time_ms=doc.get("execution_time_ms"),
                published_at=doc.get("published_at"),
                created_at=doc["created_at"],
            ))

        return PublishStatsData(
            total_attempts=total,
            successful_publishes=successes,
            failed_publishes=failures,
            success_rate=success_rate,
            avg_execution_time_ms=round(avg_exec, 1) if avg_exec else None,
            daily_trend=daily_trend,
            recent_history=recent_history,
        )

    @classmethod
    async def get_worker_health(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        limit: int = 10,
    ) -> WorkerHealthData:
        """
        Return Celery task health metrics and recent execution history.
        """
        # ── Aggregate worker_logs ──────────────────────────────────────────
        agg_pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "successes": {
                        "$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}
                    },
                    "failures": {
                        "$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}
                    },
                    "retried": {
                        "$sum": {"$cond": [{"$eq": ["$status", "retried"]}, 1, 0]}
                    },
                    "skipped": {
                        "$sum": {"$cond": [{"$eq": ["$status", "skipped"]}, 1, 0]}
                    },
                    "avg_exec_time": {"$avg": "$execution_time_ms"},
                }
            },
        ]
        agg_docs = [doc async for doc in db.worker_logs.aggregate(agg_pipeline)]
        agg = agg_docs[0] if agg_docs else {}

        total = agg.get("total", 0)
        successes = agg.get("successes", 0)
        failures = agg.get("failures", 0)
        retried = agg.get("retried", 0)
        skipped = agg.get("skipped", 0)
        avg_exec = agg.get("avg_exec_time")
        success_rate = round((successes / total) * 100, 1) if total > 0 else 0.0

        # ── Recent executions ──────────────────────────────────────────────
        recent_cursor = (
            db.worker_logs
            .find({"user_id": user_id})
            .sort("executed_at", -1)
            .limit(limit)
        )
        recent_executions = []
        async for doc in recent_cursor:
            recent_executions.append(WorkerLogItem(
                id=str(doc["_id"]),
                task_name=doc.get("task_name", ""),
                post_id=doc.get("post_id"),
                schedule_id=doc.get("schedule_id"),
                status=doc.get("status", ""),
                retry_count=doc.get("retry_count", 0),
                error_message=doc.get("error_message"),
                execution_time_ms=doc.get("execution_time_ms"),
                executed_at=doc.get("executed_at", doc["created_at"]),
            ))

        return WorkerHealthData(
            total_tasks_executed=total,
            successful_tasks=successes,
            failed_tasks=failures,
            retried_tasks=retried,
            skipped_tasks=skipped,
            success_rate=success_rate,
            avg_execution_time_ms=round(avg_exec, 1) if avg_exec else None,
            recent_executions=recent_executions,
        )

    @classmethod
    async def get_user_activity(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> list:
        """
        Return the paginated activity feed for a user.

        Sorted by created_at descending (most recent first).
        """
        cursor = (
            db.user_activity
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        items = []
        async for doc in cursor:
            items.append(RecentActivityItem(
                id=str(doc["_id"]),
                event_type=doc.get("event_type", ""),
                title=doc.get("title", ""),
                description=doc.get("description", ""),
                post_id=doc.get("post_id"),
                schedule_id=doc.get("schedule_id"),
                metadata=doc.get("metadata", {}),
                created_at=doc["created_at"],
            ))
        return items

    # =========================================================================
    # ASYNC WRITE METHODS — called from FastAPI / Motor context
    # =========================================================================

    @classmethod
    async def log_generation_event_async(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        post_id: Optional[str],
        prompt: str,
        status: str,
        duration_ms: Optional[int] = None,
        model: str = "",
        error_message: Optional[str] = None,
    ) -> None:
        """
        Write a generation event to generation_logs (async / Motor).
        Called by AIService after each Gemini generation.

        Errors are logged as warnings — never bubble up.
        """
        try:
            doc = GenerationLogDocument(
                user_id=user_id,
                post_id=post_id,
                prompt=prompt[:500] if prompt else "",  # truncate for storage
                status=status,
                duration_ms=duration_ms,
                model=model,
                error_message=error_message,
            )
            await db.generation_logs.insert_one(doc.to_dict())
            logger.debug(f"[Analytics] Generation event logged for user {user_id}")
        except Exception as e:
            logger.warning(f"[Analytics] Failed to log generation event: {e}")

    @classmethod
    async def log_activity_event_async(
        cls,
        db: AsyncIOMotorDatabase,
        user_id: str,
        event_type: str,
        title: str,
        description: str = "",
        post_id: Optional[str] = None,
        schedule_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Write an activity event to user_activity (async / Motor).
        Can be called from any async FastAPI service.

        Errors are logged as warnings — never bubble up.
        """
        try:
            doc = ActivityEventDocument(
                user_id=user_id,
                event_type=event_type,
                title=title,
                description=description,
                post_id=post_id,
                schedule_id=schedule_id,
                metadata=metadata or {},
            )
            await db.user_activity.insert_one(doc.to_dict())
            logger.debug(f"[Analytics] Activity event '{event_type}' logged for user {user_id}")
        except Exception as e:
            logger.warning(f"[Analytics] Failed to log activity event: {e}")

    # =========================================================================
    # SYNC WRITE METHODS — called from Celery worker context (pymongo)
    # =========================================================================

    @classmethod
    def log_publish_event_sync(
        cls,
        user_id: str,
        post_id: str,
        schedule_id: str,
        status: str,
        instagram_post_id: Optional[str] = None,
        error_message: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        published_at: Optional[datetime] = None,
    ) -> None:
        """
        Write a publish event to publish_logs (sync / pymongo).
        Called by instagram_tasks.publish_to_instagram after success or failure.

        Errors are swallowed — analytics must NEVER disrupt publishing.
        """
        try:
            db = _get_sync_db()
            doc = PublishLogDocument(
                user_id=user_id,
                post_id=post_id,
                schedule_id=schedule_id,
                platform="instagram",
                status=status,
                instagram_post_id=instagram_post_id,
                error_message=error_message,
                execution_time_ms=execution_time_ms,
                published_at=published_at,
            )
            db.publish_logs.insert_one(doc.to_dict())
            logger.debug(f"[Analytics] Publish event logged — status={status} post={post_id}")
        except Exception as e:
            logger.warning(f"[Analytics] Failed to log publish event: {e}")

    @classmethod
    def log_worker_event_sync(
        cls,
        user_id: str,
        task_name: str,
        status: str,
        schedule_id: Optional[str] = None,
        post_id: Optional[str] = None,
        retry_count: int = 0,
        error_message: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
    ) -> None:
        """
        Write a worker task event to worker_logs (sync / pymongo).
        Called by scheduler_tasks.execute_scheduled_post after each execution.

        Errors are swallowed — analytics must NEVER disrupt task execution.
        """
        try:
            db = _get_sync_db()
            doc = WorkerLogDocument(
                user_id=user_id,
                task_name=task_name,
                schedule_id=schedule_id,
                post_id=post_id,
                status=status,
                retry_count=retry_count,
                error_message=error_message,
                execution_time_ms=execution_time_ms,
            )
            db.worker_logs.insert_one(doc.to_dict())
            logger.debug(f"[Analytics] Worker event logged — task={task_name} status={status}")
        except Exception as e:
            logger.warning(f"[Analytics] Failed to log worker event: {e}")

    @classmethod
    def log_activity_event_sync(
        cls,
        user_id: str,
        event_type: str,
        title: str,
        description: str = "",
        post_id: Optional[str] = None,
        schedule_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Write an activity event to user_activity (sync / pymongo).
        Called by Celery tasks to update the activity feed.

        Errors are swallowed — analytics must NEVER disrupt publishing.
        """
        try:
            db = _get_sync_db()
            doc = ActivityEventDocument(
                user_id=user_id,
                event_type=event_type,
                title=title,
                description=description,
                post_id=post_id,
                schedule_id=schedule_id,
                metadata=metadata or {},
            )
            db.user_activity.insert_one(doc.to_dict())
            logger.debug(f"[Analytics] Activity event '{event_type}' logged (sync) for user {user_id}")
        except Exception as e:
            logger.warning(f"[Analytics] Failed to log activity event (sync): {e}")
