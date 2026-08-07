import pytest
from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import func

from app.db.base import Base
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.user import User, UserRole
from app.services.dashboard_service import get_dashboard_summary

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

@pytest.fixture
def populated_db(db_session: Session, admin_user: User) -> Session:
    now = datetime.now(timezone.utc)
    
    # Analysis Jobs
    job1 = AnalysisJob(user_id=admin_user.id, file_name="f1", file_hash="h1", file_size=100, status=AnalysisJobStatus.COMPLETED)
    job2 = AnalysisJob(user_id=admin_user.id, file_name="f2", file_hash="h2", file_size=200, status=AnalysisJobStatus.FAILED)
    db_session.add_all([job1, job2])
    db_session.commit()
    
    # Detection Results
    d1 = DetectionResult(job_id=job1.id, row_index=0, attack_probability=0.1, is_attack=False, risk_level="LOW", created_at=now)
    # Give d2 exactly same created_at but different ID for order testing
    d2 = DetectionResult(job_id=job1.id, row_index=1, attack_probability=0.9, is_attack=True, risk_level="CRITICAL", created_at=now)
    
    yesterday = now - timedelta(days=1)
    d3 = DetectionResult(job_id=job1.id, row_index=2, attack_probability=0.8, is_attack=True, risk_level="HIGH", created_at=yesterday)
    d4 = DetectionResult(job_id=job1.id, row_index=3, attack_probability=0.95, is_attack=True, risk_level="CRITICAL", created_at=yesterday)
    
    eight_days_ago = now - timedelta(days=8)
    d_old = DetectionResult(job_id=job2.id, row_index=4, attack_probability=0.99, is_attack=True, risk_level="CRITICAL", created_at=eight_days_ago)
    
    # Boundary detection (exactly 6 days ago start)
    six_days_ago = now - timedelta(days=6)
    d_bound = DetectionResult(job_id=job1.id, row_index=5, attack_probability=0.2, is_attack=False, risk_level="LOW", created_at=six_days_ago)
    
    db_session.add_all([d1, d2, d3, d4, d_old, d_bound])
    db_session.commit()
    
    # Add extra detections for limit testing
    extra_detections = []
    for i in range(4):
        extra_detections.append(DetectionResult(
            job_id=job2.id, row_index=10+i, attack_probability=0.1, is_attack=False, risk_level="LOW", created_at=now - timedelta(hours=i+1)
        ))
    db_session.add_all(extra_detections)
    db_session.commit()

    # Incidents
    i1 = Incident(detection_result_id=d2.id, status=IncidentStatus.OPEN, severity=IncidentSeverity.CRITICAL, title="T1", description="D1", created_at=now)
    i2 = Incident(detection_result_id=d3.id, status=IncidentStatus.RESOLVED, severity=IncidentSeverity.HIGH, title="T2", description="D2", created_at=now)
    
    i_old = Incident(detection_result_id=d_old.id, status=IncidentStatus.IN_PROGRESS, severity=IncidentSeverity.MEDIUM, title="Old", description="Old D", created_at=yesterday)
    
    # Extra 4 incidents to push count > 5 for limit testing
    extra_incidents = []
    for i in range(4):
        extra_incidents.append(Incident(
            detection_result_id=extra_detections[i].id, 
            status=IncidentStatus.FALSE_POSITIVE, 
            severity=IncidentSeverity.LOW, 
            title=f"E{i}", 
            description="D", 
            created_at=now - timedelta(hours=i+1)
        ))
    db_session.add_all([i1, i2, i_old] + extra_incidents)
    db_session.commit()
    
    return db_session


# --- Boş veritabanı ---

def test_empty_db_analysis_total_is_zero(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert res.analysis_summary.total_jobs == 0
    assert res.analysis_summary.completed_jobs == 0

def test_empty_db_detection_total_is_zero(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert res.detection_summary.total_detections == 0
    assert res.detection_class_distribution.benign == 0
    assert res.detection_class_distribution.attack == 0

def test_empty_db_incident_total_is_zero(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert res.incident_summary.total_incidents == 0

def test_empty_db_enum_distributions_padded_with_zeroes(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert all(count == 0 for count in res.analysis_summary.status_distribution.values())
    assert all(count == 0 for count in res.incident_summary.status_distribution.values())
    assert all(count == 0 for count in res.incident_summary.severity_distribution.values())
    assert all(count == 0 for count in res.risk_distribution.values())
    assert "LOW" in res.risk_distribution
    assert "CRITICAL" in res.risk_distribution

def test_empty_db_recent_detection_list_is_empty(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert len(res.recent_detections) == 0

def test_empty_db_recent_incident_list_is_empty(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert len(res.recent_incidents) == 0

def test_empty_db_trend_returns_seven_days_zero_data(db_session: Session):
    res = get_dashboard_summary(db_session)
    assert len(res.trend_7_days) == 7
    for point in res.trend_7_days:
        assert point.total == 0
        assert point.benign == 0
        assert point.attack == 0


# --- AnalysisJob özeti ---

def test_analysis_total_job_count_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert res.analysis_summary.total_jobs == 2

def test_analysis_job_status_distribution_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert res.analysis_summary.status_distribution[AnalysisJobStatus.COMPLETED] == 1
    assert res.analysis_summary.status_distribution[AnalysisJobStatus.FAILED] == 1

def test_analysis_completed_job_count_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert res.analysis_summary.completed_jobs == 1

def test_analysis_missing_status_category_is_zero(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert res.analysis_summary.status_distribution[AnalysisJobStatus.PENDING] == 0


# --- DetectionResult özeti ---

def test_detection_total_count_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # 6 specific + 4 extra = 10
    assert res.detection_summary.total_detections == 10

def test_detection_benign_count_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # d1(1) + d_bound(1) + extra(4) = 6
    assert res.detection_summary.benign_count == 6

def test_detection_attack_count_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # d2(1) + d3(1) + d4(1) + d_old(1) = 4
    assert res.detection_summary.attack_count == 4

def test_detection_distribution_matches_total(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    total = res.detection_summary.total_detections
    benign = res.detection_class_distribution.benign
    attack = res.detection_class_distribution.attack
    assert total == benign + attack

def test_detection_risk_level_distribution_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # LOW: d1(1) + d_bound(1) + extra(4) = 6
    # CRITICAL: d2(1) + d4(1) + d_old(1) = 3
    # HIGH: d3(1) = 1
    # MEDIUM: 0
    assert res.risk_distribution["LOW"] == 6
    assert res.risk_distribution["CRITICAL"] == 3
    assert res.risk_distribution["HIGH"] == 1

def test_detection_missing_risk_levels_padded_with_zero(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert res.risk_distribution["MEDIUM"] == 0


# --- Incident özeti ---

def test_incident_total_count_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # i1(1) + i2(1) + i_old(1) + extra(4) = 7
    assert res.incident_summary.total_incidents == 7

def test_incident_status_distribution_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert res.incident_summary.status_distribution[IncidentStatus.OPEN] == 1
    assert res.incident_summary.status_distribution[IncidentStatus.RESOLVED] == 1
    assert res.incident_summary.status_distribution[IncidentStatus.IN_PROGRESS] == 1
    assert res.incident_summary.status_distribution[IncidentStatus.FALSE_POSITIVE] == 4

def test_incident_severity_distribution_is_correct(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert res.incident_summary.severity_distribution[IncidentSeverity.CRITICAL] == 1
    assert res.incident_summary.severity_distribution[IncidentSeverity.HIGH] == 1
    assert res.incident_summary.severity_distribution[IncidentSeverity.MEDIUM] == 1
    assert res.incident_summary.severity_distribution[IncidentSeverity.LOW] == 4

def test_incident_missing_status_padded_with_zero(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # In our DB all 4 statuses are present, but if we delete one, it should be 0.
    # We will test this by deleting all FALSE_POSITIVEs
    populated_db.execute(Incident.__table__.delete().where(Incident.status == IncidentStatus.FALSE_POSITIVE))
    populated_db.commit()
    res2 = get_dashboard_summary(populated_db)
    assert res2.incident_summary.status_distribution[IncidentStatus.FALSE_POSITIVE] == 0

def test_incident_missing_severity_padded_with_zero(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    populated_db.execute(Incident.__table__.delete().where(Incident.severity == IncidentSeverity.LOW))
    populated_db.commit()
    res2 = get_dashboard_summary(populated_db)
    assert res2.incident_summary.severity_distribution[IncidentSeverity.LOW] == 0


# --- Son 7 gün eğilimi ---

def test_trend_returns_exactly_seven_points(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert len(res.trend_7_days) == 7

def test_trend_dates_are_ordered_oldest_to_newest(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    dates = [p.date for p in res.trend_7_days]
    assert dates == sorted(dates)
    assert dates[0] < dates[-1]

def test_trend_covers_last_seven_calendar_days_including_today(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    now_date = datetime.now(timezone.utc).date()
    assert res.trend_7_days[-1].date == now_date
    assert res.trend_7_days[0].date == now_date - timedelta(days=6)

def test_trend_days_without_data_are_padded_with_zeroes(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # 2 days ago has no data in our populated_db
    two_days_ago = datetime.now(timezone.utc).date() - timedelta(days=2)
    point = next(p for p in res.trend_7_days if p.date == two_days_ago)
    assert point.total == 0
    assert point.benign == 0
    assert point.attack == 0

def test_trend_each_day_total_equals_benign_plus_attack(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    for p in res.trend_7_days:
        assert p.total == p.benign + p.attack

def test_trend_excludes_detections_older_than_seven_days(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    total_trend_detections = sum(p.total for p in res.trend_7_days)
    # DB has 10 total, but 1 is 8 days ago (d_old)
    assert total_trend_detections == 9

def test_trend_boundary_detections_added_to_correct_day(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    six_days_ago = datetime.now(timezone.utc).date() - timedelta(days=6)
    point = next(p for p in res.trend_7_days if p.date == six_days_ago)
    assert point.total >= 1
    assert point.benign >= 1


# --- Recent listeler ---

def test_recent_detection_list_returns_max_5_records(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert len(res.recent_detections) == 5

def test_recent_detection_list_ordered_by_created_at_desc(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    d_list = res.recent_detections
    for i in range(len(d_list) - 1):
        assert d_list[i].created_at >= d_list[i+1].created_at

def test_recent_detection_list_ordered_by_id_desc_on_same_created_at(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # d1 and d2 have exactly the same created_at (now). d2 was inserted after d1 so it has higher ID.
    now_list = [d for d in res.recent_detections if d.id in (1, 2)]
    if len(now_list) == 2:
        assert now_list[0].id > now_list[1].id

def test_recent_detection_response_contains_only_allowed_fields(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    det = res.recent_detections[0]
    expected_fields = {"id", "job_id", "row_index", "is_attack", "attack_probability", "risk_level", "created_at"}
    actual_fields = set(det.model_dump().keys())
    assert actual_fields == expected_fields

def test_recent_incident_list_returns_max_5_records(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert len(res.recent_incidents) == 5

def test_recent_incident_list_ordered_by_created_at_desc(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    i_list = res.recent_incidents
    for i in range(len(i_list) - 1):
        assert i_list[i].created_at >= i_list[i+1].created_at

def test_recent_incident_list_ordered_by_id_desc_on_same_created_at(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    # i1 and i2 have same created_at
    now_list = [i for i in res.recent_incidents if i.id in (1, 2)]
    if len(now_list) == 2:
        assert now_list[0].id > now_list[1].id

def test_recent_incident_response_contains_only_safe_fields(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    inc = res.recent_incidents[0]
    expected_fields = {"id", "title", "status", "severity", "assigned_analyst_id", "created_at", "updated_at"}
    actual_fields = set(inc.model_dump().keys())
    assert actual_fields == expected_fields


# --- Salt okunur ve güvenlik davranışı ---

def test_service_does_not_modify_record_counts(populated_db: Session):
    count_before = populated_db.scalar(func.count(DetectionResult.id))
    get_dashboard_summary(populated_db)
    count_after = populated_db.scalar(func.count(DetectionResult.id))
    assert count_before == count_after

def test_service_leaves_no_new_or_dirty_objects_in_session(populated_db: Session):
    get_dashboard_summary(populated_db)
    assert len(populated_db.new) == 0
    assert len(populated_db.dirty) == 0
    assert len(populated_db.deleted) == 0

def test_response_schema_does_not_contain_password_or_token(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    data = res.model_dump()
    json_str = str(data).lower()
    assert "password" not in json_str
    assert "token" not in json_str

def test_response_schema_does_not_contain_protocol_field(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    data = res.model_dump()
    json_str = str(data).lower()
    assert "protocol" not in json_str

def test_response_schema_does_not_contain_model_performance_fields(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    data = res.model_dump()
    json_str = str(data).lower()
    assert "accuracy" not in json_str
    assert "precision" not in json_str
    assert "recall" not in json_str
    assert "f1" not in json_str
    assert "confusion" not in json_str

def test_generated_at_is_valid_datetime(populated_db: Session):
    res = get_dashboard_summary(populated_db)
    assert isinstance(res.generated_at, datetime)
    assert res.generated_at <= datetime.now(timezone.utc)
