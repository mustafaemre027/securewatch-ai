from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User, UserRole
from app.schemas.dashboard import DashboardSummaryResponse
from app.services import dashboard_service

router = APIRouter()

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles([UserRole.ADMIN, UserRole.ANALYST])),
) -> DashboardSummaryResponse:
    """Get dashboard summary data."""
    summary = dashboard_service.get_dashboard_summary(db=db)
    return summary
