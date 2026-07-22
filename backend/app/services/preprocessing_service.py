import logging
from dataclasses import dataclass
import numpy as np
import pandas as pd
from typing import List, Optional

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

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


def build_sklearn_preprocessing_pipeline(
    numeric_features: Optional[List[str]] = None,
    categorical_features: Optional[List[str]] = None,
) -> ColumnTransformer:
    """
    Builds an unfitted scikit-learn ColumnTransformer for preprocessing CIC-IDS2017 data.

    Args:
        numeric_features: List of numeric column names. Defaults to all 77 features.
        categorical_features: List of categorical column names. Defaults to an empty list.

    Returns:
        ColumnTransformer: An unfitted scikit-learn ColumnTransformer instance.

    Raises:
        AppException: If there's an overlap between numeric and categorical features,
                      or if duplicate/empty feature names are provided.
    """
    if numeric_features is None:
        numeric_features = [col for col in CICIDS2017_FEATURE_COLUMNS if col != REDUNDANT_COLUMN]
    if categorical_features is None:
        categorical_features = []

    # Validate empty names
    if any(not str(col).strip() for col in numeric_features + categorical_features):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Feature lists cannot contain empty column names."
        )

    # Validate duplicates within lists
    if len(numeric_features) != len(set(numeric_features)):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Numeric feature list contains duplicate column names."
        )
    if len(categorical_features) != len(set(categorical_features)):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Categorical feature list contains duplicate column names."
        )

    # Validate intersection
    overlap = set(numeric_features).intersection(set(categorical_features))
    if overlap:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="A feature cannot be both numeric and categorical.",
            details={"overlapping_features": sorted(list(overlap))}
        )

    transformers = []

    if numeric_features:
        num_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("scaler", StandardScaler())
        ])
        transformers.append(("num", num_pipeline, list(numeric_features)))

    if categorical_features:
        cat_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent", keep_empty_features=True)),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("cat", cat_pipeline, list(categorical_features)))

    return ColumnTransformer(
        transformers=transformers,
        remainder="drop"
    )


@dataclass(frozen=True)
class SplitDataResult:
    """Frozen container for train/test split and pipeline execution results.

    Note: ``frozen=True`` prevents re-assignment of fields but does NOT make
    the contained ``pd.DataFrame``/``pd.Series`` objects deeply immutable.
    Each field is produced via defensive deep-copy isolation inside
    ``split_and_transform_data`` so that callers cannot accidentally
    corrupt shared mutable state.

    ``train_indices`` and ``test_indices`` are stored as plain Python tuples
    (immutable) rather than ``pd.Index`` objects.
    """
    preprocessor: ColumnTransformer
    X_train: pd.DataFrame
    X_test: pd.DataFrame
    y_train: pd.Series
    y_test: pd.Series
    train_indices: tuple
    test_indices: tuple


def split_and_transform_data(
    data: TrainingDataResult,
    preprocessor: ColumnTransformer,
    test_size: float = 0.2,
    random_state: int = 42
) -> SplitDataResult:
    """
    Splits the data into train/test sets and fits/transforms the preprocessor
    in a leakage-safe manner (fit only on training data).

    Args:
        data: The prepared training data containing features and targets.
        preprocessor: An unfitted scikit-learn ColumnTransformer.
        test_size: Proportion of the dataset to include in the test split.
        random_state: Controls the shuffling applied to the data before applying the split.

    Returns:
        SplitDataResult: The split and transformed data along with the fitted preprocessor.

    Raises:
        AppException: If validation fails or stratified split cannot be performed.
    """
    if not (0 < test_size < 1):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="test_size must be strictly between 0 and 1."
        )

    if data.features.empty:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Cannot split an empty dataset."
        )

    # Class count validation for stratified split
    class_counts = data.targets.value_counts()
    if len(class_counts) < 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="At least two distinct classes are required for stratification."
        )

    if class_counts.min() < 2:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Stratified split failed: At least one class has fewer than 2 samples."
        )

    # Defensive deep copies before split - prevents callers from accidentally
    # mutating the source PreparedTrainingData through pandas' shared buffers.
    features_copy = data.features.copy(deep=True)
    targets_copy = data.targets.copy(deep=True)

    # We must explicitly NOT fallback to normal split
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            features_copy,
            targets_copy,
            test_size=test_size,
            random_state=random_state,
            stratify=targets_copy
        )
    except ValueError as e:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message=f"Stratified split failed: {str(e)}"
        )

    # Fit transform on training data ONLY to prevent data leakage.
    X_train_transformed_arr = preprocessor.fit_transform(X_train)
    # Transform on test data ONLY - no fitting.
    X_test_transformed_arr = preprocessor.transform(X_test)

    # Get feature names from preprocessor to maintain dataframe structure.
    feature_names = preprocessor.get_feature_names_out()

    # Build independent DataFrames so X_train and X_test share no mutable buffer.
    X_train_transformed = pd.DataFrame(
        X_train_transformed_arr.copy(),
        columns=feature_names,
        index=X_train.index
    )
    X_test_transformed = pd.DataFrame(
        X_test_transformed_arr.copy(),
        columns=feature_names,
        index=X_test.index
    )

    # Ensure dimensions match (columns).
    if X_train_transformed.shape[1] != X_test_transformed.shape[1]:
        raise AppException(
            status_code=500,
            code="TRANSFORM_ERROR",
            message="Transformed train and test datasets have mismatched column counts."
        )

    # Capture indices as immutable tuples before validation.
    train_idx = tuple(X_train.index.tolist())
    test_idx = tuple(X_test.index.tolist())

    if set(train_idx).intersection(set(test_idx)):
        raise AppException(
            status_code=500,
            code="SPLIT_ERROR",
            message="Training and test sets have overlapping indices."
        )

    if len(train_idx) + len(test_idx) != len(data.features):
        raise AppException(
            status_code=500,
            code="SPLIT_ERROR",
            message="Training and test sets do not cover all original rows."
        )

    logger.info(
        "Data split and transformed successfully. Train: %d rows, Test: %d rows.",
        len(X_train_transformed), len(X_test_transformed)
    )

    return SplitDataResult(
        preprocessor=preprocessor,
        X_train=X_train_transformed,
        X_test=X_test_transformed,
        y_train=y_train.copy(deep=True),
        y_test=y_test.copy(deep=True),
        train_indices=train_idx,
        test_indices=test_idx
    )
