"""CIC-IDS2017 CSV metadata and schema validation service.

Validates file extension, MIME type, and CIC-IDS2017 column schema of a
staged CSV upload.  No database interaction, no file staging, and no
finalisation occur here.  The caller retains responsibility for cleaning up
the staged file on validation failure.
"""
import csv
import io
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import FrozenSet, Tuple

from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Canonical CIC-IDS2017 schema
# Source: docs/cicids2017-column-dictionary.md (79 rows: 78 features + Label)
# ---------------------------------------------------------------------------

CICIDS2017_FEATURE_COLUMNS: Tuple[str, ...] = (
    "Destination Port",
    "Flow Duration",
    "Total Fwd Packets",
    "Total Backward Packets",
    "Total Length of Fwd Packets",
    "Total Length of Bwd Packets",
    "Fwd Packet Length Max",
    "Fwd Packet Length Min",
    "Fwd Packet Length Mean",
    "Fwd Packet Length Std",
    "Bwd Packet Length Max",
    "Bwd Packet Length Min",
    "Bwd Packet Length Mean",
    "Bwd Packet Length Std",
    "Flow Bytes/s",
    "Flow Packets/s",
    "Flow IAT Mean",
    "Flow IAT Std",
    "Flow IAT Max",
    "Flow IAT Min",
    "Fwd IAT Total",
    "Fwd IAT Mean",
    "Fwd IAT Std",
    "Fwd IAT Max",
    "Fwd IAT Min",
    "Bwd IAT Total",
    "Bwd IAT Mean",
    "Bwd IAT Std",
    "Bwd IAT Max",
    "Bwd IAT Min",
    "Fwd PSH Flags",
    "Bwd PSH Flags",
    "Fwd URG Flags",
    "Bwd URG Flags",
    "Fwd Header Length",
    "Bwd Header Length",
    "Fwd Packets/s",
    "Bwd Packets/s",
    "Min Packet Length",
    "Max Packet Length",
    "Packet Length Mean",
    "Packet Length Std",
    "Packet Length Variance",
    "FIN Flag Count",
    "SYN Flag Count",
    "RST Flag Count",
    "PSH Flag Count",
    "ACK Flag Count",
    "URG Flag Count",
    "CWE Flag Count",
    "ECE Flag Count",
    "Down/Up Ratio",
    "Average Packet Size",
    "Avg Fwd Segment Size",
    "Avg Bwd Segment Size",
    "Fwd Header Length.1",
    "Fwd Avg Bytes/Bulk",
    "Fwd Avg Packets/Bulk",
    "Fwd Avg Bulk Rate",
    "Bwd Avg Bytes/Bulk",
    "Bwd Avg Packets/Bulk",
    "Bwd Avg Bulk Rate",
    "Subflow Fwd Packets",
    "Subflow Fwd Bytes",
    "Subflow Bwd Packets",
    "Subflow Bwd Bytes",
    "Init_Win_bytes_forward",
    "Init_Win_bytes_backward",
    "act_data_pkt_fwd",
    "min_seg_size_forward",
    "Active Mean",
    "Active Std",
    "Active Max",
    "Active Min",
    "Idle Mean",
    "Idle Std",
    "Idle Max",
    "Idle Min",
)

CICIDS2017_OPTIONAL_LABEL: str = "Label"

# Derived constants used during validation.
_REQUIRED_COLUMNS: FrozenSet[str] = frozenset(CICIDS2017_FEATURE_COLUMNS)
_ALLOWED_MIME_TYPES: FrozenSet[str] = frozenset({"text/csv"})

# Header read safety guard: never buffer more than 8 KiB from the file just
# to read a single CSV header line.
_MAX_HEADER_BYTES: int = 8 * 1024  # 8 KiB


# ---------------------------------------------------------------------------
# Validation result
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CsvValidationResult:
    """Immutable result produced by a successful CSV validation pass.

    Attributes:
        normalized_columns (Tuple[str, ...]): Column names after whitespace
            stripping, in the order they appear in the file.
        feature_count (int): Number of required CIC-IDS2017 feature columns
            found.  Always 78 for a passing validation.
        has_label (bool): True when the optional ``Label`` column is present.
    """

    normalized_columns: Tuple[str, ...]
    feature_count: int
    has_label: bool


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_csv_metadata(filename: str | None, content_type: str | None) -> None:
    """Validate the file extension and MIME type declared by the client.

    This is a lightweight pre-screening step executed *before* any file bytes
    are stored.  It does not open or read the file.

    Args:
        filename (str | None): The ``filename`` field from the UploadFile.
        content_type (str | None): The ``content_type`` field from the UploadFile.

    Raises:
        AppException: 422 VALIDATION_ERROR if the filename is absent, has no
            ``.csv`` extension (case-insensitive), or the MIME type is not
            ``text/csv``.
    """
    # ── Filename presence ─────────────────────────────────────────────────
    if not filename:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Uploaded file must have a filename.",
        )

    # ── Extension check (case-insensitive, guards against e.g. .csv.exe) ──
    # Use Path.suffix to get only the last extension component.
    suffix = Path(filename).suffix.lower()
    if suffix != ".csv":
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message=(
                "Only CSV files are accepted. "
                "The uploaded file does not have a valid .csv extension."
            ),
        )

    # ── MIME type check ───────────────────────────────────────────────────
    # Strip optional parameters such as "; charset=utf-8".
    raw_mime = (content_type or "").strip()
    base_mime = raw_mime.split(";")[0].strip().lower()
    if base_mime not in _ALLOWED_MIME_TYPES:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message=(
                "Only CSV files with MIME type 'text/csv' are accepted. "
                f"Received: '{base_mime}'."
            ),
        )


def validate_csv_schema(staged_path: Path) -> CsvValidationResult:
    """Read and validate the header of a staged CSV file against the CIC-IDS2017 schema.

    Only the first line of the file is read.  The file is never fully loaded
    into memory.  The staged file is not modified, moved, or deleted.

    Args:
        staged_path (Path): Absolute path to the staged temporary CSV file.

    Returns:
        CsvValidationResult: Immutable result with column metadata.

    Raises:
        AppException: 422 VALIDATION_ERROR for empty file, empty header,
            malformed CSV header, NUL characters, invalid UTF-8 encoding, or
            duplicate / empty column names after normalisation.
        AppException: 422 SCHEMA_MISMATCH when required columns are absent or
            unexpected columns are present (beyond the optional ``Label``).
    """
    # ── Read only the first MAX_HEADER_BYTES bytes ────────────────────────
    try:
        raw_bytes = _read_header_bytes(staged_path)
    except AppException:
        raise
    except Exception as exc:
        logger.exception("Unexpected I/O error while reading CSV header.")
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Could not read the uploaded file.",
        ) from exc

    if not raw_bytes:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The uploaded CSV file is empty.",
        )

    # ── NUL character guard ───────────────────────────────────────────────
    if b"\x00" in raw_bytes:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The uploaded file contains invalid NUL characters.",
        )

    # ── Decode: support UTF-8 BOM ─────────────────────────────────────────
    try:
        header_text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The uploaded file contains invalid UTF-8 characters.",
        )

    # ── Extract first line only ───────────────────────────────────────────
    first_line = header_text.splitlines()[0] if header_text.splitlines() else ""
    if not first_line.strip():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The CSV header row is empty.",
        )

    # ── Parse with csv module ─────────────────────────────────────────────
    try:
        reader = csv.reader(io.StringIO(first_line))
        raw_columns = next(reader)
    except (csv.Error, StopIteration) as exc:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The CSV header row is malformed and could not be parsed.",
        ) from exc

    # ── Normalise column names (strip whitespace only) ────────────────────
    normalized: list[str] = []
    for col in raw_columns:
        stripped = col.strip()
        if not stripped:
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="The CSV header contains one or more empty column names.",
            )
        normalized.append(stripped)

    # ── Duplicate column check ────────────────────────────────────────────
    seen: set[str] = set()
    for col in normalized:
        if col in seen:
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="The CSV header contains duplicate column names.",
            )
        seen.add(col)

    # ── Schema comparison ─────────────────────────────────────────────────
    normalized_set = frozenset(normalized)
    has_label = CICIDS2017_OPTIONAL_LABEL in normalized_set
    feature_columns_present = normalized_set - {CICIDS2017_OPTIONAL_LABEL}

    missing_columns = sorted(_REQUIRED_COLUMNS - feature_columns_present)
    extra_columns = sorted(feature_columns_present - _REQUIRED_COLUMNS)

    if missing_columns or extra_columns:
        raise AppException(
            status_code=422,
            code="SCHEMA_MISMATCH",
            message=(
                "The uploaded CSV file does not match the required CIC-IDS2017 schema. "
                f"{len(missing_columns)} required column(s) missing, "
                f"{len(extra_columns)} unexpected column(s) found."
            ),
            details={
                "missing_columns": missing_columns,
                "extra_columns": extra_columns,
            },
        )

    logger.info(
        "CSV schema validated: feature_count=%d has_label=%s",
        len(feature_columns_present),
        has_label,
    )

    return CsvValidationResult(
        normalized_columns=tuple(normalized),
        feature_count=len(feature_columns_present),
        has_label=has_label,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _read_header_bytes(path: Path) -> bytes:
    """Read up to _MAX_HEADER_BYTES bytes from the file at *path*.

    Reads only enough to safely parse the CSV header without buffering the
    entire file.

    Args:
        path (Path): File to read.

    Returns:
        bytes: Raw bytes from the beginning of the file (at most
            ``_MAX_HEADER_BYTES`` bytes).
    """
    with path.open("rb") as fh:
        return fh.read(_MAX_HEADER_BYTES)
