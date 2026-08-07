from datetime import datetime, timedelta, timezone
from typing import Dict
from sqlalchemy import select, func, case
from sqlalchemy.orm import Session

from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    AnalysisSummary,
    DetectionSummary,
    DetectionClassDistribution,
    IncidentSummary,
    TrendDataPoint,
    RecentDetection,
    RecentIncident,
)

def get_dashboard_summary(db: Session) -> DashboardSummaryResponse:
    now = datetime.now(timezone.utc)

    # 1. Analysis Summary
    job_counts = db.execute(
        select(AnalysisJob.status, func.count(AnalysisJob.id))
        .group_by(AnalysisJob.status)
    ).all()

    status_distribution: Dict[AnalysisJobStatus, int] = {s: 0 for s in AnalysisJobStatus}
    for status, count in job_counts:
        status_distribution[status] = count

    total_jobs = sum(status_distribution.values())
    completed_jobs = status_distribution[AnalysisJobStatus.COMPLETED]

    analysis_summary = AnalysisSummary(
        total_jobs=total_jobs,
        status_distribution=status_distribution,
        completed_jobs=completed_jobs
    )

    # 2. Detection Summary and Class Distribution
    det_counts = db.execute(
        select(
            func.count(DetectionResult.id).label("total"),
            func.sum(case((DetectionResult.is_attack == False, 1), else_=0)).label("benign"),
            func.sum(case((DetectionResult.is_attack == True, 1), else_=0)).label("attack")
        )
    ).first()

    total_detections = det_counts.total if det_counts and det_counts.total else 0
    benign_count = det_counts.benign if det_counts and det_counts.benign else 0
    attack_count = det_counts.attack if det_counts and det_counts.attack else 0

    detection_summary = DetectionSummary(
        total_detections=total_detections,
        benign_count=benign_count,
        attack_count=attack_count
    )

    detection_class_distribution = DetectionClassDistribution(
        benign=benign_count,
        attack=attack_count
    )

    # 3. Risk Distribution
    risk_counts = db.execute(
        select(DetectionResult.risk_level, func.count(DetectionResult.id))
        .group_by(DetectionResult.risk_level)
    ).all()

    risk_distribution = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for r_level, count in risk_counts:
        risk_distribution[r_level] = count

    # 4. Incident Summary
    inc_status_counts = db.execute(
        select(Incident.status, func.count(Incident.id))
        .group_by(Incident.status)
    ).all()

    inc_status_dist = {s: 0 for s in IncidentStatus}
    for status, count in inc_status_counts:
        inc_status_dist[status] = count

    inc_severity_counts = db.execute(
        select(Incident.severity, func.count(Incident.id))
        .group_by(Incident.severity)
    ).all()

    inc_severity_dist = {s: 0 for s in IncidentSeverity}
    for severity, count in inc_severity_counts:
        inc_severity_dist[severity] = count

    total_incidents = sum(inc_status_dist.values())

    incident_summary = IncidentSummary(
        total_incidents=total_incidents,
        status_distribution=inc_status_dist,
        severity_distribution=inc_severity_dist
    )

    # 5. Trend 7 Days
    seven_days_ago = now - timedelta(days=6)
    seven_days_ago_start = datetime(seven_days_ago.year, seven_days_ago.month, seven_days_ago.day, tzinfo=timezone.utc)

    trend_records = db.execute(
        select(
            func.date(DetectionResult.created_at).label("day_date"),
            func.count(DetectionResult.id).label("total"),
            func.sum(case((DetectionResult.is_attack == False, 1), else_=0)).label("benign"),
            func.sum(case((DetectionResult.is_attack == True, 1), else_=0)).label("attack")
        )
        .where(DetectionResult.created_at >= seven_days_ago_start)
        .group_by(func.date(DetectionResult.created_at))
    ).all()

    trend_dict = {}
    for r in trend_records:
        day_val = r.day_date
        if isinstance(day_val, str):
            try:
                day_d = datetime.strptime(day_val[:10], "%Y-%m-%d").date()
            except ValueError:
                day_d = None
        else:
            day_d = day_val

        if day_d:
            trend_dict[day_d] = {
                "total": r.total or 0,
                "benign": r.benign or 0,
                "attack": r.attack or 0
            }

    trend_7_days = []
    for i in range(6, -1, -1):
        target_date = (now - timedelta(days=i)).date()
        if target_date in trend_dict:
            data = trend_dict[target_date]
            trend_7_days.append(TrendDataPoint(
                date=target_date,
                total=data["total"],
                benign=data["benign"],
                attack=data["attack"]
            ))
        else:
            trend_7_days.append(TrendDataPoint(
                date=target_date,
                total=0,
                benign=0,
                attack=0
            ))

    # 6. Recent Detections
    recent_detections_db = db.execute(
        select(DetectionResult)
        .order_by(DetectionResult.created_at.desc(), DetectionResult.id.desc())
        .limit(5)
    ).scalars().all()

    recent_detections = [RecentDetection.model_validate(rd) for rd in recent_detections_db]

    # 7. Recent Incidents
    recent_incidents_db = db.execute(
        select(Incident)
        .order_by(Incident.created_at.desc(), Incident.id.desc())
        .limit(5)
    ).scalars().all()

    recent_incidents = [RecentIncident.model_validate(ri) for ri in recent_incidents_db]

    return DashboardSummaryResponse(
        generated_at=now,
        analysis_summary=analysis_summary,
        detection_summary=detection_summary,
        detection_class_distribution=detection_class_distribution,
        risk_distribution=risk_distribution,
        incident_summary=incident_summary,
        trend_7_days=trend_7_days,
        recent_detections=recent_detections,
        recent_incidents=recent_incidents
    )
