"""
Brandflow AI - AI Image Generation Routes
==========================================
HTTP layer for the AI image generation workflow.
All endpoints are JWT-protected and ownership-validated.

Endpoints:
    POST /api/v1/images/generate-image/{post_id}
        — Generate an AI image for a selected post draft,
          save it locally, and update the post's MongoDB document.

Design:
    - Separate router from ai_routes.py (different workflow).
    - All generation + storage logic lives in ImageAIService.
    - MongoDB updates go through the existing PostService.
    - Routes stay thin — just auth, delegation, and response assembly.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.connection import get_database
from app.dependencies.auth import get_current_active_user
from app.models.user import UserDocument
from app.schemas.image_schema import ImageGenerateResponse
from app.schemas.post import PostUpdate
from app.services.image_ai_service import ImageAIService
from app.services.post_service import PostService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/images",
    tags=["AI Image Generation"],
)


# ---------------------------------------------------------------------------
# POST /images/generate-image/{post_id}
# ---------------------------------------------------------------------------
@router.post(
    "/generate-image/{post_id}",
    response_model=ImageGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AI image for a selected post draft",
    responses={
        201: {"description": "Image generated, saved locally, and post updated"},
        400: {"description": "Invalid post ID format"},
        401: {"description": "Missing or invalid JWT token"},
        404: {"description": "Post not found or not owned by you"},
        503: {"description": "Replicate API token not configured"},
        502: {"description": "Image generation or download failed"},
    },
)
async def generate_image_for_post(
    post_id: str,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ImageGenerateResponse:
    """
    Generate a cinematic AI image for an existing post draft using Replicate FLUX.

    **Workflow:**
    1. Fetches the selected post draft from MongoDB (validates ownership).
    2. Builds a high-quality cinematic image prompt using the post's `caption`,
       `tone`, and `design_style`.
    3. Sends the prompt to the **Replicate FLUX Schnell** model.
    4. Downloads the generated image and saves it to `generated_images/`.
    5. Updates the post's `image_url` and `status` → `"ready"` in MongoDB.
    6. Returns the local image URL for immediate frontend use.

    **Use this endpoint AFTER** generating text drafts via
    `POST /api/v1/ai/generate-posts` and selecting your preferred variation.

    **Note:** Images are currently stored locally. S3 integration will be
    added in Stair 9.
    """
    user_id = str(current_user.id)

    # ── Step 1: Fetch & validate the post (ownership enforced by PostService) ──
    try:
        post = await PostService.get_post_by_id(
            db=db,
            post_id=post_id,
            user_id=user_id,
        )
    except HTTPException:
        raise  # Re-raise 400/404 directly

    # ── Step 2 & 3 & 4: Generate image + save locally ─────────────────────
    try:
        local_image_url = await ImageAIService.generate_and_save(
            post_id=post_id,
            caption=post.caption,
            tone=post.tone,
            design_style=post.design_style,
        )
    except RuntimeError as e:
        # API failure or download failure
        logger.error(f"Image generation failed for post {post_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Image generation failed. Please try again. ({str(e)[:120]})",
        )

    # ── Step 5: Update MongoDB — only image_url and status ────────────────
    await PostService.update_post(
        db=db,
        post_id=post_id,
        update_data=PostUpdate(
            image_url=local_image_url,
            status="ready",
        ),
        user_id=user_id,
    )

    logger.info(f"Post {post_id} updated with image_url={local_image_url}")

    # ── Step 6: Return response ────────────────────────────────────────────
    return ImageGenerateResponse(
        success=True,
        message="Image generated and saved successfully.",
        post_id=post_id,
        image_url=local_image_url,
        status="ready",
    )
