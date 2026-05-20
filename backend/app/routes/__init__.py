"""
Brandflow AI - Routes Package
Central router aggregation — all sub-routers are registered here
and imported by main.py via a single include call.

Registered routers:
    /auth       — Registration, login, JWT token, profile
    /health     — App liveness and DB connectivity checks
    /posts      — Post CRUD (create / read / update / delete)
"""

from fastapi import APIRouter

from app.routes.auth import router as auth_router
from app.routes.health import router as health_router
from app.routes.post_routes import router as posts_router

# Root API router — all routes are nested under this
api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(health_router)
api_router.include_router(posts_router)

__all__ = ["api_router"]
