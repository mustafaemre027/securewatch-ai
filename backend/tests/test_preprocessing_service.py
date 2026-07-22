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
