import logging
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.incident_comment import IncidentComment
from app.models.detection_result import DetectionResult
from app.models.analysis_job import AnalysisJob
from app.models.user import User, UserRole
from app.core.exceptions import AppException
from app.services import audit_service

logger = logging.getLogger(__name__)


def get_incident_by_id(db: Session, incident_id: int) -> Optional[Incident]:
    """Get an incident by ID.
    
    Args:
        db (Session): Database session.
        incident_id (int): Incident ID.
        
    Returns:
        Optional[Incident]: The incident if found, None otherwise.
    """
    return db.query(Incident).filter(Incident.id == incident_id).first()


def list_incidents(
    db: Session,
    status: Optional[IncidentStatus] = None,
    severity: Optional[IncidentSeverity] = None,
    assigned_analyst_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Incident]:
    """List incidents with optional filters and pagination.
    
    Args:
        db (Session): Database session.
        status (Optional[IncidentStatus]): Filter by status.
        severity (Optional[IncidentSeverity]): Filter by severity.
        assigned_analyst_id (Optional[int]): Filter by assigned analyst.
        skip (int): Number of records to skip.
        limit (int): Maximum number of records to return.
        
    Returns:
        List[Incident]: List of incidents.
    """
    query = db.query(Incident)

    if status is not None:
        query = query.filter(Incident.status == status)
    if severity is not None:
        query = query.filter(Incident.severity == severity)
    if assigned_analyst_id is not None:
        query = query.filter(Incident.assigned_analyst_id == assigned_analyst_id)

    # Order by created_at DESC, then id DESC for deterministic sort
    query = query.order_by(Incident.created_at.desc(), Incident.id.desc())
    return query.offset(skip).limit(limit).all()


def create_incident(
    db: Session,
    detection_result_id: int,
    title: str,
    description: str,
    severity: IncidentSeverity,
    current_user: User,
    ip_address: str,
) -> Incident:
    """Create a new incident from a detection result.
    
    Args:
        db (Session): Database session.
        detection_result_id (int): Detection result ID.
        title (str): Incident title.
        description (str): Incident description.
        severity (IncidentSeverity): Incident severity.
        current_user (User): The user creating the incident.
        ip_address (str): User's IP address.
        
    Returns:
        Incident: The created incident.
    """
    if current_user.role != UserRole.ANALYST:
        raise AppException(403, "FORBIDDEN", "Only ANALYST can create incidents")

    if not title or not title.strip():
        raise AppException(400, "BAD_REQUEST", "Title cannot be empty")
    if not description or not description.strip():
        raise AppException(400, "BAD_REQUEST", "Description cannot be empty")
        
    if not isinstance(severity, IncidentSeverity):
        raise AppException(400, "BAD_REQUEST", "Invalid severity level")

    # Fetch detection result safely, ensuring ownership
    dr = db.query(DetectionResult).join(AnalysisJob).filter(
        DetectionResult.id == detection_result_id,
        AnalysisJob.user_id == current_user.id
    ).first()

    if not dr:
        raise AppException(404, "NOT_FOUND", "Detection result not found")

    if not dr.is_attack:
        raise AppException(400, "BAD_REQUEST", "Only attack detections can be escalated to incidents")

    incident = Incident(
        detection_result_id=dr.id,
        severity=severity,
        title=title.strip(),
        description=description.strip(),
        status=IncidentStatus.OPEN,
        assigned_analyst_id=None
    )
    db.add(incident)

    try:
        db.flush()
    except IntegrityError as e:
        db.rollback()
        raise AppException(409, "CONFLICT", "An incident already exists for this detection result") from e

    try:
        audit_service.create_audit_log(
            db=db,
            action_type="INCIDENT_CREATED",
            description=f"Incident {incident.id} created from detection result {dr.id}",
            ip_address=ip_address,
            user_id=current_user.id,
        )
        db.commit()
        db.refresh(incident)
        return incident
    except AppException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise AppException(500, "INTERNAL_ERROR", "Failed to create incident") from e


def update_incident(
    db: Session,
    incident_id: int,
    current_user: User,
    ip_address: str,
    status: Optional[IncidentStatus] = None,
    assigned_analyst_id: Optional[int] = None,
) -> Incident:
    """Update an incident's assignment and/or status.
    
    Args:
        db (Session): Database session.
        incident_id (int): Incident ID.
        current_user (User): The user updating the incident.
        ip_address (str): User's IP address.
        status (Optional[IncidentStatus]): New status.
        assigned_analyst_id (Optional[int]): New assigned analyst ID.
        
    Returns:
        Incident: The updated incident.
    """
    try:
        # Use with_for_update for row-level locking to prevent race conditions
        incident = db.query(Incident).filter(Incident.id == incident_id).with_for_update().first()
        if not incident:
            raise AppException(404, "NOT_FOUND", "Incident not found")

        old_status = incident.status
        old_assigned = incident.assigned_analyst_id

        # Handle assignment
        if assigned_analyst_id is not None:
            if assigned_analyst_id != old_assigned:
                target_user = db.query(User).filter(User.id == assigned_analyst_id).first()
                if not target_user:
                    raise AppException(404, "NOT_FOUND", "Target user not found")
                if target_user.role == UserRole.ADMIN:
                    raise AppException(400, "BAD_REQUEST", "Cannot assign incident to an ADMIN")

                if current_user.role == UserRole.ANALYST:
                    if assigned_analyst_id != current_user.id:
                        raise AppException(403, "FORBIDDEN", "Analyst can only assign incidents to themselves")
                    if incident.assigned_analyst_id is not None and incident.assigned_analyst_id != current_user.id:
                        raise AppException(403, "FORBIDDEN", "Incident is already assigned to another analyst")

                incident.assigned_analyst_id = assigned_analyst_id
                db.flush()

                audit_service.create_audit_log(
                    db=db,
                    action_type="INCIDENT_ASSIGNED",
                    description=f"Incident {incident.id} assigned to user {assigned_analyst_id}",
                    ip_address=ip_address,
                    user_id=current_user.id,
                )

        # Handle status update
        if status is not None and status != old_status:
            if current_user.role == UserRole.ANALYST:
                if incident.assigned_analyst_id != current_user.id:
                    raise AppException(403, "FORBIDDEN", "Cannot update status of unassigned or other's incident")

            if incident.assigned_analyst_id is None and status != IncidentStatus.OPEN:
                raise AppException(400, "BAD_REQUEST", "Unassigned incident cannot change status from OPEN")

            valid_transitions = {
                IncidentStatus.OPEN: [IncidentStatus.IN_PROGRESS, IncidentStatus.FALSE_POSITIVE],
                IncidentStatus.IN_PROGRESS: [IncidentStatus.RESOLVED, IncidentStatus.FALSE_POSITIVE],
                IncidentStatus.RESOLVED: [],
                IncidentStatus.FALSE_POSITIVE: [],
            }
            if status not in valid_transitions[old_status]:
                raise AppException(409, "CONFLICT", f"Invalid transition from {old_status.value} to {status.value}")

            incident.status = status
            db.flush()

            audit_service.create_audit_log(
                db=db,
                action_type="INCIDENT_STATUS_CHANGED",
                description=f"Incident {incident.id} status changed from {old_status.value} to {status.value}",
                ip_address=ip_address,
                user_id=current_user.id,
            )

        db.commit()
        db.refresh(incident)
        return incident

    except AppException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise AppException(500, "INTERNAL_ERROR", "Failed to update incident") from e


def add_incident_comment(
    db: Session,
    incident_id: int,
    comment_text: str,
    current_user: User,
    ip_address: str,
) -> IncidentComment:
    """Add a comment to an incident.
    
    Args:
        db (Session): Database session.
        incident_id (int): Incident ID.
        comment_text (str): Comment text.
        current_user (User): The user commenting.
        ip_address (str): User's IP address.
        
    Returns:
        IncidentComment: The created comment.
    """
    if not comment_text or not comment_text.strip():
        raise AppException(400, "BAD_REQUEST", "Comment text cannot be empty")

    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise AppException(404, "NOT_FOUND", "Incident not found")

    if current_user.role == UserRole.ANALYST:
        if incident.assigned_analyst_id != current_user.id:
            raise AppException(403, "FORBIDDEN", "Analyst can only comment on their assigned incidents")

    comment = IncidentComment(
        incident_id=incident.id,
        user_id=current_user.id,
        comment_text=comment_text.strip(),
    )
    db.add(comment)

    try:
        db.flush()
        audit_service.create_audit_log(
            db=db,
            action_type="INCIDENT_COMMENT_ADDED",
            description=f"Comment added to incident {incident.id}",
            ip_address=ip_address,
            user_id=current_user.id,
        )
        db.commit()
        db.refresh(comment)
        return comment
    except AppException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise AppException(500, "INTERNAL_ERROR", "Failed to add comment") from e
