from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.models.user import UserRole
from app.schemas.audit_log import AuditLogResponse
from app.schemas.auth import Token, UserLogin
from app.schemas.user import UserCreate, UserResponse


class DummyUserORM:
    """Dummy ORM class simulating SQLAlchemy User instance."""
    def __init__(self, id: int, username: str, email: str, password_hash: str, role: UserRole, created_at: datetime):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.role = role
        self.created_at = created_at


class DummyAuditLogORM:
    """Dummy ORM class simulating SQLAlchemy AuditLog instance."""
    def __init__(self, id: int, user_id: int | None, action_type: str, description: str, ip_address: str, created_at: datetime):
        self.id = id
        self.user_id = user_id
        self.action_type = action_type
        self.description = description
        self.ip_address = ip_address
        self.created_at = created_at


def test_user_create_valid() -> None:
    """Test valid user creation schema validation."""
    data = {
        "username": "analyst_ahmet",
        "email": "ahmet@securewatch.ai",
        "password": "TemporaryPass456!",
        "role": "ANALYST",
    }
    schema = UserCreate(**data)
    assert schema.username == "analyst_ahmet"
    assert schema.email == "ahmet@securewatch.ai"
    assert schema.password == "TemporaryPass456!"
    assert schema.role == UserRole.ANALYST


def test_user_create_invalid_role() -> None:
    """Test user creation fails with an invalid role."""
    data = {
        "username": "user1",
        "email": "user1@securewatch.ai",
        "password": "Password123!",
        "role": "SUPERUSER",  # Invalid role
    }
    with pytest.raises(ValidationError):
        UserCreate(**data)


def test_user_create_invalid_email() -> None:
    """Test user creation fails with an invalid email address."""
    data = {
        "username": "user1",
        "email": "not-an-email",  # Invalid email format
        "password": "Password123!",
        "role": "ADMIN",
    }
    with pytest.raises(ValidationError):
        UserCreate(**data)


def test_user_response_from_orm_and_no_password_leak() -> None:
    """Test UserResponse serialization from ORM object and verify password fields are absent."""
    now = datetime.now(timezone.utc)
    orm_user = DummyUserORM(
        id=42,
        username="admin_mustafa",
        email="mustafa@securewatch.ai",
        password_hash="$2b$12$secretpasswordhash",
        role=UserRole.ADMIN,
        created_at=now,
    )

    response_schema = UserResponse.model_validate(orm_user)
    assert response_schema.id == 42
    assert response_schema.username == "admin_mustafa"
    assert response_schema.email == "mustafa@securewatch.ai"
    assert response_schema.role == UserRole.ADMIN
    assert response_schema.created_at == now

    # Verify password and password_hash are not in model fields or dump
    dumped = response_schema.model_dump()
    assert "password" not in dumped
    assert "password_hash" not in dumped
    assert "password" not in UserResponse.model_fields
    assert "password_hash" not in UserResponse.model_fields


def test_token_response_schema() -> None:
    """Test Token response schema structure matching API contract."""
    now = datetime.now(timezone.utc)
    user_resp = UserResponse(
        id=2,
        username="analyst_emre",
        email="emre@securewatch.ai",
        role=UserRole.ANALYST,
        created_at=now,
    )
    token = Token(
        access_token="eyJhbGciOiJIUzI1NiIsIn...",
        token_type="bearer",
        user=user_resp,
    )

    dumped = token.model_dump()
    assert dumped["access_token"] == "eyJhbGciOiJIUzI1NiIsIn..."
    assert dumped["token_type"] == "bearer"
    assert dumped["user"]["username"] == "analyst_emre"
    assert dumped["user"]["role"] == "ANALYST"


def test_audit_log_response_from_orm_and_nullable_user_id() -> None:
    """Test AuditLogResponse ORM serialization including null user_id (SET NULL scenario)."""
    now = datetime.now(timezone.utc)
    orm_log_with_user = DummyAuditLogORM(
        id=501,
        user_id=2,
        action_type="FILE_UPLOAD",
        description="Uploaded traffic file",
        ip_address="192.168.1.50",
        created_at=now,
    )

    schema1 = AuditLogResponse.model_validate(orm_log_with_user)
    assert schema1.id == 501
    assert schema1.user_id == 2
    assert schema1.action_type == "FILE_UPLOAD"

    # Test with null user_id
    orm_log_null_user = DummyAuditLogORM(
        id=502,
        user_id=None,
        action_type="USER_DELETE",
        description="User was deleted, log retained",
        ip_address="192.168.1.50",
        created_at=now,
    )

    schema2 = AuditLogResponse.model_validate(orm_log_null_user)
    assert schema2.id == 502
    assert schema2.user_id is None
