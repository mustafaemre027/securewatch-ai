from typing import List
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse
from app.services import user_service

router = APIRouter()


def get_client_ip(request: Request) -> str:
    """Extract client IP address from HTTP request safely.

    Args:
        request (Request): Incoming HTTP request.

    Returns:
        str: Client IP address.
    """
    return request.client.host if request.client else "127.0.0.1"


@router.post("/", response_model=UserResponse, status_code=201)
def create_new_user(
    user_create: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
) -> UserResponse:
    """Create a new user account and audit log atomically.

    Protected: Admin role required.
    Both the new user and the USER_CREATED audit log entry are committed in a single
    transaction. If either operation fails, the entire transaction is rolled back.
    """
    ip_address = get_client_ip(request)
    new_user = user_service.create_user_with_audit(
        db=db,
        user_create=user_create,
        created_by_user_id=current_user.id,
        ip_address=ip_address,
    )
    return UserResponse.model_validate(new_user)


@router.get("/", response_model=List[UserResponse])
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
) -> List[UserResponse]:
    """List all registered users in the system.

    Protected: Admin role required.
    """
    users = user_service.list_users(db=db, skip=skip, limit=limit)
    return [UserResponse.model_validate(u) for u in users]
