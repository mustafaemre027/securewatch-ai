import logging
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.security import create_access_token, verify_password
from app.schemas.auth import Token, UserLogin
from app.schemas.user import UserResponse
from app.services.audit_service import create_audit_log
from app.services.user_service import get_user_by_username

logger = logging.getLogger(__name__)


def authenticate_user(
    db: Session,
    login_data: UserLogin,
    ip_address: str = "127.0.0.1",
) -> Token:
    """Authenticate a user using credentials and return a signed JWT token response.

    Args:
        db (Session): Database session.
        login_data (UserLogin): User login credentials schema.
        ip_address (str): Client IP address for audit logging.

    Returns:
        Token: JWT access token response schema containing user profile.

    Raises:
        AppException: If username does not exist or password is invalid.
    """
    user = get_user_by_username(db, login_data.username)

    if not user or not verify_password(login_data.password, user.password_hash):
        logger.warning("Failed login attempt for username=%s from ip=%s", login_data.username, ip_address)
        raise AppException(
            status_code=401,
            code="CREDENTIALS_INVALID",
            message="Yanlış kullanıcı adı veya parola girildi.",
        )

    # Build JWT token payload
    token_payload = {
        "sub": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "user_id": user.id,
    }

    access_token = create_access_token(data=token_payload)

    # Log successful login action
    create_audit_log(
        db=db,
        action_type="USER_LOGIN",
        description=f"User {user.username} logged in successfully.",
        ip_address=ip_address,
        user_id=user.id,
    )

    user_response = UserResponse.model_validate(user)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
    )
