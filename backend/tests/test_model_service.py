import numpy as np
import pandas as pd
import pytest

from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.compose import ColumnTransformer

from app.core.exceptions import AppException
from app.services.model_service import (
    encode_binary_labels,
    evaluate_binary_classification,
    ClassificationMetrics,
    ModelTrainingResult,
    train_dummy_classifier,
    train_logistic_regression,
)
from app.services.preprocessing_service import SplitDataResult


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


@pytest.fixture
def synthetic_split_data():
    X_train = pd.DataFrame({"f1": [1.0, 2.0, 3.0, 4.0], "f2": [5.0, 6.0, 7.0, 8.0]})
    y_train = pd.Series([0, 0, 0, 1])  # 0 is the majority class
    X_test = pd.DataFrame({"f1": [9.0, 10.0], "f2": [11.0, 12.0]})
    y_test = pd.Series([1, 0])

    preprocessor = ColumnTransformer([], remainder="drop")

    return SplitDataResult(
        preprocessor=preprocessor,
        X_train=X_train,
        X_test=X_test,
        y_train=y_train,
        y_test=y_test,
        train_indices=(0, 1, 2, 3),
        test_indices=(4, 5)
    )


def test_dummy_classifier_training_success(synthetic_split_data):
    """Test 1: DummyClassifier'ın başarıyla eğitilmesi."""
    result = train_dummy_classifier(synthetic_split_data)
    assert isinstance(result, ModelTrainingResult)


def test_dummy_classifier_estimator_is_dummy(synthetic_split_data):
    """Test 2: Estimator'ın DummyClassifier olması."""
    result = train_dummy_classifier(synthetic_split_data)
    assert isinstance(result.estimator, DummyClassifier)


def test_dummy_classifier_strategy(synthetic_split_data):
    """Test 3: Stratejinin most_frequent olması."""
    result = train_dummy_classifier(synthetic_split_data)
    assert result.estimator.strategy == "most_frequent"


def test_dummy_model_name(synthetic_split_data):
    """Test 4: model_name değerinin dummy_classifier olması."""
    result = train_dummy_classifier(synthetic_split_data)
    assert result.model_name == "dummy_classifier"


def test_dummy_classifier_predictions_length(synthetic_split_data):
    """Test 5: Tahmin sayısının test satırı sayısıyla eşleşmesi."""
    result = train_dummy_classifier(synthetic_split_data)
    assert len(result.predictions) == len(synthetic_split_data.X_test)


def test_dummy_classifier_predictions_is_tuple(synthetic_split_data):
    """Test 6: Tahminlerin immutable tuple olması."""
    result = train_dummy_classifier(synthetic_split_data)
    assert isinstance(result.predictions, tuple)


def test_dummy_classifier_all_majority_class(synthetic_split_data):
    """Test 7: Tahminlerin tamamının training kümesindeki çoğunluk sınıfı olması (0)."""
    result = train_dummy_classifier(synthetic_split_data)
    assert set(result.predictions) == {0}


def test_dummy_classifier_metrics_match(synthetic_split_data):
    """Test 8: Metriklerin mevcut evaluate_binary_classification sonucu ile eşleşmesi."""
    result = train_dummy_classifier(synthetic_split_data)
    expected_metrics = evaluate_binary_classification(
        synthetic_split_data.y_test,
        result.predictions
    )
    assert result.metrics == expected_metrics


def test_dummy_classifier_confusion_matrix(synthetic_split_data):
    """Test 9: Confusion matrix ve tn/fp/fn/tp değerlerinin doğru olması."""
    result = train_dummy_classifier(synthetic_split_data)
    assert result.metrics.tn == 1
    assert result.metrics.fp == 0
    assert result.metrics.fn == 1
    assert result.metrics.tp == 0
    assert result.metrics.confusion_matrix == ((1, 0), (1, 0))


def test_dummy_classifier_deterministic(synthetic_split_data):
    """Test 10: Aynı girdilerle tekrarlanan eğitimin deterministik sonuç üretmesi."""
    res1 = train_dummy_classifier(synthetic_split_data)
    res2 = train_dummy_classifier(synthetic_split_data)
    assert res1.predictions == res2.predictions
    assert res1.metrics == res2.metrics


def test_dummy_classifier_test_targets_not_used(synthetic_split_data):
    """Test 11: Modelin yalnızca training kümesinde fit edilmesi."""
    # Since DummyClassifier fit only accesses y_train to find the majority class,
    # we can pass y_test as all 1s (which would make 1 the majority if mistakenly used).
    # It should still predict 0, which is the majority of y_train.
    split_data_modified = synthetic_split_data
    split_data_modified.y_test[:] = 1
    result = train_dummy_classifier(split_data_modified)
    assert set(result.predictions) == {0}


def test_dummy_classifier_input_not_mutated(synthetic_split_data):
    """Test 12: Girdi SplitDataResult içeriğinin değiştirilmemesi."""
    X_train_copy = synthetic_split_data.X_train.copy(deep=True)
    y_train_copy = synthetic_split_data.y_train.copy(deep=True)
    X_test_copy = synthetic_split_data.X_test.copy(deep=True)
    y_test_copy = synthetic_split_data.y_test.copy(deep=True)

    train_dummy_classifier(synthetic_split_data)

    pd.testing.assert_frame_equal(synthetic_split_data.X_train, X_train_copy)
    pd.testing.assert_series_equal(synthetic_split_data.y_train, y_train_copy)
    pd.testing.assert_frame_equal(synthetic_split_data.X_test, X_test_copy)
    pd.testing.assert_series_equal(synthetic_split_data.y_test, y_test_copy)


def test_dummy_classifier_rejects_empty_splits(synthetic_split_data):
    """Test 13: Boş training veya test kümesinin reddedilmesi."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        X_train=pd.DataFrame()
    )
    with pytest.raises(AppException) as excinfo:
        train_dummy_classifier(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "empty" in excinfo.value.message.lower()


def test_dummy_classifier_rejects_row_mismatch(synthetic_split_data):
    """Test 14: X/y satır sayısı uyuşmazlığının reddedilmesi."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        y_train=pd.Series([0, 1])  # Only 2 rows instead of 4
    )
    with pytest.raises(AppException) as excinfo:
        train_dummy_classifier(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "match" in excinfo.value.message.lower()


def test_dummy_classifier_rejects_feature_mismatch(synthetic_split_data):
    """Test 15: Feature boyutu uyuşmazlığının reddedilmesi."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        X_test=pd.DataFrame({"f1": [9.0, 10.0]})  # Missing f2
    )
    with pytest.raises(AppException) as excinfo:
        train_dummy_classifier(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_dummy_classifier_rejects_non_binary_targets(synthetic_split_data):
    """Test 16: Binary olmayan veya geçersiz hedeflerin reddedilmesi."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        y_train=pd.Series([0, 1, 2, 0])  # Contains 2
    )
    with pytest.raises(AppException) as excinfo:
        train_dummy_classifier(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_dummy_classifier_rejects_single_class_training(synthetic_split_data):
    """Test 17: Training hedefinde yalnızca tek sınıf bulunmasının reddedilmesi."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        y_train=pd.Series([0, 0, 0, 0])  # Only class 0
    )
    with pytest.raises(AppException) as excinfo:
        train_dummy_classifier(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "both classes" in excinfo.value.message.lower()


def test_dummy_classifier_rejects_invalid_input_type():
    """Test 18: SplitDataResult olmayan girdinin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        train_dummy_classifier("not a split data result")  # type: ignore
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_dummy_classifier_validation_error_code(synthetic_split_data):
    """Test 19: Geçersiz girdilerde 422 ve VALIDATION_ERROR sözleşmesinin korunması."""
    with pytest.raises(AppException) as excinfo:
        train_dummy_classifier(None)  # type: ignore
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_training_success(synthetic_split_data):
    """Test 1: Logistic Regression modelinin başarıyla eğitilmesi."""
    result = train_logistic_regression(synthetic_split_data)
    assert isinstance(result, ModelTrainingResult)


def test_lr_estimator_is_lr(synthetic_split_data):
    """Test 2: Estimator'ın LogisticRegression olması."""
    result = train_logistic_regression(synthetic_split_data)
    assert isinstance(result.estimator, LogisticRegression)


def test_lr_default_class_weight(synthetic_split_data):
    """Test 3: Varsayılan class_weight değerinin 'balanced' olması."""
    result = train_logistic_regression(synthetic_split_data)
    assert result.estimator.class_weight == "balanced"


def test_lr_default_params(synthetic_split_data):
    """Test 4: max_iter=1000, solver='lbfgs' ve random_state=42 parametrelerinin doğrulanması."""
    result = train_logistic_regression(synthetic_split_data)
    assert result.estimator.max_iter == 1000
    assert result.estimator.solver == "lbfgs"
    assert result.estimator.random_state == 42


def test_lr_model_name(synthetic_split_data):
    """Test 5: model_name değerinin logistic_regression olması."""
    result = train_logistic_regression(synthetic_split_data)
    assert result.model_name == "logistic_regression"


def test_lr_classes_(synthetic_split_data):
    """Test 6: Estimator'ın classes_ değerlerinin [0, 1] olması."""
    result = train_logistic_regression(synthetic_split_data)
    assert result.estimator.classes_.tolist() == [0, 1]


def test_lr_coef_shape(synthetic_split_data):
    """Test 7: Katsayı feature boyutunun X_train feature sayısıyla eşleşmesi."""
    result = train_logistic_regression(synthetic_split_data)
    assert result.estimator.coef_.shape[1] == synthetic_split_data.X_train.shape[1]


def test_lr_predictions_length(synthetic_split_data):
    """Test 8: Tahmin sayısının X_test satır sayısıyla eşleşmesi."""
    result = train_logistic_regression(synthetic_split_data)
    assert len(result.predictions) == len(synthetic_split_data.X_test)


def test_lr_predictions_type_and_values(synthetic_split_data):
    """Test 9: Tahminlerin immutable tuple ve yalnızca 0/1 olması."""
    result = train_logistic_regression(synthetic_split_data)
    assert isinstance(result.predictions, tuple)
    assert set(result.predictions).issubset({0, 1})


def test_lr_metrics_match(synthetic_split_data):
    """Test 10: Metriklerin evaluate_binary_classification sonucu ile eşleşmesi."""
    result = train_logistic_regression(synthetic_split_data)
    expected_metrics = evaluate_binary_classification(
        synthetic_split_data.y_test,
        result.predictions
    )
    assert result.metrics == expected_metrics


def test_lr_confusion_matrix_structure(synthetic_split_data):
    """Test 11: Confusion matrix ve tn/fp/fn/tp değerlerinin doğru olması."""
    result = train_logistic_regression(synthetic_split_data)
    cm = result.metrics.confusion_matrix
    assert result.metrics.tn == cm[0][0]
    assert result.metrics.fp == cm[0][1]
    assert result.metrics.fn == cm[1][0]
    assert result.metrics.tp == cm[1][1]


def test_lr_deterministic(synthetic_split_data):
    """Test 12: Aynı veri ve parametrelerle deterministik sonuç üretilmesi."""
    res1 = train_logistic_regression(synthetic_split_data)
    res2 = train_logistic_regression(synthetic_split_data)
    assert res1.predictions == res2.predictions
    assert np.allclose(res1.estimator.coef_, res2.estimator.coef_)


def test_lr_test_targets_not_used(synthetic_split_data):
    """Test 13/14: Modelin yalnızca training verisinde fit edilmesi ve y_test'in fit işlemine sızmaması."""
    split_data_modified = synthetic_split_data
    split_data_modified.y_test[:] = 1  # Changing test targets should not change predictions
    res1 = train_logistic_regression(synthetic_split_data)
    res2 = train_logistic_regression(split_data_modified)
    assert res1.predictions == res2.predictions


def test_lr_input_not_mutated(synthetic_split_data):
    """Test 15: Girdi SplitDataResult içeriğinin değiştirilmemesi."""
    X_train_copy = synthetic_split_data.X_train.copy(deep=True)
    y_train_copy = synthetic_split_data.y_train.copy(deep=True)
    X_test_copy = synthetic_split_data.X_test.copy(deep=True)
    y_test_copy = synthetic_split_data.y_test.copy(deep=True)

    train_logistic_regression(synthetic_split_data)

    pd.testing.assert_frame_equal(synthetic_split_data.X_train, X_train_copy)
    pd.testing.assert_series_equal(synthetic_split_data.y_train, y_train_copy)
    pd.testing.assert_frame_equal(synthetic_split_data.X_test, X_test_copy)
    pd.testing.assert_series_equal(synthetic_split_data.y_test, y_test_copy)


def test_lr_supports_none_weight(synthetic_split_data):
    """Test 16: class_weight=None seçeneğinin desteklenmesi."""
    result = train_logistic_regression(synthetic_split_data, class_weight=None)
    assert result.estimator.class_weight is None


def test_lr_supports_dict_weight(synthetic_split_data):
    """Test 17: Geçerli özel sınıf ağırlığının desteklenmesi."""
    custom_weight = {0: 1.0, 1: 5.0}
    result = train_logistic_regression(synthetic_split_data, class_weight=custom_weight)
    assert result.estimator.class_weight == custom_weight


def test_lr_rejects_invalid_string_weight(synthetic_split_data):
    """Test 18: Geçersiz string class weight değerinin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        train_logistic_regression(synthetic_split_data, class_weight="unbalanced")
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_rejects_invalid_dict_keys(synthetic_split_data):
    """Test 19: Eksik veya fazladan dictionary anahtarlarının reddedilmesi."""
    invalid_weights = [{0: 1.0}, {0: 1.0, 1: 1.0, 2: 1.0}, {"0": 1.0, "1": 1.0}]
    for cw in invalid_weights:
        with pytest.raises(AppException) as excinfo:
            train_logistic_regression(synthetic_split_data, class_weight=cw)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_rejects_invalid_dict_values(synthetic_split_data):
    """Test 20: Sıfır, negatif, sonsuz, NaN, boolean ve metin ağırlıkların reddedilmesi."""
    invalid_weights = [
        {0: 0, 1: 1},
        {0: -1.0, 1: 1.0},
        {0: np.inf, 1: 1.0},
        {0: np.nan, 1: 1.0},
        {0: True, 1: 1.0},
        {0: "1.0", 1: 1.0}
    ]
    for cw in invalid_weights:
        with pytest.raises(AppException) as excinfo:
            train_logistic_regression(synthetic_split_data, class_weight=cw)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_rejects_empty_splits(synthetic_split_data):
    """Test 21: Boş veya uyumsuz train/test verisinin reddedilmesi (Empty)."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        X_train=pd.DataFrame()
    )
    with pytest.raises(AppException) as excinfo:
        train_logistic_regression(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_rejects_non_binary_targets(synthetic_split_data):
    """Test 22: Binary olmayan hedeflerin reddedilmesi."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        y_train=pd.Series([0, 1, 2, 0])
    )
    with pytest.raises(AppException) as excinfo:
        train_logistic_regression(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_rejects_single_class_training(synthetic_split_data):
    """Test 23: Tek sınıflı training hedefinin reddedilmesi."""
    import dataclasses
    invalid_split = dataclasses.replace(
        synthetic_split_data,
        y_train=pd.Series([0, 0, 0, 0])
    )
    with pytest.raises(AppException) as excinfo:
        train_logistic_regression(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_rejects_invalid_feature_values(synthetic_split_data):
    """Test 24: Sayısal olmayan veya sonlu olmayan feature değerlerinin reddedilmesi."""
    import dataclasses
    invalid_splits = [
        dataclasses.replace(synthetic_split_data, X_train=pd.DataFrame({"f1": [np.nan, 2, 3, 4], "f2": [5, 6, 7, 8]})),
        dataclasses.replace(synthetic_split_data, X_train=pd.DataFrame({"f1": [np.inf, 2, 3, 4], "f2": [5, 6, 7, 8]})),
        dataclasses.replace(synthetic_split_data, X_train=pd.DataFrame({"f1": ["a", "b", "c", "d"], "f2": [5, 6, 7, 8]}))
    ]
    for inv in invalid_splits:
        with pytest.raises(AppException) as excinfo:
            train_logistic_regression(inv)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_validation_error_code(synthetic_split_data):
    """Test 25: Geçersiz girdilerde 422 ve VALIDATION_ERROR sözleşmesinin korunması."""
    with pytest.raises(AppException) as excinfo:
        train_logistic_regression("invalid")  # type: ignore
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_no_warnings(synthetic_split_data):
    """Test 27: Eğitim sırasında hiçbir warning oluşmaması (ConvergenceWarning vs)."""
    # -W error parametresiyle test edildiği için warning oluşursa test doğrudan patlar
    train_logistic_regression(synthetic_split_data)
