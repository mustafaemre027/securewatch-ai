import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate

logger = logging.getLogger(__name__)


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Retrieve a user by primary key ID.

    Args:
        db (Session): Database session.
        user_id (int): Primary key user ID.

    Returns:
        Optional[User]: User model instance if found, None otherwise.
    """
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Retrieve a user by username.

    Args:
        db (Session): Database session.
        username (str): Target username.

    Returns:
        Optional[User]: User model instance if found, None otherwise.
    """
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieve a user by email address.

    Args:
        db (Session): Database session.
        email (str): Target email address.

    Returns:
        Optional[User]: User model instance if found, None otherwise.
    """
    return db.query(User).filter(User.email == email).first()


def list_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """List registered users with pagination.

    Args:
        db (Session): Database session.
        skip (int): Number of records to skip.
        limit (int): Maximum number of records to return.

    Returns:
        List[User]: List of User model instances.
    """
    return db.query(User).order_by(User.id.asc()).offset(skip).limit(limit).all()


def create_user(db: Session, user_create: UserCreate) -> User:
    """Create a new user account with a hashed password.

    Args:
        db (Session): Database session.
        user_create (UserCreate): User creation request schema.

    Returns:
        User: The created User database model instance.

    Raises:
        AppException: If username or email already exists.
    """
    # Check username conflict
    if get_user_by_username(db, user_create.username):
        raise AppException(
            status_code=400,
            code="DUPLICATE_USERNAME",
            message="Bu kullanıcı adı zaten kullanılmaktadır.",
        )

    # Check email conflict
    if get_user_by_email(db, user_create.email):
        raise AppException(
            status_code=400,
            code="DUPLICATE_EMAIL",
            message="Bu e-posta adresi zaten kullanılmaktadır.",
        )

    hashed_pwd = hash_password(user_create.password)

    db_user = User(
        username=user_create.username,
        email=user_create.email,
        password_hash=hashed_pwd,
        role=user_create.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    logger.info("Created user account id=%s username=%s role=%s", db_user.id, db_user.username, db_user.role)
    return db_user
