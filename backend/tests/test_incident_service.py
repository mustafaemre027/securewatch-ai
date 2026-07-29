import pytest
from unittest.mock import patch
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.incident_comment import IncidentComment
from app.models.detection_result import DetectionResult
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.core.exceptions import AppException

from app.services.incident_service import (
    get_incident_by_id,
    list_incidents,
    create_incident,
    update_incident,
    add_incident_comment,
)


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
    user = User(username="admin_test", email="admin@test.com", password_hash="h", role=UserRole.ADMIN)
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def analyst_user(db_session: Session) -> User:
    user = User(username="analyst_test", email="analyst@test.com", password_hash="h", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def analyst_user2(db_session: Session) -> User:
    user = User(username="analyst_test2", email="analyst2@test.com", password_hash="h", role=UserRole.ANALYST)
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def detection_result(db_session: Session, analyst_user: User) -> DetectionResult:
    job = AnalysisJob(user_id=analyst_user.id, file_name="f.csv", file_hash="h", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=1, attack_probability=0.9, is_attack=True, risk_level="HIGH")
    db_session.add(dr)
    db_session.commit()
    return dr


@pytest.fixture
def non_attack_result(db_session: Session, analyst_user: User) -> DetectionResult:
    job = AnalysisJob(user_id=analyst_user.id, file_name="f_clean.csv", file_hash="h2", file_size=1, status=AnalysisJobStatus.COMPLETED)
    db_session.add(job)
    db_session.flush()
    dr = DetectionResult(job_id=job.id, row_index=2, attack_probability=0.1, is_attack=False, risk_level="LOW")
    db_session.add(dr)
    db_session.commit()
    return dr


@pytest.fixture
def incident(db_session: Session, detection_result: DetectionResult, analyst_user: User) -> Incident:
    return create_incident(
        db=db_session,
        detection_result_id=detection_result.id,
        title="Test Title",
        description="Test Desc",
        severity=IncidentSeverity.HIGH,
        current_user=analyst_user,
        ip_address="127.0.0.1"
    )


# --- Create Incident Tests ---

def test_create_incident_success(db_session: Session, detection_result: DetectionResult, analyst_user: User):
    incident = create_incident(
        db=db_session,
        detection_result_id=detection_result.id,
        title="Valid Title",
        description="Valid Desc",
        severity=IncidentSeverity.MEDIUM,
        current_user=analyst_user,
        ip_address="127.0.0.1"
    )
    assert incident.id is not None
    assert incident.status == IncidentStatus.OPEN
    assert incident.assigned_analyst_id is None
    
    # Check audit log
    audit_log = db_session.query(AuditLog).filter_by(action_type="INCIDENT_CREATED", user_id=analyst_user.id).first()
    assert audit_log is not None
    assert str(incident.id) in audit_log.description


def test_create_incident_non_attack(db_session: Session, non_attack_result: DetectionResult, analyst_user: User):
    with pytest.raises(AppException) as exc:
        create_incident(
            db=db_session,
            detection_result_id=non_attack_result.id,
            title="T",
            description="D",
            severity=IncidentSeverity.LOW,
            current_user=analyst_user,
            ip_address="127.0.0.1"
        )
    assert exc.value.status_code == 400


def test_create_incident_wrong_owner(db_session: Session, detection_result: DetectionResult, analyst_user2: User):
    with pytest.raises(AppException) as exc:
        create_incident(
            db=db_session,
            detection_result_id=detection_result.id,
            title="T",
            description="D",
            severity=IncidentSeverity.LOW,
            current_user=analyst_user2,
            ip_address="127.0.0.1"
        )
    assert exc.value.status_code == 404


def test_create_incident_admin_forbidden(db_session: Session, detection_result: DetectionResult, admin_user: User):
    with pytest.raises(AppException) as exc:
        create_incident(
            db=db_session,
            detection_result_id=detection_result.id,
            title="T",
            description="D",
            severity=IncidentSeverity.LOW,
            current_user=admin_user,
            ip_address="127.0.0.1"
        )
    assert exc.value.status_code == 403


def test_create_incident_not_found(db_session: Session, analyst_user: User):
    with pytest.raises(AppException) as exc:
        create_incident(db_session, 9999, "T", "D", IncidentSeverity.LOW, analyst_user, "127.0.0.1")
    assert exc.value.status_code == 404


def test_create_incident_duplicate(db_session: Session, incident: Incident, analyst_user: User):
    with pytest.raises(AppException) as exc:
        create_incident(db_session, incident.detection_result_id, "T2", "D2", IncidentSeverity.LOW, analyst_user, "1.1.1.1")
    assert exc.value.status_code == 409


def test_create_incident_race_condition(db_session: Session, detection_result: DetectionResult, analyst_user: User):
    with patch.object(db_session, 'flush', side_effect=IntegrityError("msg", "orig", "params")):
        with pytest.raises(AppException) as exc:
            create_incident(db_session, detection_result.id, "T", "D", IncidentSeverity.LOW, analyst_user, "1.1.1.1")
        assert exc.value.status_code == 409


def test_create_incident_audit_rollback(db_session: Session, detection_result: DetectionResult, analyst_user: User):
    with patch('app.services.incident_service.audit_service.create_audit_log', side_effect=Exception("Audit fail")):
        with pytest.raises(AppException) as exc:
            create_incident(db_session, detection_result.id, "T", "D", IncidentSeverity.LOW, analyst_user, "1.1.1.1")
        assert exc.value.status_code == 500
    
    # Incident should be rolled back
    inc = db_session.query(Incident).filter_by(detection_result_id=detection_result.id).first()
    assert inc is None


# --- List/Read Tests ---

def test_list_incidents(db_session: Session, incident: Incident, analyst_user: User):
    incidents = list_incidents(db_session)
    assert len(incidents) == 1
    assert incidents[0].id == incident.id

    # Filter by status
    assert len(list_incidents(db_session, status=IncidentStatus.OPEN)) == 1
    assert len(list_incidents(db_session, status=IncidentStatus.IN_PROGRESS)) == 0

    # Filter by severity
    assert len(list_incidents(db_session, severity=IncidentSeverity.HIGH)) == 1
    assert len(list_incidents(db_session, severity=IncidentSeverity.LOW)) == 0
    
    # Filter by assigned
    assert len(list_incidents(db_session, assigned_analyst_id=analyst_user.id)) == 0
    
    assert get_incident_by_id(db_session, incident.id) is not None
    assert get_incident_by_id(db_session, 9999) is None


# --- Update / Assignment Tests ---

def test_update_assign_admin_to_analyst(db_session: Session, incident: Incident, admin_user: User, analyst_user: User):
    inc = update_incident(db_session, incident.id, admin_user, "1.1.1.1", assigned_analyst_id=analyst_user.id)
    assert inc.assigned_analyst_id == analyst_user.id
    
    audit_log = db_session.query(AuditLog).filter_by(action_type="INCIDENT_ASSIGNED").first()
    assert audit_log is not None


def test_update_assign_admin_to_admin_forbidden(db_session: Session, incident: Incident, admin_user: User):
    with pytest.raises(AppException) as exc:
        update_incident(db_session, incident.id, admin_user, "1.1.1.1", assigned_analyst_id=admin_user.id)
    assert exc.value.status_code == 400


def test_update_assign_analyst_claims_unassigned(db_session: Session, incident: Incident, analyst_user2: User):
    inc = update_incident(db_session, incident.id, analyst_user2, "1.1.1.1", assigned_analyst_id=analyst_user2.id)
    assert inc.assigned_analyst_id == analyst_user2.id


def test_update_assign_analyst_to_other_forbidden(db_session: Session, incident: Incident, analyst_user: User, analyst_user2: User):
    with pytest.raises(AppException) as exc:
        update_incident(db_session, incident.id, analyst_user, "1.1.1.1", assigned_analyst_id=analyst_user2.id)
    assert exc.value.status_code == 403


def test_update_assign_analyst_claims_assigned_forbidden(db_session: Session, incident: Incident, analyst_user: User, analyst_user2: User):
    update_incident(db_session, incident.id, analyst_user, "1.1.1.1", assigned_analyst_id=analyst_user.id)
    with pytest.raises(AppException) as exc:
        update_incident(db_session, incident.id, analyst_user2, "1.1.1.1", assigned_analyst_id=analyst_user2.id)
    assert exc.value.status_code == 403


# --- Status Transitions ---

def test_update_status_open_to_in_progress(db_session: Session, incident: Incident, analyst_user: User):
    # Claim and update status in one transaction
    inc = update_incident(db_session, incident.id, analyst_user, "1.1.1.1", 
                          assigned_analyst_id=analyst_user.id, status=IncidentStatus.IN_PROGRESS)
    assert inc.status == IncidentStatus.IN_PROGRESS
    assert inc.assigned_analyst_id == analyst_user.id

    audit_log = db_session.query(AuditLog).filter_by(action_type="INCIDENT_STATUS_CHANGED").first()
    assert audit_log is not None


def test_update_status_unassigned_forbidden(db_session: Session, incident: Incident, admin_user: User):
    with pytest.raises(AppException) as exc:
        update_incident(db_session, incident.id, admin_user, "1.1.1.1", status=IncidentStatus.IN_PROGRESS)
    assert exc.value.status_code == 400


def test_update_status_others_incident_forbidden(db_session: Session, incident: Incident, analyst_user: User, analyst_user2: User):
    update_incident(db_session, incident.id, analyst_user, "1.1.1.1", assigned_analyst_id=analyst_user.id)
    with pytest.raises(AppException) as exc:
        update_incident(db_session, incident.id, analyst_user2, "1.1.1.1", status=IncidentStatus.IN_PROGRESS)
    assert exc.value.status_code == 403


def test_update_status_open_to_resolved_forbidden(db_session: Session, incident: Incident, admin_user: User, analyst_user: User):
    update_incident(db_session, incident.id, admin_user, "1.1.1.1", assigned_analyst_id=analyst_user.id)
    with pytest.raises(AppException) as exc:
        update_incident(db_session, incident.id, admin_user, "1.1.1.1", status=IncidentStatus.RESOLVED)
    assert exc.value.status_code == 409


def test_update_status_terminal_forbidden(db_session: Session, incident: Incident, admin_user: User, analyst_user: User):
    update_incident(db_session, incident.id, admin_user, "1.1.1.1", assigned_analyst_id=analyst_user.id, status=IncidentStatus.FALSE_POSITIVE)
    with pytest.raises(AppException) as exc:
        update_incident(db_session, incident.id, admin_user, "1.1.1.1", status=IncidentStatus.OPEN)
    assert exc.value.status_code == 409


# --- Comments Tests ---

def test_add_comment_admin_success(db_session: Session, incident: Incident, admin_user: User):
    comment = add_incident_comment(db_session, incident.id, "Admin comm", admin_user, "1.1.1.1")
    assert comment.id is not None
    assert comment.user_id == admin_user.id
    
    audit_log = db_session.query(AuditLog).filter_by(action_type="INCIDENT_COMMENT_ADDED").first()
    assert audit_log is not None
    assert "Admin comm" not in audit_log.description


def test_add_comment_assigned_analyst_success(db_session: Session, incident: Incident, analyst_user: User):
    update_incident(db_session, incident.id, analyst_user, "1.1.1.1", assigned_analyst_id=analyst_user.id)
    comment = add_incident_comment(db_session, incident.id, "Analyst comm", analyst_user, "1.1.1.1")
    assert comment.id is not None


def test_add_comment_unassigned_analyst_forbidden(db_session: Session, incident: Incident, analyst_user: User):
    with pytest.raises(AppException) as exc:
        add_incident_comment(db_session, incident.id, "comm", analyst_user, "1.1.1.1")
    assert exc.value.status_code == 403


def test_add_comment_empty_forbidden(db_session: Session, incident: Incident, admin_user: User):
    with pytest.raises(AppException) as exc:
        add_incident_comment(db_session, incident.id, "   ", admin_user, "1.1.1.1")
    assert exc.value.status_code == 400


def test_add_comment_audit_rollback(db_session: Session, incident: Incident, admin_user: User):
    with patch('app.services.incident_service.audit_service.create_audit_log', side_effect=Exception("Audit fail")):
        with pytest.raises(AppException) as exc:
            add_incident_comment(db_session, incident.id, "C", admin_user, "1.1.1.1")
        assert exc.value.status_code == 500
        
    comments = db_session.query(IncidentComment).all()
    assert len(comments) == 0
