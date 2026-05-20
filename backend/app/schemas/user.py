"""
Brandflow AI - User Pydantic Schemas
=======================================
These schemas define the shape of data flowing into and out of the API layer.
They are deliberately separate from the MongoDB model (UserDocument) to give
full control over what is exposed vs. what is stored.

Schema hierarchy:
    UserBase        — shared fields (name, email)
    ├── UserCreate  — API input for /register (adds password)
    ├── UserLogin   — API input for /login
    └── UserResponse — API output (no password, has id/created_at)

TokenSchema         — JWT token response
TokenPayload        — JWT payload (decoded claims)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Base Schema
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    """Shared user fields used as a base for other schemas."""

    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="User's full display name",
        examples=["Jane Doe"],
    )
    email: EmailStr = Field(
        ...,
        description="Valid email address (used for login)",
        examples=["jane@example.com"],
    )


# ---------------------------------------------------------------------------
# Input Schemas (API → Application)
# ---------------------------------------------------------------------------
class UserCreate(UserBase):
    """
    Schema for POST /register.
    Accepts name, email, and plaintext password.
    Password is hashed in the service layer — never stored raw.
    """

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (min 8 characters)",
        examples=["SecurePass123!"],
    )

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        """
        Basic password strength check.
        Enforces at least one uppercase, one lowercase, and one digit.
        """
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v

    @field_validator("name")
    @classmethod
    def name_no_special_chars(cls, v: str) -> str:
        """Strip leading/trailing whitespace from the name field."""
        return v.strip()


class UserLogin(BaseModel):
    """
    Schema for POST /login.
    Only requires email + password; name is not needed for login.
    """

    email: EmailStr = Field(..., examples=["jane@example.com"])
    password: str = Field(..., examples=["SecurePass123!"])


# ---------------------------------------------------------------------------
# Output Schemas (Application → API)
# ---------------------------------------------------------------------------
class UserResponse(BaseModel):
    """
    Schema returned in API responses.
    IMPORTANT: password is intentionally excluded.
    """

    id: str = Field(..., description="MongoDB document ID as string")
    name: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# JWT Token Schemas
# ---------------------------------------------------------------------------
class TokenSchema(BaseModel):
    """Response schema for successful authentication."""

    access_token: str = Field(..., description="JWT Bearer token")
    token_type: str = Field(default="bearer", description="Token type — always 'bearer'")
    expires_in: int = Field(..., description="Token lifetime in seconds")
    user: UserResponse = Field(..., description="Authenticated user details")


class TokenPayload(BaseModel):
    """
    Decoded JWT payload claims.
    'sub' holds the user's MongoDB ID string.
    'exp' is the UNIX timestamp expiry (handled by python-jose automatically).
    """

    sub: Optional[str] = None  # subject = user id
    exp: Optional[int] = None  # expiry unix timestamp


# ---------------------------------------------------------------------------
# Generic API Response Wrappers
# ---------------------------------------------------------------------------
class MessageResponse(BaseModel):
    """Simple message response for success/info endpoints."""

    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Standardised error response shape."""

    detail: str
    error_code: Optional[str] = None
    success: bool = False
