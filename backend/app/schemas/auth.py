from typing import Optional
from pydantic import BaseModel, Field

from app.models.user import UserRole
from app.schemas.user import UserResponse


class UserLogin(BaseModel):
    """Schema for authentication login request.

    Attributes:
        username (str): Registered username.
        password (str): Plain text password.
    """
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class Token(BaseModel):
    """Schema for successful authentication token response.

    Attributes:
        access_token (str): JWT access token.
        token_type (str): Token type string (default "bearer").
        user (UserResponse): Profile details of the authenticated user.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Internal schema for extracted JWT token claims data.

    Attributes:
        username (Optional[str]): Subject username.
        role (Optional[UserRole]): User role.
        user_id (Optional[int]): Unique user ID.
    """
    username: Optional[str] = None
    role: Optional[UserRole] = None
    user_id: Optional[int] = None
