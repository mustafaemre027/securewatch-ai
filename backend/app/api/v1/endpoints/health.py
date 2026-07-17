from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.core.config import get_settings
from app.core.exceptions import AppException
from app.db import check_database_connection

router = APIRouter()


@router.get("", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Check the health status of the service and database connection.

    Raises:
        AppException: If the database is not available (503 Service Unavailable).

    Returns:
        HealthResponse: Status details of the application and database.
    """
    settings = get_settings()

    if not check_database_connection():
        raise AppException(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Database connection is not available."
        )

    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        database="connected"
    )
