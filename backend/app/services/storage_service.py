"""
Brandflow AI - S3 Cloud Storage Service
=========================================
Abstracts all Amazon S3 interactions behind a clean, reusable interface.

Responsibilities:
    1. Upload image files to S3 using organized folder paths
    2. Generate public S3 image URLs
    3. Clean up local temp files after successful upload
    4. Validate upload success before confirming

Architecture philosophy:
    - All S3 logic is ISOLATED here — routes and other services
      never touch boto3 directly.
    - The interface is intentionally generic so the storage provider
      can be swapped to Cloudflare R2, Azure Blob, or Firebase Storage
      in the future without touching any other file.

Architecture position:
    ImageAIService → StorageService → Amazon S3
                                    → Local filesystem (cleanup)
"""

import logging
import os
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# S3 Client Factory
# ---------------------------------------------------------------------------

def _get_s3_client():
    """
    Build and return a configured boto3 S3 client.

    Uses credentials from the Settings singleton (loaded from .env).
    A new client is created per-call — boto3 manages connection pooling
    internally, so this is safe and avoids stale sessions.

    Returns:
        A boto3 S3 client instance.

    Raises:
        RuntimeError: If AWS credentials are not configured.
    """
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        raise RuntimeError(
            "AWS credentials are not configured. "
            "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file."
        )

    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


# ---------------------------------------------------------------------------
# Temp file cleanup helper
# ---------------------------------------------------------------------------

def _cleanup_temp_file(file_path: Path) -> None:
    """
    Safely delete a local temporary file.

    Logs a warning if deletion fails but never raises — cleanup failures
    should never abort the main workflow (the S3 upload already succeeded).

    Args:
        file_path: Absolute path to the temp file to delete.
    """
    try:
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Temp file cleaned up: {file_path.name}")
    except OSError as e:
        logger.warning(f"Failed to clean up temp file {file_path.name}: {e}")


# ---------------------------------------------------------------------------
# Public S3 URL builder
# ---------------------------------------------------------------------------

def _build_s3_url(bucket: str, region: str, key: str) -> str:
    """
    Build the standard public S3 URL for a given object key.

    Format: https://<bucket>.s3.<region>.amazonaws.com/<key>

    Args:
        bucket: S3 bucket name.
        region: AWS region string (e.g. 'eu-north-1').
        key:    S3 object key (e.g. 'generated/user_123/uuid.png').

    Returns:
        Full public HTTPS URL string.
    """
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


# ---------------------------------------------------------------------------
# Storage Service Class
# ---------------------------------------------------------------------------

class StorageService:
    """
    Abstracts all cloud storage operations.

    Provider: Amazon S3 (swappable in the future).

    Design principles:
    - Stateless — all inputs passed as arguments.
    - No FastAPI/HTTP knowledge — pure Python business logic.
    - Fail-fast on upload errors — never silently swallow S3 failures.
    - Safe cleanup — temp deletion failures are warned, never raised.
    """

    @staticmethod
    async def upload_image(
        local_path: Path,
        user_id: str,
        post_id: str,
        cleanup_local: bool = True,
    ) -> str:
        """
        Upload a locally stored image to Amazon S3 and return its public URL.

        Workflow:
        1. Validate AWS configuration.
        2. Build a unique, user-scoped S3 object key.
        3. Upload the file using boto3 (run_in_executor for async safety).
        4. Build and return the public S3 URL.
        5. Optionally delete the local temp file.

        Args:
            local_path:    Absolute path to the local image file.
            user_id:       Owner's MongoDB user ID (used for S3 folder scoping).
            post_id:       Post MongoDB ID (used in the filename).
            cleanup_local: If True, deletes the local file after upload (default True).

        Returns:
            Public HTTPS S3 URL of the uploaded image.

        Raises:
            RuntimeError: AWS credentials not configured.
            RuntimeError: S3 upload failed.
        """
        import asyncio

        # ── Step 1: Validate config ─────────────────────────────────────
        if not settings.AWS_BUCKET_NAME:
            raise RuntimeError(
                "AWS_BUCKET_NAME is not configured. Add it to your .env file."
            )

        # ── Step 2: Build a unique, organised S3 key ────────────────────
        # Format: generated/<user_id>/<post_id>_<timestamp>.png
        # This prevents filename collisions across users and retries.
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        s3_key = f"generated/{user_id}/{post_id}_{timestamp}.png"

        # ── Step 3: Upload to S3 ────────────────────────────────────────
        logger.info(f"Uploading image to S3: s3://{settings.AWS_BUCKET_NAME}/{s3_key}")

        try:
            s3_client = _get_s3_client()

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: s3_client.upload_file(
                    Filename=str(local_path),
                    Bucket=settings.AWS_BUCKET_NAME,
                    Key=s3_key,
                    ExtraArgs={
                        "ContentType": "image/png",
                    },
                ),
            )

        except (BotoCoreError, ClientError) as e:
            logger.error(f"S3 upload failed for post {post_id}: {e}")
            raise RuntimeError(f"S3 upload failed: {type(e).__name__}: {str(e)}") from e

        # ── Step 4: Build public URL ────────────────────────────────────
        public_url = _build_s3_url(
            bucket=settings.AWS_BUCKET_NAME,
            region=settings.AWS_REGION,
            key=s3_key,
        )
        logger.info(f"Image uploaded successfully. Public URL: {public_url}")

        # ── Step 5: Cleanup local temp file ─────────────────────────────
        if cleanup_local:
            _cleanup_temp_file(local_path)

        return public_url
