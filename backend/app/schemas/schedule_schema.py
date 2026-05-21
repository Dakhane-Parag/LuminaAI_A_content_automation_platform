"""
Brandflow AI - Schedule Pydantic Schemas
=========================================
Request/response schemas for the post scheduling workflow.

Schema hierarchy:
    SchedulePostRequest    — API input: scheduled_time only
    SchedulePostResponse   — API output: confirmation + schedule details
    ScheduledPostDocument  — MongoDB document mirror for scheduled_posts collection
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Input Schema — POST /schedule-post/{post_id}
# ---------------------------------------------------------------------------
class SchedulePostRequest(BaseModel):
    """
    Request body for scheduling a post for future execution.
    The client supplies a UTC datetime in ISO 8601 format.
    """

    scheduled_time: datetime = Field(
        ...,
        description="UTC datetime when the post automation should execute (ISO 8601 format)",
        examples=["2026-08-20T21:00:00Z"],
    )

    @field_validator("scheduled_time")
    @classmethod
    def must_be_in_future(cls, v: datetime) -> datetime:
        """Reject any schedule time that is already in the past."""
        # Make v timezone-aware if it's naive (assume UTC)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if v <= now:
            raise ValueError(
                "scheduled_time must be a future datetime. "
                f"Received: {v.isoformat()} which is in the past."
            )
        return v


# ---------------------------------------------------------------------------
# Output Schema — POST /schedule-post/{post_id}
# ---------------------------------------------------------------------------
class SchedulePostResponse(BaseModel):
    """
    API response confirming that a post has been scheduled.
    Returns schedule metadata and the Celery task ID for traceability.
    """

    success: bool = True
    message: str
    schedule_id: str = Field(..., description="MongoDB document ID of the schedule record")
    post_id: str
    user_id: str
    scheduled_time: datetime
    status: str = Field(..., description="Current schedule status: pending | executed | failed")
    celery_task_id: Optional[str] = Field(
        default=None,
        description="Celery task ID (for tracking in Redis / Flower)",
    )


# ---------------------------------------------------------------------------
# MongoDB Document Mirror
# ---------------------------------------------------------------------------
class ScheduledPostDocument(BaseModel):
    """
    Mirrors the MongoDB 'scheduled_posts' collection document structure.
    Used internally by ScheduleService when reading/writing schedules.

    Fields:
        user_id        — ObjectId string of the owning user
        post_id        — ObjectId string of the post to schedule
        scheduled_time — UTC datetime when the task should execute
        status         — pending | executed | failed
        celery_task_id — Celery async result ID for introspection
        created_at     — When the schedule was created
        executed_at    — When the Celery task actually ran (null until then)
        error_message  — Set on failure to describe what went wrong
    """

    user_id: str
    post_id: str
    scheduled_time: datetime
    status: str = "pending"
    celery_task_id: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    executed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    def to_dict(self) -> dict:
        """Serialize to a plain dict suitable for MongoDB insertion."""
        return self.model_dump(exclude_none=False)
