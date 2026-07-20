from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy database models.

    Inherits from SQLAlchemy's DeclarativeBase to provide
    declarative class definitions.
    """
    pass


# Import all models here so that Alembic and metadata creation can register them.
from app.models.user import User, UserRole  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
