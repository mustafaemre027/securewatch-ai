import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Tuple

import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.models.analysis_job import AnalysisJob, AnalysisJobStatus
from app.models.detection_result import DetectionResult
from app.services.storage_service import resolve_upload_file
from app.services.model_package_service import load_model_package
from app.services.inference_service import prepare_inference_data, run_inference

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AnalysisProcessingResult:
    """Immutable result structure for analysis job processing."""
    job_id: int
    records_processed: int
    final_status: str


def process_analysis_job(db: Session, job_id: int) -> AnalysisProcessingResult:
    """
    Synchronously process a PENDING AnalysisJob.

    Flow:
    1. Check state is PENDING.
    2. Set state to PROCESSING and commit.
    3. Resolve file, load model, read CSV, prepare data, run inference.
    4. Save all DetectionResult objects.
    5. Set state to COMPLETED and commit.
    If an error occurs, rollback and set state to FAILED.

    Args:
        db (Session): SQLAlchemy database session.
        job_id (int): The ID of the AnalysisJob to process.

    Returns:
        AnalysisProcessingResult: Immutable struct containing processing result.

    Raises:
        AppException: If job not found or state is invalid.
    """
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise AppException(404, "JOB_NOT_FOUND", "Analysis job not found.")

    # Atomic update to prevent race conditions
    updated_rows = db.query(AnalysisJob).filter(
        AnalysisJob.id == job_id,
        AnalysisJob.status == AnalysisJobStatus.PENDING
    ).update({"status": AnalysisJobStatus.PROCESSING})

    if updated_rows == 0:
        db.rollback()
        db.refresh(job)
        raise AppException(
            status_code=409,
            code="INVALID_JOB_STATE",
            message=f"Job cannot be started from state: {job.status.value}"
        )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to commit PROCESSING state: %s", str(e))
        raise AppException(500, "DB_ERROR", "Could not update job status to PROCESSING.")

    # Refresh to ensure job has the latest DB state
    db.refresh(job)

    settings = get_settings()

    try:
        # Resolve file path
        file_path = resolve_upload_file(job.file_hash, settings.upload_dir)

        # Load model package
        model_package = load_model_package()

        # Read CSV
        try:
            df = pd.read_csv(file_path)
        except pd.errors.EmptyDataError:
            raise AppException(422, "VALIDATION_ERROR", "The CSV file is empty.")
        except Exception as e:
            logger.error("Failed to read CSV: %s", str(e))
            raise AppException(422, "VALIDATION_ERROR", "Failed to parse the CSV file.")

        if df.empty:
            raise AppException(422, "VALIDATION_ERROR", "The CSV file contains no data rows.")

        # Inference pipeline
        prepared_df = prepare_inference_data(df)
        batch_result = run_inference(prepared_df, model_package)

        # Save results
        detection_results = []
        for pred in batch_result.predictions:
            det_res = DetectionResult(
                job_id=job.id,
                row_index=pred.row_index,
                attack_probability=pred.attack_probability,
                is_attack=pred.is_attack,
                risk_level=pred.risk_level
            )
            detection_results.append(det_res)

        db.add_all(detection_results)

        # Mark as completed
        job.status = AnalysisJobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        return AnalysisProcessingResult(
            job_id=job.id,
            records_processed=len(detection_results),
            final_status=AnalysisJobStatus.COMPLETED.value
        )

    except Exception as e:
        db.rollback()

        job.status = AnalysisJobStatus.FAILED
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = "An error occurred during file processing or analysis."

        try:
            db.commit()
        except Exception as inner_e:
            db.rollback()
            logger.error("Failed to save FAILED state: %s", str(inner_e))
            raise AppException(500, "DB_ERROR", "Failed to update job to FAILED state.")

        # Rethrow as safe domain error if it was one, else generic
        # Wait, the prompt says: "Başlangıçtaki kontrollü domain hatalarının anlamı korunmalı ancak veritabanına hassas ayrıntı yazılmamalı. FAILED durumunu kaydetmek de başarısız olursa kontrollü veritabanı hatası üret."
        # If we raise AppException here, we return it to the caller.
        if isinstance(e, AppException):
            raise e
        else:
            logger.error("Unexpected error during job processing: %s", str(e))
            raise AppException(500, "PROCESSING_ERROR", "An unexpected error occurred during analysis.")
