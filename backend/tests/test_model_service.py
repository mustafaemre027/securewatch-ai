import numpy as np
import pandas as pd
import pytest

from app.core.exceptions import AppException
from app.services.model_service import encode_binary_labels


def test_encode_benign():
    """Test that BENIGN values are correctly encoded as 0."""
    labels = pd.Series(["BENIGN", "BENIGN"])
    encoded = encode_binary_labels(labels)
    assert encoded.tolist() == [0, 0]


def test_encode_benign_case_and_space():
    """Test case insensitivity and whitespace stripping for BENIGN."""
    labels = pd.Series(["benign", "Benign", " BENIGN ", "\tBENIGN\n"])
    encoded = encode_binary_labels(labels)
    assert encoded.tolist() == [0, 0, 0, 0]


def test_encode_attacks():
    """Test that valid attack names are encoded as 1."""
    labels = pd.Series(["DDoS", "DoS Hulk", "PortScan", "Bot", "Web Attack"])
    encoded = encode_binary_labels(labels)
    assert encoded.tolist() == [1, 1, 1, 1, 1]


def test_encode_mixed_order():
    """Test correctly mixed normal and attack labels encoding."""
    labels = pd.Series(["BENIGN", "DDoS", "benign", "PortScan"])
    encoded = encode_binary_labels(labels)
    assert encoded.tolist() == [0, 1, 0, 1]


def test_preserves_index_and_name():
    """Test that the original series index and name are preserved."""
    labels = pd.Series(["BENIGN", "DDoS"], index=[10, 20], name="TargetLabel")
    encoded = encode_binary_labels(labels)
    assert encoded.index.tolist() == [10, 20]
    assert encoded.name == "TargetLabel"


def test_output_contains_only_integers_zero_and_one():
    """Test that the output Series contains strictly 0 and 1 integer values."""
    labels = pd.Series(["BENIGN", "DDoS", "benign", "PortScan"])
    encoded = encode_binary_labels(labels)
    assert pd.api.types.is_integer_dtype(encoded)
    assert set(encoded.unique()).issubset({0, 1})


def test_input_series_not_modified():
    """Test that the input series remains completely untouched (defensive copy)."""
    original_data = [" BENIGN ", "DDoS"]
    labels = pd.Series(original_data)
    labels_copy = labels.copy(deep=True)
    
    encode_binary_labels(labels)
    
    pd.testing.assert_series_equal(labels, labels_copy)


def test_rejects_empty_series():
    """Test rejection of empty series input."""
    labels = pd.Series([], dtype=str)
    with pytest.raises(AppException) as excinfo:
        encode_binary_labels(labels)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "empty" in excinfo.value.message.lower()


def test_rejects_nan_none_empty_whitespace():
    """Test rejection of NaN, None, empty strings, and whitespace-only labels."""
    invalid_cases = [
        pd.Series(["BENIGN", np.nan]),
        pd.Series(["BENIGN", None]),
        pd.Series(["BENIGN", ""]),
        pd.Series(["BENIGN", "   "]),
        pd.Series(["BENIGN", "\t\n"]),
    ]
    for labels in invalid_cases:
        with pytest.raises(AppException) as excinfo:
            encode_binary_labels(labels)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_rejects_non_string_labels():
    """Test rejection of non-string values."""
    labels = pd.Series(["BENIGN", 1, 2.5])
    with pytest.raises(AppException) as excinfo:
        encode_binary_labels(labels)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "strings" in excinfo.value.message.lower()


def test_rejects_non_series_input():
    """Test rejection of types other than pandas Series."""
    invalid_inputs = [
        ["BENIGN", "DDoS"],
        ("BENIGN", "DDoS"),
        pd.DataFrame({"Label": ["BENIGN", "DDoS"]})
    ]
    for invalid_input in invalid_inputs:
        with pytest.raises(AppException) as excinfo:
            encode_binary_labels(invalid_input)  # type: ignore
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"
        assert "Series" in excinfo.value.message
