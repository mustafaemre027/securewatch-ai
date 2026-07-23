import logging
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Any
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

from app.core.exceptions import AppException
from app.services.preprocessing_service import SplitDataResult

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


@dataclass(frozen=True)
class ModelTrainingResult:
    """
    Immutable structure for storing model training and evaluation results.

    Note: The `estimator` object inside this frozen dataclass is a scikit-learn
    estimator and is intrinsically mutable. Deep immutability is not guaranteed
    for the estimator itself.
    """
    model_name: str
    estimator: Any
    predictions: tuple[int, ...]
    metrics: ClassificationMetrics


def train_dummy_classifier(split_data: SplitDataResult) -> ModelTrainingResult:
    """
    Trains and evaluates a baseline DummyClassifier.

    Args:
        split_data: The result of preprocessing, containing train/test splits.

    Returns:
        ModelTrainingResult: Results containing the trained estimator, predictions, and metrics.

    Raises:
        AppException: If input validation fails.
    """
    if not isinstance(split_data, SplitDataResult):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Input must be a SplitDataResult object."
        )

    X_train = split_data.X_train
    y_train = split_data.y_train
    X_test = split_data.X_test
    y_test = split_data.y_test

    if X_train.empty or y_train.empty or X_test.empty or y_test.empty:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Training and test features or targets cannot be empty."
        )

    if len(X_train) != len(y_train) or len(X_test) != len(y_test):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Row counts for features and targets must match within each split."
        )

    if X_train.shape[1] != X_test.shape[1]:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Feature counts for train and test splits must match."
        )

    y_train_unique = y_train.unique()
    y_test_unique = y_test.unique()

    if not np.isin(y_train_unique, [0, 1]).all() or not np.isin(y_test_unique, [0, 1]).all():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must contain only binary values 0 and 1."
        )

    if len(y_train_unique) < 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Training targets must contain both classes (0 and 1)."
        )

    if y_train.isna().any() or y_test.isna().any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets cannot contain NaN values."
        )

    # Defensive copy to avoid mutating source dataset
    X_train_clean = X_train.copy(deep=True)
    y_train_clean = y_train.copy(deep=True)
    X_test_clean = X_test.copy(deep=True)

    # Train dummy classifier
    dummy = DummyClassifier(strategy="most_frequent", random_state=42)
    dummy.fit(X_train_clean, y_train_clean)

    # Predict only on test set
    preds_arr = dummy.predict(X_test_clean)

    # Tuple conversion for immutability
    predictions_tuple = tuple(int(p) for p in preds_arr)

    # Evaluate metrics against y_test
    metrics = evaluate_binary_classification(y_test, preds_arr)

    return ModelTrainingResult(
        model_name="dummy_classifier",
        estimator=dummy,
        predictions=predictions_tuple,
        metrics=metrics
    )
