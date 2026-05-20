"""
Brandflow AI - AI Image Generation Service
============================================
Orchestrates the complete AI image generation workflow using Pollinations.ai
for image generation and Amazon S3 for production cloud storage.

Responsibilities:
    1. Build a cinematic, Instagram-optimised prompt from post data
    2. Generate the Pollinations URL for the image
    3. Download the generated image as a temp file
    4. Upload the temp file to Amazon S3 via StorageService
    5. Return the public S3 URL (caller updates MongoDB)
    6. Temp file is cleaned up automatically after S3 upload

This service is intentionally decoupled from:
    - FastAPI (no Request/Response objects here)
    - HTTP concerns (no status codes in this layer)
    - MongoDB (the route calls PostService to update the document)

Storage architecture:
    ImageAIService → Pollinations API  (generates image)
                   → temp local file   (intermediate storage)
                   → StorageService    (uploads to S3, cleans temp)
                   → returns S3 URL
"""

import logging
import urllib.parse
from pathlib import Path

import httpx

from app.config.settings import settings
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Temp storage configuration
# ---------------------------------------------------------------------------

# Root of the backend project (two levels up from this file)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

# Temp directory for intermediate image files (cleaned up after S3 upload)
TEMP_IMAGES_DIR = _BACKEND_ROOT / "generated_images"
TEMP_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Prompt Engineering
# ---------------------------------------------------------------------------

def _build_image_prompt(caption: str, tone: str, design_style: str) -> str:
    """
    Build a high-quality cinematic image generation prompt using the post's
    caption, tone, and design style.
    """
    tone_moods: dict[str, str] = {
        "viral":          "high-energy, bold, eye-catching, dynamic composition",
        "professional":   "clean, authoritative, sophisticated, corporate premium",
        "educational":    "clear, informative, bright, structured layout",
        "humorous":       "playful, vibrant, fun, light-hearted atmosphere",
        "inspirational":  "uplifting, golden hour lighting, motivational energy",
        "casual":         "relaxed, warm, approachable, lifestyle photography feel",
    }

    style_aesthetics: dict[str, str] = {
        "luxury":   "black and gold color palette, ultra-premium materials, refined elegance, high-end fashion editorial",
        "startup":  "modern tech office, holographic UI elements, neon blue and white, Silicon Valley aesthetic",
        "minimal":  "clean white background, geometric shapes, lots of negative space, Bauhaus-inspired",
        "bold":     "high contrast, saturated colors, strong typography impact, graphic design poster style",
        "elegant":  "soft gradients, pastel tones, refined serif typography, fashion magazine quality",
        "modern":   "sleek surfaces, glass morphism, gradient overlays, contemporary digital art",
        "retro":    "warm vintage film grain, muted earth tones, nostalgic 70s-80s poster aesthetic",
    }

    mood = tone_moods.get(tone.lower(), "premium, modern, polished visual")
    aesthetic = style_aesthetics.get(design_style.lower(), "modern, clean, professional Instagram aesthetic")

    subject_hint = caption[:80].strip() if caption else "premium product launch"
    subject_hint = subject_hint.split("#")[0].strip()

    prompt = (
        f"{subject_hint}, "
        f"{aesthetic}, "
        f"{mood}, "
        f"cinematic lighting, 8K ultra detailed, Instagram post composition, "
        f"professional photography, award-winning visual design, "
        f"no text overlay, no watermarks, square format social media content"
    )

    logger.debug(f"Generated image prompt: {prompt[:120]}...")
    return prompt


# ---------------------------------------------------------------------------
# Image Download Helper
# ---------------------------------------------------------------------------

async def _download_image(url: str, save_path: Path) -> None:
    """
    Asynchronously download an image from a URL and save it to disk as a
    temporary file ready for S3 upload.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url, follow_redirects=True)
        if response.status_code != 200:
            raise RuntimeError(
                f"Failed to download image from Pollinations: HTTP {response.status_code}"
            )
        save_path.write_bytes(response.content)
    logger.info(f"Temp image downloaded to: {save_path}")


# ---------------------------------------------------------------------------
# Image AI Service Class
# ---------------------------------------------------------------------------

class ImageAIService:
    """
    Orchestrates AI image generation using the free Pollinations API,
    with production cloud storage via Amazon S3.

    Flow:
        1. Generate cinematic prompt from post data
        2. Fetch image from Pollinations API
        3. Save locally as a temp file
        4. Upload temp file to S3 via StorageService
        5. Return the public S3 URL
        (temp file is automatically cleaned up by StorageService)
    """

    @staticmethod
    async def generate_and_save(
        post_id: str,
        user_id: str,
        caption: str,
        tone: str,
        design_style: str,
    ) -> str:
        """
        Full image generation + S3 cloud storage workflow.

        Args:
            post_id:      MongoDB string ID of the post (used for S3 filename).
            user_id:      MongoDB string ID of the owning user (used for S3 folder).
            caption:      Post caption (for prompt subject matter).
            tone:         Post tone (for mood direction).
            design_style: Post design style (for visual aesthetic).

        Returns:
            Public S3 HTTPS URL (e.g. https://bucket.s3.region.amazonaws.com/generated/user_id/post_id.png)
            Falls back to a local static URL if AWS is not configured (dev mode).

        Raises:
            RuntimeError: Image download or S3 upload failed.
        """
        # ── Step 1: Build cinematic prompt ─────────────────────────────
        prompt = _build_image_prompt(caption, tone, design_style)

        # ── Step 2: Generate Pollinations request URL ───────────────────
        encoded_prompt = urllib.parse.quote(prompt)
        pollinations_url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}"
            f"?width=1024&height=1024&nologo=true&seed={post_id}"
        )
        logger.info(f"Requesting image from Pollinations for post {post_id}")

        # ── Step 3: Download to temp file ───────────────────────────────
        filename = f"post_{post_id}.png"
        temp_path = TEMP_IMAGES_DIR / filename

        try:
            await _download_image(pollinations_url, temp_path)
        except Exception as e:
            logger.error(f"Image download failed for post {post_id}: {e}")
            raise RuntimeError(f"Image generation failed: {e}") from e

        # ── Step 4: Upload to S3 (or fall back to local) ────────────────
        # If AWS is not configured, serve images locally (development mode).
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_BUCKET_NAME:
            logger.warning(
                "AWS credentials not configured — serving image from local storage. "
                "Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and "
                "AWS_BUCKET_NAME to .env for production S3 storage."
            )
            local_url = f"/generated_images/{filename}"
            logger.info(f"[DEV] Image available at: {local_url}")
            return local_url

        # Production: upload temp file to S3, cleanup local file
        try:
            s3_url = await StorageService.upload_image(
                local_path=temp_path,
                user_id=user_id,
                post_id=post_id,
                cleanup_local=True,   # delete temp file after S3 upload
            )
        except RuntimeError as e:
            logger.error(f"S3 upload failed for post {post_id}: {e}")
            raise RuntimeError(f"Cloud upload failed: {e}") from e

        return s3_url
