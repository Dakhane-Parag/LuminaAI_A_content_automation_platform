"""
Brandflow AI - Instagram Graph API Service
===========================================
Handles all communication with the Meta Graph API for Instagram publishing.

This service is intentionally kept stateless and framework-agnostic so it
can be imported by both FastAPI routes (for OAuth) AND Celery tasks (for
background publishing) without pulling in asyncio event loop dependencies.

Meta Graph API publishing flow (2-step):
    Step 1: Create a media container
            POST /{ig_business_id}/media
            → returns: creation_id

    Step 2: Publish the container
            POST /{ig_business_id}/media_publish
            → returns: instagram_post_id (the live media ID)

Reference:
    https://developers.facebook.com/docs/instagram-api/guides/content-publishing
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Meta Graph API base URL
# ---------------------------------------------------------------------------
GRAPH_API_BASE = "https://graph.facebook.com/v21.0"

# Max seconds to wait between container creation and publish (Meta requirement)
CONTAINER_STATUS_POLL_INTERVAL = 5   # seconds
CONTAINER_STATUS_MAX_ATTEMPTS  = 12  # 12 × 5s = 60s max wait


class InstagramAPIError(Exception):
    """Raised when Meta Graph API returns an error response."""
    def __init__(self, message: str, code: Optional[int] = None):
        super().__init__(message)
        self.code = code


class InstagramService:
    """
    Stateless service wrapping all Meta Graph API calls for Instagram.

    Usage in Celery tasks (sync context):
        result = InstagramService.publish_post_sync(
            access_token=...,
            instagram_business_id=...,
            image_url=...,
            caption=...,
        )

    Usage in FastAPI routes (async context):
        result = await InstagramService.validate_token(access_token)
    """

    # ------------------------------------------------------------------
    # Token validation & account info
    # ------------------------------------------------------------------
    @staticmethod
    def validate_token_sync(access_token: str) -> dict:
        """
        Validate a Meta access token and return basic user info.
        Uses /me endpoint — simple connectivity check.

        Returns:
            {"id": "...", "name": "..."}

        Raises:
            InstagramAPIError on invalid/expired token.
        """
        response = httpx.get(
            f"{GRAPH_API_BASE}/me",
            params={"access_token": access_token, "fields": "id,name"},
            timeout=15.0,
        )
        data = response.json()
        if "error" in data:
            raise InstagramAPIError(
                f"Token validation failed: {data['error'].get('message', 'Unknown error')}",
                code=data["error"].get("code"),
            )
        return data

    @staticmethod
    def get_instagram_username_sync(
        instagram_business_id: str,
        access_token: str,
    ) -> Optional[str]:
        """
        Fetch the Instagram username for a given Business Account ID.
        Returns None if the request fails (non-critical — just for display).
        """
        try:
            response = httpx.get(
                f"{GRAPH_API_BASE}/{instagram_business_id}",
                params={
                    "fields": "username",
                    "access_token": access_token,
                },
                timeout=15.0,
            )
            data = response.json()
            return data.get("username")
        except Exception as e:
            logger.warning(f"Could not fetch Instagram username: {e}")
            return None

    @staticmethod
    def get_pages_sync(access_token: str) -> list:
        """
        Fetch all Facebook Pages managed by the authenticated user.
        Used during manual token connect to show available pages.

        Returns:
            List of dicts: [{"id": "...", "name": "...", "access_token": "..."}]
        """
        response = httpx.get(
            f"{GRAPH_API_BASE}/me/accounts",
            params={"access_token": access_token, "fields": "id,name,access_token"},
            timeout=15.0,
        )
        data = response.json()
        if "error" in data:
            raise InstagramAPIError(
                f"Failed to fetch Facebook Pages: {data['error'].get('message')}",
                code=data["error"].get("code"),
            )
        return data.get("data", [])

    # ------------------------------------------------------------------
    # Media Container (Step 1 of Instagram publish flow)
    # ------------------------------------------------------------------
    @staticmethod
    def create_media_container_sync(
        instagram_business_id: str,
        access_token: str,
        image_url: str,
        caption: str,
    ) -> str:
        """
        Create an Instagram media container from an S3 image URL.

        IMPORTANT: image_url MUST be a public HTTPS URL.
        Use existing S3 bucket URLs from the image generation pipeline.

        Args:
            instagram_business_id: The Instagram Business Account ID.
            access_token:          Long-lived Meta User Access Token.
            image_url:             Public HTTPS URL of the image (S3 URL).
            caption:               Post caption text (with hashtags).

        Returns:
            creation_id — the container ID to use in Step 2.

        Raises:
            InstagramAPIError — if Meta API returns an error.
        """
        logger.info(
            f"[Instagram] Creating media container for IG Business ID: {instagram_business_id}"
        )

        response = httpx.post(
            f"{GRAPH_API_BASE}/{instagram_business_id}/media",
            data={
                "image_url": image_url,
                "caption": caption,
                "access_token": access_token,
            },
            timeout=30.0,
        )
        data = response.json()

        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            error_code = data["error"].get("code")
            logger.error(f"[Instagram] Media container creation failed: {error_msg} (code: {error_code})")
            raise InstagramAPIError(
                f"Media container creation failed: {error_msg}",
                code=error_code,
            )

        creation_id = data.get("id")
        if not creation_id:
            raise InstagramAPIError("Meta API returned no creation_id in media container response.")

        logger.info(f"[Instagram] Media container created: {creation_id}")
        return creation_id

    # ------------------------------------------------------------------
    # Container Status Check (Meta recommends polling before publish)
    # ------------------------------------------------------------------
    @staticmethod
    def wait_for_container_ready_sync(
        creation_id: str,
        access_token: str,
    ) -> bool:
        """
        Poll the container status until it is FINISHED (ready to publish).

        Meta processes the image asynchronously after container creation.
        Attempting to publish before it's FINISHED may result in an error.

        Possible status values: IN_PROGRESS, FINISHED, ERROR

        Returns:
            True if FINISHED, False if ERROR or timed out.
        """
        for attempt in range(CONTAINER_STATUS_MAX_ATTEMPTS):
            try:
                response = httpx.get(
                    f"{GRAPH_API_BASE}/{creation_id}",
                    params={
                        "fields": "status_code",
                        "access_token": access_token,
                    },
                    timeout=15.0,
                )
                data = response.json()
                status_code = data.get("status_code", "")

                logger.info(
                    f"[Instagram] Container {creation_id} status: {status_code} "
                    f"(attempt {attempt + 1}/{CONTAINER_STATUS_MAX_ATTEMPTS})"
                )

                if status_code == "FINISHED":
                    return True
                elif status_code == "ERROR":
                    logger.error(f"[Instagram] Container {creation_id} entered ERROR state.")
                    return False

            except Exception as e:
                logger.warning(f"[Instagram] Status poll attempt {attempt + 1} failed: {e}")

            time.sleep(CONTAINER_STATUS_POLL_INTERVAL)

        logger.error(f"[Instagram] Container {creation_id} did not reach FINISHED state in time.")
        return False

    # ------------------------------------------------------------------
    # Publish Media Container (Step 2 of Instagram publish flow)
    # ------------------------------------------------------------------
    @staticmethod
    def publish_container_sync(
        instagram_business_id: str,
        access_token: str,
        creation_id: str,
    ) -> str:
        """
        Publish a FINISHED media container to Instagram.

        Args:
            instagram_business_id: The Instagram Business Account ID.
            access_token:          Long-lived Meta User Access Token.
            creation_id:           The container ID from Step 1.

        Returns:
            instagram_post_id — the published media ID (e.g. "17854360229135492").

        Raises:
            InstagramAPIError — if Meta API returns an error.
        """
        logger.info(
            f"[Instagram] Publishing container {creation_id} to IG Business {instagram_business_id}"
        )

        response = httpx.post(
            f"{GRAPH_API_BASE}/{instagram_business_id}/media_publish",
            data={
                "creation_id": creation_id,
                "access_token": access_token,
            },
            timeout=30.0,
        )
        data = response.json()

        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            error_code = data["error"].get("code")
            logger.error(f"[Instagram] Publish failed: {error_msg} (code: {error_code})")
            raise InstagramAPIError(
                f"Instagram publish failed: {error_msg}",
                code=error_code,
            )

        instagram_post_id = data.get("id")
        if not instagram_post_id:
            raise InstagramAPIError("Meta API returned no post ID after publishing.")

        logger.info(f"[Instagram] ✅ Published successfully! Post ID: {instagram_post_id}")
        return instagram_post_id

    # ------------------------------------------------------------------
    # Full pipeline (Step 1 + poll + Step 2 combined)
    # ------------------------------------------------------------------
    @staticmethod
    def publish_post_sync(
        access_token: str,
        instagram_business_id: str,
        image_url: str,
        caption: str,
    ) -> dict:
        """
        Complete Instagram publishing pipeline:
            1. Create media container
            2. Poll until FINISHED
            3. Publish container

        This is what the Celery worker calls at scheduled time.

        Args:
            access_token:          Long-lived Meta User Access Token.
            instagram_business_id: Instagram Business Account ID.
            image_url:             Public HTTPS S3 image URL.
            caption:               Full caption text + hashtags.

        Returns:
            {
                "success": True,
                "instagram_post_id": "...",
                "published_at": datetime (UTC),
            }

        Raises:
            InstagramAPIError — on any API failure.
        """
        # Step 1 — Create container
        creation_id = InstagramService.create_media_container_sync(
            instagram_business_id=instagram_business_id,
            access_token=access_token,
            image_url=image_url,
            caption=caption,
        )

        # Step 2 — Wait for container to be ready
        is_ready = InstagramService.wait_for_container_ready_sync(
            creation_id=creation_id,
            access_token=access_token,
        )

        if not is_ready:
            raise InstagramAPIError(
                f"Media container {creation_id} did not become ready. "
                "The image may be invalid or Meta's processing failed."
            )

        # Step 3 — Publish
        instagram_post_id = InstagramService.publish_container_sync(
            instagram_business_id=instagram_business_id,
            access_token=access_token,
            creation_id=creation_id,
        )

        return {
            "success": True,
            "instagram_post_id": instagram_post_id,
            "published_at": datetime.now(timezone.utc),
        }
