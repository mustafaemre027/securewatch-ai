import logging
import time
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Any, Sequence
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
    average_precision_score,
    precision_recall_curve,
)

from app.core.exceptions import AppException
from app.services.preprocessing_service import (
    SplitDataResult,
    TrainingDataResult,
    build_sklearn_preprocessing_pipeline,
    prepare_training_data,
    split_and_transform_data,
)

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
class RocCurvePoint:
    """Immutable struct representing a point on the ROC curve."""
    false_positive_rate: float
    true_positive_rate: float
    threshold: float | None


@dataclass(frozen=True)
class PrecisionRecallCurvePoint:
    """Immutable struct representing a point on the Precision-Recall curve."""
    precision: float
    recall: float
    threshold: float | None


@dataclass(frozen=True)
class ProbabilityEvaluationMetrics:
    """Immutable struct for probability-based evaluation results."""
    roc_auc: float
    average_precision: float
    threshold: float
    classification_metrics: ClassificationMetrics
    false_positive_rate: float
    roc_curve: tuple[RocCurvePoint, ...]
    precision_recall_curve: tuple[PrecisionRecallCurvePoint, ...]


def extract_positive_probabilities(estimator: Any, X: Any) -> tuple[float, ...]:
    """
    Safely extracts positive class (1) probabilities from a trained estimator.

    Args:
        estimator: A trained classification model supporting predict_proba.
        X: Input features for prediction.

    Returns:
        tuple[float, ...]: Immutable tuple of positive class probabilities as native floats.

    Raises:
        AppException: If validation fails or estimator does not support probability extraction.
    """
    if estimator is None:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Estimator cannot be None."
        )

    if not hasattr(estimator, "predict_proba") or not callable(getattr(estimator, "predict_proba", None)):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Estimator does not support predict_proba."
        )

    if not hasattr(estimator, "classes_"):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Estimator does not have classes_ attribute."
        )

    try:
        classes_arr = np.asarray(estimator.classes_)
    except Exception:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Estimator classes_ attribute is invalid."
        )

    if classes_arr.ndim != 1 or len(classes_arr) != 2 or set(classes_arr) != {0, 1}:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Estimator classes_ must contain exactly binary classes 0 and 1."
        )

    if X is None:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Input features cannot be None."
        )

    try:
        if hasattr(X, "empty") and X.empty:
            raise AppException(status_code=422, code="VALIDATION_ERROR", message="Input features cannot be empty.")
        elif hasattr(X, "size") and X.size == 0:
            raise AppException(status_code=422, code="VALIDATION_ERROR", message="Input features cannot be empty.")
        elif len(X) == 0:
            raise AppException(status_code=422, code="VALIDATION_ERROR", message="Input features cannot be empty.")
    except TypeError:
        raise AppException(status_code=422, code="VALIDATION_ERROR", message="Invalid input features structure.")
    except AppException:
        raise

    try:
        proba = estimator.predict_proba(X)
    except AppException:
        raise
    except Exception:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Failed to predict probabilities with estimator."
        )

    try:
        proba_arr = np.asarray(proba)
    except Exception:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities cannot be converted to array."
        )

    if proba_arr.ndim != 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities must be a 2-dimensional array."
        )

    if proba_arr.shape[1] != 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities must contain exactly 2 class columns."
        )

    try:
        expected_len = len(X)
    except TypeError:
        expected_len = proba_arr.shape[0]

    if proba_arr.shape[0] != expected_len:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities row count does not match input features row count."
        )

    if proba_arr.shape[0] == 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities cannot be empty."
        )

    pos_idx = int(np.where(classes_arr == 1)[0][0])
    pos_probs = proba_arr[:, pos_idx]

    if np.isnan(pos_probs).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities cannot contain NaN."
        )

    if np.isinf(pos_probs).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities cannot contain infinite values."
        )

    if (pos_probs < 0.0).any() or (pos_probs > 1.0).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Predicted probabilities must be between 0.0 and 1.0 inclusive."
        )

    return tuple(float(val) for val in pos_probs)


def evaluate_probability_metrics(
    y_true: Any,
    probabilities: Any,
    threshold: float = 0.5,
) -> ProbabilityEvaluationMetrics:
    """
    Evaluates binary classification probability predictions and calculates advanced metrics.

    Args:
        y_true: Array-like true binary targets (0 and 1).
        probabilities: Array-like positive class probabilities.
        threshold: Decision threshold in [0.0, 1.0]. Rule: score >= threshold -> 1.

    Returns:
        ProbabilityEvaluationMetrics: Immutable evaluation metrics including ROC and PR curves.

    Raises:
        AppException: If validation fails.
    """
    try:
        thresh_val = float(threshold)
    except (TypeError, ValueError):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Threshold must be a numeric value."
        )

    if np.isnan(thresh_val) or np.isinf(thresh_val):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Threshold must be a finite number."
        )

    if thresh_val < 0.0 or thresh_val > 1.0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Threshold must be between 0.0 and 1.0 inclusive."
        )

    try:
        y_true_arr = np.asarray(y_true)
        probs_arr = np.asarray(probabilities)
    except Exception:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs must be array-like."
        )

    if y_true_arr.size == 0 or probs_arr.size == 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot be empty."
        )

    if y_true_arr.ndim != 1 or probs_arr.ndim != 1:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs must be 1-dimensional."
        )

    if y_true_arr.shape[0] != probs_arr.shape[0]:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="y_true and probabilities must have the same length."
        )

    if y_true_arr.dtype.kind not in {'i', 'u', 'f'} or probs_arr.dtype.kind not in {'i', 'u', 'f'}:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot contain text or non-numeric values."
        )

    if np.isnan(y_true_arr).any() or np.isnan(probs_arr).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot contain NaN."
        )

    if np.isinf(y_true_arr).any() or np.isinf(probs_arr).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Inputs cannot contain infinite values."
        )

    if not np.isin(y_true_arr, [0, 1]).all():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must contain only 0 and 1."
        )

    unique_classes = np.unique(y_true_arr)
    if len(unique_classes) < 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must contain both 0 and 1 classes to evaluate ROC-AUC."
        )

    if (probs_arr < 0.0).any() or (probs_arr > 1.0).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Probabilities must be between 0.0 and 1.0 inclusive."
        )

    y_pred_arr = (probs_arr >= thresh_val).astype(int)
    class_metrics = evaluate_binary_classification(y_true_arr, y_pred_arr)

    denom = class_metrics.fp + class_metrics.tn
    fpr_val = float(class_metrics.fp / denom) if denom > 0 else 0.0

    roc_auc_val = float(roc_auc_score(y_true_arr, probs_arr))

    fpr_array, tpr_array, roc_thresholds = roc_curve(y_true_arr, probs_arr)
    roc_points = []
    for i in range(len(fpr_array)):
        f_val = float(fpr_array[i])
        t_val = float(tpr_array[i])
        th_val = roc_thresholds[i]
        if i == 0 or np.isinf(th_val) or np.isnan(th_val) or th_val > 1.0:
            th_clean = None
        else:
            th_clean = float(th_val)
        roc_points.append(RocCurvePoint(false_positive_rate=f_val, true_positive_rate=t_val, threshold=th_clean))
    roc_curve_tuple = tuple(roc_points)

    ap_val = float(average_precision_score(y_true_arr, probs_arr))

    prec_array, rec_array, pr_thresholds = precision_recall_curve(y_true_arr, probs_arr)
    pr_points = []
    n_thresh = len(pr_thresholds)
    for i in range(len(prec_array)):
        p_val = float(prec_array[i])
        r_val = float(rec_array[i])
        if i < n_thresh:
            th_val = pr_thresholds[i]
            if np.isinf(th_val) or np.isnan(th_val):
                th_clean = None
            else:
                th_clean = float(th_val)
        else:
            th_clean = None
        pr_points.append(PrecisionRecallCurvePoint(precision=p_val, recall=r_val, threshold=th_clean))
    pr_curve_tuple = tuple(pr_points)

    return ProbabilityEvaluationMetrics(
        roc_auc=roc_auc_val,
        average_precision=ap_val,
        threshold=thresh_val,
        classification_metrics=class_metrics,
        false_positive_rate=fpr_val,
        roc_curve=roc_curve_tuple,
        precision_recall_curve=pr_curve_tuple,
    )


DEFAULT_THRESHOLD_CANDIDATES: tuple[float, ...] = tuple(round(0.10 + i * 0.05, 2) for i in range(17))


@dataclass(frozen=True)
class OutOfFoldProbabilityResult:
    """Out-of-fold olasılık üretimi sonuç yapısı (immutable)."""
    probabilities: tuple[float, ...]
    fold_ids: tuple[int, ...]
    n_splits: int
    random_state: int


@dataclass(frozen=True)
class ThresholdEvaluationResult:
    """Karar eşiği adayının değerlendirme sonucu (immutable)."""
    threshold: float
    metrics: ClassificationMetrics
    false_positive_rate: float


@dataclass(frozen=True)
class ThresholdSelectionResult:
    """Karar eşiği seçim politikası sonuç yapısı (immutable)."""
    evaluations: tuple[ThresholdEvaluationResult, ...]
    selected_threshold: float | None
    selected_metrics: ClassificationMetrics | None
    max_false_positive_rate: float
    constraint_satisfied: bool
    selection_reason: str


def generate_out_of_fold_probabilities(
    estimator: Any,
    X_train: Any,
    y_train: Any,
    n_splits: int = 5,
    random_state: int = 42,
) -> OutOfFoldProbabilityResult:
    """
    Eğitim verisi üzerinde Stratified K-Fold ile out-of-fold olasılık tahminleri üretir.
    Test verisine veya X_test/y_test'e asla erişmez.
    """
    if estimator is None:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Estimator cannot be None."
        )
    if not hasattr(estimator, "predict_proba") or not callable(getattr(estimator, "predict_proba", None)):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Estimator does not support predict_proba."
        )

    if not isinstance(n_splits, int) or isinstance(n_splits, bool) or n_splits < 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="n_splits must be an integer greater than or equal to 2."
        )

    if not isinstance(random_state, int) or isinstance(random_state, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="random_state must be an integer."
        )

    try:
        y_arr = np.asarray(y_train)
    except Exception:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must be array-like."
        )

    if y_arr.size == 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets cannot be empty."
        )

    if y_arr.ndim != 1:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must be 1-dimensional."
        )

    if y_arr.dtype.kind not in {'i', 'u', 'f', 'b'}:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets cannot contain text or non-numeric values."
        )

    if np.isnan(y_arr).any() or np.isinf(y_arr).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets cannot contain NaN or infinite values."
        )

    unique_classes = np.unique(y_arr)
    if not np.array_equal(unique_classes, [0, 1]):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must contain both 0 and 1 classes and no other values."
        )

    class_counts = pd.Series(y_arr).value_counts()
    if any(count < n_splits for count in class_counts):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Number of samples in each class cannot be less than n_splits."
        )

    try:
        if isinstance(X_train, pd.DataFrame):
            if X_train.empty:
                raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features cannot be empty.")
            if not all(dtype.kind in {'i', 'u', 'f', 'b'} for dtype in X_train.dtypes):
                raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features must be numeric.")
            X_check = X_train.to_numpy()
        elif isinstance(X_train, pd.Series):
            if X_train.empty:
                raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features cannot be empty.")
            if X_train.dtype.kind not in {'i', 'u', 'f', 'b'}:
                raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features must be numeric.")
            X_check = X_train.to_numpy().reshape(-1, 1)
        else:
            X_check = np.asarray(X_train)
            if X_check.size == 0:
                raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features cannot be empty.")
            if X_check.dtype.kind not in {'i', 'u', 'f', 'b'}:
                raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features must be numeric.")
    except AppException:
        raise
    except Exception:
        raise AppException(status_code=422, code="VALIDATION_ERROR", message="Invalid features input.")

    if X_check.ndim not in (1, 2):
        raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features must be 1D or 2D array.")

    if len(X_check) != len(y_arr):
        raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features and targets row counts must be equal.")

    if np.isnan(X_check).any() or np.isinf(X_check).any():
        raise AppException(status_code=422, code="VALIDATION_ERROR", message="Features must be finite and cannot contain NaN or inf.")

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    n_samples = len(y_arr)
    oof_probs = [0.0] * n_samples
    oof_fold_ids = [0] * n_samples

    try:
        for fold_id, (train_idx, val_idx) in enumerate(skf.split(X_check, y_arr)):
            fold_estimator = clone(estimator)

            if isinstance(X_train, (pd.DataFrame, pd.Series)):
                X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
            else:
                X_tr, X_val = X_check[train_idx], X_check[val_idx]

            if isinstance(y_train, pd.Series):
                y_tr = y_train.iloc[train_idx]
            else:
                y_tr = y_arr[train_idx]

            fold_estimator.fit(X_tr, y_tr)
            val_probs = extract_positive_probabilities(fold_estimator, X_val)

            for idx, prob in zip(val_idx, val_probs):
                oof_probs[int(idx)] = float(prob)
                oof_fold_ids[int(idx)] = int(fold_id)
    except AppException:
        raise
    except Exception as e:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message=f"Error during out-of-fold probability generation: {str(e)}"
        )

    return OutOfFoldProbabilityResult(
        probabilities=tuple(oof_probs),
        fold_ids=tuple(oof_fold_ids),
        n_splits=int(n_splits),
        random_state=int(random_state),
    )


def validate_threshold_candidates(thresholds: Any = None) -> tuple[float, ...]:
    """
    Karar eşiği adaylarını doğrular, tekrarsız ve kesin biçimde artan sırada olmasını kontrol eder.
    """
    if thresholds is None:
        return DEFAULT_THRESHOLD_CANDIDATES

    try:
        thresh_list = list(thresholds)
    except Exception:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Threshold candidates must be an iterable sequence."
        )

    if len(thresh_list) == 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Threshold candidates cannot be empty."
        )

    for t in thresh_list:
        if not isinstance(t, (int, float)) or isinstance(t, bool):
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="All threshold candidates must be numeric."
            )
        if np.isnan(t) or np.isinf(t):
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Threshold candidates must be finite."
            )
        if not (0.0 <= float(t) <= 1.0):
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Threshold candidates must be in [0, 1] range."
            )

    float_list = [float(t) for t in thresh_list]
    if len(set(float_list)) != len(float_list):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Threshold candidates cannot contain duplicate values."
        )
    if float_list != sorted(float_list):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Threshold candidates must be in strictly increasing order."
        )

    return tuple(float_list)


def select_decision_threshold(
    y_val: Any,
    val_probabilities: Any,
    thresholds: Any = None,
    max_false_positive_rate: float = 0.05,
    min_recall: float = 0.0,
) -> ThresholdSelectionResult:
    """
    Validation hedefleri ve olasılıkları üzerinden karar eşiğini seçer.
    Test verisine asla erişmez.
    """
    if not isinstance(min_recall, (int, float)) or isinstance(min_recall, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be numeric."
        )
    if np.isnan(min_recall) or np.isinf(min_recall):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be finite."
        )
    if not (0.0 <= float(min_recall) <= 1.0):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be in [0, 1] range."
        )

    if not isinstance(max_false_positive_rate, (int, float)) or isinstance(max_false_positive_rate, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be numeric."
        )
    if np.isnan(max_false_positive_rate) or np.isinf(max_false_positive_rate):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be finite."
        )
    if not (0.0 <= float(max_false_positive_rate) <= 1.0):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be in [0, 1] range."
        )

    valid_thresholds = validate_threshold_candidates(thresholds)

    evaluations: list[ThresholdEvaluationResult] = []
    for thresh in valid_thresholds:
        res = evaluate_probability_metrics(y_val, val_probabilities, threshold=thresh)
        eval_record = ThresholdEvaluationResult(
            threshold=float(thresh),
            metrics=res.classification_metrics,
            false_positive_rate=float(res.false_positive_rate),
        )
        evaluations.append(eval_record)

    feasible = [
        ev for ev in evaluations
        if ev.false_positive_rate <= float(max_false_positive_rate) and ev.metrics.recall >= float(min_recall)
    ]

    if len(feasible) > 0:
        best = max(
            feasible,
            key=lambda ev: (
                ev.metrics.recall,
                ev.metrics.f1_score,
                ev.metrics.precision,
                -ev.false_positive_rate,
                ev.threshold,
            ),
        )
        selected_threshold = best.threshold
        selected_metrics = best.metrics
        constraint_satisfied = True
        selection_reason = (
            f"Selected threshold {best.threshold:.2f} satisfying max FPR constraint "
            f"({best.false_positive_rate:.4f} <= {float(max_false_positive_rate):.4f}) "
            f"with recall {best.metrics.recall:.4f}, f1 {best.metrics.f1_score:.4f}, "
            f"precision {best.metrics.precision:.4f}."
        )
    else:
        selected_threshold = None
        selected_metrics = None
        constraint_satisfied = False
        selection_reason = (
            f"No threshold candidate satisfied the maximum false positive rate constraint "
            f"(max_false_positive_rate={float(max_false_positive_rate):.4f}, min_recall={float(min_recall):.4f})."
        )

    return ThresholdSelectionResult(
        evaluations=tuple(evaluations),
        selected_threshold=selected_threshold,
        selected_metrics=selected_metrics,
        max_false_positive_rate=float(max_false_positive_rate),
        constraint_satisfied=constraint_satisfied,
        selection_reason=selection_reason,
    )


@dataclass(frozen=True)
class ModelCandidateConfig:
    """Gün 10 kapsamındaki bir model adayının yapılandırma kaydı (immutable)."""
    variant_name: str
    model_name: str
    hyperparameters: tuple[tuple[str, Any], ...]
    estimator: Any


@dataclass(frozen=True)
class ModelEvaluationCandidateResult:
    """Gün 10 kapsamındaki bir model adayının validation ve test değerlendirme sonucu (immutable)."""
    model_name: str
    variant_name: str
    hyperparameters: tuple[tuple[str, Any], ...]
    validation_roc_auc: float
    validation_average_precision: float
    threshold_selection: ThresholdSelectionResult
    validation_recall: float | None
    validation_precision: float | None
    validation_f1_score: float | None
    validation_false_positive_rate: float | None
    selected_threshold: float | None
    test_roc_auc: float
    test_average_precision: float
    test_accuracy: float | None
    test_precision: float | None
    test_recall: float | None
    test_f1_score: float | None
    test_false_positive_rate: float | None
    test_confusion_matrix: tuple[tuple[int, ...], ...] | None
    training_duration_seconds: float
    is_eligible: bool
    ineligibility_reason: str | None


@dataclass(frozen=True)
class FinalModelSelectionResult:
    """Gün 10 kapsamındaki deterministik nihai model seçim politikası sonucu (immutable)."""
    candidates: tuple[ModelEvaluationCandidateResult, ...]
    selected_model_name: str | None
    selected_variant_name: str | None
    selected_threshold: float | None
    min_recall: float
    max_false_positive_rate: float
    is_selected: bool
    selection_reason: str


EXPECTED_DAY10_VARIANTS: tuple[str, ...] = (
    "lr_baseline",
    "rf_baseline",
    "rf_deeper",
    "rf_unweighted",
    "rf_compact",
)


def get_day10_model_candidates() -> tuple[ModelCandidateConfig, ...]:
    """Gün 10 kapsamındaki kesin ve deterministik beş model adayını sabit sırada döndürür."""
    lr_base = LogisticRegression(class_weight="balanced", max_iter=1000, solver="lbfgs", random_state=42)
    rf_base = RandomForestClassifier(n_estimators=100, max_depth=10, min_samples_split=2, min_samples_leaf=1, class_weight="balanced", random_state=42, n_jobs=-1)
    rf_deep = RandomForestClassifier(n_estimators=100, max_depth=20, min_samples_split=2, min_samples_leaf=1, class_weight="balanced", random_state=42, n_jobs=-1)
    rf_unw = RandomForestClassifier(n_estimators=100, max_depth=10, min_samples_split=2, min_samples_leaf=1, class_weight=None, random_state=42, n_jobs=-1)
    rf_comp = RandomForestClassifier(n_estimators=50, max_depth=5, min_samples_split=2, min_samples_leaf=1, class_weight="balanced", random_state=42, n_jobs=-1)

    return (
        ModelCandidateConfig(
            variant_name="lr_baseline",
            model_name="LogisticRegression",
            hyperparameters=(
                ("class_weight", "balanced"),
                ("max_iter", 1000),
                ("random_state", 42),
                ("solver", "lbfgs"),
            ),
            estimator=lr_base,
        ),
        ModelCandidateConfig(
            variant_name="rf_baseline",
            model_name="RandomForestClassifier",
            hyperparameters=(
                ("class_weight", "balanced"),
                ("max_depth", 10),
                ("min_samples_leaf", 1),
                ("min_samples_split", 2),
                ("n_estimators", 100),
                ("n_jobs", -1),
                ("random_state", 42),
            ),
            estimator=rf_base,
        ),
        ModelCandidateConfig(
            variant_name="rf_deeper",
            model_name="RandomForestClassifier",
            hyperparameters=(
                ("class_weight", "balanced"),
                ("max_depth", 20),
                ("min_samples_leaf", 1),
                ("min_samples_split", 2),
                ("n_estimators", 100),
                ("n_jobs", -1),
                ("random_state", 42),
            ),
            estimator=rf_deep,
        ),
        ModelCandidateConfig(
            variant_name="rf_unweighted",
            model_name="RandomForestClassifier",
            hyperparameters=(
                ("class_weight", None),
                ("max_depth", 10),
                ("min_samples_leaf", 1),
                ("min_samples_split", 2),
                ("n_estimators", 100),
                ("n_jobs", -1),
                ("random_state", 42),
            ),
            estimator=rf_unw,
        ),
        ModelCandidateConfig(
            variant_name="rf_compact",
            model_name="RandomForestClassifier",
            hyperparameters=(
                ("class_weight", "balanced"),
                ("max_depth", 5),
                ("min_samples_leaf", 1),
                ("min_samples_split", 2),
                ("n_estimators", 50),
                ("n_jobs", -1),
                ("random_state", 42),
            ),
            estimator=rf_comp,
        ),
    )


def validate_model_candidates(candidates: Sequence[Any]) -> tuple[Any, ...]:
    """Model adayları listesinin Gün 10 sözleşmesiyle tam uyumunu doğrular."""
    if not isinstance(candidates, (list, tuple)):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Candidates must be a list or tuple."
        )
    if len(candidates) != 5:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Must provide exactly 5 candidate models."
        )
    variant_names: list[str] = []
    for c in candidates:
        if not hasattr(c, "variant_name"):
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Candidate missing variant_name attribute."
            )
        v_name = getattr(c, "variant_name")
        if v_name in variant_names:
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message=f"Duplicate variant name found: '{v_name}'."
            )
        variant_names.append(str(v_name))

        if hasattr(c, "model_name") and "dummy" in str(getattr(c, "model_name")).lower():
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="DummyClassifier cannot be included as a final model candidate."
            )
        if hasattr(c, "estimator") and isinstance(getattr(c, "estimator"), DummyClassifier):
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="DummyClassifier cannot be included as a final model candidate."
            )

    if tuple(variant_names) != EXPECTED_DAY10_VARIANTS:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message=f"Candidates must match the exact 5 Day 10 variants in fixed order: {EXPECTED_DAY10_VARIANTS}."
        )
    return tuple(candidates)


def _validate_evaluation_data(X_train: Any, y_train: Any, X_test: Any, y_test: Any) -> tuple[Any, Any, Any, Any]:
    if X_train is None or y_train is None or X_test is None or y_test is None:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Training and test datasets cannot be None."
        )
    try:
        X_tr = np.asarray(X_train, dtype=float)
        y_tr = np.asarray(y_train, dtype=float)
        X_te = np.asarray(X_test, dtype=float)
        y_te = np.asarray(y_test, dtype=float)
    except (ValueError, TypeError):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Datasets must be numeric array-like structures."
        )
    if X_tr.size == 0 or y_tr.size == 0 or X_te.size == 0 or y_te.size == 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Training and test datasets cannot be empty."
        )
    if X_tr.ndim != 2 or X_te.ndim != 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Features must be 2-dimensional."
        )
    if y_tr.ndim != 1 or y_te.ndim != 1:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must be 1-dimensional."
        )
    if len(X_tr) != len(y_tr) or len(X_te) != len(y_te):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Row counts for features and targets must match."
        )
    if X_tr.shape[1] != X_te.shape[1]:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Feature counts for train and test splits must match."
        )
    if np.isnan(X_tr).any() or np.isnan(X_te).any() or np.isnan(y_tr).any() or np.isnan(y_te).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Datasets cannot contain NaN values."
        )
    if np.isinf(X_tr).any() or np.isinf(X_te).any() or np.isinf(y_tr).any() or np.isinf(y_te).any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Datasets cannot contain infinite values."
        )
    if not np.isin(y_tr, [0, 1]).all() or not np.isin(y_te, [0, 1]).all():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must contain only binary values 0 and 1."
        )
    if len(np.unique(y_tr)) < 2 or len(np.unique(y_te)) < 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Targets must contain both classes (0 and 1)."
        )
    return X_train, y_train, X_test, y_test


def evaluate_model_candidates(
    X_train: Any,
    y_train: Any,
    X_test: Any,
    y_test: Any,
    candidates: Sequence[ModelCandidateConfig] | None = None,
    n_splits: int = 5,
    random_state: int = 42,
    min_recall: float = 0.95,
    max_false_positive_rate: float = 0.05,
) -> tuple[ModelEvaluationCandidateResult, ...]:
    """
    Beş model adayını validation (OOF) ve test metrikleriyle değerlendiren servis fonksiyonu.
    Karar eşiği yalnızca validation verisi üzerinde seçilir; test verisine asla bakılmaz.
    """
    if not isinstance(min_recall, (int, float)) or isinstance(min_recall, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be numeric."
        )
    if np.isnan(min_recall) or np.isinf(min_recall):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be finite."
        )
    if not (0.0 <= float(min_recall) <= 1.0):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be in [0, 1] range."
        )

    if not isinstance(max_false_positive_rate, (int, float)) or isinstance(max_false_positive_rate, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be numeric."
        )
    if np.isnan(max_false_positive_rate) or np.isinf(max_false_positive_rate):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be finite."
        )
    if not (0.0 <= float(max_false_positive_rate) <= 1.0):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be in [0, 1] range."
        )

    X_tr, y_tr, X_te, y_te = _validate_evaluation_data(X_train, y_train, X_test, y_test)

    if candidates is None:
        cand_list = get_day10_model_candidates()
    else:
        cand_list = validate_model_candidates(candidates)

    results: list[ModelEvaluationCandidateResult] = []
    for cand in cand_list:
        oof_res = generate_out_of_fold_probabilities(
            estimator=cand.estimator,
            X_train=X_tr,
            y_train=y_tr,
            n_splits=n_splits,
            random_state=random_state,
        )

        thresh_res = select_decision_threshold(
            y_val=y_tr,
            val_probabilities=oof_res.probabilities,
            max_false_positive_rate=max_false_positive_rate,
            min_recall=min_recall,
        )

        val_eval_05 = evaluate_probability_metrics(y_tr, oof_res.probabilities, threshold=0.5)
        val_roc_auc = float(val_eval_05.roc_auc)
        val_ap = float(val_eval_05.average_precision)

        if thresh_res.selected_threshold is not None:
            val_eval_sel = evaluate_probability_metrics(y_tr, oof_res.probabilities, threshold=thresh_res.selected_threshold)
            val_recall: float | None = float(val_eval_sel.classification_metrics.recall)
            val_precision: float | None = float(val_eval_sel.classification_metrics.precision)
            val_f1_score: float | None = float(val_eval_sel.classification_metrics.f1_score)
            val_fpr: float | None = float(val_eval_sel.false_positive_rate)
            selected_thresh: float | None = float(thresh_res.selected_threshold)
            is_eligible = True
            ineligibility_reason = None
        else:
            val_recall = None
            val_precision = None
            val_f1_score = None
            val_fpr = None
            selected_thresh = None
            is_eligible = False
            ineligibility_reason = thresh_res.selection_reason

        if is_eligible:
            if any(v is None or np.isnan(v) or np.isinf(v) for v in (val_roc_auc, val_ap, val_recall, val_precision, val_f1_score, val_fpr)):
                is_eligible = False
                ineligibility_reason = "Validation metrics contain NaN or infinite values."
            elif not (val_recall >= float(min_recall) and val_fpr <= float(max_false_positive_rate)):
                is_eligible = False
                ineligibility_reason = f"Validation metrics failed constraints (Recall={val_recall:.4f} >= {float(min_recall):.4f}, FPR={val_fpr:.4f} <= {float(max_false_positive_rate):.4f})."

        model_instance = clone(cand.estimator)
        t0 = time.perf_counter()
        model_instance.fit(X_tr, y_tr)
        t1 = time.perf_counter()
        duration_sec = float(t1 - t0)

        test_probs = extract_positive_probabilities(model_instance, X_te)
        test_eval_05 = evaluate_probability_metrics(y_te, test_probs, threshold=0.5)
        test_roc_auc = float(test_eval_05.roc_auc)
        test_ap = float(test_eval_05.average_precision)

        if selected_thresh is not None:
            test_eval_sel = evaluate_probability_metrics(y_te, test_probs, threshold=selected_thresh)
            test_acc: float | None = float(test_eval_sel.classification_metrics.accuracy)
            test_prec: float | None = float(test_eval_sel.classification_metrics.precision)
            test_rec: float | None = float(test_eval_sel.classification_metrics.recall)
            test_f1: float | None = float(test_eval_sel.classification_metrics.f1_score)
            test_fpr: float | None = float(test_eval_sel.false_positive_rate)
            test_cm: tuple[tuple[int, ...], ...] | None = test_eval_sel.classification_metrics.confusion_matrix
        else:
            test_acc = None
            test_prec = None
            test_rec = None
            test_f1 = None
            test_fpr = None
            test_cm = None

        res_record = ModelEvaluationCandidateResult(
            model_name=str(cand.model_name),
            variant_name=str(cand.variant_name),
            hyperparameters=tuple(cand.hyperparameters),
            validation_roc_auc=val_roc_auc,
            validation_average_precision=val_ap,
            threshold_selection=thresh_res,
            validation_recall=val_recall,
            validation_precision=val_precision,
            validation_f1_score=val_f1_score,
            validation_false_positive_rate=val_fpr,
            selected_threshold=selected_thresh,
            test_roc_auc=test_roc_auc,
            test_average_precision=test_ap,
            test_accuracy=test_acc,
            test_precision=test_prec,
            test_recall=test_rec,
            test_f1_score=test_f1,
            test_false_positive_rate=test_fpr,
            test_confusion_matrix=test_cm,
            training_duration_seconds=duration_sec,
            is_eligible=is_eligible,
            ineligibility_reason=ineligibility_reason,
        )
        results.append(res_record)

    return tuple(results)


def select_final_model(
    candidate_results: Sequence[ModelEvaluationCandidateResult],
    min_recall: float = 0.95,
    max_false_positive_rate: float = 0.05,
) -> FinalModelSelectionResult:
    """
    Yalnızca validation sonuçlarından uygun adayları belirleyip deterministik nihai seçimi yapan fonksiyon.
    Test metriklerine veya test verisine asla bakılmaz.
    """
    if not isinstance(min_recall, (int, float)) or isinstance(min_recall, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be numeric."
        )
    if np.isnan(min_recall) or np.isinf(min_recall):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be finite."
        )
    if not (0.0 <= float(min_recall) <= 1.0):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_recall must be in [0, 1] range."
        )

    if not isinstance(max_false_positive_rate, (int, float)) or isinstance(max_false_positive_rate, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be numeric."
        )
    if np.isnan(max_false_positive_rate) or np.isinf(max_false_positive_rate):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be finite."
        )
    if not (0.0 <= float(max_false_positive_rate) <= 1.0):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_false_positive_rate must be in [0, 1] range."
        )

    if not isinstance(candidate_results, (list, tuple)):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="candidate_results must be a list or tuple."
        )
    if len(candidate_results) != 5:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Must provide exactly 5 candidate evaluation results."
        )

    variant_names: list[str] = []
    for c in candidate_results:
        if not isinstance(c, ModelEvaluationCandidateResult):
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="All elements must be ModelEvaluationCandidateResult objects."
            )
        if c.variant_name in variant_names:
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message=f"Duplicate variant name in results: '{c.variant_name}'."
            )
        variant_names.append(c.variant_name)

    if tuple(variant_names) != EXPECTED_DAY10_VARIANTS:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message=f"Candidate results must match the exact 5 Day 10 variants in fixed order: {EXPECTED_DAY10_VARIANTS}."
        )

    eligible = [
        c for c in candidate_results
        if c.is_eligible
        and c.validation_recall is not None and c.validation_recall >= float(min_recall)
        and c.validation_false_positive_rate is not None and c.validation_false_positive_rate <= float(max_false_positive_rate)
    ]

    if len(eligible) > 0:
        best = min(
            eligible,
            key=lambda c: (
                -float(c.validation_recall if c.validation_recall is not None else -1.0),
                float(c.validation_false_positive_rate if c.validation_false_positive_rate is not None else 2.0),
                -float(c.validation_f1_score if c.validation_f1_score is not None else -1.0),
                -float(c.validation_average_precision),
                float(c.training_duration_seconds),
                str(c.variant_name),
            ),
        )
        selected_model = str(best.model_name)
        selected_variant = str(best.variant_name)
        selected_thresh: float | None = float(best.selected_threshold) if best.selected_threshold is not None else None
        is_sel = True
        reason = (
            f"Selected candidate '{best.variant_name}' ({best.model_name}) satisfying validation constraints "
            f"(Recall={best.validation_recall:.4f} >= {float(min_recall):.4f}, "
            f"FPR={best.validation_false_positive_rate:.4f} <= {float(max_false_positive_rate):.4f}) "
            f"via deterministic tie-break rules."
        )
    else:
        selected_model = None
        selected_variant = None
        selected_thresh = None
        is_sel = False
        reason = (
            f"No candidate model satisfied the validation constraints "
            f"(min_recall={float(min_recall):.4f}, max_false_positive_rate={float(max_false_positive_rate):.4f})."
        )

    return FinalModelSelectionResult(
        candidates=tuple(candidate_results),
        selected_model_name=selected_model,
        selected_variant_name=selected_variant,
        selected_threshold=selected_thresh,
        min_recall=float(min_recall),
        max_false_positive_rate=float(max_false_positive_rate),
        is_selected=is_sel,
        selection_reason=reason,
    )


def run_final_model_selection(
    X_train: Any,
    y_train: Any,
    X_test: Any,
    y_test: Any,
    candidates: Sequence[ModelCandidateConfig] | None = None,
    n_splits: int = 5,
    random_state: int = 42,
    min_recall: float = 0.95,
    max_false_positive_rate: float = 0.05,
) -> FinalModelSelectionResult:
    """
    Değerlendirme ve nihai model seçimi aşamalarını bir araya getiren üst seviye servis fonksiyonu.
    """
    evaluated = evaluate_model_candidates(
        X_train=X_train,
        y_train=y_train,
        X_test=X_test,
        y_test=y_test,
        candidates=candidates,
        n_splits=n_splits,
        random_state=random_state,
        min_recall=min_recall,
        max_false_positive_rate=max_false_positive_rate,
    )
    return select_final_model(
        candidate_results=evaluated,
        min_recall=min_recall,
        max_false_positive_rate=max_false_positive_rate,
    )


@dataclass(frozen=True)
class FeatureImportanceRecord:
    feature_name: str
    importance: float


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
    training_duration_seconds: float | None = None
    feature_importances: tuple[FeatureImportanceRecord, ...] | None = None


def _validate_training_data(split_data: SplitDataResult):
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


def _validate_class_weight(class_weight: Any):
    if class_weight is None or class_weight == "balanced":
        return

    if isinstance(class_weight, dict):
        if set(class_weight.keys()) != {0, 1}:
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="class_weight dictionary must have exactly keys 0 and 1."
            )
        for k, v in class_weight.items():
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                raise AppException(
                    status_code=422,
                    code="VALIDATION_ERROR",
                    message="class_weight values must be numeric."
                )
            if pd.isna(v) or np.isinf(v):
                raise AppException(
                    status_code=422,
                    code="VALIDATION_ERROR",
                    message="class_weight values must be finite numbers."
                )
            if v <= 0:
                raise AppException(
                    status_code=422,
                    code="VALIDATION_ERROR",
                    message="class_weight values must be positive."
                )
        return

    raise AppException(
        status_code=422,
        code="VALIDATION_ERROR",
        message="class_weight must be 'balanced', None, or a dictionary with keys 0 and 1."
    )


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
    _validate_training_data(split_data)

    X_train = split_data.X_train
    y_train = split_data.y_train
    X_test = split_data.X_test
    y_test = split_data.y_test

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


def train_logistic_regression(
    split_data: SplitDataResult,
    class_weight: Any = "balanced"
) -> ModelTrainingResult:
    """
    Trains and evaluates a LogisticRegression baseline model.
    """
    _validate_training_data(split_data)
    _validate_class_weight(class_weight)

    try:
        X_train_np = split_data.X_train.to_numpy()
        X_test_np = split_data.X_test.to_numpy()

        if X_train_np.dtype.kind not in {'i', 'f', 'u'} or X_test_np.dtype.kind not in {'i', 'f', 'u'}:
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Features must be numeric."
            )

        if np.isnan(X_train_np).any() or np.isnan(X_test_np).any():
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Features cannot contain NaN."
            )

        if np.isinf(X_train_np).any() or np.isinf(X_test_np).any():
            raise AppException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Features cannot contain infinite values."
            )
    except Exception as e:
        if isinstance(e, AppException):
            raise
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Features validation failed."
        )

    X_train_clean = split_data.X_train.copy(deep=True)
    y_train_clean = split_data.y_train.copy(deep=True)
    X_test_clean = split_data.X_test.copy(deep=True)

    model = LogisticRegression(
        class_weight=class_weight,
        max_iter=1000,
        solver="lbfgs",
        random_state=42
    )

    t0 = time.perf_counter()

    model.fit(X_train_clean, y_train_clean)
    t1 = time.perf_counter()
    training_duration_seconds = float(t1 - t0)

    preds_arr = model.predict(X_test_clean)
    predictions_tuple = tuple(int(p) for p in preds_arr)

    metrics = evaluate_binary_classification(split_data.y_test, preds_arr)

    return ModelTrainingResult(
        model_name="logistic_regression",
        estimator=model,
        predictions=predictions_tuple,
        metrics=metrics,
        training_duration_seconds=training_duration_seconds
    )


def train_random_forest(
    split_data: SplitDataResult,
    n_estimators: int = 100,
    max_depth: int | None = 10,
    min_samples_split: int = 2,
    min_samples_leaf: int = 1,
    class_weight: Any = "balanced",
    random_state: int = 42,
    n_jobs: int = -1,
) -> ModelTrainingResult:
    """
    Trains and evaluates a RandomForestClassifier model.
    """
    _validate_training_data(split_data)
    _validate_class_weight(class_weight)

    if not isinstance(n_estimators, int) or isinstance(n_estimators, bool) or n_estimators <= 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="n_estimators must be a positive integer."
        )

    if max_depth is None:
        pass
    elif not isinstance(max_depth, int) or isinstance(max_depth, bool) or max_depth <= 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="max_depth must be None or a positive integer."
        )

    if not isinstance(min_samples_split, int) or isinstance(min_samples_split, bool) or min_samples_split < 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_samples_split must be an integer >= 2."
        )

    if not isinstance(min_samples_leaf, int) or isinstance(min_samples_leaf, bool) or min_samples_leaf < 1:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="min_samples_leaf must be an integer >= 1."
        )

    if not isinstance(random_state, int) or isinstance(random_state, bool):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="random_state must be an integer."
        )

    if not isinstance(n_jobs, int) or isinstance(n_jobs, bool) or n_jobs == 0:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="n_jobs must be a non-zero integer."
        )

    X_train_clean = split_data.X_train.copy(deep=True)
    y_train_clean = split_data.y_train.copy(deep=True)
    X_test_clean = split_data.X_test.copy(deep=True)

    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_split=min_samples_split,
        min_samples_leaf=min_samples_leaf,
        class_weight=class_weight,
        random_state=random_state,
        n_jobs=n_jobs,
    )

    t0 = time.perf_counter()
    model.fit(X_train_clean, y_train_clean)
    t1 = time.perf_counter()

    training_duration_seconds = float(t1 - t0)

    preds_arr = model.predict(X_test_clean)
    predictions_tuple = tuple(int(p) for p in preds_arr)

    metrics = evaluate_binary_classification(split_data.y_test, preds_arr)

    feature_names = X_train_clean.columns.tolist()
    importances = [float(v) for v in model.feature_importances_]

    feature_records = [
        FeatureImportanceRecord(feature_name=str(name), importance=val)
        for name, val in zip(feature_names, importances)
    ]
    # Sort descending by importance, then alphabetically by name for determinism
    feature_records.sort(key=lambda x: (-x.importance, x.feature_name))

    return ModelTrainingResult(
        model_name="random_forest",
        estimator=model,
        predictions=predictions_tuple,
        metrics=metrics,
        training_duration_seconds=training_duration_seconds,
        feature_importances=tuple(feature_records)
    )


@dataclass(frozen=True)
class RandomForestExperimentConfig:
    experiment_name: str
    n_estimators: int
    max_depth: int | None
    min_samples_split: int
    min_samples_leaf: int
    class_weight: Any
    random_state: int
    n_jobs: int


@dataclass(frozen=True)
class RandomForestExperimentResult:
    config: RandomForestExperimentConfig
    training_result: ModelTrainingResult


def run_random_forest_experiments(split_data: SplitDataResult) -> tuple[RandomForestExperimentResult, ...]:
    """
    Runs four predefined Random Forest experiments.
    """
    configs = [
        RandomForestExperimentConfig(
            experiment_name="rf_baseline",
            n_estimators=100,
            max_depth=10,
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
        RandomForestExperimentConfig(
            experiment_name="rf_deeper",
            n_estimators=100,
            max_depth=20,
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
        RandomForestExperimentConfig(
            experiment_name="rf_unweighted",
            n_estimators=100,
            max_depth=10,
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight=None,
            random_state=42,
            n_jobs=-1,
        ),
        RandomForestExperimentConfig(
            experiment_name="rf_compact",
            n_estimators=50,
            max_depth=5,
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
    ]

    results = []
    for config in configs:
        result = train_random_forest(
            split_data=split_data,
            n_estimators=config.n_estimators,
            max_depth=config.max_depth,
            min_samples_split=config.min_samples_split,
            min_samples_leaf=config.min_samples_leaf,
            class_weight=config.class_weight,
            random_state=config.random_state,
            n_jobs=config.n_jobs,
        )
        results.append(RandomForestExperimentResult(config=config, training_result=result))

    return tuple(results)


@dataclass(frozen=True)
class ModelComparisonRow:
    model_name: str
    variant_name: str
    hyperparameters: tuple[tuple[str, Any], ...]
    training_duration_seconds: float
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: tuple[tuple[int, int], tuple[int, int]]
    feature_importances: tuple[FeatureImportanceRecord, ...] | None = None


@dataclass(frozen=True)
class ModelComparisonReport:
    rows: tuple[ModelComparisonRow, ...]


@dataclass(frozen=True)
class FullModelComparisonReport:
    initial_row_count: int
    dropped_duplicate_count: int
    final_row_count: int
    feature_count: int
    train_row_count: int
    test_row_count: int
    train_class_distribution: tuple
    test_class_distribution: tuple
    comparison: ModelComparisonReport


def compare_models(split_data: SplitDataResult) -> ModelComparisonReport:
    """
    Compares a LogisticRegression baseline against predefined Random Forest configurations.
    Returns exactly five comparison rows in a deterministic order.
    """
    rows = []

    # 1. Logistic Regression
    lr_result = train_logistic_regression(split_data)
    lr_params = (
        ("class_weight", "balanced"),
        ("max_iter", 1000),
        ("solver", "lbfgs"),
        ("random_state", 42),
    )
    lr_metrics = lr_result.metrics
    rows.append(
        ModelComparisonRow(
            model_name="logistic_regression",
            variant_name="lr_baseline",
            hyperparameters=lr_params,
            training_duration_seconds=float(lr_result.training_duration_seconds) if lr_result.training_duration_seconds is not None else 0.0,
            accuracy=lr_metrics.accuracy,
            precision=lr_metrics.precision,
            recall=lr_metrics.recall,
            f1_score=lr_metrics.f1_score,
            confusion_matrix=((lr_metrics.tn, lr_metrics.fp), (lr_metrics.fn, lr_metrics.tp)),
            feature_importances=None,
        )
    )

    # 2. Random Forest Experiments
    rf_experiments = run_random_forest_experiments(split_data)
    for exp in rf_experiments:
        cfg = exp.config
        rf_params = (
            ("n_estimators", cfg.n_estimators),
            ("max_depth", cfg.max_depth),
            ("min_samples_split", cfg.min_samples_split),
            ("min_samples_leaf", cfg.min_samples_leaf),
            ("class_weight", cfg.class_weight),
            ("random_state", cfg.random_state),
            ("n_jobs", cfg.n_jobs),
        )
        rf_metrics = exp.training_result.metrics
        fi = exp.training_result.feature_importances
        top_10_fi = fi[:10] if fi is not None else None

        rows.append(
            ModelComparisonRow(
                model_name="random_forest",
                variant_name=cfg.experiment_name,
                hyperparameters=rf_params,
                training_duration_seconds=float(exp.training_result.training_duration_seconds) if exp.training_result.training_duration_seconds is not None else 0.0,
                accuracy=rf_metrics.accuracy,
                precision=rf_metrics.precision,
                recall=rf_metrics.recall,
                f1_score=rf_metrics.f1_score,
                confusion_matrix=((rf_metrics.tn, rf_metrics.fp), (rf_metrics.fn, rf_metrics.tp)),
                feature_importances=top_10_fi,
            )
        )

    return ModelComparisonReport(rows=tuple(rows))


def run_model_comparison(df: pd.DataFrame) -> FullModelComparisonReport:
    """
    Runs the full end-to-end model comparison workflow for Logistic Regression and Random Forest.
    """
    raw_result = prepare_training_data(df)
    binary_targets = encode_binary_labels(raw_result.targets)

    binary_result = TrainingDataResult(
        features=raw_result.features.copy(deep=True),
        targets=binary_targets,
        initial_row_count=raw_result.initial_row_count,
        dropped_duplicate_count=raw_result.dropped_duplicate_count,
        final_row_count=raw_result.final_row_count,
    )

    preprocessor = build_sklearn_preprocessing_pipeline()
    split_data = split_and_transform_data(binary_result, preprocessor)

    train_dist = tuple(
        sorted(
            [(int(k), int(v)) for k, v in split_data.y_train.value_counts().items()],
            key=lambda x: x[0]
        )
    )
    test_dist = tuple(
        sorted(
            [(int(k), int(v)) for k, v in split_data.y_test.value_counts().items()],
            key=lambda x: x[0]
        )
    )

    comparison_rows = compare_models(split_data)

    return FullModelComparisonReport(
        initial_row_count=raw_result.initial_row_count,
        dropped_duplicate_count=raw_result.dropped_duplicate_count,
        final_row_count=raw_result.final_row_count,
        feature_count=len(split_data.X_train.columns),
        train_row_count=len(split_data.X_train),
        test_row_count=len(split_data.X_test),
        train_class_distribution=train_dist,
        test_class_distribution=test_dist,
        comparison=comparison_rows,
    )


@dataclass(frozen=True)
class BaselineTrainingReport:
    """
    Immutable report containing the full baseline training evaluation results.

    Note: The ``estimator`` objects inside the nested ``ModelTrainingResult``
    instances are scikit-learn models and are intrinsically mutable. Deep
    immutability of the estimators is not guaranteed.

    This report is descriptive only; it does not declare a winner or final
    model, and must not be interpreted as a model selection decision.
    """
    initial_row_count: int
    dropped_duplicate_count: int
    final_row_count: int
    feature_count: int
    train_row_count: int
    test_row_count: int
    train_class_distribution: tuple
    test_class_distribution: tuple
    dummy_result: ModelTrainingResult
    logistic_result: ModelTrainingResult


def train_baseline_models(df: pd.DataFrame) -> BaselineTrainingReport:
    """
    Runs the full end-to-end baseline training workflow.

    Workflow (in order):
      1. Validate and prepare training data via prepare_training_data.
      2. Encode raw Label strings to binary 0/1 targets (BENIGN=0, attack=1).
      3. Construct a binary-label TrainingDataResult (no mutation of originals).
      4. Build an unfitted sklearn preprocessor.
      5. Split and transform data (stratified on binary target, leakage-safe).
      6. Train DummyClassifier baseline.
      7. Train LogisticRegression with balanced class weights.
      8. Return a BaselineTrainingReport with both results.

    Args:
        df: Raw CIC-IDS2017 DataFrame with all 78 feature columns + Label.

    Returns:
        BaselineTrainingReport: Full evaluation results for both models.

    Raises:
        AppException: If any validation step fails.
    """
    # Step 1: Validate schema and prepare raw training data
    raw_result = prepare_training_data(df)

    # Step 2: Encode raw attack labels to binary targets BEFORE split
    binary_targets = encode_binary_labels(raw_result.targets)

    # Step 3: Build an independent TrainingDataResult with binary targets
    binary_result = TrainingDataResult(
        features=raw_result.features.copy(deep=True),
        targets=binary_targets,
        initial_row_count=raw_result.initial_row_count,
        dropped_duplicate_count=raw_result.dropped_duplicate_count,
        final_row_count=raw_result.final_row_count,
    )

    # Step 4: Build a fresh unfitted preprocessor
    preprocessor = build_sklearn_preprocessing_pipeline()

    # Step 5: Stratified split and leakage-safe transform (binary target used)
    split_data = split_and_transform_data(binary_result, preprocessor)

    # Compute class distributions from the binary split targets
    train_dist = tuple(
        sorted(
            [(int(k), int(v)) for k, v in split_data.y_train.value_counts().items()],
            key=lambda x: x[0]
        )
    )
    test_dist = tuple(
        sorted(
            [(int(k), int(v)) for k, v in split_data.y_test.value_counts().items()],
            key=lambda x: x[0]
        )
    )

    # Step 6: Train DummyClassifier baseline
    dummy_result = train_dummy_classifier(split_data)

    # Step 7: Train LogisticRegression with balanced class weights
    logistic_result = train_logistic_regression(split_data, class_weight="balanced")

    feature_count = binary_result.features.shape[1]

    return BaselineTrainingReport(
        initial_row_count=raw_result.initial_row_count,
        dropped_duplicate_count=raw_result.dropped_duplicate_count,
        final_row_count=raw_result.final_row_count,
        feature_count=feature_count,
        train_row_count=len(split_data.X_train),
        test_row_count=len(split_data.X_test),
        train_class_distribution=train_dist,
        test_class_distribution=test_dist,
        dummy_result=dummy_result,
        logistic_result=logistic_result,
    )


def _model_result_to_dict(result: ModelTrainingResult, *, max_sample: int = 10) -> dict:
    """Converts a ModelTrainingResult to a JSON-safe dictionary."""
    m = result.metrics
    sample = list(result.predictions[:max_sample])
    out = {
        "model_name": str(result.model_name),
        "prediction_count": int(len(result.predictions)),
        "prediction_sample": [int(p) for p in sample],
        "accuracy": float(m.accuracy),
        "precision": float(m.precision),
        "recall": float(m.recall),
        "f1_score": float(m.f1_score),
        "confusion_matrix": [
            [int(m.tn), int(m.fp)],
            [int(m.fn), int(m.tp)]
        ],
        "tn": int(m.tn),
        "fp": int(m.fp),
        "fn": int(m.fn),
        "tp": int(m.tp),
    }
    if result.training_duration_seconds is not None:
        out["training_duration_seconds"] = float(result.training_duration_seconds)
    if result.feature_importances is not None:
        out["feature_importances"] = [
            {"feature_name": r.feature_name, "importance": float(r.importance)}
            for r in result.feature_importances
        ]
    return out


def baseline_report_to_dict(report: BaselineTrainingReport) -> dict:
    """
    Converts a BaselineTrainingReport to a JSON-safe dictionary.

    No estimator objects, raw data rows, or feature values are included.
    All numeric values are converted to Python-native int/float types.
    """
    return {
        "dataset": {
            "initial_row_count": int(report.initial_row_count),
            "dropped_duplicate_count": int(report.dropped_duplicate_count),
            "final_row_count": int(report.final_row_count),
            "feature_count": int(report.feature_count),
            "train_row_count": int(report.train_row_count),
            "test_row_count": int(report.test_row_count),
            "train_class_distribution": {
                str(k): int(v) for k, v in report.train_class_distribution
            },
            "test_class_distribution": {
                str(k): int(v) for k, v in report.test_class_distribution
            },
        },
        "models": {
            "dummy_classifier": _model_result_to_dict(report.dummy_result),
            "logistic_regression": _model_result_to_dict(report.logistic_result),
        },
    }


def comparison_report_to_dict(report: FullModelComparisonReport) -> dict:
    """
    Converts a FullModelComparisonReport into a JSON-serializable dictionary.
    """
    return {
        "dataset": {
            "initial_row_count": int(report.initial_row_count),
            "dropped_duplicate_count": int(report.dropped_duplicate_count),
            "final_row_count": int(report.final_row_count),
            "feature_count": int(report.feature_count),
            "train_row_count": int(report.train_row_count),
            "test_row_count": int(report.test_row_count),
            "train_class_distribution": {
                str(k): int(v) for k, v in report.train_class_distribution
            },
            "test_class_distribution": {
                str(k): int(v) for k, v in report.test_class_distribution
            },
        },
        "rows": [
            {
                "model_name": str(row.model_name),
                "variant_name": str(row.variant_name),
                "hyperparameters": dict(row.hyperparameters),
                "training_duration_seconds": float(row.training_duration_seconds),
                "accuracy": float(row.accuracy),
                "precision": float(row.precision),
                "recall": float(row.recall),
                "f1_score": float(row.f1_score),
                "confusion_matrix": [
                    [int(row.confusion_matrix[0][0]), int(row.confusion_matrix[0][1])],
                    [int(row.confusion_matrix[1][0]), int(row.confusion_matrix[1][1])]
                ],
                "feature_importances": [
                    {"feature_name": r.feature_name, "importance": float(r.importance)}
                    for r in row.feature_importances
                ] if row.feature_importances is not None else []
            }
            for row in report.comparison.rows
        ]
    }
