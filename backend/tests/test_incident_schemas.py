import pytest
from pydantic import ValidationError

from app.models.incident import IncidentSeverity, IncidentStatus
from app.schemas.incident import (
    IncidentCreate,
    IncidentUpdate,
    IncidentCommentCreate,
)

def test_incident_create_valid():
    schema = IncidentCreate(
        detection_result_id=1,
        title="  Valid Title  ",
        description="  Valid Description  ",
        severity=IncidentSeverity.HIGH,
    )
    assert schema.title == "Valid Title"
    assert schema.description == "Valid Description"
    assert schema.detection_result_id == 1
    assert schema.severity == IncidentSeverity.HIGH

def test_incident_create_invalid_severity():
    with pytest.raises(ValidationError):
        IncidentCreate(
            detection_result_id=1,
            title="Title",
            description="Desc",
            severity="INVALID",
        )

def test_incident_create_empty_title():
    with pytest.raises(ValidationError):
        IncidentCreate(
            detection_result_id=1,
            title="   ",
            description="Desc",
            severity=IncidentSeverity.LOW,
        )

def test_incident_create_title_too_long():
    with pytest.raises(ValidationError):
        IncidentCreate(
            detection_result_id=1,
            title="a" * 151,
            description="Desc",
            severity=IncidentSeverity.LOW,
        )

def test_incident_create_empty_description():
    with pytest.raises(ValidationError):
        IncidentCreate(
            detection_result_id=1,
            title="Title",
            description="   ",
            severity=IncidentSeverity.LOW,
        )

def test_incident_create_invalid_id():
    with pytest.raises(ValidationError):
        IncidentCreate(
            detection_result_id=0,
            title="Title",
            description="Desc",
            severity=IncidentSeverity.LOW,
        )

def test_incident_update_valid_assignment():
    schema = IncidentUpdate.model_validate({"assigned_analyst_id": 2})
    assert schema.assigned_analyst_id == 2
    assert schema.status is None

def test_incident_update_valid_both():
    schema = IncidentUpdate.model_validate({
        "assigned_analyst_id": 2,
        "status": IncidentStatus.IN_PROGRESS.value
    })
    assert schema.assigned_analyst_id == 2
    assert schema.status == IncidentStatus.IN_PROGRESS

def test_incident_update_extra_fields():
    with pytest.raises(ValidationError):
        IncidentUpdate.model_validate({"assigned_analyst_id": 2, "extra": "field"})

def test_incident_comment_create_valid():
    schema = IncidentCommentCreate(comment_text="  Some comment  ")
    assert schema.comment_text == "Some comment"

def test_incident_comment_create_empty():
    with pytest.raises(ValidationError):
        IncidentCommentCreate(comment_text="   ")
