import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.detection_result import DetectionResult
    from app.models.user import User
    from app.models.incident_comment import IncidentComment


class IncidentStatus(str, enum.Enum):
    """Incident status enumeration."""
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class IncidentSeverity(str, enum.Enum):
    """Incident severity enumeration."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Incident(Base):
    """SQLAlchemy model representing the incidents table.

    Tracks escalated security incidents from detection results.

    Attributes:
        id (int): Primary key ID.
        detection_result_id (int): Foreign key to detection_results (RESTRICT on delete).
        assigned_analyst_id (Optional[int]): Foreign key to users (SET NULL on delete).
        status (IncidentStatus): Current status of the incident (default: OPEN).
        severity (IncidentSeverity): Severity level of the incident.
        title (str): Incident title (max 150 chars).
        description (str): Detailed text description.
        created_at (datetime): Timestamp when the incident was created.
        updated_at (datetime): Timestamp when the incident was last updated.
        detection_result (DetectionResult): Relationship back to the detection result.
        assigned_analyst (Optional[User]): Relationship to the assigned user.
        comments (List[IncidentComment]): Relationship to the incident comments.
    """
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    detection_result_id: Mapped[int] = mapped_column(
        ForeignKey("detection_results.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    assigned_analyst_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, native_enum=False, length=20, values_callable=lambda obj: [e.value for e in obj]),
        default=IncidentStatus.OPEN,
        server_default=IncidentStatus.OPEN.value,
        nullable=False,
        index=True,
    )
    severity: Mapped[IncidentSeverity] = mapped_column(
        Enum(IncidentSeverity, native_enum=False, length=20, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    detection_result: Mapped["DetectionResult"] = relationship(
        "DetectionResult",
        back_populates="incident",
        uselist=False,
    )
    assigned_analyst: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="assigned_incidents",
    )
    comments: Mapped[List["IncidentComment"]] = relationship(
        "IncidentComment",
        back_populates="incident",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE')",
            name="chk_incident_status_valid"
        ),
        CheckConstraint(
            "severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="chk_incident_severity_valid"
        ),
    )
