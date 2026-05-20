"""
Brandflow AI - AI Generation Pydantic Schemas
===============================================
Schemas for the AI content generation workflow.

These are separate from the Post CRUD schemas to keep the AI generation
API contract independent and evolvable without touching the post CRUD layer.

Schema hierarchy:
    GeneratePostRequest   — API input  (prompt only)
    GeneratedPostVariant  — One AI-generated post variation (not yet stored)
    AIGenerateResponse    — Final API response with stored PostResponse objects
    RawAIPost             — Internal schema for parsing the raw Gemini JSON output
"""

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Request Schema
# ---------------------------------------------------------------------------
class GeneratePostRequest(BaseModel):
    """
    Schema for POST /api/v1/ai/generate-posts.

    The user only needs to supply a prompt — the AI handles everything else.
    Optionally they can request a specific number of variations.
    """

    prompt: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Content brief or idea to generate Instagram posts for",
        examples=["A luxury watch brand post targeting professionals aged 30-45"],
    )
    variations: int = Field(
        default=4,
        ge=1,
        le=8,
        description="Number of post variations to generate (1–8). Defaults to 4.",
    )

    @field_validator("prompt")
    @classmethod
    def strip_prompt(cls, v: str) -> str:
        """Remove leading/trailing whitespace from the prompt."""
        return v.strip()


# ---------------------------------------------------------------------------
# Internal schema — raw Gemini output parser
# ---------------------------------------------------------------------------
class RawAIPost(BaseModel):
    """
    Internal-only schema used to parse and validate a single post variation
    from the raw JSON response returned by the Gemini API.

    All fields are Optional to allow graceful fallbacks when Gemini
    omits a field or returns an unexpected format.
    """

    caption: Optional[str] = ""
    hashtags: Optional[List[str]] = Field(default_factory=list)
    tone: Optional[str] = ""
    design_style: Optional[str] = ""
    cta: Optional[str] = ""

    @field_validator("hashtags", mode="before")
    @classmethod
    def clean_hashtags(cls, v) -> List[str]:
        """Normalise hashtags — strip '#' prefix and whitespace."""
        if not isinstance(v, list):
            return []
        cleaned = []
        seen: set = set()
        for tag in v:
            if isinstance(tag, str):
                tag = tag.strip().lstrip("#").lower()
                if tag and tag not in seen:
                    seen.add(tag)
                    cleaned.append(tag)
        return cleaned

    @field_validator("caption", "tone", "design_style", "cta", mode="before")
    @classmethod
    def coerce_to_str(cls, v) -> str:
        """Ensure string fields are always strings (Gemini can return None)."""
        return str(v).strip() if v is not None else ""


# ---------------------------------------------------------------------------
# Response Schemas — returned to the frontend
# ---------------------------------------------------------------------------
class GeneratedPostVariant(BaseModel):
    """
    A single AI-generated post variation as returned in the API response.
    This is the 'preview' shape before the post is saved as a PostDocument.

    Note: This mirrors what is stored in MongoDB, but includes 'cta' as a
    top-level field for frontend convenience. The CTA is embedded in the
    caption when stored.
    """

    id: str = Field(..., description="MongoDB document ID of the saved draft")
    caption: str
    hashtags: List[str]
    tone: str
    design_style: str
    cta: str
    status: str = "draft"


class AIGenerateResponse(BaseModel):
    """
    Final API response for POST /api/v1/ai/generate-posts.

    Contains all generated variations that were saved as drafts in MongoDB.

    Example:
        {
            "success": true,
            "message": "4 post drafts generated and saved successfully.",
            "prompt": "Luxury watch brand...",
            "count": 4,
            "posts": [ ...GeneratedPostVariant objects... ]
        }
    """

    success: bool = True
    message: str
    prompt: str
    count: int
    posts: List[GeneratedPostVariant]
