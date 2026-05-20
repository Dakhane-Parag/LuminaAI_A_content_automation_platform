"""
Brandflow AI - FastAPI Application Entry Point
===============================================
Initialises the FastAPI app, configures middleware, mounts routers,
and manages the application lifecycle (startup / shutdown).

Architecture overview:
    main.py          — App factory + lifecycle management
    config/          — Environment-driven settings
    database/        — Async Motor MongoDB client
    models/          — MongoDB document shapes
    schemas/         — Pydantic I/O schemas
    services/        — Business logic (no HTTP knowledge)
    routes/          — FastAPI routers (HTTP layer only)
    utils/           — Pure helper functions (security, etc.)
    dependencies/    — Reusable FastAPI Depends() callables
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import settings
from app.database.connection import db_manager
from app.routes import api_router


# ---------------------------------------------------------------------------
# Application Lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    FastAPI lifespan context manager.
    Code before `yield` runs at startup; code after runs at shutdown.
    This replaces the deprecated @app.on_event("startup") pattern.
    """
    # ── Startup ──────────────────────────────────────────────────────────
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"   Environment : {settings.ENVIRONMENT}")
    print(f"   Debug mode  : {settings.DEBUG}")

    await db_manager.connect()

    yield  # Application is now live and handling requests

    # ── Shutdown ─────────────────────────────────────────────────────────
    print(f"🛑 Shutting down {settings.APP_NAME}...")
    await db_manager.disconnect()


# ---------------------------------------------------------------------------
# App Factory
# ---------------------------------------------------------------------------
def create_application() -> FastAPI:
    """
    Construct and configure the FastAPI application instance.
    Using a factory function makes the app easier to test
    (create a fresh instance per test suite).
    """
    application = FastAPI(
        title=settings.APP_NAME,
        description=settings.APP_DESCRIPTION,
        version=settings.APP_VERSION,
        docs_url="/docs",           # Swagger UI
        redoc_url="/redoc",         # ReDoc UI
        openapi_url="/openapi.json",
        lifespan=lifespan,
        # Only show debug info in non-production environments
        debug=settings.DEBUG and not settings.is_production,
    )

    # ── Middleware ────────────────────────────────────────────────────────

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # ── Routers ───────────────────────────────────────────────────────────

    application.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # ── Root endpoint ─────────────────────────────────────────────────────

    @application.get(
        "/",
        tags=["Root"],
        summary="API root — welcome message",
        status_code=status.HTTP_200_OK,
    )
    async def root() -> dict:
        """
        Root endpoint. Confirms the API is running and provides
        quick links to documentation.
        """
        return {
            "message": f"Welcome to {settings.APP_NAME} API 🚀",
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "redoc": "/redoc",
            "health": f"{settings.API_V1_PREFIX}/health",
        }

    # ── Global Exception Handlers ─────────────────────────────────────────

    @application.exception_handler(404)
    async def not_found_handler(request: Request, exc) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "detail": f"Endpoint '{request.url.path}' not found.",
                "success": False,
            },
        )

    @application.exception_handler(500)
    async def internal_error_handler(request: Request, exc) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An unexpected error occurred. Please try again later.",
                "success": False,
            },
        )

    return application


# ---------------------------------------------------------------------------
# Application Instance (imported by uvicorn)
# ---------------------------------------------------------------------------
app = create_application()


# ---------------------------------------------------------------------------
# Development entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,       # hot-reload in dev mode
        log_level="debug" if settings.DEBUG else "info",
        workers=1,                   # use 1 worker when reload=True
    )
