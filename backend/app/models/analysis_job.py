import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AnalysisJobStatus(str, enum.Enum):
    """Execution status enumeration for AnalysisJob."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AnalysisJob(Base):
    """SQLAlchemy model representing the analysis_jobs table.

    Tracks batch network traffic analysis jobs uploaded by security analysts.

    Attributes:
        id (int): Primary key ID.
        user_id (int): Foreign key referencing the user who created the job (RESTRICT on delete).
        file_name (str): Original uploaded file name (max 255 chars).
        file_hash (str): Unique SHA-256 hash string of the file (max 64 chars).
        file_size (int): Size of the uploaded file in bytes.
        status (AnalysisJobStatus): Current job processing status (default: PENDING).
        error_message (Optional[str]): Failure error message if job failed.
        created_at (datetime): Timestamp when the job was uploaded.
        completed_at (Optional[datetime]): Timestamp when job processing completed.
        user (User): Relationship to the User who created the analysis job.
    """
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[AnalysisJobStatus] = mapped_column(
        Enum(AnalysisJobStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=AnalysisJobStatus.PENDING,
        server_default=AnalysisJobStatus.PENDING.value,
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="analysis_jobs",
    )
