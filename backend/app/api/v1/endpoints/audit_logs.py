from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.audit_log import AuditLogResponse
from app.services import audit_service

router = APIRouter()


@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    start_date: Optional[datetime] = Query(None, description="Filter start timestamp"),
    end_date: Optional[datetime] = Query(None, description="Filter end timestamp"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
) -> List[AuditLogResponse]:
    """List system audit log entries.

    Protected: Admin role required.
    """
    logs = audit_service.list_audit_logs(
        db=db,
        user_id=user_id,
        action_type=action_type,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    return [AuditLogResponse.model_validate(log) for log in logs]
