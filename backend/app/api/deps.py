from typing import Callable, List, Optional
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.services.user_service import get_user_by_username

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_prefix}/auth/login",
    auto_error=False,
)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate JWT token from request header, then load current user from database.

    Args:
        token (Optional[str]): Bearer token string from Authorization header.
        db (Session): Database session.

    Returns:
        User: Authenticated User model instance loaded from database.

    Raises:
        AppException: 401 Unauthorized if token is missing, expired, invalid, or user does not exist.
    """
    if not token:
        raise AppException(
            status_code=401,
            code="CREDENTIALS_INVALID",
            message="Kimlik doğrulama token'ı bulunamadı.",
        )

    # decode_access_token handles expiration and malformed token exceptions
    payload = decode_access_token(token)

    username: Optional[str] = payload.get("sub")
    if not username:
        raise AppException(
            status_code=401,
            code="TOKEN_INVALID",
            message="Geçersiz kimlik doğrulama token'ı.",
        )

    user = get_user_by_username(db, username=username)
    if user is None:
        raise AppException(
            status_code=401,
            code="CREDENTIALS_INVALID",
            message="Kullanıcı veritabanında bulunamadı.",
        )

    return user


def require_roles(allowed_roles: List[UserRole]) -> Callable[[User], User]:
    """Dependency factory enforcing Role-Based Access Control (RBAC).

    Args:
        allowed_roles (List[UserRole]): List of UserRole values permitted to access the route.

    Returns:
        Callable[[User], User]: FastAPI dependency function checking current_user role.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        allowed_role_strs = [r.value if hasattr(r, "value") else str(r) for r in allowed_roles]

        if user_role_str not in allowed_role_strs:
            raise AppException(
                status_code=403,
                code="PERMISSION_DENIED",
                message="Kullanıcının bu işlemi gerçekleştirmek için yetkisi yetersiz.",
            )
        return current_user

    return role_checker
