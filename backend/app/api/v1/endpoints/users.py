from typing import List
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse
from app.services import audit_service, user_service

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
    """Create a new user account.

    Protected: Admin role required.
    """
    ip_address = get_client_ip(request)
    new_user = user_service.create_user(db=db, user_create=user_create)

    # Log user creation audit event
    role_str = new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role)
    audit_service.create_audit_log(
        db=db,
        action_type="USER_CREATED",
        description=f"Admin {current_user.username} created user {new_user.username} with role {role_str}.",
        ip_address=ip_address,
        user_id=current_user.id,
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
