import pytest
from sqlalchemy.exc import IntegrityError
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.models.user import User, UserRole
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
    return create_user(db_session, UserCreate(username="analyst_det", email="det@test.ai", password="Password123!", role=UserRole.ANALYST))


def test_create_detection_result(db_session, test_user):
    """Test creating a valid DetectionResult."""
    job = AnalysisJob(
        user_id=test_user.id,
        file_name="test.csv",
        file_hash="a" * 64,
        file_size=100,
        status=AnalysisJobStatus.COMPLETED
    )
    db_session.add(job)
    db_session.commit()

    result = DetectionResult(
        job_id=job.id,
        row_index=0,
        attack_probability=0.95,
        is_attack=True,
        risk_level="CRITICAL"
    )
    db_session.add(result)
    db_session.commit()

    assert result.id is not None
    assert result.created_at is not None
    assert result.row_index == 0
    assert result.attack_probability == 0.95
    assert result.is_attack is True
    assert result.risk_level == "CRITICAL"


def test_unique_job_row_index(db_session, test_user):
    """Test that a job cannot have duplicate row indices."""
    job = AnalysisJob(
        user_id=test_user.id,
        file_name="test.csv",
        file_hash="b" * 64,
        file_size=100
    )
    db_session.add(job)
    db_session.commit()

    res1 = DetectionResult(
        job_id=job.id, row_index=1, attack_probability=0.5, is_attack=False, risk_level="LOW"
    )
    res2 = DetectionResult(
        job_id=job.id, row_index=1, attack_probability=0.8, is_attack=True, risk_level="HIGH"
    )
    
    db_session.add(res1)
    db_session.commit()
    
    db_session.add(res2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_different_jobs_same_row_index(db_session, test_user):
    """Test that different jobs can have the same row index."""
    job1 = AnalysisJob(user_id=test_user.id, file_name="t1.csv", file_hash="c"*64, file_size=100)
    job2 = AnalysisJob(user_id=test_user.id, file_name="t2.csv", file_hash="d"*64, file_size=100)
    db_session.add_all([job1, job2])
    db_session.commit()

    res1 = DetectionResult(job_id=job1.id, row_index=1, attack_probability=0.1, is_attack=False, risk_level="LOW")
    res2 = DetectionResult(job_id=job2.id, row_index=1, attack_probability=0.2, is_attack=False, risk_level="LOW")
    db_session.add_all([res1, res2])
    db_session.commit()
    
    assert res1.id is not None
    assert res2.id is not None


def test_cascade_delete(db_session, test_user):
    """Test that deleting a job deletes its detection results."""
    job = AnalysisJob(user_id=test_user.id, file_name="test.csv", file_hash="e"*64, file_size=100)
    db_session.add(job)
    db_session.commit()

    res = DetectionResult(job_id=job.id, row_index=0, attack_probability=0.1, is_attack=False, risk_level="LOW")
    db_session.add(res)
    db_session.commit()
    
    db_session.delete(job)
    db_session.commit()
    
    assert db_session.query(DetectionResult).count() == 0


def test_check_constraints(db_session, test_user):
    """Test negative row_index and out-of-bounds probability."""
    job = AnalysisJob(user_id=test_user.id, file_name="test.csv", file_hash="f"*64, file_size=100)
    db_session.add(job)
    db_session.commit()

    # Negative row_index
    res1 = DetectionResult(job_id=job.id, row_index=-1, attack_probability=0.5, is_attack=False, risk_level="LOW")
    db_session.add(res1)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # Probability > 1.0
    res2 = DetectionResult(job_id=job.id, row_index=0, attack_probability=1.5, is_attack=True, risk_level="CRITICAL")
    db_session.add(res2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # Invalid risk level
    res3 = DetectionResult(job_id=job.id, row_index=0, attack_probability=0.5, is_attack=False, risk_level="UNKNOWN")
    db_session.add(res3)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
