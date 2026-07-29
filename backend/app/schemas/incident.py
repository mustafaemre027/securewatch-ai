from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator
from typing_extensions import Annotated

from app.models.incident import IncidentSeverity, IncidentStatus

# For strings that need whitespace stripped and shouldn't be empty
StrippedString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
TitleString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]

class IncidentCommentBase(BaseModel):
    comment_text: StrippedString

class IncidentCommentCreate(IncidentCommentBase):
    pass

class IncidentCommentResponse(IncidentCommentBase):
    id: int
    incident_id: int
    user_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class IncidentBase(BaseModel):
    title: TitleString
    description: StrippedString
    severity: IncidentSeverity

class IncidentCreate(IncidentBase):
    detection_result_id: int = Field(..., gt=0)

class IncidentUpdate(BaseModel):
    assigned_analyst_id: Optional[int] = Field(None, gt=0)
    status: Optional[IncidentStatus] = None

    model_config = ConfigDict(extra="forbid")

class IncidentListItem(IncidentBase):
    id: int
    detection_result_id: int
    assigned_analyst_id: Optional[int]
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class IncidentResponse(IncidentListItem):
    pass

class IncidentDetailResponse(IncidentListItem):
    comments: List[IncidentCommentResponse] = []
