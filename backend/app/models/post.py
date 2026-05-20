"""
Brandflow AI - Post Document Model
=====================================
Defines the shape of a Post document as stored in MongoDB.

Note: This is NOT a Pydantic schema for API I/O — it is a dataclass-style
      representation that mirrors the MongoDB 'posts' collection structure.
      Pydantic I/O schemas live in app/schemas/post.py.

Post lifecycle:
    draft → scheduled → published
"""

from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field

from app.models.user import PyObjectId  # reuse the shared ObjectId bridge


# ---------------------------------------------------------------------------
# Status Enum (plain string constants — avoids Enum serialisation quirks)
# ---------------------------------------------------------------------------
class PostStatus:
    """Valid values for the Post.status field."""
    DRAFT      = "draft"
    SCHEDULED  = "scheduled"
    PUBLISHED  = "published"

    ALL_VALUES = {DRAFT, SCHEDULED, PUBLISHED}


# ---------------------------------------------------------------------------
# Post MongoDB Document
# ---------------------------------------------------------------------------
class PostDocument(BaseModel):
    """
    Mirrors the MongoDB 'posts' collection document structure.
    Used internally by services when reading/writing to the database.

    Fields:
        id             — MongoDB ObjectId (serialised as string)
        user_id        — ObjectId of the owning user (FK reference to users)
        prompt         — Original AI prompt submitted by the user
        caption        — Generated or user-supplied caption text
        hashtags       — List of hashtag strings (without '#' prefix)
        design_style   — Visual style hint (luxury / minimal / startup / bold / etc.)
        tone           — Writing tone (viral / professional / educational / humorous / etc.)
        status         — Workflow state: draft | scheduled | published
        image_url      — S3/CDN URL for the generated post image (set by image pipeline)
        scheduled_time — UTC datetime when the post should be auto-published
        created_at     — UTC timestamp of document creation
        updated_at     — UTC timestamp of last modification
    """

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    # Ownership
    user_id: str  # stored as plain string ObjectId of the owner

    # Content
    prompt: str = ""
    caption: str = ""
    hashtags: List[str] = Field(default_factory=list)

    # Style & tone
    design_style: str = ""
    tone: str = ""

    # Workflow
    status: str = PostStatus.DRAFT
    image_url: Optional[str] = None
    scheduled_time: Optional[datetime] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        # Allow population by field name AND alias (_id)
        "populate_by_name": True,
        # Allow arbitrary types (ObjectId)
        "arbitrary_types_allowed": True,
        # Serialise ObjectId → string in JSON
        "json_encoders": {ObjectId: str},
    }

    def to_dict(self) -> dict:
        """Return a plain dict suitable for inserting into MongoDB."""
        return self.model_dump(by_alias=True, exclude_none=True)
