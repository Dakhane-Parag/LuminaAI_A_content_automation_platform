"""
Brandflow AI - Post Routes
============================
HTTP layer for the Post Management System.
All endpoints are JWT-protected and scope data to the authenticated user.

Endpoints:
    POST   /api/v1/posts             — Create a new post
    GET    /api/v1/posts             — List the authenticated user's posts
    GET    /api/v1/posts/{post_id}   — Fetch a single post by ID
    PUT    /api/v1/posts/{post_id}   — Update a post (partial update)
    DELETE /api/v1/posts/{post_id}   — Delete a post

Design decisions:
    - Routes are deliberately thin (no business logic here).
    - All DB interaction is delegated to PostService.
    - get_current_active_user dependency is used on every endpoint to
      enforce JWT authentication and active-account checks.
    - Ownership validation lives in the service layer (not here).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.connection import get_database
from app.dependencies.auth import get_current_active_user
from app.models.user import UserDocument
from app.schemas.post import (
    DeleteResponse,
    PostCreate,
    PostListResponse,
    PostSuccessResponse,
    PostUpdate,
)
from app.services.post_service import PostService

router = APIRouter(
    prefix="/posts",
    tags=["Posts"],
)


# ---------------------------------------------------------------------------
# POST /posts — Create a new post
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=PostSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new post",
    responses={
        201: {"description": "Post created successfully"},
        401: {"description": "Missing or invalid JWT token"},
        422: {"description": "Validation error in request body"},
    },
)
async def create_post(
    post_data: PostCreate,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PostSuccessResponse:
    """
    Create a new post for the authenticated user.

    The post is stored with `status: draft` by default.
    The `user_id` is automatically set from the JWT — clients cannot
    create posts on behalf of other users.

    **Required fields:**
    - `prompt` — AI generation brief or content intent (5–2000 chars)

    **Optional fields:**
    - `caption`, `hashtags`, `design_style`, `tone`, `image_url`, `scheduled_time`
    """
    created_post = await PostService.create_post(
        db=db,
        post_data=post_data,
        user_id=str(current_user.id),
    )
    return PostSuccessResponse(
        success=True,
        message="Post created successfully.",
        data=created_post,
    )


# ---------------------------------------------------------------------------
# GET /posts — List authenticated user's posts
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=PostListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all posts for the authenticated user",
    responses={
        200: {"description": "Posts retrieved successfully"},
        400: {"description": "Invalid query parameter value"},
        401: {"description": "Missing or invalid JWT token"},
    },
)
async def list_posts(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filter by post status: draft | scheduled | published",
        examples=["draft"],
    ),
    skip: int = Query(default=0, ge=0, description="Number of posts to skip (pagination)"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum posts to return (1–100)"),
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PostListResponse:
    """
    Return all posts belonging to the currently authenticated user, sorted newest first.

    Supports optional filtering and pagination:
    - `?status=draft` — show only drafts
    - `?status=scheduled` — show only scheduled posts
    - `?status=published` — show only published posts
    - `?skip=0&limit=20` — paginate results
    """
    posts = await PostService.get_user_posts(
        db=db,
        user_id=str(current_user.id),
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return PostListResponse(
        success=True,
        message="Posts retrieved successfully.",
        count=len(posts),
        data=posts,
    )


# ---------------------------------------------------------------------------
# GET /posts/{post_id} — Fetch a single post
# ---------------------------------------------------------------------------
@router.get(
    "/{post_id}",
    response_model=PostSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single post by ID",
    responses={
        200: {"description": "Post retrieved successfully"},
        400: {"description": "Invalid post ID format"},
        401: {"description": "Missing or invalid JWT token"},
        404: {"description": "Post not found (or not owned by you)"},
    },
)
async def get_post(
    post_id: str,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PostSuccessResponse:
    """
    Retrieve a single post by its MongoDB ID.

    Returns 404 if:
    - The ID does not exist in the database.
    - The post belongs to a different user (prevents enumeration).
    """
    post = await PostService.get_post_by_id(
        db=db,
        post_id=post_id,
        user_id=str(current_user.id),
    )
    return PostSuccessResponse(
        success=True,
        message="Post retrieved successfully.",
        data=post,
    )


# ---------------------------------------------------------------------------
# PUT /posts/{post_id} — Update a post
# ---------------------------------------------------------------------------
@router.put(
    "/{post_id}",
    response_model=PostSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing post",
    responses={
        200: {"description": "Post updated successfully"},
        400: {"description": "Invalid post ID format or field value"},
        401: {"description": "Missing or invalid JWT token"},
        404: {"description": "Post not found (or not owned by you)"},
        422: {"description": "Validation error in request body"},
    },
)
async def update_post(
    post_id: str,
    update_data: PostUpdate,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PostSuccessResponse:
    """
    Partially update a post.

    Only the fields included in the request body are changed.
    Omitted fields remain unchanged (true partial update — no need to send
    the entire post object).

    Ownership is enforced — you can only update your own posts.
    """
    updated_post = await PostService.update_post(
        db=db,
        post_id=post_id,
        update_data=update_data,
        user_id=str(current_user.id),
    )
    return PostSuccessResponse(
        success=True,
        message="Post updated successfully.",
        data=updated_post,
    )


# ---------------------------------------------------------------------------
# DELETE /posts/{post_id} — Delete a post
# ---------------------------------------------------------------------------
@router.delete(
    "/{post_id}",
    response_model=DeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a post",
    responses={
        200: {"description": "Post deleted successfully"},
        400: {"description": "Invalid post ID format"},
        401: {"description": "Missing or invalid JWT token"},
        404: {"description": "Post not found (or not owned by you)"},
    },
)
async def delete_post(
    post_id: str,
    current_user: UserDocument = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DeleteResponse:
    """
    Permanently delete a post.

    This action is irreversible.
    You can only delete posts that you own.
    Returns 404 if the post doesn't exist or belongs to another user.
    """
    deleted_id = await PostService.delete_post(
        db=db,
        post_id=post_id,
        user_id=str(current_user.id),
    )
    return DeleteResponse(
        success=True,
        message="Post deleted successfully.",
        deleted_id=deleted_id,
    )
