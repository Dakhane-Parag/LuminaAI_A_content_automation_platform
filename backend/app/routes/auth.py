"""
Brandflow AI - Authentication Routes
=======================================
Handles user registration, login, and profile retrieval.

Endpoints:
    POST /api/v1/auth/register  — Create a new user account
    POST /api/v1/auth/login     — Authenticate and receive a JWT token
    GET  /api/v1/auth/me        — Return the authenticated user's profile
"""

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.connection import get_database
from app.dependencies.auth import get_current_active_user
from app.models.user import UserDocument
from app.schemas.user import MessageResponse, TokenSchema, UserCreate, UserLogin, UserResponse
from app.services.user_service import UserService
from app.utils.security import create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ---------------------------------------------------------------------------
# POST /register
# ---------------------------------------------------------------------------
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    responses={
        201: {"description": "User created successfully"},
        409: {"description": "Email already registered"},
        422: {"description": "Validation error (weak password, invalid email, etc.)"},
    },
)
async def register(
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserResponse:
    """
    Register a new Brandflow AI user.

    - Validates email format and password strength.
    - Hashes the password with bcrypt before storage.
    - Returns the created user profile (no password in response).

    **Password requirements:**
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    """
    return await UserService.create_user(db, user_data)


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=TokenSchema,
    status_code=status.HTTP_200_OK,
    summary="Login and receive a JWT access token",
    responses={
        200: {"description": "Authentication successful, JWT token returned"},
        401: {"description": "Invalid credentials"},
        403: {"description": "Account deactivated"},
    },
)
async def login(
    credentials: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> TokenSchema:
    """
    Authenticate a user and return a JWT Bearer token.

    Use the returned `access_token` in subsequent requests:
    ```
    Authorization: Bearer <access_token>
    ```

    The token expires after `expires_in` seconds.
    """
    # Validate credentials — raises 401 on failure
    user = await UserService.authenticate_user(db, credentials.email, credentials.password)

    # Generate JWT access token
    access_token, expires_in = create_access_token(subject=str(user.id))

    return TokenSchema(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserService.to_response(user),
    )


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------
@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the authenticated user's profile",
    responses={
        200: {"description": "User profile returned"},
        401: {"description": "Missing or invalid JWT token"},
        403: {"description": "Account deactivated"},
    },
)
async def get_me(
    current_user: UserDocument = Depends(get_current_active_user),
) -> UserResponse:
    """
    Return the profile of the currently authenticated user.

    Requires a valid JWT Bearer token in the Authorization header.
    """
    return UserService.to_response(current_user)
