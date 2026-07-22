"""Secure CSV file storage service.

Handles staged upload, streaming SHA-256 hashing, size enforcement,
path traversal prevention, finalisation and cleanup of uploaded CSV files.
No database interaction occurs in this module.
"""
import hashlib
import logging
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

# Read chunk size: 64 KiB — small enough to avoid large memory spikes.
_CHUNK_SIZE: int = 64 * 1024


@dataclass(frozen=True)
class StagedUpload:
    """Immutable result of a successful staged file upload.

    Attributes:
        original_filename (str): Sanitised base-name of the original file.
        temporary_path (Path): Absolute path to the temporary staged file.
        file_size (int): Exact byte count of the uploaded content.
        file_hash (str): Lowercase 64-character SHA-256 hex digest of the file.
    """

    original_filename: str
    temporary_path: Path
    file_size: int
    file_hash: str


def _sanitise_filename(raw: Optional[str]) -> str:
    """Return only the base-name component of a user-supplied filename.

    Strips directory separators (both ``/`` and ``\\``) so that values such as
    ``../../evil.csv`` are reduced to ``evil.csv``.

    Args:
        raw (Optional[str]): The ``filename`` attribute from the UploadFile.

    Returns:
        str: Sanitised base-name string.

    Raises:
        AppException: 400 if the filename is absent or empty after sanitisation.
    """
    if not raw:
        raise AppException(
            status_code=400,
            code="INVALID_FILENAME",
            message="Uploaded file must have a non-empty filename.",
        )
    # Use posixpath split on both separator styles to extract only the base name.
    name = raw.replace("\\", "/")
    base = name.split("/")[-1].strip()
    if not base:
        raise AppException(
            status_code=400,
            code="INVALID_FILENAME",
            message="Uploaded file must have a valid, non-empty filename.",
        )
    return base


def _ensure_upload_dir(upload_dir: Path) -> None:
    """Create the upload directory hierarchy if it does not already exist.

    Args:
        upload_dir (Path): Target directory path.
    """
    upload_dir.mkdir(parents=True, exist_ok=True)


async def stage_upload(
    upload_file: UploadFile,
    upload_dir: Path,
    max_size_bytes: int,
) -> StagedUpload:
    """Stream an UploadFile to a temporary file while computing its SHA-256 hash.

    The file is written to a UUID-named ``.tmp`` file inside *upload_dir*.
    Reading stops immediately when *max_size_bytes* is exceeded and the
    temporary file is removed before raising.

    Args:
        upload_file (UploadFile): FastAPI upload file object from the request.
        upload_dir (Path): Absolute path to the staging/storage directory.
        max_size_bytes (int): Maximum accepted file size in bytes (inclusive).

    Returns:
        StagedUpload: Immutable result carrying filename, path, size and hash.

    Raises:
        AppException: 400 if filename is missing or empty.
        AppException: 413 if the upload exceeds *max_size_bytes*.
        AppException: 500 (re-raised as generic) if an I/O error occurs.
    """
    original_filename = _sanitise_filename(upload_file.filename)
    _ensure_upload_dir(upload_dir)

    tmp_name = f"{uuid.uuid4().hex}.tmp"
    tmp_path = upload_dir / tmp_name

    sha256 = hashlib.sha256()
    total_bytes = 0

    try:
        with tmp_path.open("wb") as fh:
            while True:
                chunk: bytes = await upload_file.read(_CHUNK_SIZE)
                if not chunk:
                    break

                total_bytes += len(chunk)

                if total_bytes > max_size_bytes:
                    # Discard immediately — do not leave partial file on disk.
                    fh.close()
                    _safe_delete(tmp_path)
                    raise AppException(
                        status_code=413,
                        code="FILE_TOO_LARGE",
                        message=(
                            f"Uploaded file exceeds the maximum allowed size of "
                            f"{max_size_bytes} bytes."
                        ),
                    )

                sha256.update(chunk)
                fh.write(chunk)

    except AppException:
        # Re-raise controlled errors without wrapping.
        raise
    except Exception as exc:
        _safe_delete(tmp_path)
        logger.exception("Unexpected I/O error while staging upload.")
        raise AppException(
            status_code=500,
            code="UPLOAD_IO_ERROR",
            message="An unexpected error occurred while processing the uploaded file.",
        ) from exc

    file_hash = sha256.hexdigest()

    logger.info(
        "File staged successfully: original=%s size=%d hash=%s tmp=%s",
        original_filename,
        total_bytes,
        file_hash,
        tmp_path.name,
    )

    return StagedUpload(
        original_filename=original_filename,
        temporary_path=tmp_path,
        file_size=total_bytes,
        file_hash=file_hash,
    )


def finalise_upload(staged: StagedUpload, upload_dir: Path) -> Path:
    """Promote a staged file to its permanent SHA-256-named location.

    The permanent filename is ``<sha256_hex>.csv`` inside *upload_dir*.  If a
    file with that name already exists the staged temporary file is cleaned up
    and an error is raised — the caller should handle duplicate detection at
    the database level before calling this function, but this provides a
    filesystem-level safety net.

    Args:
        staged (StagedUpload): Result returned by :func:`stage_upload`.
        upload_dir (Path): Same directory used during staging.

    Returns:
        Path: Absolute path to the promoted permanent file.

    Raises:
        AppException: 400 if a file with the same hash already exists on disk.
        AppException: 500 if the rename/move operation fails unexpectedly.
    """
    permanent_path = upload_dir / f"{staged.file_hash}.csv"

    if permanent_path.exists():
        _safe_delete(staged.temporary_path)
        raise AppException(
            status_code=400,
            code="DUPLICATE_FILE",
            message="A file with the same content has already been uploaded.",
        )

    try:
        staged.temporary_path.rename(permanent_path)
    except Exception as exc:
        _safe_delete(staged.temporary_path)
        logger.exception("Failed to promote staged file to permanent storage.")
        raise AppException(
            status_code=500,
            code="UPLOAD_FINALISE_ERROR",
            message="An unexpected error occurred while finalising the uploaded file.",
        ) from exc

    logger.info(
        "Upload finalised: hash=%s permanent=%s",
        staged.file_hash,
        permanent_path.name,
    )
    return permanent_path


def discard_staged(staged: StagedUpload) -> None:
    """Delete a staged temporary file that failed downstream validation.

    Safe to call even if the temporary file has already been removed — no
    secondary exception is raised in that case.

    Args:
        staged (StagedUpload): The staged upload whose temporary file should
            be discarded.
    """
    _safe_delete(staged.temporary_path)
    logger.info("Staged upload discarded: tmp=%s", staged.temporary_path.name)


def delete_finalised(file_hash: str, upload_dir: Path) -> None:
    """Safely delete a finalised CSV file by its SHA-256 hash.

    Used primarily for rollback cleanup if a database transaction fails after
    a file has been successfully finalised. It will only target files with the
    `.csv` extension located directly in `upload_dir`.

    Args:
        file_hash (str): The SHA-256 hash of the file.
        upload_dir (Path): The configured upload directory.
    """
    if not file_hash or len(file_hash) != 64:
        logger.warning("Invalid file hash provided for deletion: %s", file_hash)
        return

    permanent_path = upload_dir / f"{file_hash}.csv"

    # Ensure the path is actually within upload_dir (prevents traversal)
    if permanent_path.parent != upload_dir:
        logger.warning("Refused to delete file outside upload directory: %s", permanent_path)
        return

    _safe_delete(permanent_path)

    logger.info("Finalised file deleted during rollback: %s", permanent_path.name)


def _safe_delete(path: Path) -> None:
    """Remove a file silently, ignoring errors if it no longer exists.

    Args:
        path (Path): File path to remove.
    """
    try:
        path.unlink(missing_ok=True)
    except Exception:
        # Best-effort: log but do not propagate.
        logger.warning("Could not remove file during cleanup: %s", path.name)
