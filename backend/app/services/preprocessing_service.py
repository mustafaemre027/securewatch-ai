import logging
from dataclasses import dataclass
import numpy as np
import pandas as pd

from app.core.exceptions import AppException
from app.services.csv_validation_service import (
    CICIDS2017_FEATURE_COLUMNS,
    CICIDS2017_OPTIONAL_LABEL,
)

logger = logging.getLogger(__name__)

REDUNDANT_COLUMN = "Fwd Header Length.1"


@dataclass(frozen=True)
class TrainingDataResult:
    """Immutable result structure for prepared training data."""
    features: pd.DataFrame
    targets: pd.Series
    initial_row_count: int
    dropped_duplicate_count: int
    final_row_count: int


def prepare_training_data(df: pd.DataFrame) -> TrainingDataResult:
    """
    Prepares the CIC-IDS2017 dataset for model training.

    Args:
        df (pd.DataFrame): Raw DataFrame containing CIC-IDS2017 data.

    Returns:
        TrainingDataResult: Data structure with features, targets, and row counts.

    Raises:
        AppException: If schema validation fails or label column is invalid.
    """
    # 1. Work on a copy to avoid mutating the original DataFrame
    df_clean = df.copy()
    initial_row_count = len(df_clean)

    if df_clean.empty:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The provided DataFrame is empty."
        )

    # 2. Clean and validate column names
    df_clean.columns = df_clean.columns.str.strip()

    if any(col == "" for col in df_clean.columns):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="DataFrame contains empty column names."
        )

    if df_clean.columns.duplicated().any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="DataFrame contains duplicate column names."
        )

    # 3. Validate canonical schema presence (78 features + 1 label)
    expected_features = set(CICIDS2017_FEATURE_COLUMNS)
    actual_columns = set(df_clean.columns)

    if CICIDS2017_OPTIONAL_LABEL not in actual_columns:
        raise AppException(
            status_code=422,
            code="SCHEMA_MISMATCH",
            message="The 'Label' column is required for training data."
        )

    actual_features = actual_columns - {CICIDS2017_OPTIONAL_LABEL}
    missing_columns = expected_features - actual_features
    extra_columns = actual_features - expected_features

    if missing_columns or extra_columns:
        raise AppException(
            status_code=422,
            code="SCHEMA_MISMATCH",
            message="DataFrame columns do not match the canonical CIC-IDS2017 schema.",
            details={
                "missing_columns": sorted(list(missing_columns)),
                "extra_columns": sorted(list(extra_columns)),
            }
        )

    # 4. Validate Label column values
    if df_clean[CICIDS2017_OPTIONAL_LABEL].isna().any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The 'Label' column contains missing values."
        )

    labels_str = df_clean[CICIDS2017_OPTIONAL_LABEL].astype(str).str.strip()
    if (labels_str == "").any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The 'Label' column contains empty or whitespace-only values."
        )

    # 5. Remove exact duplicate rows
    df_clean = df_clean.drop_duplicates()
    final_row_count = len(df_clean)
    dropped_duplicate_count = initial_row_count - final_row_count

    # 6. Separate features and targets
    targets = df_clean[CICIDS2017_OPTIONAL_LABEL]
    features = df_clean.drop(columns=[CICIDS2017_OPTIONAL_LABEL])

    # 7. Remove redundant feature column (leaving 77 features)
    if REDUNDANT_COLUMN in features.columns:
        features = features.drop(columns=[REDUNDANT_COLUMN])

    # 8. Ensure deterministic column order
    ordered_cols = [col for col in CICIDS2017_FEATURE_COLUMNS if col != REDUNDANT_COLUMN]
    features = features[ordered_cols]

    # 9. Convert features to numeric, coercing errors to NaN
    features = features.apply(pd.to_numeric, errors='coerce')

    # 10. Replace positive and negative infinity with NaN
    features = features.replace([np.inf, -np.inf], np.nan)

    # 11. Final alignment of indices (safe check)
    features, targets = features.align(targets, join='inner', axis=0)

    logger.info(
        "Training data prepared: %d initial, %d duplicates dropped, %d final. Features: %d",
        initial_row_count, dropped_duplicate_count, final_row_count, features.shape[1]
    )

    return TrainingDataResult(
        features=features,
        targets=targets,
        initial_row_count=initial_row_count,
        dropped_duplicate_count=dropped_duplicate_count,
        final_row_count=final_row_count,
    )
