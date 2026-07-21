import io
import os
import shutil
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.audit_log import AuditLog
from app.models.user import UserRole
from app.services import csv_validation_service, storage_service, analysis_service
from app.services.csv_validation_service import CICIDS2017_FEATURE_COLUMNS, CICIDS2017_OPTIONAL_LABEL
from app.services.user_service import create_user
from app.schemas.user import UserCreate
from app.core.config import get_settings


from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
from app.db.session import get_db
from app.main import create_application

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
def app_instance(db_session: Session, override_settings, temp_upload_dir):
    app = create_application()
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_settings():
        from app.core.config import Settings
        settings = Settings()
        settings.upload_dir = temp_upload_dir
        settings.max_upload_size_bytes = 1048576
        return settings

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings
    return app


@pytest.fixture
def client(app_instance):
    return TestClient(app_instance, raise_server_exceptions=False)

@pytest.fixture
def temp_upload_dir(tmp_path) -> Path:

    """Provide a temporary directory for uploads, cleaning up after the test."""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    yield upload_dir
    shutil.rmtree(upload_dir, ignore_errors=True)

@pytest.fixture
def override_settings(temp_upload_dir):
    """Override application settings to use temp directory via os.environ."""
    import os
    env_backup_dir = os.environ.get("UPLOAD_DIR")
    env_backup_size = os.environ.get("MAX_UPLOAD_SIZE_BYTES")

    os.environ["UPLOAD_DIR"] = str(temp_upload_dir)
    os.environ["MAX_UPLOAD_SIZE_BYTES"] = "1048576"  # 1 MB
    get_settings.cache_clear()

    yield

    if env_backup_dir:
        os.environ["UPLOAD_DIR"] = env_backup_dir
    else:
        del os.environ["UPLOAD_DIR"]

    if env_backup_size:
        os.environ["MAX_UPLOAD_SIZE_BYTES"] = env_backup_size
    else:
        del os.environ["MAX_UPLOAD_SIZE_BYTES"]
    get_settings.cache_clear()

@pytest.fixture
def test_admin(db_session: Session):
    return create_user(db_session, UserCreate(username="admin_up", email="admin_up@test.ai", password="Password123!", role=UserRole.ADMIN))

@pytest.fixture
def test_user(db_session: Session):
    return create_user(db_session, UserCreate(username="analyst_up", email="analyst_up@test.ai", password="Password123!", role=UserRole.ANALYST))

@pytest.fixture
def test_admin_token(client: TestClient, test_admin):
    resp = client.post("/api/v1/auth/login", json={"username": "admin_up", "password": "Password123!"})
    return resp.json()["access_token"]

@pytest.fixture
def test_user_token(client: TestClient, test_user):
    resp = client.post("/api/v1/auth/login", json={"username": "analyst_up", "password": "Password123!"})
    return resp.json()["access_token"]


def generate_valid_csv_content(include_label: bool = True) -> str:
    headers = list(CICIDS2017_FEATURE_COLUMNS)
    if include_label:
        headers.append(CICIDS2017_OPTIONAL_LABEL)

    rows = [
        ",".join(headers),
        ",".join(["0"] * 78 + (["BENIGN"] if include_label else [])),
        ",".join(["1"] * 78 + (["DoS"] if include_label else [])),
    ]
    return "\n".join(rows)

class MockUploadFile:
    def __init__(self, filename: str, content: bytes, content_type: str = "text/csv"):
        self.filename = filename
        self.file = io.BytesIO(content)
        self.content_type = content_type

    async def read(self, size: int = -1):
        return self.file.read(size)

    async def seek(self, offset: int):
        self.file.seek(offset)

    async def close(self):
        self.file.close()

# --- Storage Service Tests ---
import asyncio

def test_storage_stage_success(temp_upload_dir):
    content = b"test content"
    mock_file = MockUploadFile("test.csv", content)
    staged = asyncio.run(storage_service.stage_upload(mock_file, temp_upload_dir, max_size_bytes=100))

    assert staged.original_filename == "test.csv"
    assert staged.file_size == len(content)
    assert len(staged.file_hash) == 64
    assert staged.temporary_path.exists()
    assert staged.temporary_path.parent == temp_upload_dir

def test_storage_stage_file_too_large(temp_upload_dir):
    content = b"a" * 105
    mock_file = MockUploadFile("large.csv", content)
    with pytest.raises(AppException) as exc:
        asyncio.run(storage_service.stage_upload(mock_file, temp_upload_dir, max_size_bytes=100))
    assert exc.value.status_code == 413
    assert exc.value.code == "FILE_TOO_LARGE"
    # Ensure tmp files are cleaned up
    assert len(list(temp_upload_dir.iterdir())) == 0

def test_storage_stage_path_traversal(temp_upload_dir):
    mock_file = MockUploadFile("../../evil.csv", b"content")
    staged = asyncio.run(storage_service.stage_upload(mock_file, temp_upload_dir, max_size_bytes=100))
    assert staged.original_filename == "evil.csv"

def test_storage_finalise_and_delete(temp_upload_dir):
    tmp_path = temp_upload_dir / "tmp_123"
    tmp_path.write_bytes(b"content")
    staged = storage_service.StagedUpload(
        temporary_path=tmp_path,
        original_filename="test.csv",
        file_hash="1" * 64,
        file_size=7
    )
    final_path = storage_service.finalise_upload(staged, temp_upload_dir)
    assert final_path.exists()
    assert final_path.name == f"{'1' * 64}.csv"
    assert not tmp_path.exists()

    storage_service.delete_finalised("1" * 64, temp_upload_dir)
    assert not final_path.exists()

def test_storage_discard_staged(temp_upload_dir):
    tmp_path = temp_upload_dir / "tmp_123"
    tmp_path.write_bytes(b"content")
    staged = storage_service.StagedUpload(
        temporary_path=tmp_path,
        original_filename="t.csv", file_hash="h", file_size=1
    )
    storage_service.discard_staged(staged)
    assert not tmp_path.exists()
    # Idempotent check
    storage_service.discard_staged(staged)

def test_storage_delete_finalised_traversal_protection(temp_upload_dir):
    # Should not delete outside upload_dir
    with patch("app.services.storage_service._safe_delete") as mock_delete:
        storage_service.delete_finalised("../some_hash", temp_upload_dir)
        mock_delete.assert_not_called()

# --- CSV Validation Tests ---

def test_validate_csv_metadata_success():
    csv_validation_service.validate_csv_metadata("test.csv", "text/csv")
    csv_validation_service.validate_csv_metadata("test.csv", "text/csv; charset=utf-8")

def test_validate_csv_metadata_failure():
    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_metadata("test.txt", "text/csv")
    assert exc.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_metadata("test.csv.exe", "text/csv")

    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_metadata("test.csv", "application/octet-stream")

def test_validate_csv_schema_success_with_label(tmp_path):
    f = tmp_path / "valid.csv"
    f.write_text(generate_valid_csv_content(include_label=True), encoding="utf-8")
    res = csv_validation_service.validate_csv_schema(f)
    assert res.feature_count == 78
    assert res.has_label is True

def test_validate_csv_schema_success_without_label(tmp_path):
    f = tmp_path / "valid_no_label.csv"
    f.write_text(generate_valid_csv_content(include_label=False), encoding="utf-8")
    res = csv_validation_service.validate_csv_schema(f)
    assert res.feature_count == 78
    assert res.has_label is False

def test_validate_csv_schema_shuffled(tmp_path):
    headers = list(CICIDS2017_FEATURE_COLUMNS)
    headers.reverse()  # Shuffle
    f = tmp_path / "shuffled.csv"
    f.write_text(",".join(headers) + "\n" + ",".join(["0"]*78), encoding="utf-8")
    res = csv_validation_service.validate_csv_schema(f)
    assert res.feature_count == 78

def test_validate_csv_schema_missing_column(tmp_path):
    headers = list(CICIDS2017_FEATURE_COLUMNS)[:-1] # Remove one
    f = tmp_path / "missing.csv"
    f.write_text(",".join(headers) + "\n", encoding="utf-8")
    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_schema(f)
    assert exc.value.code == "SCHEMA_MISMATCH"

def test_validate_csv_schema_extra_column(tmp_path):
    headers = list(CICIDS2017_FEATURE_COLUMNS) + ["ExtraCol"]
    f = tmp_path / "extra.csv"
    f.write_text(",".join(headers) + "\n", encoding="utf-8")
    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_schema(f)
    assert exc.value.code == "SCHEMA_MISMATCH"

def test_validate_csv_schema_duplicate_column(tmp_path):
    headers = list(CICIDS2017_FEATURE_COLUMNS)
    headers[1] = headers[0] # Duplicate first col
    f = tmp_path / "dup.csv"
    f.write_text(",".join(headers) + "\n", encoding="utf-8")
    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_schema(f)
    assert exc.value.code == "VALIDATION_ERROR"

def test_validate_csv_schema_empty_file(tmp_path):
    f = tmp_path / "empty.csv"
    f.touch()
    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_schema(f)
    assert exc.value.code == "VALIDATION_ERROR"

def test_validate_csv_schema_nul_byte(tmp_path):
    f = tmp_path / "nul.csv"
    f.write_bytes(b"header1,head\x00er2\n")
    with pytest.raises(AppException) as exc:
        csv_validation_service.validate_csv_schema(f)
    assert exc.value.code == "VALIDATION_ERROR"


# --- API Endpoint Integration Tests ---

def test_api_upload_unauthorized(client: TestClient):
    response = client.post("/api/v1/analysis/upload")
    assert response.status_code == 401

def test_api_upload_admin_forbidden(client: TestClient, test_admin_token: str):
    response = client.post(
        "/api/v1/analysis/upload",
        headers={"Authorization": f"Bearer {test_admin_token}"},
        files={"file": ("test.csv", b"content", "text/csv")}
    )
    assert response.status_code == 403

def test_api_upload_success_and_list(client: TestClient, test_user_token: str, test_user, override_settings, temp_upload_dir, db_session: Session):
    content = generate_valid_csv_content(include_label=True).encode("utf-8")


    # Upload
    response = client.post(
        "/api/v1/analysis/upload",
        headers={"Authorization": f"Bearer {test_user_token}"},
        files={"file": ("test_upload.csv", content, "text/csv")}
    )
    assert response.status_code == 202, f"Failed with {response.status_code}: {response.text}"
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "PENDING"
    assert data["file_name"] == "test_upload.csv"
    assert "file_hash" in data

    job_id = data["job_id"]
    file_hash = data["file_hash"]

    # Check physical file exists
    assert (temp_upload_dir / f"{file_hash}.csv").exists()

    # Check DB
    job = db_session.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    assert job is not None
    assert job.user_id == test_user.id

    # Check Audit Log
    audit = db_session.query(AuditLog).filter(AuditLog.user_id == test_user.id, AuditLog.action_type == "FILE_UPLOAD").first()
    assert audit is not None
    assert file_hash in audit.description

    # Duplicate Upload -> 400
    response_dup = client.post(
        "/api/v1/analysis/upload",
        headers={"Authorization": f"Bearer {test_user_token}"},
        files={"file": ("test_upload2.csv", content, "text/csv")}
    )
    assert response_dup.status_code == 400
    assert response_dup.json()["error"]["code"] == "DUPLICATE_FILE"

    # Get List
    response_list = client.get(
        "/api/v1/analysis",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert response_list.status_code == 200
    list_data = response_list.json()
    assert len(list_data) == 1
    assert list_data[0]["id"] == job_id

    # Get Detail
    response_detail = client.get(
        f"/api/v1/analysis/{job_id}",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert response_detail.status_code == 200
    assert response_detail.json()["id"] == job_id

def test_api_get_job_not_found(client: TestClient, test_user_token: str):
    response = client.get(
        "/api/v1/analysis/99999",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert response.status_code == 404


def test_transaction_rollback_on_db_error(override_settings, temp_upload_dir, db_session: Session, test_user):
    """Test that if DB commit fails, rollback happens and physical file is deleted."""
    content = generate_valid_csv_content(include_label=True).encode("utf-8")
    mock_file = MockUploadFile("rollback.csv", content)

    # Monkeypatch to force DB error on flush/commit
    original_add = db_session.add

    def fake_add(instance):
        if isinstance(instance, AuditLog):
            raise Exception("Simulated DB Error")
        original_add(instance)

    with patch.object(db_session, "add", side_effect=fake_add):
        with pytest.raises(AppException) as exc:
            asyncio.run(analysis_service.handle_csv_upload(
                db=db_session,
                upload_file=mock_file,
                upload_dir=temp_upload_dir,
                max_upload_size_bytes=1024*1024,
                analyst_id=test_user.id,
                ip_address="127.0.0.1"
            ))
        assert exc.value.status_code == 500
        assert exc.value.code == "UPLOAD_DB_ERROR"

    # Verify rollback
    assert db_session.query(AnalysisJob).count() == 0
    # Verify file cleanup
    assert len(list(temp_upload_dir.iterdir())) == 0


def test_transaction_rollback_on_integrity_error(override_settings, temp_upload_dir, db_session: Session, test_user):
    """Test IntegrityError simulation during atomic commit."""
    content = generate_valid_csv_content(include_label=True).encode("utf-8")
    mock_file = MockUploadFile("race.csv", content)

    def fake_commit():
        raise IntegrityError("Simulated Unique Constraint Failure", params={}, orig=Exception())

    with patch.object(db_session, "commit", side_effect=fake_commit):
        with pytest.raises(AppException) as exc:
            asyncio.run(analysis_service.handle_csv_upload(
                db=db_session,
                upload_file=mock_file,
                upload_dir=temp_upload_dir,
                max_upload_size_bytes=1024*1024,
                analyst_id=test_user.id,
                ip_address="127.0.0.1"
            ))
        assert exc.value.status_code == 400
        assert exc.value.code == "DUPLICATE_FILE"

    # Verify rollback and file cleanup
    assert len(list(temp_upload_dir.iterdir())) == 0
