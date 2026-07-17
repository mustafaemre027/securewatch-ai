import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.exceptions import AppException


class DummyModel(BaseModel):
    name: str
    age: int


@pytest.fixture(autouse=True)
def setup_test_routes(app: FastAPI) -> None:
    """Fixture to dynamically register dummy test routes to the app instance.

    This ensures test endpoints are not part of the production application.
    """

    @app.get("/_test/app-exception")
    def trigger_app_exception():
        raise AppException(
            status_code=400,
            code="TEST_APP_ERROR",
            message="This is a test application error.",
            details={"test": True}
        )

    @app.get("/_test/http-exception")
    def trigger_http_exception():
        raise HTTPException(
            status_code=403,
            detail="Forbidden test route."
        )

    @app.post("/_test/validation-error")
    def trigger_validation_error(data: DummyModel):
        return {"status": "ok"}

    @app.get("/_test/unexpected-error")
    def trigger_unexpected_error():
        raise ValueError("Secret database password is leaked? No, it shouldn't be.")


def test_app_exception_handler(client: TestClient) -> None:
    """Test custom AppException handler returns correct JSON structure and code."""
    response = client.get("/_test/app-exception")
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "TEST_APP_ERROR",
            "message": "This is a test application error.",
            "details": {"test": True}
        }
    }


def test_http_exception_handler(client: TestClient) -> None:
    """Test HTTPException handler returns correct format."""
    response = client.get("/_test/http-exception")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "FORBIDDEN",
            "message": "Forbidden test route.",
            "details": None
        }
    }


def test_validation_error_handler(client: TestClient) -> None:
    """Test RequestValidationError returns 422 and validation details."""
    response = client.post("/_test/validation-error", json={"name": "test"})
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == "Validation failed for request parameters or body."
    assert len(error["details"]) > 0


def test_unexpected_error_handler(client: TestClient) -> None:
    """Test unexpected Exception returns 500 and hides internal tracebacks."""
    response = client.get("/_test/unexpected-error")
    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Please try again later.",
            "details": None
        }
    }
    # Verify the actual ValueError message did not leak to client
    assert "secret database password" not in response.text.lower()
