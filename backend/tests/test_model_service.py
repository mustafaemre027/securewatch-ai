import numpy as np
import pandas as pd
import pytest

from app.core.exceptions import AppException
from app.services.model_service import encode_binary_labels, evaluate_binary_classification, ClassificationMetrics


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
        assert "Series" in excinfo.value.message


def test_evaluate_perfect_predictions():
    """Test 1: Tamamen doğru tahminlerde bütün metriklerin 1.0 olması."""
    y_true = [1, 0, 1, 0]
    y_pred = [1, 0, 1, 0]
    metrics = evaluate_binary_classification(y_true, y_pred)
    assert metrics.accuracy == 1.0
    assert metrics.precision == 1.0
    assert metrics.recall == 1.0
    assert metrics.f1_score == 1.0
    assert metrics.tn == 2
    assert metrics.fp == 0
    assert metrics.fn == 0
    assert metrics.tp == 2


def test_evaluate_known_values():
    """Test 2: Bilinen örnek üzerinden accuracy, precision, recall ve F1 değerlerinin doğrulanması."""
    y_true = [1, 1, 0, 0, 1, 0]
    y_pred = [1, 0, 0, 1, 1, 0]
    metrics = evaluate_binary_classification(y_true, y_pred)
    assert np.isclose(metrics.accuracy, 4 / 6)
    assert np.isclose(metrics.precision, 2 / 3)
    assert np.isclose(metrics.recall, 2 / 3)
    assert np.isclose(metrics.f1_score, 2 * (2/3 * 2/3) / (2/3 + 2/3))


def test_confusion_matrix_order():
    """Test 3: Confusion matrix sırasının tam olarak [[TN, FP], [FN, TP]] olması."""
    y_true = [1, 1, 0, 0, 1, 0]
    y_pred = [1, 0, 0, 1, 1, 0]
    metrics = evaluate_binary_classification(y_true, y_pred)
    assert metrics.confusion_matrix == ((2, 1), (1, 2))


def test_confusion_matrix_elements_match():
    """Test 4: tn, fp, fn, tp alanlarının matrix ile eşleşmesi."""
    y_true = [1, 0, 0, 1]
    y_pred = [1, 1, 0, 0]
    metrics = evaluate_binary_classification(y_true, y_pred)
    assert metrics.tn == metrics.confusion_matrix[0][0]
    assert metrics.fp == metrics.confusion_matrix[0][1]
    assert metrics.fn == metrics.confusion_matrix[1][0]
    assert metrics.tp == metrics.confusion_matrix[1][1]


def test_zero_division_handling():
    """Test 5: Bütün tahminlerin 0 olduğu durumda warning oluşmadan hesaplanması."""
    y_true = [1, 1, 1]
    y_pred = [0, 0, 0]

    # -W error parametresiyle çalıştırıldığı için warning fırlatırsa test doğrudan hata verir.
    metrics = evaluate_binary_classification(y_true, y_pred)

    assert metrics.precision == 0.0
    assert metrics.recall == 0.0
    assert metrics.f1_score == 0.0


def test_missing_class_in_test_set():
    """Test 6: Test setinde sınıflardan biri bulunmasa bile 2x2 confusion matrix üretilmesi."""
    y_true = [0, 0, 0]
    y_pred = [0, 1, 0]
    metrics = evaluate_binary_classification(y_true, y_pred)
    assert metrics.confusion_matrix == ((2, 1), (0, 0))


def test_different_input_types():
    """Test 7: Liste, tuple, NumPy array ve pandas Series girdilerinin desteklenmesi."""
    y_true_list = [1, 0]
    y_pred_list = [1, 0]
    m1 = evaluate_binary_classification(y_true_list, y_pred_list)

    y_true_tuple = (1, 0)
    y_pred_tuple = (1, 0)
    m2 = evaluate_binary_classification(y_true_tuple, y_pred_tuple)

    y_true_np = np.array([1, 0])
    y_pred_np = np.array([1, 0])
    m3 = evaluate_binary_classification(y_true_np, y_pred_np)

    y_true_pd = pd.Series([1, 0])
    y_pred_pd = pd.Series([1, 0])
    m4 = evaluate_binary_classification(y_true_pd, y_pred_pd)

    assert m1.accuracy == m2.accuracy == m3.accuracy == m4.accuracy == 1.0


def test_native_python_types():
    """Test 8: Metrik ve confusion değerlerinin Python temel tiplerine dönüştürülmesi."""
    y_true = np.array([1, 0], dtype=np.int32)
    y_pred = np.array([1, 0], dtype=np.int32)
    metrics = evaluate_binary_classification(y_true, y_pred)
    assert type(metrics.accuracy) is float
    assert type(metrics.tn) is int
    assert type(metrics.confusion_matrix[0][0]) is int


def test_immutable_metrics_structure():
    """Test 9: Sonuç yapısının immutable olması."""
    y_true = [1, 0]
    y_pred = [1, 0]
    metrics = evaluate_binary_classification(y_true, y_pred)
    import dataclasses
    with pytest.raises(dataclasses.FrozenInstanceError):
        metrics.accuracy = 0.5  # type: ignore


def test_inputs_not_mutated():
    """Test 10: Girdilerin değiştirilmemesi."""
    y_true = pd.Series([1, 0])
    y_pred = pd.Series([1, 0])
    y_true_copy = y_true.copy(deep=True)
    y_pred_copy = y_pred.copy(deep=True)
    evaluate_binary_classification(y_true, y_pred)
    pd.testing.assert_series_equal(y_true, y_true_copy)
    pd.testing.assert_series_equal(y_pred, y_pred_copy)


def test_rejects_empty_inputs():
    """Test 11: Boş girdinin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        evaluate_binary_classification([], [])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "empty" in excinfo.value.message.lower()


def test_rejects_mismatched_lengths():
    """Test 12: Farklı uzunluktaki girdilerin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        evaluate_binary_classification([1, 0], [1])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "length" in excinfo.value.message.lower()


def test_rejects_nan_none_inf_text():
    """Test 13: NaN, None, sonsuz ve metin değerlerin reddedilmesi."""
    invalid_inputs = [
        ([1, np.nan], [1, 0]),
        ([1, None], [1, 0]),
        ([1, np.inf], [1, 0]),
        ([1, "0"], [1, 0]),
        (["1", "0"], ["1", "0"])
    ]
    for y_true, y_pred in invalid_inputs:
        with pytest.raises(AppException) as excinfo:
            evaluate_binary_classification(y_true, y_pred)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_rejects_invalid_class_values():
    """Test 14: 0 ve 1 dışındaki sınıf değerlerinin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        evaluate_binary_classification([1, 2], [1, 0])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "0 and 1" in excinfo.value.message


def test_rejects_multidimensional_inputs():
    """Test 15: İki boyutlu veya uygun olmayan girdilerin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        evaluate_binary_classification([[1, 0]], [[1, 0]])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "1-dimensional" in excinfo.value.message


def test_invalid_input_structure():
    """Test 16: Geçersiz girdilerde 422 ve VALIDATION_ERROR sözleşmesinin korunması."""
    with pytest.raises(AppException) as excinfo:
        evaluate_binary_classification(object(), [1, 0])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
