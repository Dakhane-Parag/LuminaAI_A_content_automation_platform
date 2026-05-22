"""
Brandflow AI - User Document Model
=====================================
Defines the shape of a User document as stored in MongoDB.

Note: This is NOT a Pydantic schema for API I/O — it is a dataclass-style
      representation that mirrors the MongoDB document structure.
      Pydantic schemas live in app/schemas/.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field


class PyObjectId(ObjectId):
    """
    Custom type that bridges BSON ObjectId with Pydantic v2.
    Allows MongoDB _id fields to be serialised as plain strings in JSON.
    """

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _info=None):
        if not ObjectId.is_valid(v):
            raise ValueError(f"Invalid ObjectId: {v}")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema

        return core_schema.no_info_plain_validator_function(
            cls.validate,
            serialization=core_schema.to_string_ser_schema(),
        )


class UserDocument(BaseModel):
    """
    Mirrors the MongoDB 'users' collection document structure.
    Used internally by services when reading/writing to the database.

    Fields:
        id          — MongoDB ObjectId (serialised as string)
        name        — User's display name
        email       — Unique email address (indexed)
        password    — Bcrypt-hashed password (NEVER returned in API responses)
        is_active   — Soft-disable accounts without deletion
        created_at  — UTC timestamp of account creation
        updated_at  — UTC timestamp of last update
    """

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    email: EmailStr
    password: str  # always hashed — never store plaintext
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # ------------------------------------------------------------------
    # Social Account Connections (extensible for LinkedIn, TikTok, etc.)
    # ------------------------------------------------------------------
    # Instagram / Meta
    instagram_connected: bool = False
    instagram_access_token: Optional[str] = None   # Long-lived token — NEVER returned in API responses
    facebook_page_id: Optional[str] = None          # Facebook Page ID linked to Instagram
    instagram_business_id: Optional[str] = None     # Instagram Business Account ID
    token_created_at: Optional[datetime] = None     # When the token was last refreshed

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
        data = self.model_dump(by_alias=True, exclude_none=True)
        return data
