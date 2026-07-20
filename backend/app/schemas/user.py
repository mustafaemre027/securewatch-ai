from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    """Schema for user creation request (Admin only).

    Attributes:
        username (str): Unique username.
        email (EmailStr): Valid email address.
        password (str): Plain text user password.
        role (UserRole): Role assigned to the user (ADMIN or ANALYST).
    """
    username: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole


class UserResponse(BaseModel):
    """Schema for public user profile representation.

    Attributes:
        id (int): Unique user ID.
        username (str): Username.
        email (EmailStr): User email address.
        role (UserRole): User role.
        created_at (datetime): Account creation timestamp.
    """
    id: int
    username: str
    email: EmailStr
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
