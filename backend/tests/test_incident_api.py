import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import create_application
from app.models.user import UserRole
from app.schemas.user import UserCreate
from app.services.user_service import create_user
from app.models.detection_result import DetectionResult
from app.models.incident import IncidentSeverity, IncidentStatus, Incident
from app.core.security import create_access_token

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
    user = create_user(db_session, UserCreate(username="admin1", email="admin1@test.ai", password="Password123!", role=UserRole.ADMIN))
    return user


@pytest.fixture
def analyst_user(db_session: Session):
    user = create_user(db_session, UserCreate(username="analyst1", email="analyst1@test.ai", password="Password123!", role=UserRole.ANALYST))
    return user


@pytest.fixture
def analyst_user2(db_session: Session):
    user = create_user(db_session, UserCreate(username="analyst2", email="analyst2@test.ai", password="Password123!", role=UserRole.ANALYST))
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.username})


@pytest.fixture
def analyst_token(analyst_user):
    return create_access_token({"sub": analyst_user.username})


@pytest.fixture
def analyst2_token(analyst_user2):
    return create_access_token({"sub": analyst_user2.username})

@pytest.fixture
def dummy_detection_result(db_session: Session, analyst_user):
    from app.models.analysis_job import AnalysisJob
    job = AnalysisJob(
        user_id=analyst_user.id,
        file_name="dummy.csv",
        file_hash="hash",
        file_size=100,
        status="COMPLETED"
    )
    db_session.add(job)
    db_session.flush()

    res = DetectionResult(
        job_id=job.id,
        row_index=1,
        attack_probability=0.9,
        is_attack=True,
        risk_level="HIGH",
    )
    db_session.add(res)
    db_session.commit()
    db_session.refresh(res)
    return res


def test_unauthorized(client: TestClient):
    response = client.post("/api/v1/incidents", json={"detection_result_id": 1, "title": "t", "description": "d", "severity": "LOW"})
    assert response.status_code == 401

def test_create_incident_admin_forbidden(client: TestClient, admin_token, dummy_detection_result):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post("/api/v1/incidents", headers=headers, json={"detection_result_id": dummy_detection_result.id, "title": "t", "description": "d", "severity": "LOW"})
    assert response.status_code == 403

def test_create_incident_success(client: TestClient, analyst_token, dummy_detection_result, db_session):
    headers = {"Authorization": f"Bearer {analyst_token}"}
    payload = {
        "detection_result_id": dummy_detection_result.id,
        "title": "Malware Found",
        "description": "Suspicious activity detected.",
        "severity": "HIGH"
    }
    # Check if the detection result exists in the session
    from app.models.detection_result import DetectionResult
    db_res = db_session.query(DetectionResult).filter(DetectionResult.id == dummy_detection_result.id).first()
    print("DB RES:", db_res)
    response = client.post("/api/v1/incidents", headers=headers, json=payload)
    print("RESPONSE:", response.json())
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Malware Found"
    assert data["severity"] == "HIGH"
    assert data["status"] == "OPEN"
    assert "findings" not in data  # No raw DetectionResult leaked
    assert "password" not in data
    assert "comments" not in data

def test_create_incident_invalid_data(client: TestClient, analyst_token):
    headers = {"Authorization": f"Bearer {analyst_token}"}
    response = client.post("/api/v1/incidents", headers=headers, json={"title": "Missing ID"})
    assert response.status_code == 422

def test_create_incident_not_found_detection(client: TestClient, analyst_token):
    headers = {"Authorization": f"Bearer {analyst_token}"}
    payload = {
        "detection_result_id": 999,
        "title": "T",
        "description": "D",
        "severity": "LOW"
    }
    response = client.post("/api/v1/incidents", headers=headers, json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_list_incidents(client: TestClient, admin_token, db_session, dummy_detection_result, admin_user):
    from app.models.analysis_job import AnalysisJob
    job2 = AnalysisJob(user_id=admin_user.id, file_name="2.csv", file_hash="hash2", file_size=100, status="COMPLETED")
    db_session.add(job2)
    db_session.flush()
    res2 = DetectionResult(job_id=job2.id, row_index=1, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(res2)
    db_session.flush()

    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    inc2 = Incident(detection_result_id=res2.id, title="2", description="2", severity=IncidentSeverity.HIGH)
    db_session.add_all([inc1, inc2])
    db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/v1/incidents", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

def test_list_incidents_invalid_limit(client: TestClient, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/v1/incidents?limit=999", headers=headers)
    assert response.status_code == 422

def test_list_incidents_negative_skip(client: TestClient, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/v1/incidents?skip=-1", headers=headers)
    assert response.status_code == 422


def test_get_incident_detail(client: TestClient, analyst_token, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    headers = {"Authorization": f"Bearer {analyst_token}"}
    response = client.get(f"/api/v1/incidents/{inc1.id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "1"
    assert "comments" in data
    assert isinstance(data["comments"], list)
    assert "findings" not in data

def test_get_incident_detail_not_found(client: TestClient, analyst_token):
    headers = {"Authorization": f"Bearer {analyst_token}"}
    response = client.get("/api/v1/incidents/999", headers=headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_update_incident_assign_and_status(client: TestClient, analyst_token, analyst_user, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    headers = {"Authorization": f"Bearer {analyst_token}"}
    payload = {
        "assigned_analyst_id": analyst_user.id,
        "status": "IN_PROGRESS"
    }
    response = client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers, json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["assigned_analyst_id"] == analyst_user.id
    assert data["status"] == "IN_PROGRESS"

def test_update_incident_empty_body(client: TestClient, analyst_token, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    headers = {"Authorization": f"Bearer {analyst_token}"}
    response = client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers, json={})
    assert response.status_code == 422

def test_update_incident_explicit_null(client: TestClient, analyst_token, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    headers = {"Authorization": f"Bearer {analyst_token}"}
    response = client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers, json={"assigned_analyst_id": None})
    assert response.status_code == 422

def test_update_incident_conflict_race(client: TestClient, analyst_token, analyst2_token, analyst_user, analyst_user2, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    # First user claims
    headers1 = {"Authorization": f"Bearer {analyst_token}"}
    client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers1, json={"assigned_analyst_id": analyst_user.id})

    # Second user tries to claim
    headers2 = {"Authorization": f"Bearer {analyst2_token}"}
    response = client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers2, json={"assigned_analyst_id": analyst_user2.id})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INCIDENT_ASSIGNMENT_CONFLICT"

def test_update_incident_forbidden_modify_other(client: TestClient, analyst_token, analyst2_token, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    headers1 = {"Authorization": f"Bearer {analyst_token}"}
    client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers1, json={"status": "IN_PROGRESS"})

    headers2 = {"Authorization": f"Bearer {analyst2_token}"}
    response = client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers2, json={"status": "RESOLVED"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"

def test_update_incident_invalid_transition(client: TestClient, analyst_token, db_session, dummy_detection_result, analyst_user):
    inc1 = Incident(
        detection_result_id=dummy_detection_result.id,
        title="1",
        description="1",
        severity=IncidentSeverity.LOW,
        status=IncidentStatus.RESOLVED,
        assigned_analyst_id=analyst_user.id
    )
    db_session.add(inc1)
    db_session.commit()
    db_session.refresh(inc1)

    headers = {"Authorization": f"Bearer {analyst_token}"}
    response = client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers, json={"status": "OPEN"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_add_comment(client: TestClient, admin_token, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(f"/api/v1/incidents/{inc1.id}/comments", headers=headers, json={"comment_text": "Looking into this."})
    assert response.status_code == 201
    data = response.json()
    assert data["comment_text"] == "Looking into this."

def test_add_comment_empty(client: TestClient, admin_token, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(f"/api/v1/incidents/{inc1.id}/comments", headers=headers, json={"comment_text": "   "})
    assert response.status_code == 422

def test_add_comment_forbidden(client: TestClient, analyst_token, analyst2_token, db_session, dummy_detection_result):
    inc1 = Incident(detection_result_id=dummy_detection_result.id, title="1", description="1", severity=IncidentSeverity.LOW)
    db_session.add(inc1)
    db_session.commit()

    # User 1 claims
    headers1 = {"Authorization": f"Bearer {analyst_token}"}
    client.patch(f"/api/v1/incidents/{inc1.id}", headers=headers1, json={"status": "IN_PROGRESS"})

    # User 2 tries to comment
    headers2 = {"Authorization": f"Bearer {analyst2_token}"}
    response = client.post(f"/api/v1/incidents/{inc1.id}/comments", headers=headers2, json={"comment_text": "Hey"})
    assert response.status_code == 403
