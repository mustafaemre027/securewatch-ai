"""Tests for CORS middleware configuration."""
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import get_settings

client = TestClient(app)


def test_cors_preflight_allowed_origin() -> None:
    """Test that a preflight request from the configured origin is allowed."""
    settings = get_settings()
    headers = {
        "Origin": settings.frontend_origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization",
    }
    response = client.options("/", headers=headers)
    
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == settings.frontend_origin


def test_cors_unconfigured_origin_rejected() -> None:
    """Test that an unconfigured origin does not receive an Access-Control-Allow-Origin header."""
    headers = {
        "Origin": "https://unconfigured-origin.com",
    }
    response = client.get("/", headers=headers)
    
    assert "access-control-allow-origin" not in response.headers
