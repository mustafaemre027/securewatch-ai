import logging
import numpy as np
import pandas as pd
from dataclasses import dataclass
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

def encode_binary_labels(labels: pd.Series) -> pd.Series:
    """
    Encodes CIC-IDS2017 labels into binary classification targets.
    BENIGN -> 0, any attack -> 1.

    Args:
        labels: A pandas Series containing string labels.

    Returns:
        pd.Series: A new Series containing only integer 0 and 1 values,
                   with the same index and name as the input.

    Raises:
        AppException: If input validation fails.
    """
    if not isinstance(labels, pd.Series):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Input must be a pandas Series."
        )

    if labels.empty:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Input Series cannot be empty."
        )

    if labels.isna().any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Labels cannot contain NaN or None values."
        )

    if not all(isinstance(val, str) for val in labels):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="All label values must be strings."
        )

    # Operate on a deep copy to ensure original series is untouched
    processed = labels.copy(deep=True)

    # Clean whitespace and normalize case
    processed = processed.str.strip().str.upper()

    if (processed == "").any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Labels cannot contain empty or whitespace-only strings."
        )

    # BENIGN becomes 0, all other attacks become 1
    encoded = pd.Series(1, index=processed.index, name=processed.name, dtype=int)

    benign_mask = processed == "BENIGN"
    encoded.loc[benign_mask] = 0

    return encoded


@dataclass(frozen=True)
class ClassificationMetrics:
    """Immutable struct for binary classification evaluation results."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: tuple
    tn: int
    fp: int
    fn: int
    tp: int


def evaluate_binary_classification(y_true, y_pred) -> ClassificationMetrics:
    """
    Evaluates binary classification predictions.
    Positive class is 1, negative class is 0.

    Args:
        y_true: Array-like true labels.
        y_pred: Array-like predicted labels.

    Returns:
        ClassificationMetrics: Evaluation metrics and confusion matrix.

    Raises:
        AppException: If input validation fails.
    """
    try:
        y_true_arr = np.asarray(y_true)
        y_pred_arr = np.asarray(y_pred)
    except Exception:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs must be array-like."
        )

    if y_true_arr.size == 0 or y_pred_arr.size == 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot be empty."
        )

    if y_true_arr.shape != y_pred_arr.shape:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="y_true and y_pred must have the same length."
        )

    if y_true_arr.ndim != 1 or y_pred_arr.ndim != 1:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs must be 1-dimensional."
        )

    if y_true_arr.dtype.kind not in {'i', 'u', 'f'} or y_pred_arr.dtype.kind not in {'i', 'u', 'f'}:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot contain text or non-numeric values."
        )

    if np.isnan(y_true_arr).any() or np.isnan(y_pred_arr).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot contain NaN."
        )

    if np.isinf(y_true_arr).any() or np.isinf(y_pred_arr).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot contain infinite values."
        )

    if not np.isin(y_true_arr, [0, 1]).all() or not np.isin(y_pred_arr, [0, 1]).all():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs must contain only 0 and 1."
        )

    acc = float(accuracy_score(y_true_arr, y_pred_arr))
    prec = float(precision_score(y_true_arr, y_pred_arr, pos_label=1, zero_division=0))
    rec = float(recall_score(y_true_arr, y_pred_arr, pos_label=1, zero_division=0))
    f1 = float(f1_score(y_true_arr, y_pred_arr, pos_label=1, zero_division=0))

    cm = confusion_matrix(y_true_arr, y_pred_arr, labels=[0, 1])
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    cm_tuple = ((tn, fp), (fn, tp))

    return ClassificationMetrics(
        accuracy=acc,
        precision=prec,
        recall=rec,
        f1_score=f1,
        confusion_matrix=cm_tuple,
        tn=tn,
        fp=fp,
        fn=fn,
        tp=tp
    )
