"""
Brandflow AI - Security Utilities
====================================
Provides password hashing and JWT token operations.
All cryptographic logic is isolated here so it can be
tested and swapped independently.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config.settings import settings


# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------

# CryptContext configured for bcrypt with automatic scheme deprecation
_pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.BCRYPT_ROUNDS,
)


def hash_password(plain_password: str) -> str:
    """
    Hash a plaintext password using bcrypt.

    Args:
        plain_password: The raw password string from the user.

    Returns:
        A bcrypt hash string safe to store in the database.
    """
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash.

    Args:
        plain_password:  Raw password submitted by the user.
        hashed_password: Hash stored in the database.

    Returns:
        True if the password matches, False otherwise.
    """
    return _pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT Token Operations
# ---------------------------------------------------------------------------

def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
) -> tuple[str, int]:
    """
    Generate a signed JWT access token.

    Args:
        subject:       The token subject — typically the user's MongoDB ID string.
        expires_delta: Optional custom expiry override. Defaults to
                       JWT_ACCESS_TOKEN_EXPIRE_MINUTES from settings.

    Returns:
        A tuple of (encoded_jwt_string, expires_in_seconds).
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.now(timezone.utc) + expires_delta

    payload = {
        "sub": subject,          # subject (user id)
        "exp": expire,           # expiry (python-jose handles datetime → int)
        "iat": datetime.now(timezone.utc),  # issued-at
        "type": "access",        # token type discriminator
    }

    encoded_token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    expires_in_seconds = int(expires_delta.total_seconds())
    return encoded_token, expires_in_seconds


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode and validate a JWT access token, returning the subject claim.

    Args:
        token: The raw JWT string from the Authorization header.

    Returns:
        The subject string (user ID) if valid, None if the token is
        invalid, expired, or malformed.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        subject: Optional[str] = payload.get("sub")
        token_type: Optional[str] = payload.get("type")

        # Reject tokens that are not access tokens
        if token_type != "access":
            return None

        return subject

    except JWTError:
        return None
