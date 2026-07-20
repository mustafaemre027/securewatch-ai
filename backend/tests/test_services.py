import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.exceptions import AppException
from app.db.base import Base
from app.models.audit_log import AuditLog
from app.models.user import UserRole
from app.schemas.auth import UserLogin
from app.schemas.user import UserCreate
from app.services.audit_service import create_audit_log, list_audit_logs
from app.services.auth_service import authenticate_user
from app.services.user_service import (
    create_user,
    create_user_with_audit,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    list_users,
)



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



def test_create_user_service_success(db_session: Session) -> None:
    """Test user creation in service layer hashes password and persists user."""
    user_create = UserCreate(
        username="analyst_test",
        email="analyst@securewatch.ai",
        password="MySecretPassword123!",
        role=UserRole.ANALYST,
    )
    user = create_user(db_session, user_create)

    assert user.id is not None
    assert user.username == "analyst_test"
    assert user.email == "analyst@securewatch.ai"
    assert user.password_hash != "MySecretPassword123!"
    assert user.role == UserRole.ANALYST

    # Query helpers
    assert get_user_by_id(db_session, user.id) == user
    assert get_user_by_username(db_session, "analyst_test") == user
    assert get_user_by_email(db_session, "analyst@securewatch.ai") == user
    assert len(list_users(db_session)) == 1


def test_create_user_duplicate_username(db_session: Session) -> None:
    """Test user creation raises AppException on duplicate username."""
    u1 = UserCreate(username="unique_user", email="u1@securewatch.ai", password="Pass123!", role=UserRole.ANALYST)
    create_user(db_session, u1)

    u2 = UserCreate(username="unique_user", email="u2@securewatch.ai", password="Pass123!", role=UserRole.ANALYST)
    with pytest.raises(AppException) as exc_info:
        create_user(db_session, u2)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "DUPLICATE_USERNAME"


def test_create_user_duplicate_email(db_session: Session) -> None:
    """Test user creation raises AppException on duplicate email."""
    u1 = UserCreate(username="user1", email="same@securewatch.ai", password="Pass123!", role=UserRole.ANALYST)
    create_user(db_session, u1)

    u2 = UserCreate(username="user2", email="same@securewatch.ai", password="Pass123!", role=UserRole.ADMIN)
    with pytest.raises(AppException) as exc_info:
        create_user(db_session, u2)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "DUPLICATE_EMAIL"


def test_authenticate_user_success(db_session: Session) -> None:
    """Test successful user authentication generates valid JWT token and audit log."""
    user_create = UserCreate(
        username="auth_user",
        email="auth@securewatch.ai",
        password="ValidPassword123!",
        role=UserRole.ANALYST,
    )
    create_user(db_session, user_create)

    token_resp = authenticate_user(
        db_session,
        login_data=UserLogin(username="auth_user", password="ValidPassword123!"),
        ip_address="192.168.1.50",
    )

    assert token_resp.access_token is not None
    assert token_resp.token_type == "bearer"
    assert token_resp.user.username == "auth_user"

    # Verify audit log created
    logs = list_audit_logs(db_session, action_type="USER_LOGIN")
    assert len(logs) == 1
    assert logs[0].user_id == token_resp.user.id
    assert logs[0].ip_address == "192.168.1.50"


def test_authenticate_user_wrong_password(db_session: Session) -> None:
    """Test authentication fails with wrong password."""
    user_create = UserCreate(
        username="auth_user2",
        email="auth2@securewatch.ai",
        password="ValidPassword123!",
        role=UserRole.ANALYST,
    )
    create_user(db_session, user_create)

    with pytest.raises(AppException) as exc_info:
        authenticate_user(
            db_session,
            login_data=UserLogin(username="auth_user2", password="WrongPassword123!"),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "CREDENTIALS_INVALID"


def test_authenticate_user_unknown_user(db_session: Session) -> None:
    """Test authentication fails with unknown username without leaking detail."""
    with pytest.raises(AppException) as exc_info:
        authenticate_user(
            db_session,
            login_data=UserLogin(username="nonexistent_user", password="SomePassword123!"),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "CREDENTIALS_INVALID"
    assert exc_info.value.message == "Yanlış kullanıcı adı veya parola girildi."


def test_audit_log_service_and_filters(db_session: Session) -> None:
    """Test audit log creation, listing, and filtering."""
    u1 = create_user(db_session, UserCreate(username="audit_u1", email="au1@test.ai", password="Password123!", role=UserRole.ANALYST))
    u2 = create_user(db_session, UserCreate(username="audit_u2", email="au2@test.ai", password="Password123!", role=UserRole.ADMIN))

    log1 = create_audit_log(db_session, action_type="FILE_UPLOAD", description="Uploaded file.csv", ip_address="10.0.0.1", user_id=u1.id)
    log2 = create_audit_log(db_session, action_type="USER_CREATE", description="Created user", ip_address="10.0.0.2", user_id=u2.id)
    log3 = create_audit_log(db_session, action_type="FILE_UPLOAD", description="Uploaded file2.csv", ip_address="10.0.0.1", user_id=u1.id)

    assert log1.id is not None
    assert log2.id is not None
    assert log3.id is not None

    user1_logs = list_audit_logs(db_session, user_id=u1.id)
    assert len(user1_logs) == 2

    upload_logs = list_audit_logs(db_session, action_type="FILE_UPLOAD")
    assert len(upload_logs) == 2


# --- H2 Atomicity Tests ---

def test_create_user_with_audit_atomically_commits_both(db_session: Session) -> None:
    """Test that create_user_with_audit commits both the user and audit log atomically."""
    admin = create_user(db_session, UserCreate(username="admin_atomic", email="atomic_admin@test.ai", password="Password123!", role=UserRole.ADMIN))
    db_session.commit()  # Commit admin so they exist for audit FK

    new_user = create_user_with_audit(
        db=db_session,
        user_create=UserCreate(username="new_atomic_user", email="new_atomic@test.ai", password="Password123!", role=UserRole.ANALYST),
        created_by_user_id=admin.id,
        ip_address="10.0.0.5",
    )

    assert new_user.id is not None
    fetched_user = db_session.query(type(new_user)).filter_by(id=new_user.id).first()
    assert fetched_user is not None

    audit_log = db_session.query(AuditLog).filter(
        AuditLog.action_type == "USER_CREATED",
        AuditLog.user_id == admin.id,
    ).first()
    assert audit_log is not None
    assert "new_atomic_user" in audit_log.description
    assert "password" not in audit_log.description.lower()


def test_create_user_with_audit_rollback_on_duplicate(db_session: Session) -> None:
    """Test that duplicate username causes rollback; no orphaned user is created."""
    admin = create_user(db_session, UserCreate(username="admin_rollback", email="rollback_admin@test.ai", password="Password123!", role=UserRole.ADMIN))
    db_session.commit()

    create_user_with_audit(
        db=db_session,
        user_create=UserCreate(username="user_to_duplicate", email="dup@test.ai", password="Password123!", role=UserRole.ANALYST),
        created_by_user_id=admin.id,
        ip_address="10.0.0.5",
    )

    # Attempt to create a duplicate — should raise and roll back fully.
    with pytest.raises(AppException) as exc_info:
        create_user_with_audit(
            db=db_session,
            user_create=UserCreate(username="user_to_duplicate", email="different@test.ai", password="Password123!", role=UserRole.ANALYST),
            created_by_user_id=admin.id,
            ip_address="10.0.0.6",
        )
    assert exc_info.value.code == "DUPLICATE_USERNAME"

    # Verify only one user with that username exists.
    from app.models.user import User
    count = db_session.query(User).filter(User.username == "user_to_duplicate").count()
    assert count == 1

    # Verify only one USER_CREATED audit log exists for this admin (not two).
    audit_count = db_session.query(AuditLog).filter(
        AuditLog.action_type == "USER_CREATED",
        AuditLog.user_id == admin.id,
    ).count()
    assert audit_count == 1
