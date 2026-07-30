import pytest
import pandas as pd
import numpy as np

from app.core.exceptions import AppException
from app.services.inference_service import (
    prepare_inference_data,
    run_inference,
    InferenceBatchResult,
)
from app.services.csv_validation_service import (
    CICIDS2017_FEATURE_COLUMNS,
    CICIDS2017_OPTIONAL_LABEL,
)
from app.services.preprocessing_service import REDUNDANT_COLUMN
from app.services.model_package_service import (
    ModelPackage,
    ModelMetadata,
    INFERENCE_FEATURE_COLUMNS,
)

class MockEstimator:
    def __init__(self, probabilities=None):
        if probabilities is None:
            self.probabilities = np.array([[0.1, 0.9], [0.8, 0.2]])
        else:
            self.probabilities = np.array(probabilities)
        self.classes_ = np.array([0, 1])

    def predict_proba(self, X):
        return self.probabilities[:len(X)]

class MockPreprocessor:
    def transform(self, X):
        return X

@pytest.fixture
def mock_model_package():
    return ModelPackage(
        estimator=MockEstimator(),
        preprocessor=MockPreprocessor(),
        feature_names=tuple(INFERENCE_FEATURE_COLUMNS),
        threshold=0.5,
        metadata=ModelMetadata("Test", "1.0")
    )


def test_prepare_inference_data_with_label():
    """Test preparing valid inference data that HAS the Label column."""
    columns = list(CICIDS2017_FEATURE_COLUMNS) + [CICIDS2017_OPTIONAL_LABEL]
    df = pd.DataFrame(np.random.rand(5, 79), columns=columns)

    prepared = prepare_inference_data(df)

    # Label and redundant column should be dropped
    assert len(prepared.columns) == 77
    assert tuple(prepared.columns) == INFERENCE_FEATURE_COLUMNS
    assert len(prepared) == 5


def test_prepare_inference_data_without_label():
    """Test preparing data that does not have the Label column."""
    df = pd.DataFrame(np.random.rand(5, 78), columns=CICIDS2017_FEATURE_COLUMNS)

    prepared = prepare_inference_data(df)
    assert len(prepared.columns) == 77
    assert tuple(prepared.columns) == INFERENCE_FEATURE_COLUMNS


def test_prepare_inference_data_empty():
    with pytest.raises(AppException) as excinfo:
        prepare_inference_data(pd.DataFrame())
    assert excinfo.value.status_code == 422


def test_prepare_inference_data_invalid_schema():
    # Missing columns
    df = pd.DataFrame(np.random.rand(5, 2), columns=["Col1", "Col2"])
    with pytest.raises(AppException) as excinfo:
        prepare_inference_data(df)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "SCHEMA_MISMATCH"


def test_run_inference_success(mock_model_package):
    """Test successful inference execution."""
    df = pd.DataFrame(np.random.rand(2, 77), columns=INFERENCE_FEATURE_COLUMNS)

    result = run_inference(df, mock_model_package)

    assert isinstance(result, InferenceBatchResult)
    assert len(result.predictions) == 2
    assert result.predictions[0].attack_probability == 0.9
    assert result.predictions[0].is_attack is True
    assert result.predictions[0].risk_level == "CRITICAL"

    assert result.predictions[1].attack_probability == 0.2
    assert result.predictions[1].is_attack is False


def test_run_inference_invalid_input(mock_model_package):
    """Test running inference with invalid schema."""
    df = pd.DataFrame(np.random.rand(2, 76), columns=list(INFERENCE_FEATURE_COLUMNS)[:76])
    with pytest.raises(AppException) as excinfo:
        run_inference(df, mock_model_package)
    assert excinfo.value.status_code == 500
    assert excinfo.value.code == "INFERENCE_ERROR"


def test_run_inference_transform_error(mock_model_package):
    class ErrorPreprocessor:
        def transform(self, X):
            raise ValueError("Transform error")
    mock_model_package = ModelPackage(
        estimator=mock_model_package.estimator,
        preprocessor=ErrorPreprocessor(),
        feature_names=mock_model_package.feature_names,
        threshold=mock_model_package.threshold,
        metadata=mock_model_package.metadata
    )
    df = pd.DataFrame(np.random.rand(2, 77), columns=INFERENCE_FEATURE_COLUMNS)
    with pytest.raises(AppException) as excinfo:
        run_inference(df, mock_model_package)
    assert excinfo.value.status_code == 500
    assert excinfo.value.code == "INFERENCE_ERROR"
    assert "preprocessing failed" in excinfo.value.message
