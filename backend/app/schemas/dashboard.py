from datetime import datetime, date
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.analysis_job import AnalysisJobStatus
from app.models.incident import IncidentStatus, IncidentSeverity


class AnalysisSummary(BaseModel):
    total_jobs: int
    status_distribution: Dict[AnalysisJobStatus, int]
    completed_jobs: int


class DetectionSummary(BaseModel):
    total_detections: int
    benign_count: int
    attack_count: int


class DetectionClassDistribution(BaseModel):
    benign: int
    attack: int


class IncidentSummary(BaseModel):
    total_incidents: int
    status_distribution: Dict[IncidentStatus, int]
    severity_distribution: Dict[IncidentSeverity, int]


class TrendDataPoint(BaseModel):
    date: date
    total: int
    benign: int
    attack: int


class RecentDetection(BaseModel):
    id: int
    job_id: int
    row_index: int
    is_attack: bool
    attack_probability: float
    risk_level: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecentIncident(BaseModel):
    id: int
    title: str
    status: IncidentStatus
    severity: IncidentSeverity
    assigned_analyst_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardSummaryResponse(BaseModel):
    generated_at: datetime
    analysis_summary: AnalysisSummary
    detection_summary: DetectionSummary
    detection_class_distribution: DetectionClassDistribution
    risk_distribution: Dict[str, int]
    incident_summary: IncidentSummary
    trend_7_days: List[TrendDataPoint]
    recent_detections: List[RecentDetection]
    recent_incidents: List[RecentIncident]
