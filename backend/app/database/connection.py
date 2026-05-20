"""
Brandflow AI - MongoDB Database Layer
======================================
Async MongoDB client management using Motor.

Design decisions:
- Single MongoClient instance shared across the app (connection pool)
- Async lifecycle managed via FastAPI lifespan context manager
- Dependency injection via get_database() — never import db object directly
- Works with both local MongoDB AND MongoDB Atlas (mongodb+srv://) out of the box
- certifi provides the trusted CA bundle for Atlas TLS verification on Windows
"""

from typing import AsyncGenerator

import certifi  # trusted CA bundle — required for MongoDB Atlas TLS on Windows
import motor.motor_asyncio
from fastapi import HTTPException, status
from pymongo import ASCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.config.settings import settings


class DatabaseManager:
    """
    Manages the Motor async MongoDB client lifecycle.
    One instance is created at application startup and torn down at shutdown.
    """

    def __init__(self) -> None:
        self.client: motor.motor_asyncio.AsyncIOMotorClient | None = None
        self.db: motor.motor_asyncio.AsyncIOMotorDatabase | None = None

    async def connect(self) -> None:
        """
        Open the MongoDB connection and verify connectivity.
        Raises RuntimeError if the database is unreachable.
        """
        try:
            self.client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,  # 5-second connection timeout
                maxPoolSize=50,                 # max connections in pool
                minPoolSize=5,                  # keep at least 5 alive
                tlsCAFile=certifi.where(),      # Atlas TLS — trusted CA bundle (safe for local too)
            )

            # Force a round-trip to verify the server is reachable
            await self.client.admin.command("ping")
            self.db = self.client[settings.MONGODB_DB_NAME]

            print(f"Connected to MongoDB: {settings.MONGODB_DB_NAME}")
            await self._create_indexes()

        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            raise RuntimeError(f"Could not connect to MongoDB: {e}") from e

    async def disconnect(self) -> None:
        """Close the MongoDB connection pool gracefully."""
        if self.client:
            self.client.close()
            print("MongoDB connection closed.")

    async def _create_indexes(self) -> None:
        """
        Create collection indexes on startup.
        Using background=True ensures existing data isn't locked during creation.
        """
        if self.db is None:
            return

        # Users collection indexes
        await self.db.users.create_index(
            [("email", ASCENDING)],
            unique=True,
            background=True,
            name="email_unique_idx",
        )

        # Posts collection indexes
        # Compound index: fetching all posts for a user sorted by date is the
        # hottest query path — this index makes it O(log n) rather than a
        # full collection scan.
        await self.db.posts.create_index(
            [("user_id", ASCENDING), ("created_at", ASCENDING)],
            background=True,
            name="posts_user_date_idx",
        )

        # Secondary index to speed up status-filtered list queries
        await self.db.posts.create_index(
            [("user_id", ASCENDING), ("status", ASCENDING)],
            background=True,
            name="posts_user_status_idx",
        )

        print("MongoDB indexes verified/created.")

    def get_db(self) -> motor.motor_asyncio.AsyncIOMotorDatabase:
        """
        Return the active database handle.
        Raises HTTPException if called before connect() succeeds.
        """
        if self.db is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database is not initialised. Please try again later.",
            )
        return self.db


# ---------------------------------------------------------------------------
# Module-level singleton — imported by the lifespan manager in main.py
# ---------------------------------------------------------------------------
db_manager = DatabaseManager()


# ---------------------------------------------------------------------------
# FastAPI Dependency
# ---------------------------------------------------------------------------
async def get_database() -> AsyncGenerator[motor.motor_asyncio.AsyncIOMotorDatabase, None]:
    """
    FastAPI dependency that yields the active MongoDB database.

    Usage:
        @router.get("/example")
        async def example(db: AsyncIOMotorDatabase = Depends(get_database)):
            ...
    """
    yield db_manager.get_db()
