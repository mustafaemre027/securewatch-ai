import numpy as np
import pandas as pd
import pytest

from app.core.exceptions import AppException
from app.services.csv_validation_service import (
    CICIDS2017_FEATURE_COLUMNS,
    CICIDS2017_OPTIONAL_LABEL,
)
from app.services.preprocessing_service import prepare_training_data, REDUNDANT_COLUMN


@pytest.fixture
def base_df() -> pd.DataFrame:
    """Create a minimal valid DataFrame with all canonical columns."""
    columns = list(CICIDS2017_FEATURE_COLUMNS) + [CICIDS2017_OPTIONAL_LABEL]
    data = {col: [1.0] for col in columns}
    data[CICIDS2017_OPTIONAL_LABEL] = ["BENIGN"]
    return pd.DataFrame(data)


def test_prepare_training_data_success(base_df):
    """Test successful data preparation with canonical schema."""
    # Ensure there's a duplicate row and an inf row
    df = pd.concat([base_df, base_df.copy(), base_df.copy()], ignore_index=True)
    df.loc[0, CICIDS2017_FEATURE_COLUMNS[0]] = np.inf

    # Store original data for immutability check
    df_copy = df.copy(deep=True)

    result = prepare_training_data(df)

    # Verify return types
    assert isinstance(result.features, pd.DataFrame)
    assert isinstance(result.targets, pd.Series)

    # Verify row counts
    assert result.initial_row_count == 3
    assert result.dropped_duplicate_count == 1
    assert result.final_row_count == 2

    # Verify 78 canonical features exist initially (78 features + 1 label = 79 cols)
    assert len(CICIDS2017_FEATURE_COLUMNS) == 78

    # Verify Fwd Header Length.1 is dropped -> 77 features
    assert result.features.shape[1] == 77
    assert REDUNDANT_COLUMN not in result.features.columns

    # Verify infinity is converted to NaN
    assert np.isnan(result.features.iloc[0, 0])

    # Verify numeric conversion (all features should be numeric)
    assert all(pd.api.types.is_numeric_dtype(result.features[c]) for c in result.features.columns)

    # Verify label separation
    assert CICIDS2017_OPTIONAL_LABEL not in result.features.columns
    assert len(result.targets) == 2
    assert result.targets.iloc[0] == "BENIGN"

    # Verify original DataFrame is completely unchanged
    pd.testing.assert_frame_equal(df, df_copy)


def test_prepare_training_data_missing_label(base_df):
    """Test rejection when Label column is missing."""
    df = base_df.drop(columns=[CICIDS2017_OPTIONAL_LABEL])
    with pytest.raises(AppException) as excinfo:
        prepare_training_data(df)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "SCHEMA_MISMATCH"


def test_prepare_training_data_empty_label(base_df):
    """Test rejection when Label column contains empty/whitespace values."""
    base_df.loc[0, CICIDS2017_OPTIONAL_LABEL] = "   "
    with pytest.raises(AppException) as excinfo:
        prepare_training_data(base_df)
    assert excinfo.value.status_code == 422
    assert "whitespace" in excinfo.value.message


def test_prepare_training_data_nan_label(base_df):
    """Test rejection when Label column contains NaN values."""
    base_df.loc[0, CICIDS2017_OPTIONAL_LABEL] = np.nan
    with pytest.raises(AppException) as excinfo:
        prepare_training_data(base_df)
    assert excinfo.value.status_code == 422
    assert "missing" in excinfo.value.message


def test_prepare_training_data_missing_features(base_df):
    """Test rejection when canonical features are missing."""
    df = base_df.drop(columns=["Destination Port"])
    with pytest.raises(AppException) as excinfo:
        prepare_training_data(df)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "SCHEMA_MISMATCH"
    assert "missing_columns" in excinfo.value.details
    assert "Destination Port" in excinfo.value.details["missing_columns"]


def test_prepare_training_data_extra_features(base_df):
    """Test rejection when extra features are present."""
    base_df["Extra Column"] = 1
    with pytest.raises(AppException) as excinfo:
        prepare_training_data(base_df)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "SCHEMA_MISMATCH"
    assert "extra_columns" in excinfo.value.details
    assert "Extra Column" in excinfo.value.details["extra_columns"]


def test_prepare_training_data_duplicate_columns(base_df):
    """Test rejection when columns are duplicated."""
    # Add a duplicate column
    df = pd.concat([base_df, base_df.iloc[:, [0]]], axis=1)
    with pytest.raises(AppException) as excinfo:
        prepare_training_data(df)
    assert excinfo.value.status_code == 422
    assert "duplicate" in excinfo.value.message


def test_prepare_training_data_empty_df():
    """Test rejection when DataFrame is completely empty."""
    df = pd.DataFrame()
    with pytest.raises(AppException) as excinfo:
        prepare_training_data(df)
    assert excinfo.value.status_code == 422
    assert "empty" in excinfo.value.message


from sklearn.base import clone
from sklearn.exceptions import NotFittedError
from app.services.preprocessing_service import build_sklearn_preprocessing_pipeline


def test_build_pipeline_defaults():
    """Verify default CIC-IDS2017 transformer has 77 numeric and 0 categorical columns."""
    transformer = build_sklearn_preprocessing_pipeline()

    # 77 numeric, 0 categorical -> 1 transformer in the list (num)
    assert len(transformer.transformers) == 1
    name, pipeline, cols = transformer.transformers[0]

    assert name == "num"
    assert len(cols) == 77
    assert "Destination Port" in cols
    assert REDUNDANT_COLUMN not in cols


def test_build_pipeline_unfitted_and_cloneable():
    """Verify transformer is unfitted initially and cloneable."""
    transformer = build_sklearn_preprocessing_pipeline()

    # Should raise NotFittedError if we try to transform
    with pytest.raises(NotFittedError):
        transformer.transform(pd.DataFrame(columns=[c for c in CICIDS2017_FEATURE_COLUMNS if c != REDUNDANT_COLUMN]))

    cloned = clone(transformer)
    assert cloned is not transformer


def test_build_pipeline_numeric_imputation_and_scaling():
    """Verify NaN is filled with median and scaled, and all-NaN column is kept."""
    cols = ["A", "B", "C"]
    transformer = build_sklearn_preprocessing_pipeline(numeric_features=cols)

    # Train data: A has NaN, B has all NaNs, C has normal values
    X_train = pd.DataFrame({
        "A": [1.0, 3.0, np.nan],  # median is 2.0
        "B": [np.nan, np.nan, np.nan], # all NaN
        "C": [10.0, 20.0, 30.0]
    })

    transformer.fit(X_train)

    # Test data: Only transform
    X_test = pd.DataFrame({
        "A": [np.nan], # Should be filled with 2.0, then scaled (2.0 is mean, so 0.0)
        "B": [np.nan], # Should be filled with 0 (sklearn default for all-NaN if keep_empty_features=True)
        "C": [20.0]    # 20 is mean, so 0.0
    })

    X_test_transformed = transformer.transform(X_test)

    assert X_test_transformed.shape == (1, 3)
    assert np.isclose(X_test_transformed[0, 0], 0.0)
    assert np.isclose(X_test_transformed[0, 1], 0.0)
    assert np.isclose(X_test_transformed[0, 2], 0.0)


def test_build_pipeline_categorical_imputation_and_unknowns():
    """Verify categorical pipeline fills missing values and ignores unknown categories."""
    cols = ["cat1"]
    transformer = build_sklearn_preprocessing_pipeline(
        numeric_features=[],
        categorical_features=cols
    )

    X_train = pd.DataFrame({
        "cat1": ["apple", "apple", "banana", np.nan] # most frequent is "apple"
    })

    transformer.fit(X_train)

    # Categories learned: "apple", "banana"

    X_test = pd.DataFrame({
        "cat1": [np.nan, "orange"] # NaN -> "apple", "orange" -> ignored (all zeros)
    })

    X_test_transformed = transformer.transform(X_test)

    # NaN filled with "apple", so one-hot is [1.0, 0.0]
    assert np.array_equal(X_test_transformed[0], [1.0, 0.0])
    # "orange" is unknown, so one-hot is [0.0, 0.0]
    assert np.array_equal(X_test_transformed[1], [0.0, 0.0])


def test_build_pipeline_reject_overlap():
    """Verify overlap of numerical/categorical lists is rejected."""
    with pytest.raises(AppException) as excinfo:
        build_sklearn_preprocessing_pipeline(
            numeric_features=["A", "B"],
            categorical_features=["B", "C"]
        )
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "B" in excinfo.value.details["overlapping_features"]


def test_build_pipeline_reject_duplicates():
    """Verify duplicate column names in lists are rejected."""
    with pytest.raises(AppException) as excinfo:
        build_sklearn_preprocessing_pipeline(numeric_features=["A", "A"])
    assert excinfo.value.status_code == 422
    assert "duplicate" in excinfo.value.message


def test_build_pipeline_reject_empty_names():
    """Verify empty column names in lists are rejected."""
    with pytest.raises(AppException) as excinfo:
        build_sklearn_preprocessing_pipeline(numeric_features=["A", "   "])
    assert excinfo.value.status_code == 422
    assert "empty" in excinfo.value.message


from app.services.preprocessing_service import split_and_transform_data, TrainingDataResult


@pytest.fixture
def base_training_data() -> TrainingDataResult:
    """Create a minimal valid TrainingDataResult with 10 rows (2 classes)."""
    # 5 BENIGN, 5 ATTACK
    data = {c: list(range(10)) for c in CICIDS2017_FEATURE_COLUMNS if c != REDUNDANT_COLUMN}
    features = pd.DataFrame(data)
    targets = pd.Series(["BENIGN"] * 5 + ["ATTACK"] * 5, name=CICIDS2017_OPTIONAL_LABEL)
    return TrainingDataResult(
        features=features,
        targets=targets,
        initial_row_count=10,
        dropped_duplicate_count=0,
        final_row_count=10
    )


def test_split_and_transform_success(base_training_data):
    """Verify successful split and transform with stratification."""
    preprocessor = build_sklearn_preprocessing_pipeline()
    data_copy = base_training_data.features.copy(deep=True)

    result = split_and_transform_data(
        data=base_training_data,
        preprocessor=preprocessor,
        test_size=0.2,
        random_state=42
    )

    # Verify outputs
    assert len(result.X_train) == 8
    assert len(result.X_test) == 2
    assert len(result.y_train) == 8
    assert len(result.y_test) == 2

    # Disjoint indices (tuples) and cover all rows
    assert not set(result.train_indices).intersection(set(result.test_indices))
    assert len(result.train_indices) + len(result.test_indices) == 10

    # Stratification check (20% of 5 = 1, so test should have exactly 1 of each)
    assert result.y_test.value_counts()["BENIGN"] == 1
    assert result.y_test.value_counts()["ATTACK"] == 1

    # Features contain finite numeric values
    assert np.isfinite(result.X_train.to_numpy()).all()
    assert np.isfinite(result.X_test.to_numpy()).all()

    # Original data is unmodified
    pd.testing.assert_frame_equal(base_training_data.features, data_copy)


def test_split_and_transform_same_random_state(base_training_data):
    """Verify same random state produces same indices."""
    preprocessor1 = build_sklearn_preprocessing_pipeline()
    preprocessor2 = build_sklearn_preprocessing_pipeline()

    res1 = split_and_transform_data(base_training_data, preprocessor1, random_state=42)
    res2 = split_and_transform_data(base_training_data, preprocessor2, random_state=42)

    assert res1.train_indices == res2.train_indices
    assert res1.test_indices == res2.test_indices


def test_split_and_transform_data_leakage(base_training_data):
    """Verify test outliers do not affect scaler stats and missing values are handled."""
    # Discover test indices via a clean run - do NOT mutate the shared fixture.
    dummy_res = split_and_transform_data(
        base_training_data, build_sklearn_preprocessing_pipeline(), random_state=42
    )
    test_idx_0, test_idx_1 = dummy_res.test_indices[0], dummy_res.test_indices[1]

    # Build a local deep copy and inject outlier + NaN only on test rows.
    import dataclasses
    features_local = base_training_data.features.copy(deep=True)
    targets_local = base_training_data.targets.copy(deep=True)
    features_local.loc[test_idx_0, CICIDS2017_FEATURE_COLUMNS[0]] = 999999.0  # Outlier in test
    features_local.loc[test_idx_1, CICIDS2017_FEATURE_COLUMNS[0]] = np.nan    # Missing in test
    local_data = dataclasses.replace(
        base_training_data,
        features=features_local,
        targets=targets_local
    )
    preprocessor = build_sklearn_preprocessing_pipeline()

    result = split_and_transform_data(
        data=local_data,
        preprocessor=preprocessor,
        test_size=0.2,
        random_state=42
    )

    # Scaler mean for the first column should be computed only on the 8 training rows.
    # Outlier was injected on test rows, so training stats are unaffected.
    num_pipeline = result.preprocessor.transformers_[0][1]
    scaler = num_pipeline.named_steps["scaler"]
    mean_val = scaler.mean_[0]

    assert mean_val < 10.0  # Meaning outlier 999999.0 was NOT included in fit

    # The NaN in test should be filled with the training median, then scaled.
    col_name = result.X_test.columns[0]
    assert np.isfinite(result.X_test.loc[test_idx_1, col_name])

    # Confirm base_training_data fixture is completely unmodified
    assert not base_training_data.features.isna().any().any(), \
        "Fixture must not have NaN after leakage test"


def test_split_and_transform_invalid_test_size(base_training_data):
    """Verify rejection of invalid test_size."""
    preprocessor = build_sklearn_preprocessing_pipeline()
    with pytest.raises(AppException) as excinfo:
        split_and_transform_data(base_training_data, preprocessor, test_size=1.5)
    assert excinfo.value.status_code == 422
    assert "test_size" in excinfo.value.message


def test_split_and_transform_empty_data():
    """Verify rejection of empty training data."""
    empty_data = TrainingDataResult(
        features=pd.DataFrame(),
        targets=pd.Series(dtype=str),
        initial_row_count=0,
        dropped_duplicate_count=0,
        final_row_count=0
    )
    preprocessor = build_sklearn_preprocessing_pipeline()
    with pytest.raises(AppException) as excinfo:
        split_and_transform_data(empty_data, preprocessor)
    assert excinfo.value.status_code == 422
    assert "empty" in excinfo.value.message


def test_split_and_transform_single_class(base_training_data):
    """Verify rejection if only one class exists."""
    base_training_data.targets[:] = "BENIGN"
    preprocessor = build_sklearn_preprocessing_pipeline()
    with pytest.raises(AppException) as excinfo:
        split_and_transform_data(base_training_data, preprocessor)
    assert excinfo.value.status_code == 422
    assert "two distinct classes" in excinfo.value.message


def test_split_and_transform_insufficient_samples(base_training_data):
    """Verify rejection if a class has < 2 samples."""
    base_training_data.targets.iloc[9] = "RARE_ATTACK" # Only 1 sample
    preprocessor = build_sklearn_preprocessing_pipeline()
    with pytest.raises(AppException) as excinfo:
        split_and_transform_data(base_training_data, preprocessor)
    assert excinfo.value.status_code == 422
    assert "fewer than 2 samples" in excinfo.value.message


# ---------------------------------------------------------------------------
# Mutation regression tests
# ---------------------------------------------------------------------------

def _make_fresh_training_data() -> TrainingDataResult:
    """Helper: build an independent TrainingDataResult with 10 rows (2 classes)."""
    data = {c: list(range(10)) for c in CICIDS2017_FEATURE_COLUMNS if c != REDUNDANT_COLUMN}
    features = pd.DataFrame(data)
    targets = pd.Series(["BENIGN"] * 5 + ["ATTACK"] * 5, name=CICIDS2017_OPTIONAL_LABEL)
    return TrainingDataResult(
        features=features,
        targets=targets,
        initial_row_count=10,
        dropped_duplicate_count=0,
        final_row_count=10
    )


def test_split_does_not_mutate_source_prepared_data():
    """split_and_transform_data must not modify PreparedTrainingData.features or .targets."""
    td = _make_fresh_training_data()
    features_snapshot = td.features.copy(deep=True)
    targets_snapshot = td.targets.copy(deep=True)

    split_and_transform_data(td, build_sklearn_preprocessing_pipeline(), random_state=42)

    pd.testing.assert_frame_equal(td.features, features_snapshot)
    pd.testing.assert_series_equal(td.targets, targets_snapshot)


def test_mutating_source_after_split_does_not_affect_result():
    """Mutating source DataFrame after split must not change X_train/X_test."""
    td = _make_fresh_training_data()
    result = split_and_transform_data(td, build_sklearn_preprocessing_pipeline(), random_state=42)

    X_train_snapshot = result.X_train.copy(deep=True)
    X_test_snapshot = result.X_test.copy(deep=True)

    # Corrupt source features after split
    td.features.iloc[:, 0] = -999.0

    pd.testing.assert_frame_equal(result.X_train, X_train_snapshot)
    pd.testing.assert_frame_equal(result.X_test, X_test_snapshot)


def test_mutating_result_train_does_not_affect_result_test():
    """X_train and X_test must not share a mutable underlying buffer."""
    td = _make_fresh_training_data()
    result = split_and_transform_data(td, build_sklearn_preprocessing_pipeline(), random_state=42)

    X_test_snapshot = result.X_test.copy(deep=True)

    # Mutate the training output
    result.X_train.iloc[:, 0] = -777.0

    pd.testing.assert_frame_equal(result.X_test, X_test_snapshot)


def test_result_indices_are_immutable_tuples():
    """train_indices and test_indices must be plain Python tuples."""
    td = _make_fresh_training_data()
    result = split_and_transform_data(td, build_sklearn_preprocessing_pipeline(), random_state=42)

    assert isinstance(result.train_indices, tuple)
    assert isinstance(result.test_indices, tuple)
    assert not set(result.train_indices).intersection(set(result.test_indices))
    assert len(result.train_indices) + len(result.test_indices) == 10
