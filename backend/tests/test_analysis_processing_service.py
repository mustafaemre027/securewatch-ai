import pytest
import pandas as pd
from pathlib import Path
import numpy as np

from app.core.exceptions import AppException
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.services.analysis_processing_service import process_analysis_job
from app.services.storage_service import resolve_upload_file

from app.models.user import UserRole
from app.services.user_service import create_user
from app.schemas.user import UserCreate

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base

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
def test_user(db_session: Session):
    return create_user(db_session, UserCreate(username="analyst_proc", email="proc@test.ai", password="Password123!", role=UserRole.ANALYST))


@pytest.fixture
def mock_upload_file(tmp_path, monkeypatch):
    class MockSettings:
        upload_dir = tmp_path
        model_package_path = tmp_path

    monkeypatch.setattr("app.services.analysis_processing_service.get_settings", lambda: MockSettings())

    file_hash = "a" * 64
    csv_path = tmp_path / f"{file_hash}.csv"

    # Write a dummy CSV with 77 columns + Label
    columns = [f"col_{i}" for i in range(77)] + ["Label", "Fwd Header Length.1"]
    df = pd.DataFrame(np.random.rand(5, 79), columns=columns)
    df.to_csv(csv_path, index=False)

    return file_hash, tmp_path


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


def test_process_analysis_job_success(db_session, test_user, mock_upload_file, mock_inference_pipeline):
    """Test successful job processing."""
    file_hash, _ = mock_upload_file

    job = AnalysisJob(
        user_id=test_user.id,
        file_name="test.csv",
        file_hash=file_hash,
        file_size=1000,
        status=AnalysisJobStatus.PENDING
    )
    db_session.add(job)
    db_session.commit()

    res = process_analysis_job(db_session, job.id)

    assert res.job_id == job.id
    assert res.records_processed == 5
    assert res.final_status == "COMPLETED"

    db_session.refresh(job)
    assert job.status == AnalysisJobStatus.COMPLETED
    assert job.completed_at is not None
    assert job.error_message is None

    # Check DB for DetectionResults
    results = db_session.query(DetectionResult).filter_by(job_id=job.id).all()
    assert len(results) == 5
    assert [r.row_index for r in results] == [0, 1, 2, 3, 4]
    assert results[0].risk_level == "CRITICAL"


def test_process_job_invalid_state(db_session, test_user):
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash="b"*64, file_size=10, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.commit()

    with pytest.raises(AppException) as excinfo:
        process_analysis_job(db_session, job.id)
    assert excinfo.value.status_code == 409
    assert "cannot be started from state" in excinfo.value.message


def test_process_job_file_not_found(db_session, test_user, mock_upload_file):
    _, tmp_path = mock_upload_file

    job = AnalysisJob(
        user_id=test_user.id,
        file_name="test.csv",
        file_hash="c"*64, # this hash doesn't exist on disk
        file_size=1000,
        status=AnalysisJobStatus.PENDING
    )
    db_session.add(job)
    db_session.commit()

    with pytest.raises(AppException) as excinfo:
        process_analysis_job(db_session, job.id)

    db_session.refresh(job)
    assert job.status == AnalysisJobStatus.FAILED
    assert job.completed_at is not None
    assert "error occurred during file processing" in job.error_message

    assert excinfo.value.status_code == 404
    assert excinfo.value.code == "FILE_NOT_FOUND"


def test_process_job_empty_csv(db_session, test_user, mock_upload_file, monkeypatch):
    _, tmp_path = mock_upload_file
    file_hash = "d"*64
    (tmp_path / f"{file_hash}.csv").write_text("")

    job = AnalysisJob(
        user_id=test_user.id,
        file_name="test.csv",
        file_hash=file_hash,
        file_size=0,
        status=AnalysisJobStatus.PENDING
    )
    db_session.add(job)
    db_session.commit()

    monkeypatch.setattr("app.services.analysis_processing_service.load_model_package", lambda: "mock_model")

    with pytest.raises(AppException) as excinfo:
        process_analysis_job(db_session, job.id)

    assert excinfo.value.code == "VALIDATION_ERROR"
    db_session.refresh(job)
    assert job.status == AnalysisJobStatus.FAILED


def test_process_job_inference_error(db_session, test_user, mock_upload_file, monkeypatch):
    file_hash, _ = mock_upload_file
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash=file_hash, file_size=1000, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()

    monkeypatch.setattr("app.services.analysis_processing_service.load_model_package", lambda: "mock_model")
    monkeypatch.setattr("app.services.analysis_processing_service.prepare_inference_data", lambda df: df)

    def bad_inference(df, mdl):
        raise AppException(500, "INFERENCE_ERROR", "boom")
    monkeypatch.setattr("app.services.analysis_processing_service.run_inference", bad_inference)

    with pytest.raises(AppException) as excinfo:
        process_analysis_job(db_session, job.id)

    assert excinfo.value.code == "INFERENCE_ERROR"
    db_session.refresh(job)
    assert job.status == AnalysisJobStatus.FAILED


def test_resolve_upload_file_path_traversal(tmp_path):
    with pytest.raises(AppException) as excinfo:
        resolve_upload_file("../" + ("a" * 61), tmp_path)
    assert excinfo.value.status_code == 422

    with pytest.raises(AppException) as excinfo:
        resolve_upload_file(("a" * 30) + "/" + ("a" * 33), tmp_path)
    assert excinfo.value.status_code == 422

    with pytest.raises(AppException) as excinfo:
        resolve_upload_file(("a" * 30) + "\\" + ("a" * 33), tmp_path)
    assert excinfo.value.status_code == 422

    with pytest.raises(AppException) as excinfo:
        resolve_upload_file(("a" * 30) + "." + ("a" * 33), tmp_path)
    assert excinfo.value.status_code == 422


def test_resolve_upload_file_invalid_hash(tmp_path):
    with pytest.raises(AppException):
        resolve_upload_file("A" * 64, tmp_path)
    with pytest.raises(AppException):
        resolve_upload_file("a" * 63, tmp_path)


def test_process_job_rollback_on_db_error(db_session, test_user, mock_upload_file, monkeypatch, mock_inference_pipeline):
    file_hash, _ = mock_upload_file
    job = AnalysisJob(user_id=test_user.id, file_name="t.csv", file_hash=file_hash, file_size=1000, status=AnalysisJobStatus.PENDING)
    db_session.add(job)
    db_session.commit()

    original_commit = db_session.commit

    def failing_commit():
        if job.status == AnalysisJobStatus.COMPLETED:
            raise Exception("Mock DB flush error")
        original_commit()

    monkeypatch.setattr(db_session, "commit", failing_commit)

    with pytest.raises(AppException) as excinfo:
        process_analysis_job(db_session, job.id)

    assert excinfo.value.code == "PROCESSING_ERROR"
    db_session.refresh(job)
    assert job.status == AnalysisJobStatus.FAILED

    # Assert absolutely 0 DetectionResult records are in the DB for this job
    results = db_session.query(DetectionResult).filter_by(job_id=job.id).all()
    assert len(results) == 0


def test_process_job_concurrent_ownership(db_session, test_user, mock_upload_file, mock_inference_pipeline):
    file_hash, _ = mock_upload_file

    job = AnalysisJob(
        user_id=test_user.id,
        file_name="test.csv",
        file_hash=file_hash,
        file_size=1000,
        status=AnalysisJobStatus.PENDING
    )
    db_session.add(job)
    db_session.commit()

    SessionLocal = sessionmaker(bind=db_session.get_bind())
    session2 = SessionLocal()

    try:
        # Session 2 claims it
        session2.query(AnalysisJob).filter(AnalysisJob.id == job.id).update({"status": AnalysisJobStatus.PROCESSING})
        session2.commit()

        # Now session 1 tries to process it. It will read PENDING (if it reads at all before the update, or even if it reads after,
        # the atomic update relies on status=PENDING which is no longer true)
        with pytest.raises(AppException) as excinfo:
            process_analysis_job(db_session, job.id)

        assert excinfo.value.status_code == 409
    finally:
        session2.close()
