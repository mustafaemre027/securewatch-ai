import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole


from sqlalchemy.pool import StaticPool


@pytest.fixture
def db_session():
    """Isolated SQLite in-memory database session fixture with foreign key support."""
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


def test_user_role_enum_values() -> None:
    """Verify UserRole enum values strictly match ADMIN and ANALYST."""
    assert UserRole.ADMIN.value == "ADMIN"
    assert UserRole.ANALYST.value == "ANALYST"
    assert UserRole.ADMIN == "ADMIN"
    assert UserRole.ANALYST == "ANALYST"


def test_create_user_and_audit_log(db_session: Session) -> None:
    """Test creating User and AuditLog models with proper attributes."""
    user = User(
        username="analyst_test",
        email="analyst@securewatch.ai",
        password_hash="$2b$12$dummyhashforunitestst1234567890",
        role=UserRole.ANALYST,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.id is not None
    assert user.username == "analyst_test"
    assert user.email == "analyst@securewatch.ai"
    assert user.role == UserRole.ANALYST
    assert user.created_at is not None
    assert user.updated_at is not None

    audit_log = AuditLog(
        user_id=user.id,
        action_type="LOGIN",
        description="User logged in successfully",
        ip_address="127.0.0.1",
    )
    db_session.add(audit_log)
    db_session.commit()
    db_session.refresh(audit_log)

    assert audit_log.id is not None
    assert audit_log.user_id == user.id
    assert audit_log.user == user
    assert audit_log.action_type == "LOGIN"
    assert audit_log.ip_address == "127.0.0.1"


def test_user_unique_username_constraint(db_session: Session) -> None:
    """Test that username must be unique."""
    user1 = User(
        username="duplicate_user",
        email="user1@securewatch.ai",
        password_hash="hash1",
        role=UserRole.ANALYST,
    )
    user2 = User(
        username="duplicate_user",
        email="user2@securewatch.ai",
        password_hash="hash2",
        role=UserRole.ANALYST,
    )
    db_session.add(user1)
    db_session.commit()

    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_user_unique_email_constraint(db_session: Session) -> None:
    """Test that email must be unique."""
    user1 = User(
        username="user1",
        email="common@securewatch.ai",
        password_hash="hash1",
        role=UserRole.ADMIN,
    )
    user2 = User(
        username="user2",
        email="common@securewatch.ai",
        password_hash="hash2",
        role=UserRole.ANALYST,
    )
    db_session.add(user1)
    db_session.commit()

    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_audit_log_set_null_on_user_delete(db_session: Session) -> None:
    """Test that deleting a user sets user_id to NULL in AuditLog without deleting the log."""
    user = User(
        username="temporary_user",
        email="temp@securewatch.ai",
        password_hash="hash_temp",
        role=UserRole.ANALYST,
    )
    db_session.add(user)
    db_session.commit()
    user_id = user.id

    log_entry = AuditLog(
        user_id=user_id,
        action_type="USER_ACTION",
        description="Action performed by temporary_user before deletion",
        ip_address="192.168.1.100",
    )
    db_session.add(log_entry)
    db_session.commit()
    log_id = log_entry.id

    # Delete the user
    db_session.delete(user)
    db_session.commit()

    # Query the audit log and verify it persists with user_id set to NULL
    fetched_log = db_session.query(AuditLog).filter(AuditLog.id == log_id).first()
    assert fetched_log is not None
    assert fetched_log.user_id is None
    assert fetched_log.description == "Action performed by temporary_user before deletion"
    assert fetched_log.user is None
