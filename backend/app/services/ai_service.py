"""
Brandflow AI - AI Generation Service
=======================================
Orchestrates the complete AI content generation workflow using Google Gemini.

Responsibilities:
    1. Build an engineered prompt for Gemini
    2. Call the Gemini API asynchronously
    3. Parse and validate the raw JSON response
    4. Delegate post storage to the existing PostService (no DB logic here)
    5. Return a list of saved GeneratedPostVariant objects

This service is intentionally decoupled from:
    - FastAPI (no Request/Response objects)
    - HTTP concerns (no status codes here)
    - MongoDB (all DB writes go through PostService)

Architecture position:
    AI Route → AIService → (PostService → MongoDB)
                         ↘ (Gemini API)
"""

import json
import logging
import re
import time
from typing import List, Optional

import google.generativeai as genai
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.schemas.ai_schema import (
    GeneratedPostVariant,
    GeneratePostRequest,
    RawAIPost,
)
from app.schemas.post import PostCreate
from app.services.post_service import PostService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini client initialisation
# ---------------------------------------------------------------------------
# Configured once at module load time — reused across all requests.
# The API key is read from settings (which reads from .env).
genai.configure(api_key=settings.GEMINI_API_KEY)

_gemini_model = genai.GenerativeModel(model_name=settings.GEMINI_MODEL)


# ---------------------------------------------------------------------------
# Prompt Engineering
# ---------------------------------------------------------------------------

def _build_system_prompt(user_prompt: str, variations: int) -> str:
    """
    Build a highly engineered Gemini prompt that instructs the model to return
    a structured JSON object with exactly `variations` post variants.

    Design principles:
    - Explicitly define the JSON schema in the prompt to reduce hallucination.
    - Instruct Gemini to return ONLY JSON — no markdown fences, no prose.
    - Provide diverse style/tone combinations so variations are meaningfully different.
    - Cap hashtags at 10 per post (Instagram best practice).

    Args:
        user_prompt: The user's content brief.
        variations:  How many variations to generate.

    Returns:
        The full engineered prompt string to send to Gemini.
    """
    style_combinations = [
        {"design_style": "luxury",      "tone": "professional"},
        {"design_style": "startup",     "tone": "viral"},
        {"design_style": "minimal",     "tone": "inspirational"},
        {"design_style": "bold",        "tone": "humorous"},
        {"design_style": "elegant",     "tone": "educational"},
        {"design_style": "modern",      "tone": "casual"},
        {"design_style": "retro",       "tone": "inspirational"},
        {"design_style": "minimal",     "tone": "professional"},
    ]

    # Slice to match requested variations count
    selected_styles = style_combinations[:variations]
    styles_json = json.dumps(selected_styles, indent=2)

    return f"""You are an expert Instagram content strategist and copywriter for a premium AI SaaS platform.

Your task is to generate exactly {variations} Instagram post variations based on the content brief below.

CONTENT BRIEF:
{user_prompt}

STYLE ASSIGNMENTS (you MUST use exactly these design_style and tone values for each variation):
{styles_json}

STRICT OUTPUT RULES:
1. Return ONLY a valid JSON object. No markdown, no code fences, no explanations, no prose.
2. The JSON must have exactly one key: "posts" — an array of exactly {variations} objects.
3. Each object in "posts" must have EXACTLY these keys:
   - "caption"      : string, 1–2200 characters, engaging Instagram caption
   - "hashtags"     : array of strings, 5–10 hashtags WITHOUT the '#' symbol
   - "tone"         : string, exactly as specified in STYLE ASSIGNMENTS above
   - "design_style" : string, exactly as specified in STYLE ASSIGNMENTS above
   - "cta"          : string, a compelling 1-sentence call-to-action
4. Do NOT include any other keys.
5. Captions should feel authentic and platform-native for Instagram.
6. Hashtags must be relevant, lowercase, no spaces, no '#' prefix.
7. Each variation must feel distinctly different from the others.

EXAMPLE OUTPUT FORMAT (do not copy the content, only the structure):
{{
  "posts": [
    {{
      "caption": "...",
      "hashtags": ["tag1", "tag2", "tag3"],
      "tone": "professional",
      "design_style": "luxury",
      "cta": "..."
    }}
  ]
}}

Generate the {variations} posts now. Output ONLY the JSON:"""


# ---------------------------------------------------------------------------
# JSON Parsing & Validation
# ---------------------------------------------------------------------------

def _extract_json_from_response(raw_text: str) -> dict:
    """
    Safely extract a JSON object from the Gemini response text.

    Gemini sometimes wraps JSON in markdown code fences or adds a preamble.
    This function strips all of that and returns a pure Python dict.

    Args:
        raw_text: Raw string returned by Gemini.

    Returns:
        Parsed Python dict.

    Raises:
        ValueError: If no valid JSON object can be extracted.
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Gemini returned an empty response.")

    text = raw_text.strip()

    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # Attempt direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: extract the first {...} block using a regex
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from Gemini response. Raw output: {text[:500]}")


def _parse_ai_posts(raw_data: dict, expected_count: int) -> List[RawAIPost]:
    """
    Validate the parsed Gemini JSON against the RawAIPost schema.

    Handles:
    - Missing "posts" key
    - Non-list "posts" value
    - Individual post validation failures (skipped with a warning)

    Args:
        raw_data:       Parsed dict from Gemini.
        expected_count: How many posts were requested (used for logging).

    Returns:
        List of validated RawAIPost objects. May be shorter than expected_count
        if some variants failed validation.

    Raises:
        HTTPException 502 — if zero posts could be parsed.
    """
    posts_data = raw_data.get("posts")

    if not isinstance(posts_data, list) or len(posts_data) == 0:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service returned an unexpected response format. Please try again.",
        )

    valid_posts: List[RawAIPost] = []
    for i, post_data in enumerate(posts_data):
        try:
            valid_posts.append(RawAIPost(**post_data))
        except Exception as e:
            logger.warning(f"Skipping AI post variant {i+1} due to validation error: {e}")
            continue

    if not valid_posts:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI generated content could not be validated. Please try again.",
        )

    if len(valid_posts) < expected_count:
        logger.info(
            f"AI returned {len(valid_posts)} valid variants out of {expected_count} requested."
        )

    return valid_posts


# ---------------------------------------------------------------------------
# AI Service Class
# ---------------------------------------------------------------------------

class AIService:
    """
    Orchestrates AI-powered Instagram post generation using Google Gemini.

    Design principles:
    - Stateless — all inputs passed as arguments, no instance state.
    - DB-agnostic — delegates all persistence to PostService.
    - Fail-safe — malformed AI responses are handled gracefully.
    """

    @staticmethod
    async def generate_posts(
        db: AsyncIOMotorDatabase,
        request: GeneratePostRequest,
        user_id: str,
    ) -> List[GeneratedPostVariant]:
        """
        Full AI generation + storage workflow.

        Steps:
        1. Build an engineered prompt.
        2. Call the Gemini API (async via run_in_executor).
        3. Parse and validate the JSON response.
        4. For each valid variant, call PostService.create_post() to store it.
        5. Return a list of GeneratedPostVariant objects for the API response.

        Args:
            db:       Active MongoDB database handle.
            request:  Validated GeneratePostRequest from the route.
            user_id:  MongoDB ID string of the authenticated user.

        Returns:
            List of GeneratedPostVariant objects (saved drafts).

        Raises:
            HTTPException 503 — Gemini API key not configured.
            HTTPException 502 — Gemini API call failed or returned bad data.
            HTTPException 500 — Unexpected internal error.
        """
        # Guard: API key must be configured
        if not settings.GEMINI_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is not configured. Please contact support.",
            )

        # ── Step 1: Build prompt ──────────────────────────────────────
        prompt = _build_system_prompt(request.prompt, request.variations)
        gen_start_time = time.time()  # Track generation time for analytics

        # ── Step 2: Call Gemini API ───────────────────────────────────────
        try:
            logger.info(f"Calling Gemini API for user {user_id} | variations={request.variations}")

            # google-generativeai's generate_content is synchronous.
            # We call it directly — Motor/FastAPI's event loop handles concurrency
            # at the route level. For production scale, wrap in run_in_executor.
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: _gemini_model.generate_content(prompt),
            )

            raw_text: str = response.text

        except HTTPException:
            raise  # re-raise our own exceptions unchanged
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            # — Analytics: log generation failure —
            gen_duration_ms = int((time.time() - gen_start_time) * 1000)
            from app.services.analytics_service import AnalyticsService
            await AnalyticsService.log_generation_event_async(
                db=db, user_id=user_id, post_id=None,
                prompt=request.prompt, status="failed",
                duration_ms=gen_duration_ms, model=settings.GEMINI_MODEL,
                error_message=str(e)[:500],
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI service is temporarily unavailable. Please try again. ({type(e).__name__})",
            )

        # ── Step 3: Parse + validate AI response ─────────────────────────
        try:
            raw_data = _extract_json_from_response(raw_text)
        except ValueError as e:
            logger.error(f"JSON extraction failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI returned an invalid response format. Please try again.",
            )

        ai_posts = _parse_ai_posts(raw_data, request.variations)

        # ── Step 4: Store each variant via PostService ────────────────────
        saved_variants: List[GeneratedPostVariant] = []

        for ai_post in ai_posts:
            # Build a PostCreate from the AI-generated data
            # CTA is appended to the caption with a newline separator
            full_caption = ai_post.caption
            if ai_post.cta:
                full_caption = f"{ai_post.caption}\n\n{ai_post.cta}"

            post_create = PostCreate(
                prompt=request.prompt,
                caption=full_caption,
                hashtags=ai_post.hashtags,
                design_style=ai_post.design_style,
                tone=ai_post.tone,
                image_url=None,
                scheduled_time=None,
            )

            try:
                saved_post = await PostService.create_post(
                    db=db,
                    post_data=post_create,
                    user_id=user_id,
                )

                saved_variants.append(
                    GeneratedPostVariant(
                        id=saved_post.id,
                        caption=ai_post.caption,    # caption without CTA for clean display
                        hashtags=saved_post.hashtags,
                        tone=saved_post.tone,
                        design_style=saved_post.design_style,
                        cta=ai_post.cta,
                        status=saved_post.status,
                    )
                )

            except HTTPException as e:
                # Log and skip this variant rather than failing the entire request
                logger.error(f"Failed to save AI post variant: {e.detail}")
                continue

        if not saved_variants:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI generated content but could not save any drafts. Please try again.",
            )

        # ── Analytics: log successful generation ──────────────────────────
        gen_duration_ms = int((time.time() - gen_start_time) * 1000)
        first_post_id = saved_variants[0].id if saved_variants else None
        from app.services.analytics_service import AnalyticsService
        await AnalyticsService.log_generation_event_async(
            db=db, user_id=user_id,
            post_id=str(first_post_id) if first_post_id else None,
            prompt=request.prompt, status="success",
            duration_ms=gen_duration_ms, model=settings.GEMINI_MODEL,
        )
        await AnalyticsService.log_activity_event_async(
            db=db, user_id=user_id,
            event_type="post_generated",
            title=f"AI Generated {len(saved_variants)} Post Variant(s)",
            description=f"Prompt: {request.prompt[:80]}{'...' if len(request.prompt) > 80 else ''}",
            post_id=str(first_post_id) if first_post_id else None,
            metadata={"count": len(saved_variants), "model": settings.GEMINI_MODEL},
        )

        logger.info(
            f"Generated and saved {len(saved_variants)} drafts for user {user_id}."
        )

        return saved_variants
