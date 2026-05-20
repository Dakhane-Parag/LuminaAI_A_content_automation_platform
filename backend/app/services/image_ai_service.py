"""
Brandflow AI - AI Image Generation Service
============================================
Orchestrates the complete AI image generation workflow using Pollinations.ai.
Pollinations is completely free and requires no API key.

Responsibilities:
    1. Build a cinematic, Instagram-optimised prompt from post data
    2. Generate the Pollinations URL for the image
    3. Download the generated image bytes
    4. Save the image locally under generated_images/
    5. Return the local image path (caller updates MongoDB)

This service is intentionally decoupled from:
    - FastAPI (no Request/Response objects here)
    - HTTP concerns (no status codes in this layer)
    - MongoDB (the route calls PostService to update the document)
"""

import logging
import urllib.parse
from pathlib import Path

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Storage configuration
# ---------------------------------------------------------------------------

# Root of the backend project (two levels up from this file)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

# Directory where generated images are saved
IMAGES_DIR = _BACKEND_ROOT / "generated_images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# The URL prefix used when serving images as static files
IMAGES_URL_PREFIX = "/generated_images"


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
    Asynchronously download an image from a URL and save it to disk.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url, follow_redirects=True)
        if response.status_code != 200:
            raise RuntimeError(
                f"Failed to download image from API: HTTP {response.status_code}"
            )
        save_path.write_bytes(response.content)
    logger.info(f"Image downloaded and saved to: {save_path}")


# ---------------------------------------------------------------------------
# Image AI Service Class
# ---------------------------------------------------------------------------

class ImageAIService:
    """
    Orchestrates AI image generation using the free Pollinations API.
    """

    @staticmethod
    async def generate_and_save(
        post_id: str,
        caption: str,
        tone: str,
        design_style: str,
    ) -> str:
        """
        Full image generation + local storage workflow via Pollinations.
        """
        # ── Step 1: Build prompt ────────────────────────────────────────
        prompt = _build_image_prompt(caption, tone, design_style)

        # ── Step 2: Generate Pollinations URL ───────────────────────────
        encoded_prompt = urllib.parse.quote(prompt)
        # We add a random seed using post_id to ensure unique images, 
        # width/height for square IG format, and nologo=true.
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed={post_id}"

        logger.info(f"Generated Pollinations URL for post {post_id}")

        # ── Step 3: Download image ──────────────────────────────────────
        filename = f"post_{post_id}.png"
        save_path = IMAGES_DIR / filename

        try:
            await _download_image(image_url, save_path)
        except Exception as e:
            logger.error(f"Image download failed for post {post_id}: {e}")
            raise RuntimeError(f"Image generation failed: {e}") from e

        # ── Step 4: Return local URL path ───────────────────────────────
        local_url = f"{IMAGES_URL_PREFIX}/{filename}"
        logger.info(f"Image saved. Local path: {local_url}")

        return local_url
