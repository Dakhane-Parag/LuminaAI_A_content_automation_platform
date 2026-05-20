"""
Brandflow AI - User Service
==============================
Business logic for user management operations.
Services sit between routes (HTTP layer) and database (persistence layer).
They NEVER import from routes and are NOT aware of HTTP concerns.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.models.user import UserDocument
from app.schemas.user import UserCreate, UserResponse
from app.utils.security import hash_password, verify_password


class UserService:
    """
    Encapsulates all user-related database operations.

    Design:
    - Each method receives a db handle (injected from FastAPI dependency)
      rather than holding a reference at class level — keeps instances
      stateless and test-friendly.
    - Returns domain objects (UserDocument / UserResponse) not raw dicts.
    """

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    @staticmethod
    async def get_user_by_email(
        db: AsyncIOMotorDatabase,
        email: str,
    ) -> Optional[UserDocument]:
        """
        Fetch a user document by email address.

        Args:
            db:    Active MongoDB database handle.
            email: Email to look up (case-sensitive; store normalised).

        Returns:
            UserDocument if found, None otherwise.
        """
        user_doc = await db.users.find_one({"email": email.lower()})
        if user_doc is None:
            return None
        return UserDocument(**user_doc)

    @staticmethod
    async def get_user_by_id(
        db: AsyncIOMotorDatabase,
        user_id: str,
    ) -> Optional[UserDocument]:
        """
        Fetch a user document by MongoDB ObjectId string.

        Args:
            db:      Active MongoDB database handle.
            user_id: String representation of the ObjectId.

        Returns:
            UserDocument if found, None otherwise.

        Raises:
            HTTPException 400 — if user_id is not a valid ObjectId string.
        """
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format.",
            )

        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if user_doc is None:
            return None
        return UserDocument(**user_doc)

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    @staticmethod
    async def create_user(
        db: AsyncIOMotorDatabase,
        user_data: UserCreate,
    ) -> UserResponse:
        """
        Register a new user account.

        Steps:
        1. Normalise email to lowercase.
        2. Check for duplicate email (graceful DuplicateKeyError handling).
        3. Hash the password — plaintext is discarded immediately.
        4. Insert the document and return a safe UserResponse.

        Args:
            db:        Active MongoDB database handle.
            user_data: Validated UserCreate schema from the request body.

        Returns:
            UserResponse (no password field).

        Raises:
            HTTPException 409 — email already registered.
        """
        # Normalise email
        normalised_email = user_data.email.lower()

        # Build the document to insert
        new_user = UserDocument(
            name=user_data.name.strip(),
            email=normalised_email,
            password=hash_password(user_data.password),  # hash immediately
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        try:
            result = await db.users.insert_one(new_user.to_dict())
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An account with email '{normalised_email}' already exists.",
            )

        # Build the response using the newly created document
        return UserResponse(
            id=str(result.inserted_id),
            name=new_user.name,
            email=new_user.email,
            is_active=new_user.is_active,
            created_at=new_user.created_at,
        )

    # ------------------------------------------------------------------
    # Authentication helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def authenticate_user(
        db: AsyncIOMotorDatabase,
        email: str,
        password: str,
    ) -> UserDocument:
        """
        Verify email + password credentials.

        Uses a constant-time comparison via passlib to resist timing attacks.
        Always looks up the user first to ensure equal timing for valid and
        invalid emails (calls verify_password regardless).

        Args:
            db:       Active MongoDB database handle.
            email:    Email submitted by the client.
            password: Plaintext password submitted by the client.

        Returns:
            The authenticated UserDocument.

        Raises:
            HTTPException 401 — credentials are invalid.
        """
        # Generic error — do NOT reveal whether email or password was wrong
        auth_error = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        user = await UserService.get_user_by_email(db, email)

        # Always run verify_password (even on None user) to prevent
        # timing-based email enumeration attacks
        dummy_hash = "$2b$12$invalidhashpaddingtomakethislongenough123456789012345"
        stored_hash = user.password if user else dummy_hash

        if not verify_password(password, stored_hash):
            raise auth_error

        if user is None:
            raise auth_error

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact support.",
            )

        return user

    # ------------------------------------------------------------------
    # Serialisation helper
    # ------------------------------------------------------------------

    @staticmethod
    def to_response(user: UserDocument) -> UserResponse:
        """
        Convert a UserDocument into a safe UserResponse (no password).

        Args:
            user: Internal UserDocument instance.

        Returns:
            UserResponse safe to return in API responses.
        """
        return UserResponse(
            id=str(user.id),
            name=user.name,
            email=user.email,
            is_active=user.is_active,
            created_at=user.created_at,
        )
