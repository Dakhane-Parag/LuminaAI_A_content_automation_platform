"""
Brandflow AI - Schemas Package
"""

from app.schemas.ai_schema import (
    AIGenerateResponse,
    GeneratedPostVariant,
    GeneratePostRequest,
    RawAIPost,
)
from app.schemas.post import (
    DeleteResponse,
    PostCreate,
    PostListResponse,
    PostResponse,
    PostSuccessResponse,
    PostUpdate,
)
from app.schemas.user import (
    ErrorResponse,
    MessageResponse,
    TokenPayload,
    TokenSchema,
    UserBase,
    UserCreate,
    UserLogin,
    UserResponse,
)

__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "TokenSchema",
    "TokenPayload",
    "MessageResponse",
    "ErrorResponse",
    # Post schemas
    "PostCreate",
    "PostUpdate",
    "PostResponse",
    "PostSuccessResponse",
    "PostListResponse",
    "DeleteResponse",
    # AI schemas
    "GeneratePostRequest",
    "RawAIPost",
    "GeneratedPostVariant",
    "AIGenerateResponse",
]
