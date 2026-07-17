from unittest.mock import patch
from fastapi.testclient import TestClient
from app.core.config import get_settings


def test_health_check_healthy(client: TestClient) -> None:
    """Test health check endpoint when database connection is healthy.

    Args:
        client (TestClient): The test client.
    """
    settings = get_settings()

    with patch("app.api.v1.endpoints.health.check_database_connection", return_value=True):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "healthy",
            "service": settings.app_name,
            "version": settings.app_version,
            "database": "connected"
        }


def test_health_check_unhealthy(client: TestClient) -> None:
    """Test health check endpoint when database connection fails.

    Args:
        client (TestClient): The test client.
    """
    with patch("app.api.v1.endpoints.health.check_database_connection", return_value=False):
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()

        # Verify central error format
        assert "error" in data
        error = data["error"]
        assert error["code"] == "DATABASE_UNAVAILABLE"
        assert error["message"] == "Database connection is not available."
        assert error["details"] is None

        # Verify no credentials or URL leaked in response
        raw_response_text = response.text
        assert "password" not in raw_response_text.lower()
        assert "postgresql" not in raw_response_text.lower()
        assert "user" not in raw_response_text.lower()
