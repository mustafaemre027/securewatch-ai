import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timedelta, timezone

from app.db.base import Base
from app.db.session import get_db
from app.main import create_application
from app.models.user import UserRole
from app.schemas.user import UserCreate
from app.services.user_service import create_user
from app.core.security import create_access_token

from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.models.incident import Incident, IncidentStatus, IncidentSeverity

@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()

@pytest.fixture
def app_instance(db_session: Session):
    app = create_application()
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    return app

@pytest.fixture
def client(app_instance):
    return TestClient(app_instance, raise_server_exceptions=False)

@pytest.fixture
def admin_user(db_session: Session):
    user = create_user(db_session, UserCreate(username="admin_dash_api", email="admin1@test.ai", password="Password123!", role=UserRole.ADMIN))
    return user

@pytest.fixture
def analyst_user(db_session: Session):
    user = create_user(db_session, UserCreate(username="analyst_dash_api", email="analyst1@test.ai", password="Password123!", role=UserRole.ANALYST))
    return user

@pytest.fixture
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.username})

@pytest.fixture
def analyst_token(analyst_user):
    return create_access_token({"sub": analyst_user.username})

@pytest.fixture
def populated_db(db_session: Session, admin_user) -> Session:
    now = datetime.now(timezone.utc)
    
    job1 = AnalysisJob(user_id=admin_user.id, file_name="f1", file_hash="h1", file_size=100, status=AnalysisJobStatus.COMPLETED)
    job2 = AnalysisJob(user_id=admin_user.id, file_name="f2", file_hash="h2", file_size=200, status=AnalysisJobStatus.FAILED)
    db_session.add_all([job1, job2])
    db_session.commit()
    
    d1 = DetectionResult(job_id=job1.id, row_index=0, attack_probability=0.1, is_attack=False, risk_level="LOW", created_at=now)
    d2 = DetectionResult(job_id=job1.id, row_index=1, attack_probability=0.9, is_attack=True, risk_level="CRITICAL", created_at=now)
    
    yesterday = now - timedelta(days=1)
    d3 = DetectionResult(job_id=job1.id, row_index=2, attack_probability=0.8, is_attack=True, risk_level="HIGH", created_at=yesterday)
    d4 = DetectionResult(job_id=job1.id, row_index=3, attack_probability=0.95, is_attack=True, risk_level="CRITICAL", created_at=yesterday)
    
    eight_days_ago = now - timedelta(days=8)
    d_old = DetectionResult(job_id=job2.id, row_index=4, attack_probability=0.99, is_attack=True, risk_level="CRITICAL", created_at=eight_days_ago)
    
    six_days_ago = now - timedelta(days=6)
    d_bound = DetectionResult(job_id=job1.id, row_index=5, attack_probability=0.2, is_attack=False, risk_level="LOW", created_at=six_days_ago)
    
    db_session.add_all([d1, d2, d3, d4, d_old, d_bound])
    db_session.commit()
    
    extra_detections = []
    for i in range(4):
        extra_detections.append(DetectionResult(
            job_id=job2.id, row_index=10+i, attack_probability=0.1, is_attack=False, risk_level="LOW", created_at=now - timedelta(hours=i+1)
        ))
    db_session.add_all(extra_detections)
    db_session.commit()

    i1 = Incident(detection_result_id=d2.id, status=IncidentStatus.OPEN, severity=IncidentSeverity.CRITICAL, title="T1", description="D1", created_at=now)
    i2 = Incident(detection_result_id=d3.id, status=IncidentStatus.RESOLVED, severity=IncidentSeverity.HIGH, title="T2", description="D2", created_at=now)
    
    i_old = Incident(detection_result_id=d_old.id, status=IncidentStatus.IN_PROGRESS, severity=IncidentSeverity.MEDIUM, title="Old", description="Old D", created_at=yesterday)
    
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


# --- Route ve authentication ---

def test_api_route_registered(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code != 404

def test_api_unauthorized_without_token(client: TestClient):
    res = client.get("/api/v1/dashboard/summary")
    assert res.status_code == 401

def test_api_unauthorized_with_invalid_token(client: TestClient):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": "Bearer INVALID"})
    assert res.status_code == 401

def test_api_analyst_can_access(client: TestClient, analyst_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res.status_code == 200

def test_api_admin_can_access(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

def test_api_successful_response_is_json(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert "application/json" in res.headers["content-type"]


# --- Boş veritabanı ---

def test_api_empty_db_returns_200(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

def test_api_empty_db_analysis_total_is_zero(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["analysis_summary"]["total_jobs"] == 0

def test_api_empty_db_detection_total_is_zero(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["detection_summary"]["total_detections"] == 0

def test_api_empty_db_incident_total_is_zero(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["incident_summary"]["total_incidents"] == 0

def test_api_empty_db_recent_lists_are_empty(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert len(data["recent_detections"]) == 0
    assert len(data["recent_incidents"]) == 0

def test_api_empty_db_trend_returns_seven_points(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert len(data["trend_7_days"]) == 7

def test_api_empty_db_distributions_are_padded(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert "COMPLETED" in data["analysis_summary"]["status_distribution"]
    assert "OPEN" in data["incident_summary"]["status_distribution"]
    assert "HIGH" in data["incident_summary"]["severity_distribution"]
    assert "LOW" in data["risk_distribution"]


# --- Gerçek aggregation entegrasyonu ---

def test_api_analysis_job_records_reflected(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["analysis_summary"]["total_jobs"] == 2
    assert data["analysis_summary"]["status_distribution"]["COMPLETED"] == 1

def test_api_detection_counts_reflected(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["detection_summary"]["total_detections"] == 10
    assert data["detection_summary"]["benign_count"] == 6
    assert data["detection_summary"]["attack_count"] == 4

def test_api_risk_distribution_reflected(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["risk_distribution"]["LOW"] == 6
    assert data["risk_distribution"]["CRITICAL"] == 3
    assert data["risk_distribution"]["HIGH"] == 1

def test_api_incident_status_distribution_reflected(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["incident_summary"]["status_distribution"]["OPEN"] == 1

def test_api_incident_severity_distribution_reflected(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert data["incident_summary"]["severity_distribution"]["CRITICAL"] == 1

def test_api_recent_detections_limit(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert len(data["recent_detections"]) == 5

def test_api_recent_incidents_limit(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert len(data["recent_incidents"]) == 5

def test_api_recent_detection_ordering(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    for i in range(len(data["recent_detections"]) - 1):
        dt1 = datetime.fromisoformat(data["recent_detections"][i]["created_at"])
        dt2 = datetime.fromisoformat(data["recent_detections"][i+1]["created_at"])
        assert dt1 >= dt2

def test_api_recent_incident_ordering(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    for i in range(len(data["recent_incidents"]) - 1):
        dt1 = datetime.fromisoformat(data["recent_incidents"][i]["created_at"])
        dt2 = datetime.fromisoformat(data["recent_incidents"][i+1]["created_at"])
        assert dt1 >= dt2

def test_api_trend_values_consistent(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert len(data["trend_7_days"]) == 7
    total_trend = sum(p["total"] for p in data["trend_7_days"])
    assert total_trend == 9


# --- Response güvenliği ve sözleşmesi ---

def test_api_response_contains_generated_at(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    assert "generated_at" in data
    assert datetime.fromisoformat(data["generated_at"])

def test_api_response_excludes_extra_fields(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    data = res.json()
    expected_keys = {
        "generated_at",
        "analysis_summary",
        "detection_summary",
        "detection_class_distribution",
        "risk_distribution",
        "incident_summary",
        "trend_7_days",
        "recent_detections",
        "recent_incidents"
    }
    assert set(data.keys()) == expected_keys

def test_api_response_excludes_password(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    json_str = res.text.lower()
    assert "password" not in json_str

def test_api_response_excludes_token(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    json_str = res.text.lower()
    assert "token" not in json_str

def test_api_response_excludes_protocol(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    json_str = res.text.lower()
    assert "protocol" not in json_str

def test_api_response_excludes_model_performance(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    json_str = res.text.lower()
    assert "accuracy" not in json_str
    assert "precision" not in json_str
    assert "recall" not in json_str

def test_api_response_excludes_model_and_upload_paths(client: TestClient, admin_token: str, populated_db):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    json_str = res.text.lower()
    assert "model_path" not in json_str
    assert "upload_path" not in json_str

def test_api_call_does_not_modify_db(client: TestClient, admin_token: str, populated_db):
    from sqlalchemy import func
    from app.models.detection_result import DetectionResult
    count_before = populated_db.scalar(func.count(DetectionResult.id))
    client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    count_after = populated_db.scalar(func.count(DetectionResult.id))
    assert count_before == count_after

def test_api_no_query_or_body_params_required(client: TestClient, admin_token: str):
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

def test_api_openapi_schema_contains_dashboard_summary(client: TestClient):
    res = client.get("/openapi.json")
    data = res.json()
    assert "/api/v1/dashboard/summary" in data["paths"]
    assert "get" in data["paths"]["/api/v1/dashboard/summary"]

def test_api_openapi_response_schema_linked(client: TestClient):
    res = client.get("/openapi.json")
    data = res.json()
    route_info = data["paths"]["/api/v1/dashboard/summary"]["get"]
    response_200 = route_info["responses"]["200"]
    schema_ref = response_200["content"]["application/json"]["schema"]["$ref"]
    assert "DashboardSummaryResponse" in schema_ref
