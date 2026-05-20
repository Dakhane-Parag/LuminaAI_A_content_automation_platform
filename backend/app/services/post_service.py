"""
Brandflow AI - Post Service
==============================
All business logic for post management operations.

Services sit between routes (HTTP layer) and database (persistence layer).
They NEVER import from routes and are NOT aware of HTTP concerns
(no Request objects, no Response objects — only domain logic).

Public API of this module:
    PostService.create_post()
    PostService.get_user_posts()
    PostService.get_post_by_id()
    PostService.update_post()
    PostService.delete_post()
"""

from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.post import PostDocument, PostStatus
from app.schemas.post import PostCreate, PostResponse, PostUpdate


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_object_id(value: str, label: str = "ID") -> ObjectId:
    """
    Validate that `value` is a well-formed MongoDB ObjectId string.

    Args:
        value: The string to validate.
        label: Human-readable field label used in error messages.

    Returns:
        The parsed ObjectId.

    Raises:
        HTTPException 400 — if value is not a valid ObjectId.
    """
    if not ObjectId.is_valid(value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label} format: '{value}' is not a valid ObjectId.",
        )
    return ObjectId(value)


def _doc_to_response(doc: dict) -> PostResponse:
    """
    Convert a raw MongoDB document dict into a PostResponse schema.

    Handles the _id → id field rename and ObjectId serialisation.

    Args:
        doc: Raw document dict returned by Motor.

    Returns:
        Populated PostResponse instance.
    """
    return PostResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        prompt=doc.get("prompt", ""),
        caption=doc.get("caption", ""),
        hashtags=doc.get("hashtags", []),
        design_style=doc.get("design_style", ""),
        tone=doc.get("tone", ""),
        status=doc.get("status", PostStatus.DRAFT),
        image_url=doc.get("image_url"),
        scheduled_time=doc.get("scheduled_time"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


# ---------------------------------------------------------------------------
# Post Service Class
# ---------------------------------------------------------------------------

class PostService:
    """
    Encapsulates all post-related database operations.

    Design principles:
    - Each method receives a db handle (injected by FastAPI dependency)
      rather than holding a reference at class level — keeps instances
      stateless and test-friendly.
    - Returns domain schemas (PostResponse / List[PostResponse]), not raw dicts.
    - Ownership is validated in every write/read-by-id operation.
    """

    # ------------------------------------------------------------------
    # CREATE
    # ------------------------------------------------------------------

    @staticmethod
    async def create_post(
        db: AsyncIOMotorDatabase,
        post_data: PostCreate,
        user_id: str,
    ) -> PostResponse:
        """
        Create a new post document owned by the authenticated user.

        Steps:
        1. Build a PostDocument with all provided fields.
        2. Insert into the 'posts' collection.
        3. Return the serialised PostResponse.

        Args:
            db:        Active MongoDB database handle.
            post_data: Validated PostCreate schema from the request body.
            user_id:   MongoDB ID string of the currently authenticated user.

        Returns:
            PostResponse of the newly created post.

        Raises:
            HTTPException 500 — unexpected insert failure.
        """
        now = datetime.now(timezone.utc)

        new_post = PostDocument(
            user_id=user_id,
            prompt=post_data.prompt,
            caption=post_data.caption,
            hashtags=post_data.hashtags,
            design_style=post_data.design_style,
            tone=post_data.tone,
            status=PostStatus.DRAFT,        # always start as draft
            image_url=post_data.image_url,
            scheduled_time=post_data.scheduled_time,
            created_at=now,
            updated_at=now,
        )

        result = await db.posts.insert_one(new_post.to_dict())

        if not result.inserted_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create post. Please try again.",
            )

        # Fetch the freshly inserted document to ensure the response is
        # consistent with what is stored (avoids any serialisation discrepancy).
        created_doc = await db.posts.find_one({"_id": result.inserted_id})
        return _doc_to_response(created_doc)

    # ------------------------------------------------------------------
    # READ — list
    # ------------------------------------------------------------------

    @staticmethod
    async def get_user_posts(
        db: AsyncIOMotorDatabase,
        user_id: str,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> List[PostResponse]:
        """
        Fetch all posts belonging to the authenticated user, newest first.

        Ownership is enforced at the query level — user_id is always included
        in the filter, so one user can NEVER see another user's posts.

        Args:
            db:            Active MongoDB database handle.
            user_id:       MongoDB ID string of the authenticated user.
            status_filter: Optionally filter by post status (draft/scheduled/published).
            skip:          Number of documents to skip (for pagination).
            limit:         Maximum number of documents to return.

        Returns:
            List of PostResponse objects (may be empty).
        """
        query: dict = {"user_id": user_id}

        # Optional status filter
        if status_filter:
            if status_filter not in PostStatus.ALL_VALUES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter '{status_filter}'. Must be one of: {', '.join(PostStatus.ALL_VALUES)}.",
                )
            query["status"] = status_filter

        cursor = (
            db.posts.find(query)
            .sort("created_at", -1)   # newest first
            .skip(skip)
            .limit(limit)
        )

        posts: List[PostResponse] = []
        async for doc in cursor:
            posts.append(_doc_to_response(doc))

        return posts

    # ------------------------------------------------------------------
    # READ — single
    # ------------------------------------------------------------------

    @staticmethod
    async def get_post_by_id(
        db: AsyncIOMotorDatabase,
        post_id: str,
        user_id: str,
    ) -> PostResponse:
        """
        Fetch a single post by its MongoDB ID, enforcing ownership.

        Args:
            db:      Active MongoDB database handle.
            post_id: String representation of the post's ObjectId.
            user_id: MongoDB ID string of the authenticated user.

        Returns:
            PostResponse if found and owned by user_id.

        Raises:
            HTTPException 400 — invalid ObjectId format.
            HTTPException 404 — post not found OR not owned by user (same error
                                to prevent object enumeration attacks).
        """
        oid = _validate_object_id(post_id, label="post ID")

        # Always include user_id in the query — ownership check at DB level
        doc = await db.posts.find_one({"_id": oid, "user_id": user_id})

        if doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Post '{post_id}' not found.",
            )

        return _doc_to_response(doc)

    # ------------------------------------------------------------------
    # UPDATE
    # ------------------------------------------------------------------

    @staticmethod
    async def update_post(
        db: AsyncIOMotorDatabase,
        post_id: str,
        update_data: PostUpdate,
        user_id: str,
    ) -> PostResponse:
        """
        Partially update a post. Only fields explicitly provided by the
        client (non-None) are applied — unset fields remain unchanged.

        Ownership is validated before any modification occurs.

        Args:
            db:          Active MongoDB database handle.
            post_id:     String ObjectId of the post to update.
            update_data: Validated PostUpdate schema (all fields optional).
            user_id:     MongoDB ID string of the authenticated user.

        Returns:
            The updated PostResponse.

        Raises:
            HTTPException 400 — invalid post_id format.
            HTTPException 404 — post not found or not owned by user.
        """
        oid = _validate_object_id(post_id, label="post ID")

        # Verify the post exists and is owned by this user before touching it
        existing = await db.posts.find_one({"_id": oid, "user_id": user_id})
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Post '{post_id}' not found.",
            )

        # Build the $set payload — exclude None values so we only update
        # fields the client actually sent.
        changes = update_data.model_dump(exclude_none=True)

        if not changes:
            # Nothing to update — return the current state unchanged
            return _doc_to_response(existing)

        # Always stamp updated_at on any real modification
        changes["updated_at"] = datetime.now(timezone.utc)

        result = await db.posts.update_one(
            {"_id": oid, "user_id": user_id},
            {"$set": changes},
        )

        if result.matched_count == 0:
            # Extremely unlikely given the existence check above, but be safe
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Post '{post_id}' could not be updated.",
            )

        # Return the refreshed document
        updated_doc = await db.posts.find_one({"_id": oid})
        return _doc_to_response(updated_doc)

    # ------------------------------------------------------------------
    # DELETE
    # ------------------------------------------------------------------

    @staticmethod
    async def delete_post(
        db: AsyncIOMotorDatabase,
        post_id: str,
        user_id: str,
    ) -> str:
        """
        Permanently delete a post, enforcing ownership.

        Args:
            db:      Active MongoDB database handle.
            post_id: String ObjectId of the post to delete.
            user_id: MongoDB ID string of the authenticated user.

        Returns:
            The deleted post's ID string (for confirmation in the response).

        Raises:
            HTTPException 400 — invalid post_id format.
            HTTPException 404 — post not found or not owned by user.
        """
        oid = _validate_object_id(post_id, label="post ID")

        # delete_one with user_id in the filter — one atomic ownership + delete
        result = await db.posts.delete_one({"_id": oid, "user_id": user_id})

        if result.deleted_count == 0:
            # Either the ID doesn't exist or it belongs to a different user —
            # return 404 in both cases to prevent object enumeration.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Post '{post_id}' not found.",
            )

        return post_id
