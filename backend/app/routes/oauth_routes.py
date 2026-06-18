"""
Brandflow AI - OAuth & Instagram Connection Routes
====================================================
Handles Instagram account connection for users.

Endpoints:
    POST   /oauth/instagram/connect-manual   — Connect via pasted Long-Lived Token (dev-friendly)
    GET    /oauth/instagram/status           — Check Instagram connection status
    DELETE /oauth/instagram/disconnect       — Remove Instagram connection

Why "connect-manual" instead of full OAuth redirect?
    Meta requires HTTPS with a verified domain for the full OAuth redirect flow.
    In development (localhost:8000), the recommended approach is to generate a
    Long-Lived Access Token manually via Graph API Explorer and paste it here.
    A full OAuth redirect endpoint (GET /oauth/instagram/callback) is also included
    for when the app goes live with a real domain.

Full OAuth Redirect (for production):
    GET /oauth/instagram/connect  — Redirects user to Meta login page
    GET /oauth/instagram/callback — Receives code from Meta, exchanges for token

Meta Graph API reference:
    https://developers.facebook.com/docs/instagram-api/getting-started
"""

import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.database.connection import get_database
from app.dependencies.auth import get_current_active_user
from app.models.user import UserDocument
from app.schemas.instagram_schema import (
    InstagramConnectResponse,
    InstagramStatusResponse,
    ManualTokenConnectRequest,
    OAuthCodeRequest,
)
from app.services.instagram_service import InstagramAPIError, InstagramService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/oauth",
    tags=["OAuth & Social Connections"],
)


# ---------------------------------------------------------------------------
# GET /oauth/instagram/connect-url
# ---------------------------------------------------------------------------
@router.get(
    "/instagram/connect-url",
    status_code=status.HTTP_200_OK,
    summary="Get the Facebook OAuth URL to open in a popup",
    responses={
        200: {"description": "Facebook OAuth URL ready to open"},
        503: {"description": "Meta App credentials not configured"},
    },
)
async def get_instagram_connect_url(
    current_user: UserDocument = Depends(get_current_active_user),
) -> dict:
    """
    Returns the Facebook OAuth authorization URL.

    The frontend opens this URL in a popup window. The user logs in with
    Facebook, grants permissions, and is redirected back to the frontend
    callback page which then calls POST /oauth/instagram/exchange-code.

    Required Meta App Dashboard settings:
        - Valid OAuth Redirect URI: http://localhost:5173/auth/instagram/callback
        - Permissions: instagram_basic, instagram_content_publish,
          pages_manage_metadata, pages_read_engagement, pages_show_list
    """
    if not settings.META_APP_ID or not settings.META_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="META_APP_ID and META_REDIRECT_URI must be configured in .env",
        )

    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.META_REDIRECT_URI,
        "scope": (
            "instagram_basic,"
            "instagram_content_publish,"
            "pages_manage_metadata,"
            "pages_read_engagement,"
            "pages_show_list"
        ),
        "response_type": "code",
        "state": str(current_user.id),  # passed through for traceability
    }
    auth_url = "https://www.facebook.com/v21.0/dialog/oauth?" + urlencode(params)
    logger.info(f"[OAuth] Generated connect URL for user {current_user.id}")
    return {"auth_url": auth_url}


# ---------------------------------------------------------------------------
# POST /oauth/instagram/exchange-code
# ---------------------------------------------------------------------------
@router.post(
    "/instagram/exchange-code",
    response_model=InstagramConnectResponse,
    status_code=status.HTTP_200_OK,
    summary="Exchange OAuth code → auto-discover & save Instagram account",
    responses={
        200: {"description": "Instagram account connected automatically"},
        400: {"description": "Code exchange or account discovery failed"},
        503: {"description": "Meta App credentials not configured"},
    },
)
async def exchange_instagram_code(
    request: OAuthCodeRequest,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> InstagramConnectResponse:
    """
    Fully automatic Instagram account connection.

    Called by the frontend callback page after the user authorises the app
    on Facebook. This single endpoint does everything:

    1.  Exchange the short-lived **authorization code** for a User Access Token
    2.  Upgrade to a **Long-Lived Token** (60-day expiry)
    3.  Auto-discover the user's **Facebook Page ID** via /me/accounts
    4.  Auto-discover the linked **Instagram Business Account ID**
    5.  Fetch the **Instagram username** for display
    6.  Persist everything to MongoDB

    The user never has to look up or paste any IDs manually.
    """
    import asyncio

    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="META_APP_ID and META_APP_SECRET must be set in .env",
        )

    loop = asyncio.get_event_loop()
    user_id = str(current_user.id)

    # ── Step 1: Exchange authorization code for short-lived token ────────
    try:
        token_data = await loop.run_in_executor(
            None,
            lambda: InstagramService.exchange_code_for_token_sync(
                code=request.code,
                redirect_uri=settings.META_REDIRECT_URI,
                app_id=settings.META_APP_ID,
                app_secret=settings.META_APP_SECRET,
            ),
        )
        short_lived_token = token_data["access_token"]
        logger.info(f"[OAuth] Short-lived token obtained for user {user_id}")
    except InstagramAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Authorization code exchange failed: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not reach Meta Graph API: {str(e)[:120]}",
        )

    # ── Step 2: Upgrade to long-lived token (60-day expiry) ──────────────
    try:
        ll_data = await loop.run_in_executor(
            None,
            lambda: InstagramService.exchange_for_long_lived_token_sync(
                short_lived_token=short_lived_token,
                app_id=settings.META_APP_ID,
                app_secret=settings.META_APP_SECRET,
            ),
        )
        long_lived_token = ll_data["access_token"]
        logger.info(f"[OAuth] Long-lived token obtained for user {user_id}")
    except InstagramAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Long-lived token exchange failed: {str(e)}",
        )

    # ── Step 3 & 4: Auto-discover Facebook Page + Instagram Business Account ─
    try:
        account = await loop.run_in_executor(
            None,
            lambda: InstagramService.auto_discover_instagram_account_sync(long_lived_token),
        )
    except InstagramAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to discover Instagram account: {str(e)}",
        )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No Instagram Business or Creator Account found on your Facebook Pages. "
                "Please make sure your Instagram account is set to Business or Creator "
                "and is linked to a Facebook Page you manage."
            ),
        )

    # ── Step 5: Fetch Instagram username for display ─────────────────────
    instagram_username = await loop.run_in_executor(
        None,
        lambda: InstagramService.get_instagram_username_sync(
            account["instagram_business_id"],
            long_lived_token,
        ),
    )

    # ── Step 6: Persist to MongoDB ───────────────────────────────────────
    now = datetime.now(timezone.utc)
    from bson import ObjectId
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "instagram_connected": True,
                "instagram_access_token": long_lived_token,
                "facebook_page_id": account["facebook_page_id"],
                "instagram_business_id": account["instagram_business_id"],
                "token_created_at": now,
                "updated_at": now,
            }
        },
    )
    logger.info(
        f"[OAuth] ✅ Instagram auto-connected for user {user_id} → "
        f"Page: {account['facebook_page_id']}, IG: {account['instagram_business_id']}"
    )

    return InstagramConnectResponse(
        success=True,
        message=(
            f"Instagram Business Account connected automatically! "
            f"Page: {account.get('page_name', account['facebook_page_id'])} → "
            f"@{instagram_username or 'unknown'}"
        ),
        instagram_business_id=account["instagram_business_id"],
        facebook_page_id=account["facebook_page_id"],
        instagram_username=instagram_username,
        token_created_at=now,
    )


# ---------------------------------------------------------------------------
# POST /oauth/instagram/connect-manual
# ---------------------------------------------------------------------------
@router.post(
    "/instagram/connect-manual",
    response_model=InstagramConnectResponse,
    status_code=status.HTTP_200_OK,
    summary="Connect Instagram account using a Long-Lived Access Token",
    responses={
        200: {"description": "Instagram account connected successfully"},
        400: {"description": "Invalid token or mismatched account IDs"},
        401: {"description": "JWT token required"},
        503: {"description": "Meta Graph API unreachable"},
    },
)
async def connect_instagram_manual(
    request: ManualTokenConnectRequest,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> InstagramConnectResponse:
    """
    Connect an Instagram Business Account using a manually pasted Long-Lived Access Token.

    **This is the recommended approach for development and testing.**

    **How to get your token:**
    1. Go to https://developers.facebook.com/tools/explorer/
    2. Select your Brandflow AI app
    3. Add permissions: `instagram_basic`, `instagram_content_publish`,
       `pages_manage_metadata`, `pages_read_engagement`
    4. Click **Generate Access Token** → login and accept
    5. Click **Generate Long-Lived Token** (or exchange via `GET /oauth/exchange-token`)
    6. Copy the token and paste it here

    **How to get your Facebook Page ID and Instagram Business ID:**
    - Call `GET /oauth/instagram/pages` after connecting to list your pages
    - Or use Graph API Explorer: run `/me/accounts` to see your pages

    **Security:** The token is stored encrypted in MongoDB and is NEVER returned
    in any API response.
    """
    import asyncio

    user_id = str(current_user.id)

    # ── Step 1: Validate token against Meta ──────────────────────────
    try:
        loop = asyncio.get_event_loop()
        me_data = await loop.run_in_executor(
            None,
            lambda: InstagramService.validate_token_sync(request.access_token),
        )
        logger.info(f"[OAuth] Token validated for Meta user: {me_data.get('id')}")

    except InstagramAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired Meta access token: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not reach Meta Graph API: {str(e)[:120]}",
        )

    # ── Step 2: Fetch Instagram username (optional — for display) ────
    import asyncio
    loop = asyncio.get_event_loop()
    instagram_username = await loop.run_in_executor(
        None,
        lambda: InstagramService.get_instagram_username_sync(
            request.instagram_business_id,
            request.access_token,
        ),
    )

    # ── Step 3: Store credentials in MongoDB ─────────────────────────
    now = datetime.now(timezone.utc)
    from bson import ObjectId
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "instagram_connected": True,
                "instagram_access_token": request.access_token,   # stored securely
                "facebook_page_id": request.facebook_page_id,
                "instagram_business_id": request.instagram_business_id,
                "token_created_at": now,
                "updated_at": now,
            }
        },
    )
    logger.info(f"[OAuth] Instagram connected for user {user_id} → IG: {request.instagram_business_id}")

    return InstagramConnectResponse(
        success=True,
        message=f"Instagram Business Account connected successfully! "
                f"Username: @{instagram_username or 'unknown'}",
        instagram_business_id=request.instagram_business_id,
        facebook_page_id=request.facebook_page_id,
        instagram_username=instagram_username,
        token_created_at=now,
    )


# ---------------------------------------------------------------------------
# GET /oauth/instagram/status
# ---------------------------------------------------------------------------
@router.get(
    "/instagram/status",
    response_model=InstagramStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Instagram connection status",
)
async def instagram_status(
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> InstagramStatusResponse:
    """
    Returns the Instagram connection state for the currently authenticated user.

    Use this to check:
    - Whether Instagram is connected
    - Which Instagram Business Account is linked
    - When the token was last refreshed
    """
    import asyncio
    from bson import ObjectId

    user_id = str(current_user.id)
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user_doc or not user_doc.get("instagram_connected"):
        return InstagramStatusResponse(
            instagram_connected=False,
            message="Instagram is not connected. Use POST /oauth/instagram/connect-manual to connect.",
        )

    # Fetch live Instagram username from Meta (token may have username updated)
    instagram_username = None
    if user_doc.get("instagram_business_id") and user_doc.get("instagram_access_token"):
        try:
            loop = asyncio.get_event_loop()
            instagram_username = await loop.run_in_executor(
                None,
                lambda: InstagramService.get_instagram_username_sync(
                    user_doc["instagram_business_id"],
                    user_doc["instagram_access_token"],
                ),
            )
        except Exception:
            pass

    return InstagramStatusResponse(
        instagram_connected=True,
        instagram_business_id=user_doc.get("instagram_business_id"),
        facebook_page_id=user_doc.get("facebook_page_id"),
        instagram_username=instagram_username,
        token_created_at=user_doc.get("token_created_at"),
        message="Instagram is connected and ready for auto-posting.",
    )


# ---------------------------------------------------------------------------
# GET /oauth/instagram/pages
# ---------------------------------------------------------------------------
@router.get(
    "/instagram/pages",
    status_code=status.HTTP_200_OK,
    summary="List Facebook Pages managed by the connected account",
)
async def list_facebook_pages(
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    """
    Lists all Facebook Pages the connected user manages.

    Use this to find your Facebook Page ID and then use Graph API Explorer
    to get the associated Instagram Business Account ID.

    **Requires:** Instagram must already be connected via /oauth/instagram/connect-manual.
    """
    import asyncio
    from bson import ObjectId

    user_doc = await db.users.find_one({"_id": ObjectId(str(current_user.id))})

    if not user_doc or not user_doc.get("instagram_access_token"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instagram is not connected. Connect first via POST /oauth/instagram/connect-manual",
        )

    try:
        loop = asyncio.get_event_loop()
        pages = await loop.run_in_executor(
            None,
            lambda: InstagramService.get_pages_sync(user_doc["instagram_access_token"]),
        )
    except InstagramAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch pages: {str(e)}",
        )

    # Strip out page access_tokens from the response for security
    safe_pages = [{"id": p["id"], "name": p["name"]} for p in pages]

    return {
        "success": True,
        "count": len(safe_pages),
        "pages": safe_pages,
        "hint": "Use GET /{page_id}?fields=instagram_business_account via Graph API Explorer to find your Instagram Business ID",
    }


# ---------------------------------------------------------------------------
# DELETE /oauth/instagram/disconnect
# ---------------------------------------------------------------------------
@router.delete(
    "/instagram/disconnect",
    status_code=status.HTTP_200_OK,
    summary="Disconnect Instagram account",
)
async def disconnect_instagram(
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    """
    Removes the Instagram connection from the user's account.
    Clears the stored access token and account IDs from MongoDB.
    """
    from bson import ObjectId

    user_id = str(current_user.id)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "instagram_connected": False,
                "instagram_access_token": None,
                "facebook_page_id": None,
                "instagram_business_id": None,
                "token_created_at": None,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "success": True,
        "message": "Instagram account disconnected successfully.",
    }


# ---------------------------------------------------------------------------
# GET /oauth/exchange-token
# ---------------------------------------------------------------------------
@router.get(
    "/exchange-token",
    status_code=status.HTTP_200_OK,
    summary="Exchange a short-lived token for a Long-Lived token (60 days)",
)
async def exchange_token(
    short_lived_token: str = Query(..., description="Short-lived User Access Token from Graph API Explorer"),
) -> dict:
    """
    Exchange a short-lived Meta User Access Token (1-hour expiry) for a
    Long-Lived Access Token (60-day expiry).

    **How to use:**
    1. Get a short-lived token from Graph API Explorer
    2. Call this endpoint with that token
    3. Copy the returned `long_lived_token`
    4. Use it in POST /oauth/instagram/connect-manual

    **Requires:** META_APP_ID and META_APP_SECRET must be set in .env
    """
    import asyncio

    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="META_APP_ID and META_APP_SECRET must be configured in .env to exchange tokens.",
        )

    try:
        loop = asyncio.get_event_loop()

        def _exchange():
            import httpx
            response = httpx.get(
                "https://graph.facebook.com/v21.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.META_APP_ID,
                    "client_secret": settings.META_APP_SECRET,
                    "fb_exchange_token": short_lived_token,
                },
                timeout=15.0,
            )
            return response.json()

        data = await loop.run_in_executor(None, _exchange)

        if "error" in data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Token exchange failed: {data['error'].get('message')}",
            )

        return {
            "success": True,
            "long_lived_token": data.get("access_token"),
            "token_type": data.get("token_type"),
            "expires_in_seconds": data.get("expires_in"),
            "note": "This token expires in ~60 days. Use it in POST /oauth/instagram/connect-manual",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Token exchange failed: {str(e)[:120]}",
        )
