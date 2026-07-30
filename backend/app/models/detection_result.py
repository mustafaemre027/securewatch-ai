from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.analysis_job import AnalysisJob


class DetectionResult(Base):
    """SQLAlchemy model representing the detection_results table.

    Stores row-level prediction results for each AnalysisJob.

    Attributes:
        id (int): Primary key ID.
        job_id (int): Foreign key referencing analysis_jobs (CASCADE on delete).
        row_index (int): The 0-based index of the row from the CSV file.
        attack_probability (float): Prediction probability [0.0 - 1.0].
        is_attack (bool): Binary decision based on probability threshold.
        risk_level (str): Categorized risk level (LOW, MEDIUM, HIGH, CRITICAL).
        created_at (datetime): Timestamp when the result was saved.
        analysis_job (AnalysisJob): Relationship back to the parent job.
    """
    __tablename__ = "detection_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("analysis_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    attack_probability: Mapped[float] = mapped_column(Float, nullable=False)
    is_attack: Mapped[bool] = mapped_column(Boolean, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    analysis_job: Mapped["AnalysisJob"] = relationship(
        "AnalysisJob",
        back_populates="detection_results",
    )

    __table_args__ = (
        UniqueConstraint("job_id", "row_index", name="uq_detection_result_job_row"),
        CheckConstraint("row_index >= 0", name="chk_row_index_positive"),
        CheckConstraint(
            "attack_probability >= 0.0 AND attack_probability <= 1.0",
            name="chk_probability_range"
        ),
        CheckConstraint(
            "risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="chk_risk_level_valid"
        ),
        Index("ix_detection_results_job_id", "job_id"),
        Index("ix_detection_results_risk_level", "risk_level"),
        Index("ix_detection_results_is_attack", "is_attack"),
    )
