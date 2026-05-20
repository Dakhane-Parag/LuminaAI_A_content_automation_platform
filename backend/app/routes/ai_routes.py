"""
Brandflow AI - AI Content Generation Routes
=============================================
HTTP layer for the AI generation workflow.
All endpoints are JWT-protected and scoped to the authenticated user.

Endpoints:
    POST /api/v1/ai/generate-posts  — Generate AI Instagram post drafts

Design:
    - This router is intentionally separate from post_routes.py.
    - AI generation is a distinct workflow, not just another CRUD operation.
    - All AI + storage logic lives in AIService — routes stay thin.
"""

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.connection import get_database
from app.dependencies.auth import get_current_active_user
from app.models.user import UserDocument
from app.schemas.ai_schema import AIGenerateResponse, GeneratePostRequest
from app.services.ai_service import AIService

router = APIRouter(
    prefix="/ai",
    tags=["AI Content Generation"],
)


# ---------------------------------------------------------------------------
# POST /ai/generate-posts
# ---------------------------------------------------------------------------
@router.post(
    "/generate-posts",
    response_model=AIGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI Instagram post drafts from a prompt",
    responses={
        201: {"description": "Post drafts generated and saved successfully"},
        401: {"description": "Missing or invalid JWT token"},
        422: {"description": "Invalid request body (prompt too short/long, etc.)"},
        502: {"description": "Gemini API returned an invalid or empty response"},
        503: {"description": "AI service is not configured"},
    },
)
async def generate_posts(
    request: GeneratePostRequest,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> AIGenerateResponse:
    """
    Generate multiple AI-powered Instagram post drafts from a single prompt.

    **Workflow:**
    1. Sends your prompt to the Gemini AI model.
    2. Gemini generates multiple post variations with different tones and styles.
    3. Each variation is automatically saved as a **draft** in MongoDB.
    4. Returns all generated drafts in a structured, frontend-ready format.

    **Generated variations include:**
    - Unique Instagram captions
    - Relevant hashtags (5–10 per post)
    - A compelling call-to-action (CTA)
    - Different tone: `viral`, `professional`, `educational`, `inspirational`, etc.
    - Different design style: `luxury`, `startup`, `minimal`, `bold`, etc.

    **After generation:**
    - Use the returned `id` fields to retrieve, update, or delete individual drafts
      via the standard `POST/GET/PUT/DELETE /api/v1/posts` endpoints.

    **Note:** Image generation is not included in this step. Images will be
    generated and attached in a later workflow stage.
    """
    user_id = str(current_user.id)

    saved_variants = await AIService.generate_posts(
        db=db,
        request=request,
        user_id=user_id,
    )

    count = len(saved_variants)
    return AIGenerateResponse(
        success=True,
        message=f"{count} post draft{'s' if count != 1 else ''} generated and saved successfully.",
        prompt=request.prompt,
        count=count,
        posts=saved_variants,
    )
