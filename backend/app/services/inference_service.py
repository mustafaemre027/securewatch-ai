"""Inference data preparation and prediction service."""
import logging
from dataclasses import dataclass
from typing import Tuple

import numpy as np
import pandas as pd

from app.core.exceptions import AppException
from app.services.csv_validation_service import (
    CICIDS2017_FEATURE_COLUMNS,
    CICIDS2017_OPTIONAL_LABEL,
)
from app.services.model_package_service import (
    INFERENCE_FEATURE_COLUMNS,
    ModelPackage,
)
from app.services.model_service import (
    classify_risk_level,
    extract_positive_probabilities,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InferenceRowResult:
    """Immutable result for a single row prediction."""
    row_index: int
    attack_probability: float
    is_attack: bool
    risk_level: str


@dataclass(frozen=True)
class InferenceBatchResult:
    """Immutable result for a batch of predictions."""
    predictions: Tuple[InferenceRowResult, ...]
    threshold: float
    model_name: str
    model_version: str
    total_records: int


def prepare_inference_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prepares a pandas DataFrame for inference.

    Rules:
    - DataFrame must not be empty.
    - Deep copy is used to prevent mutating the original DataFrame.
    - Column names are stripped of whitespace.
    - Empty and duplicate column names are rejected.
    - Must contain exactly the 78 canonical CIC-IDS2017 features (if Label is included, it is ignored).
    - Or if exactly 77 features (without Label), it is also accepted. Wait, prompt says:
      "Tam 78 CIC-IDS2017 özelliği zorunlu olmalı. Label sütunu opsiyonel olmalı... Fwd Header Length.1 şema kontrolünden sonra kaldırılmalı."
    - All features converted to numeric. +inf and -inf replaced with NaN.
    - Duplicate rows are NOT dropped.
    - Row order, indices, and counts are preserved.

    Args:
        df (pd.DataFrame): Raw DataFrame for inference.

    Returns:
        pd.DataFrame: Prepared DataFrame with exactly 77 features.

    Raises:
        AppException: On validation or schema errors.
    """
    if not isinstance(df, pd.DataFrame):
        raise AppException(422, "VALIDATION_ERROR", "Input must be a pandas DataFrame.")

    if df.empty:
        raise AppException(422, "VALIDATION_ERROR", "Input DataFrame cannot be empty.")

    # Defensive deep copy
    df_clean = df.copy(deep=True)

    # Strip column names
    df_clean.columns = df_clean.columns.astype(str).str.strip()

    if any(col == "" for col in df_clean.columns):
        raise AppException(422, "VALIDATION_ERROR", "DataFrame contains empty column names.")

    if df_clean.columns.duplicated().any():
        raise AppException(422, "VALIDATION_ERROR", "DataFrame contains duplicate column names.")

    actual_cols = set(df_clean.columns)
    expected_all = set(CICIDS2017_FEATURE_COLUMNS)

    # Label is optional, so it might or might not be there.
    # The prompt says: "Tam 78 CIC-IDS2017 özelliği zorunlu olmalı. Label sütunu opsiyonel olmalı".
    # This means 77 features are mandatory, Label is the 78th which is optional.
    expected_features = expected_all - {CICIDS2017_OPTIONAL_LABEL}

    actual_features = actual_cols - {CICIDS2017_OPTIONAL_LABEL}
    missing_cols = expected_features - actual_features
    extra_cols = actual_features - expected_features

    if missing_cols or extra_cols:
        raise AppException(
            status_code=422,
            code="SCHEMA_MISMATCH",
            message="DataFrame columns do not match the expected inference schema.",
            details={
                "missing_columns": sorted(list(missing_cols)),
                "extra_columns": sorted(list(extra_cols)),
            }
        )

    # Drop Label if it exists
    if CICIDS2017_OPTIONAL_LABEL in df_clean.columns:
        df_clean = df_clean.drop(columns=[CICIDS2017_OPTIONAL_LABEL])

    # Drop redundant column
    redundant_col = "Fwd Header Length.1"
    if redundant_col in df_clean.columns:
        df_clean = df_clean.drop(columns=[redundant_col])

    # Enforce exact canonical order for 77 features
    df_clean = df_clean[list(INFERENCE_FEATURE_COLUMNS)]

    # Convert to numeric, coercing errors to NaN
    df_clean = df_clean.apply(pd.to_numeric, errors='coerce')

    # Replace infinities with NaN
    df_clean = df_clean.replace([np.inf, -np.inf], np.nan)

    return df_clean


def run_inference(df: pd.DataFrame, model_package: ModelPackage) -> InferenceBatchResult:
    """
    Runs model inference on the prepared DataFrame.

    Args:
        df (pd.DataFrame): Prepared DataFrame (must have 77 features in canonical order).
        model_package (ModelPackage): The loaded model package.

    Returns:
        InferenceBatchResult: The batch prediction result containing immutable row predictions.

    Raises:
        AppException: If preprocessing or prediction fails.
    """
    if not isinstance(df, pd.DataFrame) or df.empty:
        raise AppException(422, "VALIDATION_ERROR", "Inference requires a non-empty DataFrame.")

    if len(df.columns) != 77 or tuple(df.columns) != INFERENCE_FEATURE_COLUMNS:
        raise AppException(500, "INFERENCE_ERROR", "DataFrame does not match canonical 77 features.")

    try:
        # ONLY transform, NEVER fit_transform
        X_transformed = model_package.preprocessor.transform(df)
    except Exception as e:
        logger.error("Preprocessor transform failed: %s", str(e))
        raise AppException(
            status_code=500,
            code="INFERENCE_ERROR",
            message="Data preprocessing failed during inference."
        )

    try:
        probabilities = extract_positive_probabilities(model_package.estimator, X_transformed)
    except AppException:
        raise
    except Exception as e:
        logger.error("Probability extraction failed: %s", str(e))
        raise AppException(
            status_code=500,
            code="INFERENCE_ERROR",
            message="Model prediction failed."
        )

    threshold = model_package.threshold
    results = []

    # We iterate over df.index to maintain original indices, though they might not be 0-indexed integers.
    # We will just use enumerate to give a positional row_index, or use the dataframe's index if it's integer?
    # The prompt says: "Satır sırası". Let's use positional row index (0 to N-1).
    for idx, prob in enumerate(probabilities):
        prob_val = float(prob)
        is_attack = bool(prob_val >= threshold)
        risk_level = str(classify_risk_level(prob_val))

        results.append(InferenceRowResult(
            row_index=idx,
            attack_probability=prob_val,
            is_attack=is_attack,
            risk_level=risk_level
        ))

    return InferenceBatchResult(
        predictions=tuple(results),
        threshold=float(threshold),
        model_name=str(model_package.metadata.model_name),
        model_version=str(model_package.metadata.version),
        total_records=len(results)
    )
