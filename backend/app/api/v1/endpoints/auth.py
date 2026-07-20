from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.utils import get_client_ip
from app.db.session import get_db
from app.schemas.auth import Token, UserLogin
from app.services.auth_service import authenticate_user

router = APIRouter()


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
