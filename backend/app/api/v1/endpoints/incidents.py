from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.utils import get_client_ip
from app.models.incident import IncidentSeverity, IncidentStatus
from app.models.user import User, UserRole
from app.schemas.incident import (
    IncidentCreate,
    IncidentUpdate,
    IncidentCommentCreate,
    IncidentCommentResponse,
    IncidentListItem,
    IncidentResponse,
    IncidentDetailResponse,
)
from app.services import incident_service

router = APIRouter()

@router.post("", response_model=IncidentResponse, status_code=201)
def create_incident(
    *,
    db: Session = Depends(deps.get_db),
    request: Request,
    incident_in: IncidentCreate,
    current_user: User = Depends(deps.require_roles([UserRole.ANALYST])),
) -> IncidentResponse:
    """Create a new incident. Only ANALYST can create incidents."""
    ip_address = get_client_ip(request)
    
    incident = incident_service.create_incident(
        db=db,
        detection_result_id=incident_in.detection_result_id,
        title=incident_in.title,
        description=incident_in.description,
        severity=incident_in.severity,
        current_user=current_user,
        ip_address=ip_address,
    )
    return incident

@router.get("", response_model=List[IncidentListItem])
def list_incidents(
    db: Session = Depends(deps.get_db),
    status: Optional[IncidentStatus] = Query(None),
    severity: Optional[IncidentSeverity] = Query(None),
    assigned_analyst_id: Optional[int] = Query(None, gt=0),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(deps.get_current_user),
) -> List[IncidentListItem]:
    """List incidents with optional filters."""
    incidents = incident_service.list_incidents(
        db=db,
        status=status,
        severity=severity,
        assigned_analyst_id=assigned_analyst_id,
        skip=skip,
        limit=limit,
    )
    return incidents

@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident(
    incident_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> IncidentDetailResponse:
    """Get incident details by ID."""
    incident = incident_service.get_incident_by_id(db=db, incident_id=incident_id)
    if not incident:
        from app.core.exceptions import AppException
        raise AppException(404, "NOT_FOUND", "Incident not found")
    return incident

@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    *,
    db: Session = Depends(deps.get_db),
    incident_id: int,
    request: Request,
    incident_in: IncidentUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> IncidentResponse:
    """Update an incident."""
    ip_address = get_client_ip(request)
    
    update_data = incident_in.model_dump(exclude_unset=True)
    if not update_data:
        from app.core.exceptions import AppException
        raise AppException(422, "VALIDATION_ERROR", "Update body cannot be empty")
        
    if "assigned_analyst_id" in incident_in.model_fields_set and incident_in.assigned_analyst_id is None:
        from app.core.exceptions import AppException
        raise AppException(422, "VALIDATION_ERROR", "Unassigning incidents (setting assigned_analyst_id to null) is not supported")
    
    incident = incident_service.update_incident(
        db=db,
        incident_id=incident_id,
        current_user=current_user,
        ip_address=ip_address,
        status=incident_in.status if "status" in incident_in.model_fields_set else None,
        assigned_analyst_id=incident_in.assigned_analyst_id if "assigned_analyst_id" in incident_in.model_fields_set else None,
    )
    return incident

@router.post("/{incident_id}/comments", response_model=IncidentCommentResponse, status_code=201)
def add_incident_comment(
    *,
    db: Session = Depends(deps.get_db),
    incident_id: int,
    request: Request,
    comment_in: IncidentCommentCreate,
    current_user: User = Depends(deps.get_current_user),
) -> IncidentCommentResponse:
    """Add a comment to an incident."""
    ip_address = get_client_ip(request)
    
    comment = incident_service.add_incident_comment(
        db=db,
        incident_id=incident_id,
        comment_text=comment_in.comment_text,
        current_user=current_user,
        ip_address=ip_address,
    )
    return comment
