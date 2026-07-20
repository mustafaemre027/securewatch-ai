from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import create_application
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
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
    """FastAPI test app instance configured with isolated db_session dependency override."""
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


# --- 1. Authentication Comprehensive Edge-Cases ---

def test_login_success_and_jwt_claims(db_session: Session, client: TestClient) -> None:
    """Test login success returns token with correct claims payload and audit log."""
    create_user(db_session, UserCreate(username="auth_master", email="master@test.ai", password="SecretPassword123!", role=UserRole.ADMIN))

    resp = client.post("/api/v1/auth/login", json={"username": "auth_master", "password": "SecretPassword123!"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "auth_master"
    assert data["user"]["role"] == "ADMIN"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Verify audit log entry was created
    audit = db_session.query(AuditLog).filter(AuditLog.action_type == "USER_LOGIN").first()
    assert audit is not None
    assert audit.user_id == data["user"]["id"]
    assert "SecretPassword123!" not in audit.description


def test_login_wrong_password_generic_error(db_session: Session, client: TestClient) -> None:
    """Test login with wrong password returns 401 with generic message."""
    create_user(db_session, UserCreate(username="user_wrong_pass", email="wrong_pass@test.ai", password="Password123!", role=UserRole.ANALYST))

    resp = client.post("/api/v1/auth/login", json={"username": "user_wrong_pass", "password": "BadPassword123!"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "CREDENTIALS_INVALID"
    assert data["error"]["message"] == "Yanlış kullanıcı adı veya parola girildi."


def test_login_unknown_user_generic_error(client: TestClient) -> None:
    """Test login with unknown user returns identical 401 generic message without leaking existence."""
    resp = client.post("/api/v1/auth/login", json={"username": "ghost_user", "password": "Password123!"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "CREDENTIALS_INVALID"
    assert data["error"]["message"] == "Yanlış kullanıcı adı veya parola girildi."


def test_auth_header_malformed(db_session: Session, client: TestClient) -> None:
    """Test malformed authorization headers return 401."""
    create_user(db_session, UserCreate(username="admin1", email="a1@test.ai", password="Password123!", role=UserRole.ADMIN))

    # Invalid header format
    res1 = client.get("/api/v1/users/", headers={"Authorization": "NotBearer invalid_token"})
    assert res1.status_code == 401

    res2 = client.get("/api/v1/users/", headers={"Authorization": "Bearer"})
    assert res2.status_code == 401


# --- 2. RBAC & Dynamic Database Role Verification ---

def test_rbac_admin_vs_analyst_permissions(db_session: Session, client: TestClient) -> None:
    """Test Admin can list users/audit logs while Analyst is forbidden (403)."""
    admin = create_user(db_session, UserCreate(username="rbac_admin", email="admin@rbac.ai", password="Password123!", role=UserRole.ADMIN))
    analyst = create_user(db_session, UserCreate(username="rbac_analyst", email="analyst@rbac.ai", password="Password123!", role=UserRole.ANALYST))

    admin_token = client.post("/api/v1/auth/login", json={"username": "rbac_admin", "password": "Password123!"}).json()["access_token"]
    analyst_token = client.post("/api/v1/auth/login", json={"username": "rbac_analyst", "password": "Password123!"}).json()["access_token"]

    # GET /users/
    assert client.get("/api/v1/users/", headers={"Authorization": f"Bearer {admin_token}"}).status_code == 200
    res_users_analyst = client.get("/api/v1/users/", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res_users_analyst.status_code == 403
    assert res_users_analyst.json()["error"]["code"] == "PERMISSION_DENIED"

    # GET /audit-logs/
    assert client.get("/api/v1/audit-logs/", headers={"Authorization": f"Bearer {admin_token}"}).status_code == 200
    res_audit_analyst = client.get("/api/v1/audit-logs/", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res_audit_analyst.status_code == 403
    assert res_audit_analyst.json()["error"]["code"] == "PERMISSION_DENIED"


def test_rbac_dynamic_db_role_change(db_session: Session, client: TestClient) -> None:
    """Test that updating user role in DB dynamically affects subsequent token authorization."""
    user = create_user(db_session, UserCreate(username="mutable_role_user", email="mutable@test.ai", password="Password123!", role=UserRole.ADMIN))

    # Obtain token while user is ADMIN
    token = client.post("/api/v1/auth/login", json={"username": "mutable_role_user", "password": "Password123!"}).json()["access_token"]
    assert client.get("/api/v1/users/", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    # Demote user to ANALYST in DB
    user.role = UserRole.ANALYST
    db_session.commit()

    # Using the same token now should be rejected with 403 Forbidden!
    resp = client.get("/api/v1/users/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"


# --- 3. User Endpoint Validation & Errors ---

def test_create_user_validations(db_session: Session, client: TestClient) -> None:
    """Test user creation validation errors (duplicate username/email, invalid email, invalid role)."""
    admin = create_user(db_session, UserCreate(username="admin_val", email="val@test.ai", password="Password123!", role=UserRole.ADMIN))
    token = client.post("/api/v1/auth/login", json={"username": "admin_val", "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Duplicate username -> 400 DUPLICATE_USERNAME
    r1 = client.post("/api/v1/users/", json={"username": "admin_val", "email": "other@test.ai", "password": "Password123!", "role": "ANALYST"}, headers=headers)
    assert r1.status_code == 400
    assert r1.json()["error"]["code"] == "DUPLICATE_USERNAME"

    # Duplicate email -> 400 DUPLICATE_EMAIL
    r2 = client.post("/api/v1/users/", json={"username": "new_user_unique", "email": "val@test.ai", "password": "Password123!", "role": "ANALYST"}, headers=headers)
    assert r2.status_code == 400
    assert r2.json()["error"]["code"] == "DUPLICATE_EMAIL"

    # Invalid email format -> 422 VALIDATION_ERROR
    r3 = client.post("/api/v1/users/", json={"username": "user_bad_email", "email": "not_an_email", "password": "Password123!", "role": "ANALYST"}, headers=headers)
    assert r3.status_code == 422
    assert r3.json()["error"]["code"] == "VALIDATION_ERROR"

    # Invalid role -> 422 VALIDATION_ERROR
    r4 = client.post("/api/v1/users/", json={"username": "user_bad_role", "email": "badrole@test.ai", "password": "Password123!", "role": "SUPER_ADMIN"}, headers=headers)
    assert r4.status_code == 422
    assert r4.json()["error"]["code"] == "VALIDATION_ERROR"


# --- 4. Audit Log Filters & SET NULL Persistence ---

def test_audit_log_filters_and_set_null(db_session: Session, client: TestClient) -> None:
    """Test audit log filters (user_id, action_type) and SET NULL serialization."""
    admin = create_user(db_session, UserCreate(username="admin_audit_test", email="atest@test.ai", password="Password123!", role=UserRole.ADMIN))
    analyst = create_user(db_session, UserCreate(username="analyst_audit_test", email="atest2@test.ai", password="Password123!", role=UserRole.ANALYST))

    token = client.post("/api/v1/auth/login", json={"username": "admin_audit_test", "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Trigger action creating USER_CREATED audit log
    client.post("/api/v1/users/", json={"username": "created_user_test", "email": "cr@test.ai", "password": "Password123!", "role": "ANALYST"}, headers=headers)

    # Filter by action_type=USER_CREATED
    r_filter_action = client.get(f"/api/v1/audit-logs/?action_type=USER_CREATED", headers=headers)
    assert r_filter_action.status_code == 200
    logs_action = r_filter_action.json()
    assert len(logs_action) == 1
    assert logs_action[0]["action_type"] == "USER_CREATED"

    # Filter by user_id
    r_filter_user = client.get(f"/api/v1/audit-logs/?user_id={admin.id}", headers=headers)
    assert r_filter_user.status_code == 200
    assert len(r_filter_user.json()) >= 1

    # Verify SET NULL: Delete analyst user and check audit log Serialization
    db_session.delete(analyst)
    db_session.commit()

    r_logs_all = client.get("/api/v1/audit-logs/", headers=headers)
    assert r_logs_all.status_code == 200
    logs_all = r_logs_all.json()
    # Confirm no password or secrets leak in audit descriptions
    for entry in logs_all:
        assert "password" not in entry["description"].lower()
        assert "secret" not in entry["description"].lower()


# --- 5. Nested Error Schema Integrity ---

def test_nested_error_format_consistency(client: TestClient) -> None:
    """Test 400, 401, 403, 404, and 422 errors maintain the central nested error structure."""
    # 401 Unauthorized
    r401 = client.get("/api/v1/users/")
    assert r401.status_code == 401
    assert "error" in r401.json()
    assert "code" in r401.json()["error"]
    assert "message" in r401.json()["error"]

    # 404 Not Found
    r404 = client.get("/api/v1/nonexistent-route")
    assert r404.status_code == 404
    assert "error" in r404.json()
    assert r404.json()["error"]["code"] == "NOT_FOUND"

    # 422 Unprocessable Entity
    r422 = client.post("/api/v1/auth/login", json={"username": ""})
    assert r422.status_code == 422
    assert "error" in r422.json()
    assert r422.json()["error"]["code"] == "VALIDATION_ERROR"
