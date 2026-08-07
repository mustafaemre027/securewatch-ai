import pytest
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect

from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.incident_comment import IncidentComment
from app.models.user import User, UserRole
from app.models.detection_result import DetectionResult
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus

from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
import alembic.command as command
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
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

def test_incident_default_status(db_session: Session):
    # Setup dependencies
    user = User(username="analyst_1", email="a1@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.flush()
    job = AnalysisJob(user_id=user.id, file_name="f.csv", file_hash="h", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=1, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    incident = Incident(
        detection_result_id=dr.id,
        severity=IncidentSeverity.HIGH,
        title="Test Incident",
        description="Desc"
    )
    db_session.add(incident)
    db_session.commit()

    assert incident.status == IncidentStatus.OPEN
    assert incident.created_at is not None
    assert incident.updated_at is not None


def test_incident_valid_status_and_severity(db_session: Session):
    # Setup
    user = User(username="analyst_2", email="a2@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.flush()
    job = AnalysisJob(user_id=user.id, file_name="f2.csv", file_hash="h2", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=2, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    # Valid status and severity combinations
    for status in [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.FALSE_POSITIVE]:
        for severity in [IncidentSeverity.LOW, IncidentSeverity.MEDIUM, IncidentSeverity.HIGH, IncidentSeverity.CRITICAL]:
            incident = Incident(
                detection_result_id=dr.id,
                status=status,
                severity=severity,
                title="Test Incident",
                description="Desc"
            )
            db_session.add(incident)
            db_session.flush()
            db_session.delete(incident)
            db_session.flush()


def test_incident_detection_result_unique_constraint(db_session: Session):
    user = User(username="analyst_3", email="a3@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.flush()
    job = AnalysisJob(user_id=user.id, file_name="f3.csv", file_hash="h3", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=3, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    incident1 = Incident(detection_result_id=dr.id, severity=IncidentSeverity.HIGH, title="1", description="1")
    db_session.add(incident1)
    db_session.commit()

    incident2 = Incident(detection_result_id=dr.id, severity=IncidentSeverity.HIGH, title="2", description="2")
    db_session.add(incident2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_detection_result_restrict_policy(db_session: Session):
    user = User(username="analyst_4", email="a4@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.flush()
    job = AnalysisJob(user_id=user.id, file_name="f4.csv", file_hash="h4", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=4, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    incident = Incident(detection_result_id=dr.id, severity=IncidentSeverity.HIGH, title="1", description="1")
    db_session.add(incident)
    db_session.commit()

    db_session.delete(dr)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_assigned_analyst_set_null_policy(db_session: Session):
    user_job = User(username="analyst_5", email="a5@test.com", password_hash="hash", role=UserRole.ANALYST)
    user_analyst = User(username="analyst_5b", email="a5b@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add_all([user_job, user_analyst])
    db_session.flush()
    job = AnalysisJob(user_id=user_job.id, file_name="f5.csv", file_hash="h5", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=5, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    incident = Incident(detection_result_id=dr.id, severity=IncidentSeverity.HIGH, title="1", description="1", assigned_analyst_id=user_analyst.id)
    db_session.add(incident)
    db_session.commit()

    db_session.delete(user_analyst)
    db_session.commit()

    db_session.refresh(incident)
    assert incident.assigned_analyst_id is None


def test_incident_comment_cascade_policy(db_session: Session):
    user = User(username="analyst_6", email="a6@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.flush()
    job = AnalysisJob(user_id=user.id, file_name="f6.csv", file_hash="h6", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=6, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    incident = Incident(detection_result_id=dr.id, severity=IncidentSeverity.HIGH, title="1", description="1")
    db_session.add(incident)
    db_session.flush()

    comment = IncidentComment(incident_id=incident.id, comment_text="Test comment")
    db_session.add(comment)
    db_session.commit()

    comment_id = comment.id
    db_session.delete(incident)
    db_session.commit()

    assert db_session.get(IncidentComment, comment_id) is None


def test_incident_comment_user_set_null_policy(db_session: Session):
    user_job = User(username="analyst_7", email="a7@test.com", password_hash="hash", role=UserRole.ANALYST)
    user_commenter = User(username="analyst_7b", email="a7b@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add_all([user_job, user_commenter])
    db_session.flush()
    job = AnalysisJob(user_id=user_job.id, file_name="f7.csv", file_hash="h7", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=7, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    incident = Incident(detection_result_id=dr.id, severity=IncidentSeverity.HIGH, title="1", description="1")
    db_session.add(incident)
    db_session.flush()

    comment = IncidentComment(incident_id=incident.id, user_id=user_commenter.id, comment_text="Test")
    db_session.add(comment)
    db_session.commit()

    db_session.delete(user_commenter)
    db_session.commit()

    db_session.refresh(comment)
    assert comment.user_id is None


def test_incident_relationships(db_session: Session):
    user = User(username="analyst_8", email="a8@test.com", password_hash="hash", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.flush()
    job = AnalysisJob(user_id=user.id, file_name="f8.csv", file_hash="h8", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=8, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.flush()

    incident = Incident(
        detection_result_id=dr.id,
        severity=IncidentSeverity.HIGH,
        title="Test Incident",
        description="Desc",
        assigned_analyst_id=user.id
    )
    db_session.add(incident)
    db_session.flush()

    comment = IncidentComment(incident_id=incident.id, user_id=user.id, comment_text="Test")
    db_session.add(comment)
    db_session.commit()

    assert incident.detection_result == dr
    assert dr.incident == incident
    assert incident.assigned_analyst == user
    assert incident in user.assigned_incidents
    assert incident.comments == [comment]
    assert comment.incident == incident
    assert comment.user == user
    assert comment in user.incident_comments


def test_migration_down_revision_and_sequence():
    config = Config("alembic.ini")
    script = ScriptDirectory.from_config(config)

    # Find the migration that creates incidents
    revisions = list(script.walk_revisions())
    incident_revision = None
    for rev in revisions:
        if "create_incident_tables" in getattr(rev, 'message', '') or "incident" in getattr(rev, 'message', '').lower():
            incident_revision = rev
            break

    if not incident_revision:
        # Fallback to the head revision
        incident_revision = script.get_current_head()
        incident_revision = script.get_revision(incident_revision)

    assert incident_revision.down_revision == "3517424f56b5", "down_revision must be exactly 3517424f56b5"
