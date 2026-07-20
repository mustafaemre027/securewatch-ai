import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def create_audit_log(
    db: Session,
    action_type: str,
    description: str,
    ip_address: str,
    user_id: Optional[int] = None,
) -> AuditLog:
    """Create a system audit log entry.

    Args:
        db (Session): Database session.
        action_type (str): Type of action performed (e.g. 'USER_LOGIN', 'FILE_UPLOAD').
        description (str): Action details description. Must not contain sensitive secrets.
        ip_address (str): Client IP address.
        user_id (Optional[int]): User ID who triggered the action (nullable).

    Returns:
        AuditLog: Created AuditLog database model instance.
    """
    audit_entry = AuditLog(
        user_id=user_id,
        action_type=action_type,
        description=description,
        ip_address=ip_address,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)

    logger.info("Audit log created id=%s action_type=%s user_id=%s", audit_entry.id, action_type, user_id)
    return audit_entry


def list_audit_logs(
    db: Session,
    user_id: Optional[int] = None,
    action_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[AuditLog]:
    """List system audit log entries with optional filters and pagination.

    Args:
        db (Session): Database session.
        user_id (Optional[int]): Filter by user ID.
        action_type (Optional[str]): Filter by action type.
        start_date (Optional[datetime]): Filter start timestamp (inclusive).
        end_date (Optional[datetime]): Filter end timestamp (inclusive).
        skip (int): Number of records to skip.
        limit (int): Maximum number of records to return.

    Returns:
        List[AuditLog]: Filtered list of AuditLog model instances.
    """
    query = db.query(AuditLog)

    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action_type:
        query = query.filter(AuditLog.action_type == action_type)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
