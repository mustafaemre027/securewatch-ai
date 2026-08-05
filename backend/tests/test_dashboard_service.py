import pytest
from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session

from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.user import User, UserRole
from app.services.dashboard_service import get_dashboard_summary

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base

@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()

@pytest.fixture
def admin_user(db_session: Session) -> User:
    user = User(username="admin_dash_test", email="admin_dash@test.com", password_hash="hash", role=UserRole.ADMIN)
    db_session.add(user)
    db_session.commit()
    return user

def test_empty_db_returns_zeroes_and_empty_lists(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert res.analysis_summary.total_jobs == 0
    assert res.analysis_summary.completed_jobs == 0
    assert sum(res.analysis_summary.status_distribution.values()) == 0

    assert res.detection_summary.total_detections == 0
    assert res.detection_class_distribution.attack == 0

    assert sum(res.risk_distribution.values()) == 0
    assert "CRITICAL" in res.risk_distribution
    assert "LOW" in res.risk_distribution

    assert res.incident_summary.total_incidents == 0
    assert sum(res.incident_summary.status_distribution.values()) == 0
    assert sum(res.incident_summary.severity_distribution.values()) == 0

    assert len(res.trend_7_days) == 7
    for day in res.trend_7_days:
        assert day.total == 0
        assert day.benign == 0
        assert day.attack == 0

    assert len(res.recent_detections) == 0
    assert len(res.recent_incidents) == 0

    # Sensitive field checks
    assert not hasattr(res, "protocol")
    assert not hasattr(res, "model_performance")

def test_dashboard_aggregation_with_data(db_session: Session, admin_user: User):
    now = datetime.now(timezone.utc)

    # Analysis Jobs
    job1 = AnalysisJob(user_id=admin_user.id, file_name="f1", file_hash="h1", file_size=100, status=AnalysisJobStatus.COMPLETED)
    job2 = AnalysisJob(user_id=admin_user.id, file_name="f2", file_hash="h2", file_size=200, status=AnalysisJobStatus.FAILED)
    db_session.add_all([job1, job2])
    db_session.commit()

    # Detection Results (with specific dates for trend)
    d1 = DetectionResult(job_id=job1.id, row_index=0, attack_probability=0.1, is_attack=False, risk_level="LOW", created_at=now)
    d2 = DetectionResult(job_id=job1.id, row_index=1, attack_probability=0.9, is_attack=True, risk_level="CRITICAL", created_at=now)

    yesterday = now - timedelta(days=1)
    d3 = DetectionResult(job_id=job1.id, row_index=2, attack_probability=0.8, is_attack=True, risk_level="HIGH", created_at=yesterday)
    d4 = DetectionResult(job_id=job1.id, row_index=3, attack_probability=0.95, is_attack=True, risk_level="CRITICAL", created_at=yesterday)

    db_session.add_all([d1, d2, d3, d4])
    db_session.commit()

    # Incidents
    i1 = Incident(detection_result_id=d2.id, status=IncidentStatus.OPEN, severity=IncidentSeverity.CRITICAL, title="T1", description="D1", created_at=now)
    i2 = Incident(detection_result_id=d3.id, status=IncidentStatus.RESOLVED, severity=IncidentSeverity.HIGH, title="T2", description="D2", created_at=now)

    db_session.add_all([i1, i2])
    db_session.commit()

    res = get_dashboard_summary(db_session)

    # Verify counts
    assert res.analysis_summary.total_jobs == 2
    assert res.analysis_summary.completed_jobs == 1
    assert res.analysis_summary.status_distribution[AnalysisJobStatus.FAILED] == 1

    assert res.detection_summary.total_detections == 4
    assert res.detection_summary.benign_count == 1
    assert res.detection_summary.attack_count == 3
    assert res.detection_class_distribution.benign == 1
    assert res.detection_class_distribution.attack == 3

    assert res.risk_distribution["LOW"] == 1
    assert res.risk_distribution["CRITICAL"] == 2
    assert res.risk_distribution["HIGH"] == 1
    assert res.risk_distribution["MEDIUM"] == 0

    assert res.incident_summary.total_incidents == 2
    assert res.incident_summary.status_distribution[IncidentStatus.OPEN] == 1
    assert res.incident_summary.severity_distribution[IncidentSeverity.HIGH] == 1

    # Verify recent records (limit 5, sorted by created_at desc, id desc)
    assert len(res.recent_detections) == 4
    assert res.recent_detections[0].id == d2.id  # created at `now`
    assert res.recent_detections[1].id == d1.id  # created at `now`
    assert res.recent_detections[2].id == d4.id  # created at `yesterday`
    assert res.recent_detections[3].id == d3.id  # created at `yesterday`

    assert len(res.recent_incidents) == 2
    assert res.recent_incidents[0].id == i2.id
    assert res.recent_incidents[1].id == i1.id

    # Verify 7-day trend
    assert len(res.trend_7_days) == 7
    today_trend = res.trend_7_days[-1]
    yesterday_trend = res.trend_7_days[-2]

    assert today_trend.date == now.date()
    assert today_trend.total == 2
    assert today_trend.attack == 1
    assert today_trend.benign == 1

    assert yesterday_trend.date == yesterday.date()
    assert yesterday_trend.total == 2
    assert yesterday_trend.attack == 2
    assert yesterday_trend.benign == 0

    # Ensure sensitive fields are not exported
    assert not hasattr(res.recent_detections[0], "protocol")
    assert not hasattr(res.recent_detections[0], "model_path")

    assert not hasattr(res.recent_incidents[0], "password")
    assert not hasattr(res.recent_incidents[0], "token")
