"""Pydantic response schemas for AnalysisJob API endpoints."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.analysis_job import AnalysisJobStatus


class AnalysisUploadResponse(BaseModel):
    """Response schema returned immediately after a successful CSV upload.

    The job is created in PENDING status; ML inference has not yet started.

    Attributes:
        job_id (int): Primary key of the created AnalysisJob.
        file_name (str): Sanitised original filename as stored.
        file_hash (str): SHA-256 hex digest of the uploaded file.
        file_size (int): Byte count of the uploaded file.
        status (AnalysisJobStatus): Always PENDING on successful upload.
        created_at (datetime): Timestamp when the job record was created.
    """

    model_config = ConfigDict(from_attributes=True)

    job_id: int
    file_name: str
    file_hash: str
    file_size: int
    status: AnalysisJobStatus
    created_at: datetime


class AnalysisJobListItem(BaseModel):
    """Abbreviated schema used in paginated list responses.

    Does not expose file_hash, user_id, or error_message for compactness.

    Attributes:
        id (int): Primary key of the AnalysisJob.
        file_name (str): Sanitised original filename.
        file_size (int): Byte count of the file.
        status (AnalysisJobStatus): Current processing status.
        created_at (datetime): Job creation timestamp.
        completed_at (Optional[datetime]): Completion timestamp, or None.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    file_size: int
    status: AnalysisJobStatus
    created_at: datetime
    completed_at: Optional[datetime]


class AnalysisJobDetail(BaseModel):
    """Full detail schema for a single AnalysisJob.

    Intended for the GET /api/v1/analysis/{job_id} endpoint.  Does not include
    the physical storage path.

    Attributes:
        id (int): Primary key of the AnalysisJob.
        user_id (int): ID of the analyst who created the job.
        file_name (str): Sanitised original filename.
        file_hash (str): SHA-256 hex digest of the uploaded file.
        file_size (int): Byte count of the file.
        status (AnalysisJobStatus): Current processing status.
        error_message (Optional[str]): Failure message if status is FAILED.
        created_at (datetime): Job creation timestamp.
        completed_at (Optional[datetime]): Completion timestamp, or None.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    file_name: str
    file_hash: str
    file_size: int
    status: AnalysisJobStatus
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
