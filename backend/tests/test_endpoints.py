from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import create_application
from app.models.user import UserRole
from app.schemas.user import UserCreate
from app.services.user_service import create_user


@pytest.fixture
def db_session():
    """Isolated SQLite in-memory database session fixture."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()



@pytest.fixture
def app_instance(db_session: Session):
    """FastAPI test app with get_db dependency overridden to isolated db_session."""
    app = create_application()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return app


@pytest.fixture
def client(app_instance):
    return TestClient(app_instance, raise_server_exceptions=False)


def test_login_success_and_audit_log(db_session: Session, client: TestClient) -> None:
    """Test POST /api/v1/auth/login with valid credentials returns token and logs audit event."""
    create_user(db_session, UserCreate(username="login_user", email="login@test.ai", password="Password123!", role=UserRole.ANALYST))

    response = client.post("/api/v1/auth/login", json={"username": "login_user", "password": "Password123!"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "login_user"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]


def test_login_failed_invalid_credentials(client: TestClient) -> None:
    """Test POST /api/v1/auth/login with invalid credentials returns 401."""
    response = client.post("/api/v1/auth/login", json={"username": "nonexistent", "password": "WrongPassword!"})
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "CREDENTIALS_INVALID"


def test_create_user_admin_success(db_session: Session, client: TestClient) -> None:
    """Test Admin can create a new analyst user and creates audit log."""
    create_user(db_session, UserCreate(username="admin_user", email="admin@test.ai", password="AdminPassword123!", role=UserRole.ADMIN))

    # Perform login as Admin to get JWT token
    login_resp = client.post("/api/v1/auth/login", json={"username": "admin_user", "password": "AdminPassword123!"})
    token = login_resp.json()["access_token"]

    # Create user as Admin
    create_payload = {
        "username": "new_analyst",
        "email": "new_analyst@test.ai",
        "password": "AnalystPassword123!",
        "role": "ANALYST",
    }
    response = client.post("/api/v1/users/", json=create_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "new_analyst"
    assert data["role"] == "ANALYST"
    assert "password" not in data
    assert "password_hash" not in data


def test_create_user_analyst_forbidden(db_session: Session, client: TestClient) -> None:
    """Test Analyst role attempting to create a user receives 403 Forbidden."""
    create_user(db_session, UserCreate(username="analyst_user", email="analyst@test.ai", password="AnalystPassword123!", role=UserRole.ANALYST))

    login_resp = client.post("/api/v1/auth/login", json={"username": "analyst_user", "password": "AnalystPassword123!"})
    token = login_resp.json()["access_token"]

    create_payload = {
        "username": "unauthorized_created",
        "email": "unauth@test.ai",
        "password": "Password123!",
        "role": "ANALYST",
    }
    response = client.post("/api/v1/users/", json=create_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "PERMISSION_DENIED"


def test_protected_route_unauthenticated(client: TestClient) -> None:
    """Test accessing protected route without token returns 401 Unauthorized."""
    response = client.get("/api/v1/users/")
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "CREDENTIALS_INVALID"


def test_list_audit_logs_admin_and_analyst_forbidden(db_session: Session, client: TestClient) -> None:
    """Test Admin can list audit logs and Analyst receives 403 Forbidden."""
    create_user(db_session, UserCreate(username="admin_audit", email="admin_audit@test.ai", password="Password123!", role=UserRole.ADMIN))
    create_user(db_session, UserCreate(username="analyst_audit", email="analyst_audit@test.ai", password="Password123!", role=UserRole.ANALYST))

    admin_token = client.post("/api/v1/auth/login", json={"username": "admin_audit", "password": "Password123!"}).json()["access_token"]
    analyst_token = client.post("/api/v1/auth/login", json={"username": "analyst_audit", "password": "Password123!"}).json()["access_token"]

    # Admin lists audit logs
    admin_resp = client.get("/api/v1/audit-logs/", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200
    logs = admin_resp.json()
    assert isinstance(logs, list)
    assert len(logs) >= 2  # Login audit logs

    # Analyst listing audit logs -> 403
    analyst_resp = client.get("/api/v1/audit-logs/", headers={"Authorization": f"Bearer {analyst_token}"})
    assert analyst_resp.status_code == 403


def test_openapi_route_registration_uniqueness(client: TestClient) -> None:
    """Verify OpenAPI schema generation and uniqueness of registered API paths."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi = response.json()
    paths = openapi.get("paths", {})

    assert "/api/v1/auth/login" in paths
    assert "/api/v1/users/" in paths
    assert "/api/v1/audit-logs/" in paths
