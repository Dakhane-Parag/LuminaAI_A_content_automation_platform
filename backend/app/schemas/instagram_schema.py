"""
Brandflow AI - Instagram Integration Pydantic Schemas
======================================================
Request/response schemas for the Instagram OAuth and publishing workflow.

Schema hierarchy:
    InstagramConnectResponse   — Response after OAuth completes, confirming account link
    InstagramStatusResponse    — GET /instagram/status — shows connection state
    InstagramPublishResult     — Internal result of a publish attempt (used by Celery task)
    OAuthCallbackParams        — Query params received at the OAuth callback URL
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# OAuth & Connection Schemas
# ---------------------------------------------------------------------------
class InstagramConnectResponse(BaseModel):
    """
    Returned after a successful OAuth flow completes.
    Shows which accounts were linked to the platform.

    SECURITY: access_token is NEVER included in this response.
    """
    success: bool = True
    message: str
    instagram_business_id: str
    facebook_page_id: str
    instagram_username: Optional[str] = None
    token_created_at: datetime


class InstagramStatusResponse(BaseModel):
    """
    Returned by GET /oauth/instagram/status.
    Shows the current Instagram connection state for the authenticated user.
    """
    instagram_connected: bool
    instagram_business_id: Optional[str] = None
    facebook_page_id: Optional[str] = None
    instagram_username: Optional[str] = None
    token_created_at: Optional[datetime] = None
    message: str


class OAuthCallbackParams(BaseModel):
    """
    Query parameters received at GET /oauth/instagram/callback.
    Meta sends `code` on success, or `error` + `error_description` on failure.
    """
    code: Optional[str] = None
    state: Optional[str] = None
    error: Optional[str] = None
    error_description: Optional[str] = None


# ---------------------------------------------------------------------------
# Manual Token Connect Schema (for non-OAuth direct token entry)
# ---------------------------------------------------------------------------
class ManualTokenConnectRequest(BaseModel):
    """
    Allows users to manually paste their Long-Lived Access Token,
    Facebook Page ID, and Instagram Business ID.

    This is the preferred setup method for development where
    the full OAuth redirect flow isn't possible on localhost.

    The backend will:
    1. Validate the token against Meta Graph API
    2. Fetch the Instagram username
    3. Store the connection details securely
    """
    access_token: str = Field(
        ...,
        description="Long-Lived Meta User Access Token (generated via Graph API Explorer)",
        min_length=10,
    )
    facebook_page_id: str = Field(
        ...,
        description="Your Facebook Page ID (found via Graph API Explorer: /me/accounts)",
    )
    instagram_business_id: str = Field(
        ...,
        description="Your Instagram Business Account ID (found via /{page_id}?fields=instagram_business_account)",
    )


# ---------------------------------------------------------------------------
# Publishing Result (internal — used by Celery tasks)
# ---------------------------------------------------------------------------
class InstagramPublishResult(BaseModel):
    """
    Internal result object returned by InstagramService.publish_post().
    Used by Celery tasks to determine next MongoDB update actions.
    """
    success: bool
    instagram_post_id: Optional[str] = None
    error_message: Optional[str] = None
    published_at: Optional[datetime] = None
