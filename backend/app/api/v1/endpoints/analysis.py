"""API endpoints for network traffic analysis jobs."""
from typing import List, Optional, Literal

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
    get_analysis_results,
    get_analysis_summary,
)
from app.services.analysis_processing_service import process_analysis_job
from app.schemas.detection_result import (
    DetectionResultPage,
    AnalysisSummaryResponse,
    AnalysisProcessingResponse,
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


@router.post("/{job_id}/process", response_model=AnalysisProcessingResponse)
def process_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ANALYST])),
) -> AnalysisProcessingResponse:
    """Process a pending analysis job synchronously.
    
    Protected: Admin and Analyst roles permitted.
    """
    is_admin = current_user.role == UserRole.ADMIN
    
    # Ownership and existence check
    job = get_analysis_job_by_id(db, job_id, current_user.id, is_admin)
    if not job:
        raise AppException(404, "NOT_FOUND", "Analysis job not found.")
        
    result = process_analysis_job(db, job.id)
    return AnalysisProcessingResponse(
        job_id=result.job_id,
        records_processed=result.records_processed,
        final_status=result.final_status
    )


@router.get("/{job_id}/results", response_model=DetectionResultPage)
def list_results(
    job_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_attack: Optional[bool] = Query(None),
    risk_level: Optional[Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ANALYST])),
) -> DetectionResultPage:
    """List inference results for a completed analysis job.
    
    Protected: Admin and Analyst roles permitted.
    """
    is_admin = current_user.role == UserRole.ADMIN
    
    total, items = get_analysis_results(
        db=db,
        job_id=job_id,
        user_id=current_user.id,
        is_admin=is_admin,
        skip=skip,
        limit=limit,
        is_attack=is_attack,
        risk_level=risk_level
    )
    
    return DetectionResultPage(
        total=total,
        items=items,
        skip=skip,
        limit=limit
    )


@router.get("/{job_id}/summary", response_model=AnalysisSummaryResponse)
def get_summary(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ANALYST])),
) -> AnalysisSummaryResponse:
    """Get aggregated summary of inference results for a completed job.
    
    Protected: Admin and Analyst roles permitted.
    """
    is_admin = current_user.role == UserRole.ADMIN
    
    return get_analysis_summary(
        db=db,
        job_id=job_id,
        user_id=current_user.id,
        is_admin=is_admin
    )
