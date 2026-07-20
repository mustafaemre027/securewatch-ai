from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import Token, UserLogin
from app.services.auth_service import authenticate_user

router = APIRouter()


def get_client_ip(request: Request) -> str:
    """Extract client IP address from HTTP request safely.

    Args:
        request (Request): Incoming HTTP request.

    Returns:
        str: Client IP address.
    """
    return request.client.host if request.client else "127.0.0.1"


@router.post("/login", response_model=Token)
def login(
    login_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
) -> Token:
    """Authenticate user with username and password, returning JWT access token.

    Public endpoint (no token required).
    """
    ip_address = get_client_ip(request)
    return authenticate_user(db=db, login_data=login_data, ip_address=ip_address)
