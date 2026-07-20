import enum
from datetime import datetime
from typing import TYPE_CHECKING, List
from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog


class UserRole(str, enum.Enum):
    """User role enumeration for RBAC authorization."""
    ADMIN = "ADMIN"
    ANALYST = "ANALYST"


class User(Base):
    """SQLAlchemy model representing the users table.

    Attributes:
        id (int): Primary key ID.
        username (str): Unique username (max 50 chars).
        email (str): Unique email address (max 100 chars).
        password_hash (str): Bcrypt hashed password (max 255 chars).
        role (UserRole): Role assigned to the user (ADMIN or ANALYST).
        created_at (datetime): Account creation timestamp.
        updated_at (datetime): Account last update timestamp.
        audit_logs (List[AuditLog]): Relationship to associated audit logs.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=UserRole.ANALYST,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
        passive_deletes=True,
    )
