"""Analysis service orchestration and business logic."""
import logging
from typing import List, Optional
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import AppException
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.user import UserRole
from app.services.audit_service import create_audit_log
from app.services.storage_service import (
    stage_upload,
    finalise_upload,
    discard_staged,
    delete_finalised,
)
from app.services.csv_validation_service import (
    validate_csv_metadata,
    validate_csv_schema,
)
from app.models.detection_result import DetectionResult
from sqlalchemy import func

logger = logging.getLogger(__name__)


def get_analysis_job_by_hash(db: Session, file_hash: str) -> Optional[AnalysisJob]:
    """Retrieve an analysis job by its unique file hash.

    Args:
        db (Session): Database session.
        file_hash (str): The SHA-256 hash of the uploaded CSV.

    Returns:
        Optional[AnalysisJob]: The AnalysisJob if found, None otherwise.
    """
    return db.query(AnalysisJob).filter(AnalysisJob.file_hash == file_hash).first()


def get_analysis_job_by_id(
    db: Session,
    job_id: int,
    user_id: Optional[int] = None,
    is_admin: bool = False,
) -> Optional[AnalysisJob]:
    """Retrieve a specific analysis job by ID.

    If not admin, restrict to jobs owned by user_id.

    Args:
        db (Session): Database session.
        job_id (int): Job ID.
        user_id (Optional[int]): ID of the requesting user (needed if not admin).
        is_admin (bool): True if the requesting user is an Admin.

    Returns:
        Optional[AnalysisJob]: The job if found, None otherwise.
    """
    query = db.query(AnalysisJob).filter(AnalysisJob.id == job_id)
    if not is_admin:
        query = query.filter(AnalysisJob.user_id == user_id)
    return query.first()


def list_analysis_jobs(
    db: Session,
    user_id: Optional[int] = None,
    is_admin: bool = False,
    status: Optional[AnalysisJobStatus] = None,
    skip: int = 0,
    limit: int = 20,
) -> List[AnalysisJob]:
    """List analysis jobs, ordered by newest first.

    Admins see all jobs; Analysts see only their own.

    Args:
        db (Session): Database session.
        user_id (Optional[int]): Requesting user's ID.
        is_admin (bool): Is requesting user admin?
        status (Optional[AnalysisJobStatus]): Optional status filter.
        skip (int): Pagination offset.
        limit (int): Pagination limit.

    Returns:
        List[AnalysisJob]: List of matching jobs.
    """
    query = db.query(AnalysisJob)

    if not is_admin:
        query = query.filter(AnalysisJob.user_id == user_id)

    if status:
        query = query.filter(AnalysisJob.status == status)

    return query.order_by(AnalysisJob.created_at.desc()).offset(skip).limit(limit).all()


async def handle_csv_upload(
    db: Session,
    upload_file: UploadFile,
    upload_dir: Path,
    max_upload_size_bytes: int,
    analyst_id: int,
    ip_address: str,
) -> AnalysisJob:
    """Orchestrate the secure CSV upload, validation, and job creation.

    Args:
        db (Session): Database session.
        upload_file (UploadFile): The file upload object.
        upload_dir (Path): The configured upload directory.
        max_upload_size_bytes (int): Maximum file size in bytes.
        analyst_id (int): The ID of the Analyst performing the upload.
        ip_address (str): The client IP address for the audit log.

    Returns:
        AnalysisJob: The created AnalysisJob in PENDING state.

    Raises:
        AppException: For validation errors, duplicate files, or DB errors.
    """
    # 1. Validate basic metadata before staging
    validate_csv_metadata(upload_file.filename, upload_file.content_type)

    # 2. Stage the file (reads chunk by chunk, checks size limit, calculates SHA-256)
    staged = await stage_upload(
        upload_file=upload_file,
        upload_dir=upload_dir,
        max_size_bytes=max_upload_size_bytes,
    )

    try:
        # 3. Validate CSV schema (reads only the first chunk of the staged file)
        # Will raise AppException if validation fails.
        validate_csv_schema(staged.temporary_path)

        # 4. Check for duplicates in DB before finalizing storage
        existing_job = get_analysis_job_by_hash(db, staged.file_hash)
        if existing_job:
            # We already have this file in the DB
            raise AppException(
                status_code=400,
                code="DUPLICATE_FILE",
                message="A file with the same content has already been uploaded.",
            )

        # 5. Finalize the upload
        permanent_path = finalise_upload(staged, upload_dir)

    except Exception:
        # Clean up the staged file if validation or duplicate check or finalization fails
        discard_staged(staged)
        raise

    # 6. Create AnalysisJob and AuditLog in a single transaction
    db_job = AnalysisJob(
        user_id=analyst_id,
        file_name=staged.original_filename,
        file_hash=staged.file_hash,
        file_size=staged.file_size,
        status=AnalysisJobStatus.PENDING,
    )

    try:
        db.add(db_job)

        # Create audit log using the existing service
        # Note: We construct description avoiding absolute paths or secrets
        description = f"Uploaded CSV file '{staged.original_filename}' with SHA-256 {staged.file_hash}"
        from app.models.audit_log import AuditLog
        audit_entry = AuditLog(
            user_id=analyst_id,
            action_type="FILE_UPLOAD",
            description=description,
            ip_address=ip_address,
        )
        db.add(audit_entry)

        db.flush()
        # Atomic commit
        db.commit()
        db.refresh(db_job)

        logger.info(
            "Atomically committed AnalysisJob id=%s and AuditLog id=%s",
            db_job.id,
            audit_entry.id,
        )
        return db_job

    except IntegrityError:
        # Race condition: another request committed the same hash just before us
        db.rollback()
        # Clean up the permanent file since we just created it and the DB failed
        delete_finalised(staged.file_hash, upload_dir)
        logger.warning("Duplicate file hash detected via IntegrityError during commit.")
        raise AppException(
            status_code=400,
            code="DUPLICATE_FILE",
            message="A file with the same content has already been uploaded.",
        )
    except Exception as exc:
        db.rollback()
        delete_finalised(staged.file_hash, upload_dir)
        logger.exception("Database error while creating analysis job.")
        raise AppException(
            status_code=500,
            code="UPLOAD_DB_ERROR",
            message="An unexpected error occurred while saving the upload record.",
        ) from exc


def get_analysis_results(
    db: Session,
    job_id: int,
    user_id: int,
    is_admin: bool,
    skip: int = 0,
    limit: int = 50,
    is_attack: Optional[bool] = None,
    risk_level: Optional[str] = None,
) -> tuple[int, List[DetectionResult]]:
    job = get_analysis_job_by_id(db, job_id, user_id, is_admin)
    if not job:
        raise AppException(404, "NOT_FOUND", "Analysis job not found.")

    if job.status != AnalysisJobStatus.COMPLETED:
        raise AppException(409, "NOT_COMPLETED", "Analysis job is not completed yet.")

    query = db.query(DetectionResult).filter(DetectionResult.job_id == job_id)

    if is_attack is not None:
        query = query.filter(DetectionResult.is_attack == is_attack)

    if risk_level is not None:
        query = query.filter(DetectionResult.risk_level == risk_level)

    total = query.count()
    items = query.order_by(DetectionResult.row_index.asc()).offset(skip).limit(limit).all()

    return total, items


def get_analysis_summary(
    db: Session,
    job_id: int,
    user_id: int,
    is_admin: bool,
):
    job = get_analysis_job_by_id(db, job_id, user_id, is_admin)
    if not job:
        raise AppException(404, "NOT_FOUND", "Analysis job not found.")

    if job.status != AnalysisJobStatus.COMPLETED:
        raise AppException(409, "NOT_COMPLETED", "Analysis job is not completed yet.")

    # Aggregate using SQL
    total_records = db.query(func.count(DetectionResult.id)).filter(DetectionResult.job_id == job_id).scalar() or 0
    attack_count = db.query(func.count(DetectionResult.id)).filter(
        DetectionResult.job_id == job_id,
        DetectionResult.is_attack == True
    ).scalar() or 0

    normal_count = total_records - attack_count

    # Risk levels
    risk_counts = db.query(DetectionResult.risk_level, func.count(DetectionResult.id)).filter(
        DetectionResult.job_id == job_id
    ).group_by(DetectionResult.risk_level).all()

    counts_dict = {level: count for level, count in risk_counts}

    from app.schemas.detection_result import AnalysisSummaryResponse, RiskLevelCounts

    return AnalysisSummaryResponse(
        job_id=job.id,
        status=job.status,
        total_records=total_records,
        normal_count=normal_count,
        attack_count=attack_count,
        risk_level_counts=RiskLevelCounts(
            LOW=counts_dict.get("LOW", 0),
            MEDIUM=counts_dict.get("MEDIUM", 0),
            HIGH=counts_dict.get("HIGH", 0),
            CRITICAL=counts_dict.get("CRITICAL", 0),
        ),
        completed_at=job.completed_at
    )
