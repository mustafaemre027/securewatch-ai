from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.analysis_job import AnalysisJobStatus


class AnalysisProcessingResponse(BaseModel):
    """Response returned when an analysis job is successfully processed."""
    job_id: int
    records_processed: int
    final_status: AnalysisJobStatus


class DetectionResultResponse(BaseModel):
    """Safe representation of a single DetectionResult."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    row_index: int
    attack_probability: float
    is_attack: bool
    risk_level: str
    created_at: datetime


class DetectionResultPage(BaseModel):
    """Paginated list of detection results."""
    items: List[DetectionResultResponse]
    total: int
    skip: int
    limit: int


class RiskLevelCounts(BaseModel):
    """Counts of detections grouped by risk level."""
    LOW: int = 0
    MEDIUM: int = 0
    HIGH: int = 0
    CRITICAL: int = 0


class AnalysisSummaryResponse(BaseModel):
    """Summary statistics for a processed analysis job."""
    job_id: int
    status: AnalysisJobStatus
    total_records: int
    normal_count: int
    attack_count: int
    risk_level_counts: RiskLevelCounts
    completed_at: Optional[datetime] = None
