"""API endpoints for network traffic analysis jobs."""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.utils import get_client_ip
from app.core.config import get_settings
from app.core.exceptions import AppException
from app.db.session import get_db
from app.models.analysis_job import AnalysisJobStatus
from app.models.user import User, UserRole
from app.schemas.analysis_job import (
    AnalysisJobDetail,
    AnalysisJobListItem,
    AnalysisUploadResponse,
)
from app.services.analysis_service import (
    get_analysis_job_by_id,
    handle_csv_upload,
    list_analysis_jobs,
)

router = APIRouter()


@router.post("/upload", response_model=AnalysisUploadResponse, status_code=202)
async def upload_analysis_csv(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ANALYST])),
    settings = Depends(get_settings),
) -> AnalysisUploadResponse:
    """Upload a CIC-IDS2017 format CSV for batch inference.

    Protected: Only Analyst role is permitted.
    Admin cannot perform uploads.
    """
    ip_address = get_client_ip(request)

    try:
        db_job = await handle_csv_upload(
            db=db,
            upload_file=file,
            upload_dir=settings.upload_dir,
            max_upload_size_bytes=settings.max_upload_size_bytes,
            analyst_id=current_user.id,
            ip_address=ip_address,
        )

        # Manually construct response to map the DB model's `id` to the schema's `job_id`
        return AnalysisUploadResponse(
            job_id=db_job.id,
            file_name=db_job.file_name,
            file_hash=db_job.file_hash,
            file_size=db_job.file_size,
            status=db_job.status,
            created_at=db_job.created_at,
        )
    finally:
        # Ensure the file resource is freed
        await file.close()


@router.get("", response_model=List[AnalysisJobListItem])
def list_jobs(
    status: Optional[AnalysisJobStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ANALYST])),
) -> List[AnalysisJobListItem]:
    """List analysis jobs with optional filtering and pagination.

    Protected: Admin and Analyst roles permitted.
    Admins see all jobs; Analysts see only jobs they created.
    """
    is_admin = current_user.role == UserRole.ADMIN

    jobs = list_analysis_jobs(
        db=db,
        user_id=current_user.id,
        is_admin=is_admin,
        status=status,
        skip=skip,
        limit=limit,
    )

    return [AnalysisJobListItem.model_validate(job) for job in jobs]


@router.get("/{job_id}", response_model=AnalysisJobDetail)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ANALYST])),
) -> AnalysisJobDetail:
    """Retrieve details of a specific analysis job.

    Protected: Admin and Analyst roles permitted.
    Admins can view any job; Analysts can view only their own jobs.
    Returns 404 if the job doesn't exist or is not owned by the Analyst.
    """
    is_admin = current_user.role == UserRole.ADMIN

    job = get_analysis_job_by_id(
        db=db,
        job_id=job_id,
        user_id=current_user.id,
        is_admin=is_admin,
    )

    if not job:
        raise AppException(
            status_code=404,
            code="NOT_FOUND",
            message="Analysis job not found.",
        )

    return AnalysisJobDetail.model_validate(job)
