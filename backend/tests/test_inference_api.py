import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import pandas as pd
import numpy as np

from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.services.user_service import create_user

# Add fixture definitions at the top since they are not in a global conftest.
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
from app.db.session import get_db
from app.main import create_application
from app.core.config import get_settings


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
def temp_upload_dir(tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


@pytest.fixture
def override_settings(temp_upload_dir):
    import os
    os.environ["UPLOAD_DIR"] = str(temp_upload_dir)
    get_settings.cache_clear()
    yield
    del os.environ["UPLOAD_DIR"]
    get_settings.cache_clear()


@pytest.fixture
def app_instance(db_session: Session, override_settings, temp_upload_dir):
    app = create_application()
    def override_get_db():
        yield db_session

    def override_get_settings():
        from app.core.config import Settings
        settings = Settings()
        settings.upload_dir = temp_upload_dir
        return settings

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings
    return app


@pytest.fixture
def client(app_instance):
    return TestClient(app_instance, raise_server_exceptions=False)


@pytest.fixture
def test_admin(db_session: Session):
    return create_user(db_session, UserCreate(username="admin_api", email="admin_api@test.ai", password="Password123!", role=UserRole.ADMIN))

@pytest.fixture
def test_user(db_session: Session):
    return create_user(db_session, UserCreate(username="analyst_api", email="api@test.ai", password="Password123!", role=UserRole.ANALYST))

@pytest.fixture
def test_user2(db_session: Session):
    return create_user(db_session, UserCreate(username="analyst_api2", email="api2@test.ai", password="Password123!", role=UserRole.ANALYST))

@pytest.fixture
def test_admin_token(client: TestClient, test_admin):
    resp = client.post("/api/v1/auth/login", json={"username": "admin_api", "password": "Password123!"})
    return resp.json()["access_token"]

@pytest.fixture
def test_user_token(client: TestClient, test_user):
    resp = client.post("/api/v1/auth/login", json={"username": "analyst_api", "password": "Password123!"})
    return resp.json()["access_token"]

@pytest.fixture
def test_user2_token(client: TestClient, test_user2):
    resp = client.post("/api/v1/auth/login", json={"username": "analyst_api2", "password": "Password123!"})
    return resp.json()["access_token"]


@pytest.fixture
def mock_upload_file(temp_upload_dir, monkeypatch):
    class MockSettings:
        upload_dir = temp_upload_dir
        model_package_path = temp_upload_dir
        
    monkeypatch.setattr("app.services.analysis_processing_service.get_settings", lambda: MockSettings())
    
    file_hash = "f" * 64
    csv_path = temp_upload_dir / f"{file_hash}.csv"
    
    columns = [f"col_{i}" for i in range(77)] + ["Label", "Fwd Header Length.1"]
    df = pd.DataFrame(np.random.rand(5, 79), columns=columns)
    df.to_csv(csv_path, index=False)
    
    return file_hash


@pytest.fixture
def mock_inference_pipeline(monkeypatch):
    class MockResult:
        class Row:
            def __init__(self, i):
                self.row_index = i
                self.attack_probability = 0.9 if i % 2 == 0 else 0.1
                self.is_attack = i % 2 == 0
                self.risk_level = "CRITICAL" if i % 2 == 0 else "LOW"
                
        def __init__(self):
            self.predictions = [self.Row(i) for i in range(5)]
            
    monkeypatch.setattr("app.services.analysis_processing_service.load_model_package", lambda: "mock_model")
    monkeypatch.setattr("app.services.analysis_processing_service.prepare_inference_data", lambda df: df)
    monkeypatch.setattr("app.services.analysis_processing_service.run_inference", lambda df, mdl: MockResult())


# Tests

def test_api_process_success_analyst(client: TestClient, test_user_token: str, db_session: Session, test_user, mock_upload_file, mock_inference_pipeline):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash=mock_upload_file, file_size=10, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()
    
    resp = client.post(f"/api/v1/analysis/{job.id}/process", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == job.id
    assert data["records_processed"] == 5
    assert data["final_status"] == "COMPLETED"


def test_api_process_success_admin(client: TestClient, test_admin_token: str, db_session: Session, test_user, mock_upload_file, mock_inference_pipeline):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash=mock_upload_file, file_size=10, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()
    
    resp = client.post(f"/api/v1/analysis/{job.id}/process", headers={"Authorization": f"Bearer {test_admin_token}"})
    assert resp.status_code == 200
    assert resp.json()["final_status"] == "COMPLETED"


def test_api_process_other_user_job(client: TestClient, test_user2_token: str, db_session: Session, test_user, mock_upload_file):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash=mock_upload_file, file_size=10, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()
    
    resp = client.post(f"/api/v1/analysis/{job.id}/process", headers={"Authorization": f"Bearer {test_user2_token}"})
    assert resp.status_code == 404


def test_api_unauthorized(client: TestClient):
    resp = client.post("/api/v1/analysis/1/process")
    assert resp.status_code == 401


def test_api_not_found(client: TestClient, test_user_token: str):
    resp = client.post("/api/v1/analysis/999/process", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 404


@pytest.mark.parametrize("status", [AnalysisJobStatus.PROCESSING, AnalysisJobStatus.COMPLETED, AnalysisJobStatus.FAILED])
def test_api_process_invalid_state(client: TestClient, test_user_token: str, db_session: Session, test_user, status):
    file_hash = str(uuid.uuid4()).replace("-", "") + str(uuid.uuid4()).replace("-", "")
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash=file_hash, file_size=10, status=status)
    db_session.add(job)
    db_session.commit()
    
    resp = client.post(f"/api/v1/analysis/{job.id}/process", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 409


import uuid

def test_api_process_invalid_state_actual(client: TestClient, test_user_token: str, db_session: Session, test_user):
    for status in [AnalysisJobStatus.PROCESSING, AnalysisJobStatus.COMPLETED, AnalysisJobStatus.FAILED]:
        file_hash = str(uuid.uuid4()).replace("-", "") + str(uuid.uuid4()).replace("-", "")
        job = AnalysisJob(user_id=test_user.id, file_name=f"{status.value}.csv", file_hash=file_hash, file_size=10, status=status)
        db_session.add(job)
        db_session.commit()
        
        resp = client.post(f"/api/v1/analysis/{job.id}/process", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 409


def setup_completed_job(db_session, test_user):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash="y"*64, file_size=10, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.commit()
    
    results = [
        DetectionResult(job_id=job.id, row_index=0, attack_probability=0.1, is_attack=False, risk_level="LOW"),
        DetectionResult(job_id=job.id, row_index=1, attack_probability=0.9, is_attack=True, risk_level="CRITICAL"),
        DetectionResult(job_id=job.id, row_index=2, attack_probability=0.2, is_attack=False, risk_level="LOW"),
        DetectionResult(job_id=job.id, row_index=3, attack_probability=0.6, is_attack=True, risk_level="HIGH"),
    ]
    db_session.add_all(results)
    db_session.commit()
    return job


def test_api_list_results(client: TestClient, test_user_token: str, db_session: Session, test_user):
    job = setup_completed_job(db_session, test_user)
    
    resp = client.get(f"/api/v1/analysis/{job.id}/results", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 4
    assert len(data["items"]) == 4
    assert [x["row_index"] for x in data["items"]] == [0, 1, 2, 3]


def test_api_list_results_pagination(client: TestClient, test_user_token: str, db_session: Session, test_user):
    job = setup_completed_job(db_session, test_user)
    
    resp = client.get(f"/api/v1/analysis/{job.id}/results?skip=1&limit=2", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 4
    assert len(data["items"]) == 2
    assert [x["row_index"] for x in data["items"]] == [1, 2]


def test_api_list_results_invalid_pagination(client: TestClient, test_user_token: str, db_session: Session, test_user):
    job = setup_completed_job(db_session, test_user)
    
    resp = client.get(f"/api/v1/analysis/{job.id}/results?skip=-1", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 422
    
    resp = client.get(f"/api/v1/analysis/{job.id}/results?limit=0", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 422
    
    resp = client.get(f"/api/v1/analysis/{job.id}/results?limit=101", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 422


def test_api_list_results_filters(client: TestClient, test_user_token: str, db_session: Session, test_user):
    job = setup_completed_job(db_session, test_user)
    
    # is_attack=true
    resp = client.get(f"/api/v1/analysis/{job.id}/results?is_attack=true", headers={"Authorization": f"Bearer {test_user_token}"})
    data = resp.json()
    assert data["total"] == 2
    assert all(x["is_attack"] for x in data["items"])
    
    # risk_level=LOW
    resp = client.get(f"/api/v1/analysis/{job.id}/results?risk_level=LOW", headers={"Authorization": f"Bearer {test_user_token}"})
    data = resp.json()
    assert data["total"] == 2
    assert all(x["risk_level"] == "LOW" for x in data["items"])
    
    # Invalid risk_level
    resp = client.get(f"/api/v1/analysis/{job.id}/results?risk_level=UNKNOWN", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 422


def test_api_list_results_not_completed(client: TestClient, test_user_token: str, db_session: Session, test_user):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash="z"*64, file_size=10, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()
    
    resp = client.get(f"/api/v1/analysis/{job.id}/results", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 409


def test_api_summary(client: TestClient, test_user_token: str, db_session: Session, test_user):
    job = setup_completed_job(db_session, test_user)
    
    resp = client.get(f"/api/v1/analysis/{job.id}/summary", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["total_records"] == 4
    assert data["normal_count"] == 2
    assert data["attack_count"] == 2
    assert data["risk_level_counts"]["LOW"] == 2
    assert data["risk_level_counts"]["MEDIUM"] == 0
    assert data["risk_level_counts"]["HIGH"] == 1
    assert data["risk_level_counts"]["CRITICAL"] == 1
    
    assert data["normal_count"] + data["attack_count"] == data["total_records"]
    assert sum(data["risk_level_counts"].values()) == data["total_records"]


def test_api_summary_not_completed(client: TestClient, test_user_token: str, db_session: Session, test_user):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash="z"*64, file_size=10, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()
    
    resp = client.get(f"/api/v1/analysis/{job.id}/summary", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 409


def test_api_safe_error_handling(client: TestClient, test_user_token: str, db_session: Session, test_user, mock_upload_file, monkeypatch):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash=mock_upload_file, file_size=10, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()
    
    def bad_inference(*args, **kwargs):
        raise ValueError("Hidden traceback")
    monkeypatch.setattr("app.services.analysis_processing_service.load_model_package", bad_inference)
    
    resp = client.post(f"/api/v1/analysis/{job.id}/process", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 500
    data = resp.json()
    assert "error" in data
    assert "Hidden traceback" not in str(data["error"])
