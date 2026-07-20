"""API v1 endpoints package."""
from app.api.v1.endpoints.audit_logs import router as audit_logs_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.users import router as users_router

__all__ = [
    "health_router",
    "auth_router",
    "users_router",
    "audit_logs_router",
]
