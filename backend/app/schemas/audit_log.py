from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    """Schema for audit log representation.

    Attributes:
        id (int): Unique audit log entry ID.
        user_id (Optional[int]): User ID who triggered action (nullable).
        action_type (str): Type of system action.
        description (str): Detailed action description.
        ip_address (str): Client IP address.
        created_at (datetime): Action timestamp.
    """
    id: int
    user_id: Optional[int] = None
    action_type: str
    description: str
    ip_address: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
