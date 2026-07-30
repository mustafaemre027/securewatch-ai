import pytest
from pathlib import Path
import joblib
import numpy as np

from app.core.exceptions import AppException
from app.services.model_package_service import (
    ModelMetadata,
    ModelPackage,
    load_model_package,
    INFERENCE_FEATURE_COLUMNS,
)


class MockEstimatorWithProba:
    def __init__(self, classes_=None):
        if classes_ is None:
            self.classes_ = np.array([0, 1])
        elif classes_ is not False:
            self.classes_ = np.array(classes_)

    def predict_proba(self, X):
        return np.array([[0.1, 0.9] for _ in range(len(X))])

class MockEstimatorNoProba:
    def __init__(self, classes_=None):
        if classes_ is None:
            self.classes_ = np.array([0, 1])
        elif classes_ is not False:
            self.classes_ = np.array(classes_)


class MockPreprocessor:
    def __init__(self, fitted=True, support_transform=True):
        if fitted:
            self.transformers_ = []
        self._support_transform = support_transform

    def transform(self, X):
        if not self._support_transform:
            raise AttributeError("transform not supported")
        return X


@pytest.fixture
def valid_model_package_data():
    return {
        "estimator": MockEstimatorWithProba(),
        "preprocessor": MockPreprocessor(),
        "feature_names": tuple(INFERENCE_FEATURE_COLUMNS),
        "threshold": 0.5,
        "metadata": {"model_name": "TestModel", "version": "1.0.0"}
    }


def test_load_model_package_success(tmp_path, monkeypatch, valid_model_package_data):
    """Test successfully loading a valid model package."""
    # Mock settings to point to tmp_path
    class MockSettings:
        model_package_path = tmp_path

    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())

    file_path = tmp_path / "valid_model.joblib"
    joblib.dump(valid_model_package_data, file_path)

    model_pkg = load_model_package("valid_model.joblib")
    assert isinstance(model_pkg, ModelPackage)
    assert model_pkg.threshold == 0.5
    assert model_pkg.metadata.model_name == "TestModel"
    assert model_pkg.metadata.version == "1.0.0"


def test_load_model_package_invalid_extension():
    """Test loading a file without .joblib extension."""
    with pytest.raises(AppException) as excinfo:
        load_model_package("model.pkl")
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "Only .joblib extensions" in excinfo.value.message


def test_load_model_package_path_traversal():
    """Test loading a file with path traversal attempts."""
    with pytest.raises(AppException) as excinfo:
        load_model_package("../model.joblib")
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "Path separators are not allowed" in excinfo.value.message


def test_load_model_package_file_not_found(tmp_path, monkeypatch):
    """Test loading a non-existent file."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())

    with pytest.raises(AppException) as excinfo:
        load_model_package("missing.joblib")
    assert excinfo.value.status_code == 404
    assert excinfo.value.code == "MODEL_NOT_FOUND"


def test_load_model_package_corrupted_file(tmp_path, monkeypatch):
    """Test loading a corrupted joblib file."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())

    file_path = tmp_path / "corrupted.joblib"
    file_path.write_text("This is not a valid joblib file.")

    with pytest.raises(AppException) as excinfo:
        load_model_package("corrupted.joblib")
    assert excinfo.value.status_code == 500
    assert excinfo.value.code == "MODEL_LOAD_ERROR"


def test_load_model_package_invalid_type(tmp_path, monkeypatch):
    """Test loading a joblib file that does not contain a dict."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())

    file_path = tmp_path / "list_model.joblib"
    joblib.dump([1, 2, 3], file_path)

    with pytest.raises(AppException) as excinfo:
        load_model_package("list_model.joblib")
    assert excinfo.value.status_code == 500
    assert excinfo.value.code == "MODEL_CONTRACT_ERROR"
    assert "must be a dictionary" in excinfo.value.message


def test_load_model_package_missing_keys(tmp_path, monkeypatch, valid_model_package_data):
    """Test loading a model package missing required keys."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())

    del valid_model_package_data["threshold"]
    file_path = tmp_path / "missing_keys.joblib"
    joblib.dump(valid_model_package_data, file_path)

    with pytest.raises(AppException) as excinfo:
        load_model_package("missing_keys.joblib")
    assert excinfo.value.status_code == 500
    assert excinfo.value.code == "MODEL_CONTRACT_ERROR"
    assert "missing required keys" in excinfo.value.message


def test_load_model_package_invalid_estimator(tmp_path, monkeypatch, valid_model_package_data):
    """Test loading a model with invalid estimator."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())

    file_path = tmp_path / "inv_est.joblib"

    # Missing predict_proba
    valid_model_package_data["estimator"] = MockEstimatorNoProba()
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_est.joblib")
    assert "does not support predict_proba" in excinfo.value.message

    # Missing classes_
    valid_model_package_data["estimator"] = MockEstimatorWithProba(classes_=False)
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_est.joblib")
    assert "missing classes_" in excinfo.value.message

    # Invalid classes
    valid_model_package_data["estimator"] = MockEstimatorWithProba(classes_=[0, 2])
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_est.joblib")
    assert "exactly binary 0 and 1" in excinfo.value.message


def test_load_model_package_invalid_preprocessor(tmp_path, monkeypatch, valid_model_package_data):
    """Test loading a model with invalid preprocessor."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())
    file_path = tmp_path / "inv_prep.joblib"

    # Not fitted
    valid_model_package_data["preprocessor"] = MockPreprocessor(fitted=False)
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_prep.joblib")
    assert "fitted" in excinfo.value.message


def test_load_model_package_invalid_features(tmp_path, monkeypatch, valid_model_package_data):
    """Test loading a model with invalid features."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())
    file_path = tmp_path / "inv_feat.joblib"

    # Wrong length
    valid_model_package_data["feature_names"] = tuple(list(INFERENCE_FEATURE_COLUMNS)[:10])
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_feat.joblib")
    assert "exactly 77" in excinfo.value.message

    # Wrong order
    wrong_order = list(INFERENCE_FEATURE_COLUMNS)
    wrong_order[0], wrong_order[1] = wrong_order[1], wrong_order[0]
    valid_model_package_data["feature_names"] = tuple(wrong_order)
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_feat.joblib")
    assert "canonical order" in excinfo.value.message


def test_load_model_package_invalid_threshold(tmp_path, monkeypatch, valid_model_package_data):
    """Test loading a model with invalid threshold."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())
    file_path = tmp_path / "inv_thresh.joblib"

    valid_model_package_data["threshold"] = 1.5
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_thresh.joblib")
    assert "between 0.0 and 1.0" in excinfo.value.message


def test_load_model_package_invalid_metadata(tmp_path, monkeypatch, valid_model_package_data):
    """Test loading a model with invalid metadata."""
    class MockSettings:
        model_package_path = tmp_path
    monkeypatch.setattr("app.services.model_package_service.get_settings", lambda: MockSettings())
    file_path = tmp_path / "inv_meta.joblib"

    valid_model_package_data["metadata"] = {"model_name": "", "version": "1.0.0"}
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_meta.joblib")
    assert "name cannot be empty" in excinfo.value.message

    valid_model_package_data["metadata"] = {"model_name": "Test", "version": " "}
    joblib.dump(valid_model_package_data, file_path)
    with pytest.raises(AppException) as excinfo:
        load_model_package("inv_meta.joblib")
    assert "version cannot be empty" in excinfo.value.message
