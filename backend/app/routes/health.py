"""
Brandflow AI - Health Check & Database Test Routes
=====================================================
Operational endpoints for liveness checks and DB connectivity verification.

Endpoints:
    GET /api/v1/health       — Lightweight liveness probe
    GET /api/v1/health/db    — Verifies MongoDB connectivity
"""

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.database.connection import get_database

router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="Application liveness check",
    responses={200: {"description": "Application is running"}},
)
async def health_check() -> dict:
    """
    Lightweight liveness probe.
    Returns immediately without touching the database.
    Use this for load balancer health checks.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get(
    "/db",
    status_code=status.HTTP_200_OK,
    summary="Database connectivity check",
    responses={
        200: {"description": "Database is reachable"},
        503: {"description": "Database is unreachable"},
    },
)
async def database_health_check(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    """
    Verify MongoDB connectivity by running a lightweight ping command.
    Use this to confirm database readiness during deployment.
    """
    await db.command("ping")
    stats = await db.command("dbStats")

    return {
        "status": "healthy",
        "database": settings.MONGODB_DB_NAME,
        "collections": stats.get("collections", 0),
        "documents": stats.get("objects", 0),
        "storage_size_bytes": stats.get("storageSize", 0),
    }
