from datetime import timedelta
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_current_user, require_roles
from app.core.exceptions import AppException
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.services.user_service import create_user


from sqlalchemy.pool import StaticPool


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



from app.core.exception_handlers import register_exception_handlers


@pytest.fixture
def dummy_app(db_session: Session) -> FastAPI:
    """Fixture providing a temporary FastAPI app with dummy RBAC test routes."""
    test_app = FastAPI()
    register_exception_handlers(test_app)

    # Override get_db dependency to use in-memory db_session

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    test_app.dependency_overrides[get_db] = override_get_db

    @test_app.get("/test/protected")
    def protected_route(current_user: User = Depends(get_current_user)):
        return {"username": current_user.username, "role": current_user.role.value}

    @test_app.get("/test/admin-only")
    def admin_route(current_user: User = Depends(require_roles([UserRole.ADMIN]))):
        return {"msg": "Welcome Admin"}

    @test_app.get("/test/analyst-only")
    def analyst_route(current_user: User = Depends(require_roles([UserRole.ANALYST]))):
        return {"msg": "Welcome Analyst"}

    return test_app


@pytest.fixture
def test_client(dummy_app: FastAPI) -> TestClient:
    return TestClient(dummy_app, raise_server_exceptions=False)


def test_get_current_user_success(db_session: Session, test_client: TestClient) -> None:
    """Test get_current_user dependency with valid token returns user."""
    user = create_user(db_session, UserCreate(username="dep_user", email="dep@test.ai", password="Password123!", role=UserRole.ANALYST))
    token = create_access_token({"sub": user.username, "role": user.role.value, "user_id": user.id})

    response = test_client.get("/test/protected", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"username": "dep_user", "role": "ANALYST"}


def test_get_current_user_missing_token(test_client: TestClient) -> None:
    """Test missing authorization header returns 401."""
    response = test_client.get("/test/protected")
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "CREDENTIALS_INVALID"


def test_get_current_user_expired_token(db_session: Session, test_client: TestClient) -> None:
    """Test expired token returns 401 with TOKEN_EXPIRED code."""
    user = create_user(db_session, UserCreate(username="exp_user", email="exp@test.ai", password="Password123!", role=UserRole.ANALYST))
    token = create_access_token({"sub": user.username}, expires_delta=timedelta(seconds=-10))

    response = test_client.get("/test/protected", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "TOKEN_EXPIRED"


def test_get_current_user_deleted_from_db(db_session: Session, test_client: TestClient) -> None:
    """Test valid token for user deleted from database returns 401."""
    token = create_access_token({"sub": "deleted_user"})

    response = test_client.get("/test/protected", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "CREDENTIALS_INVALID"


def test_require_roles_admin_success_and_analyst_forbidden(db_session: Session, test_client: TestClient) -> None:
    """Test RBAC role checking allows Admin to admin route and rejects Analyst with 403."""
    admin_user = create_user(db_session, UserCreate(username="admin_user", email="admin@test.ai", password="Password123!", role=UserRole.ADMIN))
    analyst_user = create_user(db_session, UserCreate(username="analyst_user", email="analyst@test.ai", password="Password123!", role=UserRole.ANALYST))

    admin_token = create_access_token({"sub": admin_user.username})
    analyst_token = create_access_token({"sub": analyst_user.username})

    # Admin accessing admin route -> 200 OK
    res1 = test_client.get("/test/admin-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert res1.status_code == 200
    assert res1.json() == {"msg": "Welcome Admin"}

    # Analyst accessing admin route -> 403 Forbidden
    res2 = test_client.get("/test/admin-only", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res2.status_code == 403
    data2 = res2.json()
    assert data2["error"]["code"] == "PERMISSION_DENIED"
    assert data2["error"]["message"] == "Kullanıcının bu işlemi gerçekleştirmek için yetkisi yetersiz."
