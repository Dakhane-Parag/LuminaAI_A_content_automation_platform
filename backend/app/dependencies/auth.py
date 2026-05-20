"""
Brandflow AI - FastAPI Dependencies
=====================================
Reusable dependency functions injected into route handlers.

Dependencies defined here:
    get_current_user         — Extracts & validates the JWT Bearer token,
                               returns the authenticated UserDocument.
    get_current_active_user  — Same as above but also checks is_active flag.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.connection import get_database
from app.models.user import UserDocument
from app.utils.security import decode_access_token

# HTTPBearer reads the "Authorization: Bearer <token>" header automatically
_bearer_scheme = HTTPBearer(
    scheme_name="Bearer",
    description="Paste your JWT access token (without the 'Bearer' prefix).",
    auto_error=True,  # raises 403 automatically if header is missing
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserDocument:
    """
    Dependency: Validate Bearer JWT and return the authenticated user.

    Flow:
    1. HTTPBearer extracts the raw token string from the Authorization header.
    2. decode_access_token verifies signature + expiry and returns the user ID.
    3. The user document is fetched from MongoDB.
    4. HTTPException 401 is raised for any failure.

    Args:
        credentials: Injected by FastAPI from the Authorization header.
        db:          Injected async MongoDB database handle.

    Returns:
        UserDocument for the authenticated user.

    Raises:
        HTTPException 401 — invalid / expired token or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decode and validate the JWT
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise credentials_exception

    # Fetch user from MongoDB
    try:
        from bson import ObjectId
        if not ObjectId.is_valid(user_id):
            raise credentials_exception

        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise credentials_exception

    if user_doc is None:
        raise credentials_exception

    return UserDocument(**user_doc)


async def get_current_active_user(
    current_user: UserDocument = Depends(get_current_user),
) -> UserDocument:
    """
    Dependency: Same as get_current_user but additionally verifies the
    account has not been deactivated.

    Raises:
        HTTPException 403 — account is inactive.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )
    return current_user
