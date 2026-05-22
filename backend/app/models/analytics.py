"""
Brandflow AI - Analytics Document Models
=========================================
Defines the MongoDB document shapes for all analytics/monitoring collections.

Collections managed here:
    generation_logs  — One record per AI content generation event
    publish_logs     — One record per Instagram publish attempt (success or fail)
    worker_logs      — One record per Celery task execution
    user_activity    — Unified activity feed events for the dashboard

Design principles:
    - All documents carry user_id for user-scoped queries
    - All documents carry created_at for time-series aggregations
    - Fields are intentionally flat for efficient index + aggregation use
    - No sensitive fields (tokens, passwords) are ever stored here
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field

from app.models.user import PyObjectId  # reuse shared ObjectId bridge


# ---------------------------------------------------------------------------
# Activity Event Types (string constants)
# ---------------------------------------------------------------------------
class ActivityEventType:
    """Valid values for ActivityEventDocument.event_type."""
    POST_CREATED        = "post_created"
    POST_GENERATED      = "post_generated"       # AI content generation
    IMAGE_GENERATED     = "image_generated"      # AI image generation
    POST_SCHEDULED      = "post_scheduled"       # User scheduled a post
    POST_PUBLISHED      = "post_published"       # Auto-published to Instagram
    POST_FAILED         = "post_failed"          # Publish failed
    POST_CANCELLED      = "post_cancelled"       # Schedule cancelled
    INSTAGRAM_CONNECTED = "instagram_connected"  # OAuth/manual token connect


# ---------------------------------------------------------------------------
# Publish Status Constants
# ---------------------------------------------------------------------------
class PublishStatus:
    SUCCESS = "success"
    FAILED  = "failed"
    RETRIED = "retried"


# ---------------------------------------------------------------------------
# Worker/Task Status Constants
# ---------------------------------------------------------------------------
class WorkerStatus:
    SUCCESS = "success"
    FAILED  = "failed"
    RETRIED = "retried"
    SKIPPED = "skipped"


# ---------------------------------------------------------------------------
# GenerationLogDocument — AI Content Generation Events
# ---------------------------------------------------------------------------
class GenerationLogDocument(BaseModel):
    """
    Tracks every AI content generation event.
    Written by AIService after each Gemini API call.

    Fields:
        user_id      — Owner of the generation request
        post_id      — The post document this generation populated
        prompt       — Truncated prompt (max 500 chars) — no PII
        status       — success | failed
        duration_ms  — How long the Gemini call took
        model        — Gemini model used (e.g. gemini-2.5-flash)
        error_message — Only set on failure
        created_at   — UTC timestamp of the generation event
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    user_id: str
    post_id: Optional[str] = None

    # Prompt (truncated for privacy/storage)
    prompt: str = ""

    # Outcome
    status: str = PublishStatus.SUCCESS   # "success" | "failed"
    duration_ms: Optional[int] = None     # Gemini API round-trip time
    model: str = ""                        # e.g. "gemini-2.5-flash"
    error_message: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_none=True)


# ---------------------------------------------------------------------------
# PublishLogDocument — Instagram Publishing Events
# ---------------------------------------------------------------------------
class PublishLogDocument(BaseModel):
    """
    Records every Instagram publishing attempt (success or failure).
    Written by the Celery instagram_tasks.publish_to_instagram task.

    Fields:
        user_id            — Owner user
        post_id            — Published post
        schedule_id        — The schedule document that triggered this
        platform           — "instagram" (extensible for future platforms)
        status             — "success" | "failed"
        instagram_post_id  — The media ID returned by Meta Graph API (on success)
        error_message      — Error detail (on failure)
        execution_time_ms  — Full pipeline duration (container create → publish)
        published_at       — Actual UTC time the post went live (on success)
        created_at         — Record creation timestamp
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    user_id: str
    post_id: str
    schedule_id: str
    platform: str = "instagram"

    # Outcome
    status: str = PublishStatus.SUCCESS
    instagram_post_id: Optional[str] = None  # set on success
    error_message: Optional[str] = None       # set on failure

    # Timing
    execution_time_ms: Optional[int] = None
    published_at: Optional[datetime] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_none=True)


# ---------------------------------------------------------------------------
# WorkerLogDocument — Celery Task Execution Events
# ---------------------------------------------------------------------------
class WorkerLogDocument(BaseModel):
    """
    Records every Celery task execution for worker monitoring.
    Written by scheduler_tasks.execute_scheduled_post after each run.

    Fields:
        user_id          — The user whose post was being processed
        task_name        — Fully qualified Celery task name
        schedule_id      — Related schedule document
        post_id          — Related post document
        status           — "success" | "failed" | "retried" | "skipped"
        retry_count      — How many retries this task has had
        error_message    — Error detail (on failure)
        execution_time_ms — Wall clock time the task ran
        executed_at      — UTC time the task ran
        created_at       — Record creation timestamp
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    user_id: str
    task_name: str = ""
    schedule_id: Optional[str] = None
    post_id: Optional[str] = None

    # Outcome
    status: str = WorkerStatus.SUCCESS
    retry_count: int = 0
    error_message: Optional[str] = None

    # Timing
    execution_time_ms: Optional[int] = None
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_none=True)


# ---------------------------------------------------------------------------
# ActivityEventDocument — Unified User Activity Feed
# ---------------------------------------------------------------------------
class ActivityEventDocument(BaseModel):
    """
    Unified activity feed for the dashboard.
    Written from multiple services whenever a notable event occurs.

    This powers the "Recent Activity" panel on the frontend dashboard.

    Fields:
        user_id      — Owner user
        event_type   — ActivityEventType constant (e.g. "post_published")
        title        — Human-readable event title (e.g. "Post Published to Instagram")
        description  — Short subtitle / context string
        post_id      — Related post (nullable)
        schedule_id  — Related schedule (nullable)
        metadata     — Arbitrary additional data (platform, ig_post_id, etc.)
        created_at   — UTC timestamp of the event
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    user_id: str
    event_type: str                          # ActivityEventType constant
    title: str = ""                           # e.g. "Post Published to Instagram"
    description: str = ""                    # e.g. "@jituverse · just now"

    # Related documents (nullable — not all events have a post or schedule)
    post_id: Optional[str] = None
    schedule_id: Optional[str] = None

    # Arbitrary extra data for frontend rendering
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_none=True)
