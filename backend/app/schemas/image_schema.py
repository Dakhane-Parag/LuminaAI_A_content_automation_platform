"""
Brandflow AI - Image Generation Pydantic Schemas
==================================================
Schemas for the AI image generation workflow (Stair 8).

These are deliberately separate from post and AI text schemas
to keep each workflow independently evolvable.

Schema hierarchy:
    ImageGenerateResponse — API response after image is generated & stored
"""

from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Response Schema
# ---------------------------------------------------------------------------
class ImageGenerateResponse(BaseModel):
    """
    API response for POST /api/v1/images/generate-image/{post_id}.

    Returned after the image has been generated, saved locally,
    and the MongoDB post document has been updated.

    Example:
        {
            "success": true,
            "message": "Image generated and saved successfully.",
            "post_id": "664b4c10abc123456789def0",
            "image_url": "/generated_images/post_664b4c10abc123456789def0.png",
            "status": "ready"
        }
    """

    success: bool = True
    message: str
    post_id: str = Field(..., description="MongoDB ID of the updated post")
    image_url: str = Field(..., description="Local path to the generated image (served as static file)")
    status: str = Field(default="ready", description="Post status after image attachment")
