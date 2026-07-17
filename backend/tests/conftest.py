import os
import pytest

# Set safe dummy environment variables for tests before importing the application
os.environ["DATABASE_URL"] = "postgresql+psycopg://dummy_user:dummy_pass@localhost:5432/dummy_db"
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "False"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.main import create_application


@pytest.fixture
def app() -> FastAPI:
    """Fixture to provide an isolated FastAPI application instance.

    Returns:
        FastAPI: The application instance.
    """
    application = create_application()
    return application


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Fixture to provide a TestClient configured with raise_server_exceptions=False.

    Args:
        app (FastAPI): The test application instance.

    Returns:
        TestClient: The configured TestClient.
    """
    return TestClient(app, raise_server_exceptions=False)
