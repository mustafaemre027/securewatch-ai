"""Secure model package loader service."""
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Tuple

import joblib

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.services.csv_validation_service import CICIDS2017_FEATURE_COLUMNS
from app.services.preprocessing_service import REDUNDANT_COLUMN

logger = logging.getLogger(__name__)


# 77 feature names in canonical order (excluding the redundant column)
INFERENCE_FEATURE_COLUMNS: Tuple[str, ...] = tuple(
    col for col in CICIDS2017_FEATURE_COLUMNS if col != REDUNDANT_COLUMN
)


@dataclass(frozen=True)
class ModelMetadata:
    """Immutable metadata for the model package."""
    model_name: str
    version: str
    # Other metadata fields can be added here as needed, provided they are immutable.


@dataclass(frozen=True)
class ModelPackage:
    """Immutable container for the loaded model package.
    
    Note: `frozen=True` prevents reassignment of fields, but it does NOT deeply 
    make the `estimator` and `preprocessor` objects immutable. Callers should 
    treat them as read-only and avoid mutating their internal state.
    """
    estimator: Any
    preprocessor: Any
    feature_names: Tuple[str, ...]
    threshold: float
    metadata: ModelMetadata


def load_model_package(filename: str = "model.joblib") -> ModelPackage:
    """
    Securely load a model package from the server-controlled directory.

    Args:
        filename (str): Name of the model file. Must end with .joblib and contain no path separators.

    Returns:
        ModelPackage: The loaded, validated model package.

    Raises:
        AppException: If file is missing, invalid, or violates security/contract rules.
    """
    if not filename.endswith(".joblib"):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Only .joblib extensions are allowed for model packages."
        )

    if "/" in filename or "\\" in filename:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Path separators are not allowed in model filename."
        )

    settings = get_settings()
    model_path = settings.model_package_path / filename

    if not model_path.exists():
        raise AppException(
            status_code=404,
            code="MODEL_NOT_FOUND",
            message="The requested model package file could not be found."
        )
    if not model_path.is_file():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="The model package path is not a file."
        )

    try:
        loaded_data = joblib.load(model_path)
    except Exception as e:
        logger.error("Failed to load model package: %s", str(e))
        raise AppException(
            status_code=500,
            code="MODEL_LOAD_ERROR",
            message="The model package file is corrupted or could not be loaded."
        )

    if not isinstance(loaded_data, dict):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Model package must be a dictionary."
        )

    # Validate essential keys
    required_keys = {"estimator", "preprocessor", "feature_names", "threshold", "metadata"}
    missing_keys = required_keys - set(loaded_data.keys())
    if missing_keys:
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Model package is missing required keys."
        )

    estimator = loaded_data["estimator"]
    preprocessor = loaded_data["preprocessor"]
    feature_names = loaded_data["feature_names"]
    threshold = loaded_data["threshold"]
    raw_metadata = loaded_data["metadata"]

    # Validate estimator
    if not hasattr(estimator, "predict_proba") or not callable(getattr(estimator, "predict_proba", None)):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Estimator does not support predict_proba."
        )
    if not hasattr(estimator, "classes_"):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Estimator is not fitted or missing classes_."
        )
    
    classes_ = list(estimator.classes_)
    if len(classes_) != 2 or set(classes_) != {0, 1}:
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Estimator classes must be exactly binary 0 and 1."
        )

    # Validate preprocessor
    if not hasattr(preprocessor, "transformers_") and not hasattr(preprocessor, "sparse_output_"):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Preprocessor does not appear to be fitted."
        )
    if not hasattr(preprocessor, "transform") or not callable(getattr(preprocessor, "transform", None)):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Preprocessor does not support transform."
        )

    # Validate feature names
    if not isinstance(feature_names, (list, tuple)):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Feature names must be a sequence."
        )
    
    feature_names_tuple = tuple(feature_names)
    if len(feature_names_tuple) != 77:
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Model package feature names length must be exactly 77."
        )
    if feature_names_tuple != INFERENCE_FEATURE_COLUMNS:
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Model package feature names do not match the expected canonical order."
        )

    # Validate threshold
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Threshold must be a numeric value."
        )
    
    try:
        t_val = float(threshold)
    except Exception:
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Threshold must be a finite number."
        )
    
    import numpy as np
    if np.isnan(t_val) or np.isinf(t_val):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Threshold must be a finite number."
        )
    if not (0.0 <= t_val <= 1.0):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Threshold must be between 0.0 and 1.0."
        )

    # Validate metadata
    if not isinstance(raw_metadata, dict) and not isinstance(raw_metadata, ModelMetadata):
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Metadata must be a dictionary or ModelMetadata."
        )
    
    m_dict = raw_metadata if isinstance(raw_metadata, dict) else raw_metadata.__dict__
    model_name = m_dict.get("model_name")
    version = m_dict.get("version")

    if not model_name or not str(model_name).strip():
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Model name cannot be empty."
        )
    if not version or not str(version).strip():
        raise AppException(
            status_code=500,
            code="MODEL_CONTRACT_ERROR",
            message="Model version cannot be empty."
        )

    metadata_obj = ModelMetadata(
        model_name=str(model_name).strip(),
        version=str(version).strip()
    )

    return ModelPackage(
        estimator=estimator,
        preprocessor=preprocessor,
        feature_names=feature_names_tuple,
        threshold=t_val,
        metadata=metadata_obj
    )
