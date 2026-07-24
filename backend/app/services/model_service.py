import logging
import time
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Any
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
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
