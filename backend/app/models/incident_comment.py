from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.incident import Incident
    from app.models.user import User


class IncidentComment(Base):
    """SQLAlchemy model representing the incident_comments table.

    Attributes:
        id (int): Primary key ID.
        incident_id (int): Foreign key to incidents (CASCADE on delete).
        user_id (Optional[int]): Foreign key to users (SET NULL on delete).
        comment_text (str): Text content of the comment.
        created_at (datetime): Timestamp when the comment was created.
        incident (Incident): Relationship back to the incident.
        user (Optional[User]): Relationship to the user who wrote the comment.
    """
    __tablename__ = "incident_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    incident: Mapped["Incident"] = relationship(
        "Incident",
        back_populates="comments",
    )
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="incident_comments",
    )
