import json
import numpy as np
import pandas as pd
import dataclasses
import pytest
import unittest.mock

from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.compose import ColumnTransformer

from app.core.exceptions import AppException
from app.services.model_service import (
    encode_binary_labels,
    evaluate_binary_classification,
    ClassificationMetrics,
    RocCurvePoint,
    PrecisionRecallCurvePoint,
    ProbabilityEvaluationMetrics,
    extract_positive_probabilities,
    evaluate_probability_metrics,
    DEFAULT_THRESHOLD_CANDIDATES,
    OutOfFoldProbabilityResult,
    ThresholdEvaluationResult,
    ThresholdSelectionResult,
    generate_out_of_fold_probabilities,
    validate_threshold_candidates,
    select_decision_threshold,
    ModelCandidateConfig,
    ModelEvaluationCandidateResult,
    FinalModelSelectionResult,
    EXPECTED_DAY10_VARIANTS,
    get_day10_model_candidates,
    validate_model_candidates,
    evaluate_model_candidates,
    select_final_model,
    run_final_model_selection,
    ModelTrainingResult,
    train_dummy_classifier,
    train_logistic_regression,
    train_random_forest,
    RandomForestExperimentConfig,
    RandomForestExperimentResult,
    run_random_forest_experiments,
    ModelComparisonRow,
    ModelComparisonReport,
    FullModelComparisonReport,
    compare_models,
    run_model_comparison,
    comparison_report_to_dict,
    RISK_LEVEL_LOW,
    RISK_LEVEL_MEDIUM,
    RISK_LEVEL_HIGH,
    RISK_LEVEL_CRITICAL,
    classify_risk_level,
    get_risk_level_policy_dict,
    run_final_model_selection_workflow,
    final_model_selection_report_to_dict,
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


# =============================================================================
# Random Forest Classifier Tests
# =============================================================================
from sklearn.ensemble import RandomForestClassifier


def test_rf_successful_training(synthetic_split_data):
    """Test 28: Başarılı Random Forest eğitimi ve doğru yapılandırma."""
    result = train_random_forest(synthetic_split_data)

    assert result.model_name == "random_forest"
    assert isinstance(result.estimator, RandomForestClassifier)
    assert isinstance(result.predictions, tuple)
    assert set(result.predictions).issubset({0, 1})

    assert isinstance(result.training_duration_seconds, float)
    assert result.training_duration_seconds >= 0.0

    # Varsayılan hiperparametrelerin doğrulanması
    assert result.estimator.n_estimators == 100
    assert result.estimator.max_depth == 10
    assert result.estimator.min_samples_split == 2
    assert result.estimator.min_samples_leaf == 1
    assert result.estimator.class_weight == "balanced"
    assert result.estimator.random_state == 42
    assert result.estimator.n_jobs == -1


def test_rf_feature_importances(synthetic_split_data):
    """Test 29: Feature importance altyapısı ve sıralama doğrulaması."""
    result = train_random_forest(synthetic_split_data)

    assert result.feature_importances is not None
    assert isinstance(result.feature_importances, tuple)

    expected_count = len(synthetic_split_data.X_train.columns)
    assert len(result.feature_importances) == expected_count

    total_importance = sum(record.importance for record in result.feature_importances)
    assert np.isclose(total_importance, 1.0)

    for i in range(len(result.feature_importances) - 1):
        curr = result.feature_importances[i]
        nxt = result.feature_importances[i+1]
        assert isinstance(curr.feature_name, str)
        assert isinstance(curr.importance, float)
        assert curr.importance >= 0.0
        # Sıralama doğrulaması: önce importance (azalan), sonra isim (artan)
        if np.isclose(curr.importance, nxt.importance):
            assert curr.feature_name <= nxt.feature_name
        else:
            assert curr.importance >= nxt.importance


def test_rf_metrics_match(synthetic_split_data):
    """Test 30: Metriklerin mevcut evaluate_binary_classification fonksiyonuyla eşleşmesi."""
    result = train_random_forest(synthetic_split_data)
    expected_metrics = evaluate_binary_classification(
        synthetic_split_data.y_test,
        result.predictions
    )
    assert result.metrics == expected_metrics


def test_rf_deterministic(synthetic_split_data):
    """Test 31: Aynı girdi ve random_state ile sonuçların birebir aynı (deterministik) olması."""
    result1 = train_random_forest(synthetic_split_data, random_state=42)
    result2 = train_random_forest(synthetic_split_data, random_state=42)

    assert result1.predictions == result2.predictions
    assert result1.feature_importances == result2.feature_importances
    assert result1.metrics == result2.metrics


def test_rf_defensive_copy(synthetic_split_data):
    """Test 32: Eğitim ve test girdilerinin hiçbir şekilde değiştirilmemesi."""
    X_train_clean = synthetic_split_data.X_train.copy(deep=True)
    y_train_clean = synthetic_split_data.y_train.copy(deep=True)
    X_test_clean = synthetic_split_data.X_test.copy(deep=True)

    train_random_forest(synthetic_split_data)

    pd.testing.assert_frame_equal(synthetic_split_data.X_train, X_train_clean)
    pd.testing.assert_series_equal(synthetic_split_data.y_train, y_train_clean)
    pd.testing.assert_frame_equal(synthetic_split_data.X_test, X_test_clean)


def test_rf_rejects_invalid_hyperparameters(synthetic_split_data):
    """Test 33: Geçersiz RF hiperparametrelerinin reddedilmesi."""
    invalid_cases = [
        {"n_estimators": 0},
        {"n_estimators": -5},
        {"n_estimators": 50.5},
        {"n_estimators": True},
        {"max_depth": -1},
        {"max_depth": 0},
        {"max_depth": "10"},
        {"min_samples_split": 1},
        {"min_samples_split": -2},
        {"min_samples_leaf": 0},
        {"min_samples_leaf": -1},
        {"random_state": "42"},
        {"random_state": None},
        {"n_jobs": 0},
        {"n_jobs": "1"},
    ]

    for kwargs in invalid_cases:
        with pytest.raises(AppException) as excinfo:
            train_random_forest(synthetic_split_data, **kwargs)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_rf_rejects_invalid_class_weight(synthetic_split_data):
    """Test 34: Geçersiz sınıf ağırlığının reddedilmesi (mevcut doğrulama tekrarı)."""
    invalid_weights = [
        "unbalanced",
        {0: 1.0},
        {0: -1.0, 1: 1.0},
        {0: "a", 1: "b"}
    ]
    for cw in invalid_weights:
        with pytest.raises(AppException) as excinfo:
            train_random_forest(synthetic_split_data, class_weight=cw)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_rf_rejects_invalid_data(synthetic_split_data):
    """Test 35: Boş küme, tek sınıflı hedef veya non-binary hedeflerin _validate_training_data üzerinden reddedilmesi."""
    import dataclasses

    # 1. Boş split
    empty_split = dataclasses.replace(synthetic_split_data, X_train=pd.DataFrame())
    with pytest.raises(AppException):
        train_random_forest(empty_split)

    # 2. Non-binary hedefler
    non_binary_split = dataclasses.replace(synthetic_split_data, y_train=pd.Series([0, 1, 2, 0]))
    with pytest.raises(AppException):
        train_random_forest(non_binary_split)

    # 3. Tek sınıflı hedefler
    single_class_split = dataclasses.replace(synthetic_split_data, y_train=pd.Series([0, 0, 0, 0]))
    with pytest.raises(AppException):
        train_random_forest(single_class_split)


# =============================================================================
# Model Comparison Tests
# =============================================================================

def test_compare_models_structure_and_count(synthetic_split_data):
    """Test 42: Servisin tam olarak 5 satır döndürmesi ve belirlenen deterministik sırada olması."""
    report = compare_models(synthetic_split_data)
    assert isinstance(report, ModelComparisonReport)
    assert len(report.rows) == 5

    expected_variants = ["lr_baseline", "rf_baseline", "rf_deeper", "rf_unweighted", "rf_compact"]
    actual_variants = [r.variant_name for r in report.rows]
    assert actual_variants == expected_variants

    assert report.rows[0].model_name == "logistic_regression"
    for r in report.rows[1:]:
        assert r.model_name == "random_forest"

    # Check no 'best_model' or 'winner' field exists
    assert not hasattr(report, "best_model")
    assert not hasattr(report, "winner")
    for r in report.rows:
        assert not hasattr(r, "is_best")


def test_compare_models_row_content(synthetic_split_data):
    """Test 43: Her satırda metrik, confusion_matrix ve negatif olmayan eğitim süresi bulunması.
       Ayrıca, estimator, ham veri veya tahmin dizisinin saklanmaması."""
    report = compare_models(synthetic_split_data)
    for r in report.rows:
        assert isinstance(r.training_duration_seconds, float)
        assert r.training_duration_seconds >= 0.0

        assert isinstance(r.accuracy, float)
        assert isinstance(r.precision, float)
        assert isinstance(r.recall, float)
        assert isinstance(r.f1_score, float)

        assert isinstance(r.confusion_matrix, tuple)
        assert len(r.confusion_matrix) == 2
        assert len(r.confusion_matrix[0]) == 2
        assert len(r.confusion_matrix[1]) == 2

        # Check exclusion of large/mutable objects
        assert not hasattr(r, "estimator")
        assert not hasattr(r, "predictions")
        assert not hasattr(r, "metrics")


def test_compare_models_hyperparameters(synthetic_split_data):
    """Test 44: Hiperparametrelerin deterministik ve beklenen konfigürasyonlarla eşleşmesi."""
    report = compare_models(synthetic_split_data)

    lr_row = report.rows[0]
    assert isinstance(lr_row.hyperparameters, tuple)
    lr_params_dict = dict(lr_row.hyperparameters)
    assert lr_params_dict["class_weight"] == "balanced"
    assert lr_params_dict["max_iter"] == 1000
    assert lr_params_dict["solver"] == "lbfgs"

    rf_baseline_row = report.rows[1]
    rf_params_dict = dict(rf_baseline_row.hyperparameters)
    assert rf_params_dict["n_estimators"] == 100
    assert rf_params_dict["max_depth"] == 10
    assert rf_params_dict["class_weight"] == "balanced"

    rf_deeper_row = report.rows[2]
    rf_deeper_dict = dict(rf_deeper_row.hyperparameters)
    assert rf_deeper_dict["max_depth"] == 20


def test_compare_models_defensive_copy(synthetic_split_data):
    """Test 45: Kaynak verilerin değiştirilmemesi."""
    X_train_clean = synthetic_split_data.X_train.copy(deep=True)
    y_train_clean = synthetic_split_data.y_train.copy(deep=True)
    X_test_clean = synthetic_split_data.X_test.copy(deep=True)

    compare_models(synthetic_split_data)

    pd.testing.assert_frame_equal(synthetic_split_data.X_train, X_train_clean)
    pd.testing.assert_series_equal(synthetic_split_data.y_train, y_train_clean)
    pd.testing.assert_frame_equal(synthetic_split_data.X_test, X_test_clean)


def test_compare_models_determinism(synthetic_split_data):
    """Test 46: Aynı girdiyle sıra ve metriklerin deterministik olması."""
    report1 = compare_models(synthetic_split_data)
    report2 = compare_models(synthetic_split_data)

    assert len(report1.rows) == len(report2.rows)
    for r1, r2 in zip(report1.rows, report2.rows):
        assert r1.model_name == r2.model_name
        assert r1.variant_name == r2.variant_name
        assert r1.hyperparameters == r2.hyperparameters
        assert r1.accuracy == r2.accuracy
        assert r1.precision == r2.precision
        assert r1.recall == r2.recall
        assert r1.f1_score == r2.f1_score
        assert r1.confusion_matrix == r2.confusion_matrix


def test_compare_models_bubbles_up_errors(synthetic_split_data):
    """Test 47: Alt model hatalarının sessizce yutulmaması."""
    import dataclasses
    invalid_split = dataclasses.replace(synthetic_split_data, y_train=pd.Series([0, 1, 2, 0]))
    with pytest.raises(AppException) as excinfo:
        compare_models(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_lr_timing_mock(synthetic_split_data):
    """Test 48: Lojistik Regreşın eğitim süresinin yalnızca fit çağrısını kapsadığının mock ile doğrulanması."""
    import time
    from unittest.mock import patch

    def fake_fit(self, X, y):
        time.sleep(0.1)
        return self

    def fake_predict(self, X):
        return np.zeros(len(synthetic_split_data.y_test))

    with patch("sklearn.linear_model.LogisticRegression.fit", new=fake_fit), \
         patch("sklearn.linear_model.LogisticRegression.predict", new=fake_predict):
        res = train_logistic_regression(synthetic_split_data)

        assert res.training_duration_seconds is not None
        assert res.training_duration_seconds >= 0.1
        # It shouldn't take much more than the sleep, allowing generous buffer for CI
        assert res.training_duration_seconds < 0.5


def test_run_model_comparison_end_to_end():
    """Test 49: End to end preprocessing and run comparison."""
    from app.services.csv_validation_service import CICIDS2017_FEATURE_COLUMNS, CICIDS2017_OPTIONAL_LABEL
    rng = np.random.default_rng(0)
    data = {col: rng.uniform(0, 100, size=6).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    data[CICIDS2017_OPTIONAL_LABEL] = ["BENIGN", "BENIGN", "Attack", "BENIGN", "Attack", "Attack"]
    df = pd.DataFrame(data)

    report = run_model_comparison(df)

    assert isinstance(report, FullModelComparisonReport)
    assert report.initial_row_count == 6
    assert report.final_row_count == 6
    assert report.feature_count == 77
    assert len(report.comparison.rows) == 5

    # Check feature importances for RF
    for row in report.comparison.rows:
        if row.model_name == "random_forest":
            assert row.feature_importances is not None
            assert len(row.feature_importances) <= 10
        else:
            assert row.feature_importances is None


def test_comparison_report_to_dict():
    """Test 50: Serialize report to dict, allow_nan=False safe."""
    import json
    from app.services.csv_validation_service import CICIDS2017_FEATURE_COLUMNS, CICIDS2017_OPTIONAL_LABEL
    rng = np.random.default_rng(0)
    data = {col: rng.uniform(0, 100, size=6).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    data[CICIDS2017_OPTIONAL_LABEL] = ["BENIGN", "BENIGN", "Attack", "BENIGN", "Attack", "Attack"]
    df = pd.DataFrame(data)

    report = run_model_comparison(df)
    report_dict = comparison_report_to_dict(report)

    # Should not throw any exception when serialized
    json_str = json.dumps(report_dict, allow_nan=False)
    assert "logistic_regression" in json_str
    assert "random_forest" in json_str
    assert "feature_importances" in json_str


# =============================================================================
# Random Forest Experiments Tests
# =============================================================================

def test_rf_experiments_count_and_names(synthetic_split_data):
    """Test 36: Servisin tam olarak dört deney sonucu döndürmesi ve isimlerinin deterministik olması."""
    results = run_random_forest_experiments(synthetic_split_data)
    assert len(results) == 4
    expected_names = ["rf_baseline", "rf_deeper", "rf_unweighted", "rf_compact"]
    actual_names = [res.config.experiment_name for res in results]
    assert actual_names == expected_names


def test_rf_experiments_hyperparameters(synthetic_split_data):
    """Test 37: Her adayın beklenen hiperparametrelerle çalışması ve Random Forest estimator içermesi."""
    results = run_random_forest_experiments(synthetic_split_data)

    # baseline
    assert results[0].training_result.estimator.n_estimators == 100
    assert results[0].training_result.estimator.max_depth == 10
    assert results[0].training_result.estimator.class_weight == "balanced"

    # deeper
    assert results[1].training_result.estimator.max_depth == 20

    # unweighted
    assert results[2].training_result.estimator.class_weight is None

    # compact
    assert results[3].training_result.estimator.n_estimators == 50
    assert results[3].training_result.estimator.max_depth == 5


def test_rf_experiments_result_structure(synthetic_split_data):
    """Test 38: Her sonuçta tahmin, metrik, eğitim süresi ve feature importance bulunması."""
    results = run_random_forest_experiments(synthetic_split_data)
    for res in results:
        tr = res.training_result
        assert isinstance(tr.estimator, RandomForestClassifier)
        assert len(tr.predictions) == len(synthetic_split_data.y_test)
        assert isinstance(tr.metrics, ClassificationMetrics)

        assert isinstance(tr.training_duration_seconds, float)
        assert tr.training_duration_seconds >= 0.0

        assert tr.feature_importances is not None
        assert len(tr.feature_importances) == len(synthetic_split_data.X_train.columns)
        total_imp = sum(f.importance for f in tr.feature_importances)
        assert np.isclose(total_imp, 1.0)

        # Check ordering of feature importances
        for i in range(len(tr.feature_importances) - 1):
            curr = tr.feature_importances[i]
            nxt = tr.feature_importances[i+1]
            if np.isclose(curr.importance, nxt.importance):
                assert curr.feature_name <= nxt.feature_name
            else:
                assert curr.importance >= nxt.importance


def test_rf_experiments_determinism(synthetic_split_data):
    """Test 39: Aynı veriyle iki çalıştırmada deney sırasının ve tahminlerin aynı olması."""
    results1 = run_random_forest_experiments(synthetic_split_data)
    results2 = run_random_forest_experiments(synthetic_split_data)

    assert len(results1) == len(results2)
    for r1, r2 in zip(results1, results2):
        assert r1.config.experiment_name == r2.config.experiment_name
        assert r1.training_result.predictions == r2.training_result.predictions


def test_rf_experiments_defensive_copy(synthetic_split_data):
    """Test 40: Girdi SplitDataResult nesnesinin değiştirilmemesi."""
    X_train_clean = synthetic_split_data.X_train.copy(deep=True)
    y_train_clean = synthetic_split_data.y_train.copy(deep=True)
    X_test_clean = synthetic_split_data.X_test.copy(deep=True)

    run_random_forest_experiments(synthetic_split_data)

    pd.testing.assert_frame_equal(synthetic_split_data.X_train, X_train_clean)
    pd.testing.assert_series_equal(synthetic_split_data.y_train, y_train_clean)
    pd.testing.assert_frame_equal(synthetic_split_data.X_test, X_test_clean)


def test_rf_experiments_bubbles_up_errors(synthetic_split_data):
    """Test 41: Deneylerden birinde hata oluşursa hatanın sessizce yutulmaması."""
    import dataclasses
    invalid_split = dataclasses.replace(synthetic_split_data, y_train=pd.Series([0, 1, 2, 0]))
    with pytest.raises(AppException) as excinfo:
        run_random_forest_experiments(invalid_split)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


# --- Probability Extraction Tests ---

def test_extract_probabilities_logistic_regression():
    """Test 42: Lojistik Regresyondan olasılık çıkarılması."""
    X = pd.DataFrame({"feat1": [0.1, 0.5, 0.9, 0.2], "feat2": [1.0, 2.0, 3.0, 1.5]})
    y = pd.Series([0, 1, 1, 0])
    clf = LogisticRegression()
    clf.fit(X, y)
    probs = extract_positive_probabilities(clf, X)
    assert isinstance(probs, tuple)
    assert len(probs) == len(X)
    assert all(isinstance(p, float) for p in probs)
    assert all(0.0 <= p <= 1.0 for p in probs)


def test_extract_probabilities_random_forest():
    """Test 43: Random Forest’tan olasılık çıkarılması."""
    X = pd.DataFrame({"feat1": [0.1, 0.5, 0.9, 0.2], "feat2": [1.0, 2.0, 3.0, 1.5]})
    y = pd.Series([0, 1, 1, 0])
    clf = RandomForestClassifier(n_estimators=5, random_state=42)
    clf.fit(X, y)
    probs = extract_positive_probabilities(clf, X)
    assert isinstance(probs, tuple)
    assert len(probs) == len(X)
    assert all(isinstance(p, float) for p in probs)
    assert all(0.0 <= p <= 1.0 for p in probs)


def test_extract_probabilities_reverse_classes():
    """Test 44: Ters classes_ sıralamasında pozitif sınıfın doğru bulunması."""
    class DummyRevModel:
        classes_ = np.array([1, 0])
        def predict_proba(self, X):
            # Column 0 corresponds to class 1, column 1 corresponds to class 0
            return np.array([[0.8, 0.2], [0.3, 0.7]])

    probs = extract_positive_probabilities(DummyRevModel(), [[1], [2]])
    assert probs == (0.8, 0.3)
    assert all(type(p) is float for p in probs)


def test_extract_probabilities_rejects_no_predict_proba():
    """Test 45: predict_proba bulunmayan estimatorın reddedilmesi."""
    class DummyNoProba:
        classes_ = np.array([0, 1])

    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyNoProba(), [[1], [2]])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "predict_proba" in excinfo.value.message


def test_extract_probabilities_rejects_invalid_classes():
    """Test 46: Geçersiz veya eksik classes_ değerlerinin reddedilmesi."""
    class DummyMissingClasses:
        def predict_proba(self, X): return np.array([[0.5, 0.5]])
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyMissingClasses(), [[1]])
    assert excinfo.value.status_code == 422

    class DummySingleClass:
        classes_ = np.array([0])
        def predict_proba(self, X): return np.array([[1.0]])
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummySingleClass(), [[1]])
    assert excinfo.value.status_code == 422

    class DummyThreeClasses:
        classes_ = np.array([0, 1, 2])
        def predict_proba(self, X): return np.array([[0.3, 0.3, 0.4]])
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyThreeClasses(), [[1]])
    assert excinfo.value.status_code == 422


def test_extract_probabilities_rejects_invalid_proba_shape():
    """Test 47: Hatalı predict_proba boyutunun reddedilmesi."""
    class DummyBadCols:
        classes_ = np.array([0, 1])
        def predict_proba(self, X): return np.array([[0.5], [0.5]])  # 1 col instead of 2
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyBadCols(), [[1], [2]])
    assert excinfo.value.status_code == 422

    class DummyBadRows:
        classes_ = np.array([0, 1])
        def predict_proba(self, X): return np.array([[0.5, 0.5]])  # 1 row for 2 inputs
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyBadRows(), [[1], [2]])
    assert excinfo.value.status_code == 422


def test_extract_probabilities_rejects_nan_inf_out_of_range():
    """Test 48: NaN, inf ve aralık dışı olasılıkların reddedilmesi."""
    class DummyNaN:
        classes_ = np.array([0, 1])
        def predict_proba(self, X): return np.array([[0.5, np.nan]])
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyNaN(), [[1]])
    assert excinfo.value.status_code == 422

    class DummyInf:
        classes_ = np.array([0, 1])
        def predict_proba(self, X): return np.array([[0.5, np.inf]])
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyInf(), [[1]])
    assert excinfo.value.status_code == 422

    class DummyOutRange:
        classes_ = np.array([0, 1])
        def predict_proba(self, X): return np.array([[-0.1, 1.1]])
    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(DummyOutRange(), [[1]])
    assert excinfo.value.status_code == 422


# --- Probability Metrics Evaluation Tests ---

def test_evaluate_probability_metrics_correct_roc_auc():
    """Test 49: Bilinen örnek üzerinde doğru ROC-AUC."""
    y_true = [0, 0, 1, 1]
    probs = [0.1, 0.2, 0.8, 0.9]
    res = evaluate_probability_metrics(y_true, probs)
    assert res.roc_auc == 1.0
    assert type(res.roc_auc) is float

    y_true_mixed = [0, 1, 0, 1]
    probs_mixed = [0.2, 0.5, 0.6, 0.8] # 1 incorrect ranking out of 4 pairs -> AUC 0.75
    res_mixed = evaluate_probability_metrics(y_true_mixed, probs_mixed)
    assert abs(res_mixed.roc_auc - 0.75) < 1e-6


def test_evaluate_probability_metrics_correct_ap():
    """Test 50: Bilinen örnek üzerinde doğru Average Precision."""
    y_true = [0, 1, 0, 1]
    probs = [0.1, 0.9, 0.2, 0.8] # perfect ranking for positives
    res = evaluate_probability_metrics(y_true, probs)
    assert res.average_precision == 1.0
    assert type(res.average_precision) is float


def test_evaluate_probability_metrics_curve_structures():
    """Test 51: ROC ve Precision-Recall noktalarının doğru yapıda olması."""
    y_true = [0, 1, 0, 1]
    probs = [0.1, 0.4, 0.35, 0.8]
    res = evaluate_probability_metrics(y_true, probs)

    assert isinstance(res.roc_curve, tuple)
    assert len(res.roc_curve) > 0
    for pt in res.roc_curve:
        assert isinstance(pt, RocCurvePoint)
        assert 0.0 <= pt.false_positive_rate <= 1.0
        assert 0.0 <= pt.true_positive_rate <= 1.0
        assert pt.threshold is None or (0.0 <= pt.threshold <= 1.0)

    assert isinstance(res.precision_recall_curve, tuple)
    assert len(res.precision_recall_curve) > 0
    for pt in res.precision_recall_curve:
        assert isinstance(pt, PrecisionRecallCurvePoint)
        assert 0.0 <= pt.precision <= 1.0
        assert 0.0 <= pt.recall <= 1.0
        assert pt.threshold is None or (0.0 <= pt.threshold <= 1.0)


def test_evaluate_probability_metrics_roc_initial_threshold_none():
    """Test 52: ROC başlangıç sonsuz threshold değerinin None olması."""
    y_true = [0, 0, 1, 1]
    probs = [0.1, 0.2, 0.8, 0.9]
    res = evaluate_probability_metrics(y_true, probs)
    assert res.roc_curve[0].threshold is None


def test_evaluate_probability_metrics_pr_final_threshold_none():
    """Test 53: PR eğrisinin son threshold değerinin None olması."""
    y_true = [0, 0, 1, 1]
    probs = [0.1, 0.2, 0.8, 0.9]
    res = evaluate_probability_metrics(y_true, probs)
    assert res.precision_recall_curve[-1].threshold is None


def test_evaluate_probability_metrics_fpr_formula_matches_cm():
    """Test 54: FPR formülünün confusion matrix ile eşleşmesi (FP / (FP + TN))."""
    y_true = [0, 0, 0, 0, 1, 1]
    probs = [0.6, 0.7, 0.2, 0.1, 0.8, 0.9] # threshold 0.5 -> FP is 2, TN is 2
    res = evaluate_probability_metrics(y_true, probs, threshold=0.5)
    cm = res.classification_metrics.confusion_matrix
    tn, fp = cm[0][0], cm[0][1]
    expected_fpr = fp / (fp + tn)
    assert abs(res.false_positive_rate - expected_fpr) < 1e-9
    assert abs(res.false_positive_rate - 0.5) < 1e-9


def test_evaluate_probability_metrics_score_gte_threshold_boundary():
    """Test 55: score >= threshold sınır davranışı."""
    y_true = [0, 1]
    probs = [0.5, 0.5]
    # At threshold 0.5, score >= 0.5 should predict 1 for both
    res = evaluate_probability_metrics(y_true, probs, threshold=0.5)
    assert res.classification_metrics.tp == 1
    assert res.classification_metrics.fp == 1

    # At threshold 0.51, score >= 0.51 should predict 0 for both
    res_high = evaluate_probability_metrics(y_true, probs, threshold=0.51)
    assert res_high.classification_metrics.tp == 0
    assert res_high.classification_metrics.fn == 1


def test_evaluate_probability_metrics_rejects_single_class_target():
    """Test 56: Tek sınıflı hedeflerin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([0, 0, 0], [0.1, 0.2, 0.3])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "both 0 and 1" in excinfo.value.message

    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([1, 1, 1], [0.8, 0.9, 0.7])
    assert excinfo.value.status_code == 422


def test_evaluate_probability_metrics_rejects_length_mismatch():
    """Test 57: Farklı uzunluktaki girişlerin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([0, 1], [0.5, 0.6, 0.7])
    assert excinfo.value.status_code == 422
    assert "same length" in excinfo.value.message


def test_evaluate_probability_metrics_rejects_invalid_threshold():
    """Test 58: Geçersiz karar eşiğinin reddedilmesi."""
    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([0, 1], [0.2, 0.8], threshold=-0.1)
    assert excinfo.value.status_code == 422

    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([0, 1], [0.2, 0.8], threshold=1.1)
    assert excinfo.value.status_code == 422

    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([0, 1], [0.2, 0.8], threshold=np.nan)
    assert excinfo.value.status_code == 422

    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([0, 1], [0.2, 0.8], threshold="invalid")
    assert excinfo.value.status_code == 422


def test_evaluate_probability_metrics_returns_python_native_types():
    """Test 59: NumPy scalar yerine Python-native değerlerin dönmesi."""
    y_true = np.array([0, 1, 0, 1], dtype=np.int64)
    probs = np.array([0.1, 0.9, 0.2, 0.8], dtype=np.float64)
    res = evaluate_probability_metrics(y_true, probs, threshold=np.float64(0.5))

    assert type(res.roc_auc) is float
    assert type(res.average_precision) is float
    assert type(res.threshold) is float
    assert type(res.false_positive_rate) is float
    assert type(res.classification_metrics.accuracy) is float
    assert type(res.classification_metrics.tp) is int

    for pt in res.roc_curve:
        assert type(pt.false_positive_rate) is float
        assert type(pt.true_positive_rate) is float
        assert pt.threshold is None or type(pt.threshold) is float

    for pt in res.precision_recall_curve:
        assert type(pt.precision) is float
        assert type(pt.recall) is float
        assert pt.threshold is None or type(pt.threshold) is float


def test_evaluate_probability_metrics_immutability():
    """Test 60: Sonuç dataclasslarının ve tuple alanlarının immutable olması."""
    y_true = [0, 1]
    probs = [0.2, 0.8]
    res = evaluate_probability_metrics(y_true, probs)

    with pytest.raises(dataclasses.FrozenInstanceError):
        res.roc_auc = 0.5

    with pytest.raises(dataclasses.FrozenInstanceError):
        res.roc_curve[0].false_positive_rate = 1.0

    assert isinstance(res.roc_curve, tuple)
    assert isinstance(res.precision_recall_curve, tuple)


def test_evaluate_probability_metrics_no_input_mutation():
    """Test 61: Girdi dizilerinin ve DataFrame’in değişmemesi."""
    y_true = pd.Series([0, 1, 0, 1], name="target")
    probs = pd.Series([0.1, 0.9, 0.2, 0.8], name="probs")
    y_copy = y_true.copy(deep=True)
    p_copy = probs.copy(deep=True)

    evaluate_probability_metrics(y_true, probs)

    pd.testing.assert_series_equal(y_true, y_copy)
    pd.testing.assert_series_equal(probs, p_copy)

    X = pd.DataFrame({"a": [1.0, 2.0], "b": [3.0, 4.0]})
    X_copy = X.copy(deep=True)
    clf = LogisticRegression()
    clf.fit(X, [0, 1])
    extract_positive_probabilities(clf, X)
    pd.testing.assert_frame_equal(X, X_copy)


def test_probability_services_422_validation_error_contract():
    """Test 62: Hataların 422 VALIDATION_ERROR sözleşmesine uyması."""
    with pytest.raises(AppException) as excinfo:
        evaluate_probability_metrics([], [])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(None, [[1]])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_probability_services_no_leakage():
    """Test 63: Hata mesajlarında ham veri, mutlak yol veya estimator içeriği bulunmaması."""
    class VerboseBadModel:
        def __str__(self): return "SECRET_INTERNAL_MODEL_PATH_c:/Projects/securewatch-ai/model"
        def __repr__(self): return "SECRET_INTERNAL_MODEL_PATH_c:/Projects/securewatch-ai/model"
        def predict_proba(self, X): raise ValueError("Internal db error at c:/Projects/securewatch-ai/db.sqlite")

    verbose_model = VerboseBadModel()
    verbose_model.classes_ = np.array([0, 1])

    with pytest.raises(AppException) as excinfo:
        extract_positive_probabilities(verbose_model, [[1.0]])

    msg = excinfo.value.message
    assert "c:/" not in msg.lower()
    assert "securewatch" not in msg.lower()
    assert "secret" not in msg.lower()
    assert "db.sqlite" not in msg.lower()


def test_generate_oof_probabilities_five_folds_success():
    """Test 64: Beş fold ile başarılı out-of-fold olasılık üretimi."""
    X = pd.DataFrame({
        "feat1": np.linspace(0, 10, 50),
        "feat2": np.linspace(10, 20, 50)
    })
    y = pd.Series([0] * 25 + [1] * 25)
    clf = LogisticRegression()

    res = generate_out_of_fold_probabilities(clf, X, y, n_splits=5, random_state=42)

    assert isinstance(res, OutOfFoldProbabilityResult)
    assert len(res.probabilities) == 50
    assert len(res.fold_ids) == 50
    assert res.n_splits == 5
    assert res.random_state == 42
    assert all(0.0 <= p <= 1.0 for p in res.probabilities)
    assert all(0 <= fid < 5 for fid in res.fold_ids)


def test_generate_oof_probabilities_every_row_exactly_once():
    """Test 65: Her satırın tam olarak bir validation fold’unda bulunması."""
    X = np.random.RandomState(42).randn(30, 3)
    y = np.array([0] * 15 + [1] * 15)
    clf = LogisticRegression()

    res = generate_out_of_fold_probabilities(clf, X, y, n_splits=3, random_state=42)

    fold_counts = pd.Series(res.fold_ids).value_counts()
    assert len(fold_counts) == 3
    assert sum(fold_counts) == 30
    assert all(count > 0 for count in fold_counts)


def test_generate_oof_probabilities_original_order_preserved():
    """Test 66: Olasılıkların orijinal satır sırasını koruması."""
    X = np.vstack([np.zeros((10, 2)), np.ones((10, 2)) * 10.0])
    y = np.array([0] * 10 + [1] * 10)
    clf = LogisticRegression()

    res = generate_out_of_fold_probabilities(clf, X, y, n_splits=2, random_state=42)

    for i in range(10):
        assert res.probabilities[i] < 0.5
    for i in range(10, 20):
        assert res.probabilities[i] > 0.5


def test_generate_oof_probabilities_estimator_cloning_and_no_mutation():
    """Test 67: Estimator clone edilmesi, şablonun fit edilmemesi ve girdilerin değişmemesi."""
    X = pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0], "b": [2.0, 3.0, 4.0, 5.0]})
    y = pd.Series([0, 0, 1, 1])
    X_copy = X.copy(deep=True)
    y_copy = y.copy(deep=True)

    clf = LogisticRegression()
    assert not hasattr(clf, "coef_")

    generate_out_of_fold_probabilities(clf, X, y, n_splits=2, random_state=42)

    assert not hasattr(clf, "coef_")
    pd.testing.assert_frame_equal(X, X_copy)
    pd.testing.assert_series_equal(y, y_copy)


def test_generate_oof_probabilities_random_state_determinism():
    """Test 68: Aynı random state ile deterministik, farklı random state ile farklı davranış."""
    X = np.random.RandomState(42).randn(20, 2)
    y = np.array([0] * 10 + [1] * 10)
    clf = LogisticRegression()

    res1 = generate_out_of_fold_probabilities(clf, X, y, n_splits=2, random_state=42)
    res2 = generate_out_of_fold_probabilities(clf, X, y, n_splits=2, random_state=42)
    res3 = generate_out_of_fold_probabilities(clf, X, y, n_splits=2, random_state=99)

    assert res1.probabilities == res2.probabilities
    assert res1.fold_ids == res2.fold_ids
    assert res1.probabilities != res3.probabilities or res1.fold_ids != res3.fold_ids


def test_generate_oof_probabilities_invalid_targets():
    """Test 69: Tek sınıflı hedefin veya sınıf örneği fold sayısından az olduğunda reddedilmesi."""
    X = np.ones((10, 2))
    clf = LogisticRegression()

    with pytest.raises(AppException) as excinfo:
        generate_out_of_fold_probabilities(clf, X, [0] * 10, n_splits=2)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "both 0 and 1" in excinfo.value.message

    y_imbalanced = [0] * 9 + [1]
    with pytest.raises(AppException) as excinfo:
        generate_out_of_fold_probabilities(clf, X, y_imbalanced, n_splits=5)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "less than n_splits" in excinfo.value.message


def test_generate_oof_probabilities_invalid_inputs():
    """Test 70: Geçersiz fold sayısı, özellik veya hedef girdilerinin reddedilmesi."""
    clf = LogisticRegression()
    X = np.ones((10, 2))
    y = np.array([0] * 5 + [1] * 5)

    with pytest.raises(AppException) as excinfo:
        generate_out_of_fold_probabilities(clf, X, y, n_splits=1)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        generate_out_of_fold_probabilities(clf, [], y, n_splits=2)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        generate_out_of_fold_probabilities(clf, X, [0, 1], n_splits=2)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_default_threshold_candidates():
    """Test 71: Varsayılan 17 eşik değerinin doğru oluşması."""
    expected = tuple(round(0.10 + i * 0.05, 2) for i in range(17))
    assert DEFAULT_THRESHOLD_CANDIDATES == expected
    assert len(DEFAULT_THRESHOLD_CANDIDATES) == 17
    assert DEFAULT_THRESHOLD_CANDIDATES[0] == 0.10
    assert DEFAULT_THRESHOLD_CANDIDATES[-1] == 0.90
    assert validate_threshold_candidates(None) == DEFAULT_THRESHOLD_CANDIDATES


def test_custom_threshold_candidates_validation():
    """Test 72: Özel eşiklerin sıralama ve tekrar doğrulaması."""
    assert validate_threshold_candidates([0.2, 0.5, 0.8]) == (0.2, 0.5, 0.8)

    with pytest.raises(AppException) as excinfo:
        validate_threshold_candidates([0.3, 0.5, 0.5])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "duplicate" in excinfo.value.message

    with pytest.raises(AppException) as excinfo:
        validate_threshold_candidates([0.8, 0.2])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"
    assert "strictly increasing" in excinfo.value.message


def test_select_decision_threshold_metrics_and_fpr():
    """Test 73: Her eşikte metrik/FPR hesaplanması ve score == threshold kuralı."""
    y_val = [0, 0, 1, 1]
    probs = [0.2, 0.4, 0.5, 0.8]

    res = select_decision_threshold(y_val, probs, thresholds=[0.3, 0.5, 0.7], max_false_positive_rate=0.50)

    assert len(res.evaluations) == 3
    eval_05 = [ev for ev in res.evaluations if ev.threshold == 0.5][0]
    assert eval_05.metrics.recall == 1.0
    assert eval_05.false_positive_rate == 0.0


def test_select_decision_threshold_tie_break_rules():
    """Test 74: FPR sınırı altında en yüksek recall seçimi ve tie-break kuralları."""
    y_val = [0, 0, 0, 0, 1, 1, 1, 1]
    probs = [0.1, 0.1, 0.3, 0.3, 0.6, 0.7, 0.8, 0.9]

    res = select_decision_threshold(y_val, probs, thresholds=[0.2, 0.5, 0.8], max_false_positive_rate=0.25)
    assert res.constraint_satisfied is True
    assert res.selected_threshold == 0.5

    res_tie = select_decision_threshold(y_val, probs, thresholds=[0.5, 0.55], max_false_positive_rate=0.25)
    assert res_tie.selected_threshold == 0.55


def test_select_decision_threshold_no_candidate_satisfies_constraint():
    """Test 75: Hiçbir eşik kısıtı sağlamadığında selected_threshold=None dönmesi."""
    y_val = [0, 0, 1, 1]
    probs = [0.9, 0.9, 0.9, 0.9]

    res = select_decision_threshold(y_val, probs, thresholds=[0.3, 0.5], max_false_positive_rate=0.05)

    assert res.constraint_satisfied is False
    assert res.selected_threshold is None
    assert res.selected_metrics is None
    assert "No threshold candidate satisfied" in res.selection_reason


def test_threshold_and_oof_no_test_data_mutation_or_access():
    """Test 76: Test verisinin hiçbir fonksiyona verilmemesi ve mutasyona uğramaması."""
    import inspect
    oof_params = inspect.signature(generate_out_of_fold_probabilities).parameters
    assert "X_test" not in oof_params
    assert "y_test" not in oof_params

    sel_params = inspect.signature(select_decision_threshold).parameters
    assert "X_test" not in sel_params
    assert "y_test" not in sel_params
    assert "test" not in str(sel_params).lower()


def test_threshold_and_oof_immutability_and_native_types():
    """Test 77: Sonuç yapılarının immutable olması ve Python-native değerler dönmesi."""
    X = np.array([[1.0], [2.0], [3.0], [4.0]])
    y = np.array([0, 0, 1, 1])
    clf = LogisticRegression()
    oof_res = generate_out_of_fold_probabilities(clf, X, y, n_splits=2)

    assert dataclasses.is_dataclass(oof_res)
    with pytest.raises(dataclasses.FrozenInstanceError):
        oof_res.random_state = 123
    assert isinstance(oof_res.probabilities, tuple)
    assert isinstance(oof_res.probabilities[0], float)
    assert type(oof_res.probabilities[0]) is float
    assert isinstance(oof_res.fold_ids[0], int)
    assert type(oof_res.fold_ids[0]) is int

    sel_res = select_decision_threshold(y, oof_res.probabilities, thresholds=[0.5], max_false_positive_rate=0.5)
    assert dataclasses.is_dataclass(sel_res)
    with pytest.raises(dataclasses.FrozenInstanceError):
        sel_res.constraint_satisfied = False
    assert isinstance(sel_res.evaluations, tuple)
    assert type(sel_res.max_false_positive_rate) is float


def test_threshold_and_oof_422_contract():
    """Test 78: Hataların 422 VALIDATION_ERROR sözleşmesine uyması."""
    with pytest.raises(AppException) as excinfo:
        select_decision_threshold([], [], max_false_positive_rate=0.05)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        select_decision_threshold([0, 1], [0.1, 0.9], max_false_positive_rate=1.5)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


# --- Day 10 Work Block 4: Deterministik Nihai Model Seçimi Birim Testleri ---

def test_day10_candidates_exact_count_and_fixed_order():
    """Test 79: Beş adayın tam sayısı ve sabit sırası."""
    candidates = get_day10_model_candidates()
    assert len(candidates) == 5
    variants = tuple(c.variant_name for c in candidates)
    assert variants == EXPECTED_DAY10_VARIANTS == ("lr_baseline", "rf_baseline", "rf_deeper", "rf_unweighted", "rf_compact")


def test_day10_candidates_correct_models_and_hyperparameters():
    """Test 80: Her adayın doğru model ve hiperparametrelerle oluşturulması."""
    candidates = get_day10_model_candidates()
    c_dict = {c.variant_name: c for c in candidates}
    assert c_dict["lr_baseline"].model_name == "LogisticRegression"
    assert dict(c_dict["lr_baseline"].hyperparameters)["solver"] == "lbfgs"
    assert c_dict["rf_deeper"].model_name == "RandomForestClassifier"
    assert dict(c_dict["rf_deeper"].hyperparameters)["max_depth"] == 20
    assert dict(c_dict["rf_unweighted"].hyperparameters)["class_weight"] is None
    assert dict(c_dict["rf_compact"].hyperparameters)["n_estimators"] == 50


def test_day10_candidates_dummy_classifier_excluded():
    """Test 81: DummyClassifier modelinin adaylara dahil edilmemesi."""
    candidates = get_day10_model_candidates()
    for c in candidates:
        assert "dummy" not in c.model_name.lower()
        assert not isinstance(c.estimator, DummyClassifier)


def test_evaluate_model_candidates_oof_probability_generated():
    """Test 82: Her aday için OOF validation olasılığı üretilmesi."""
    X_train = np.random.RandomState(42).randn(30, 4)
    y_train = np.array([0]*15 + [1]*15)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = evaluate_model_candidates(X_train, y_train, X_test, y_test, n_splits=3)
    assert len(res) == 5
    for r in res:
        assert r.threshold_selection is not None
        assert len(r.threshold_selection.evaluations) > 0
        assert 0.0 <= r.validation_roc_auc <= 1.0
        assert 0.0 <= r.validation_average_precision <= 1.0


def test_evaluate_model_candidates_threshold_selected_on_validation():
    """Test 83: Her adayın karar eşiğinin validation verisiyle seçilmesi."""
    X_train = np.random.RandomState(42).randn(40, 4)
    y_train = np.array([0]*20 + [1]*20)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = evaluate_model_candidates(X_train, y_train, X_test, y_test, n_splits=3, max_false_positive_rate=0.5, min_recall=0.0)
    for r in res:
        if r.is_eligible:
            assert r.selected_threshold is not None
            assert r.validation_false_positive_rate <= 0.5
            assert r.validation_recall >= 0.0


def test_evaluate_model_candidates_no_test_data_in_threshold_selection():
    """Test 84: Test verisinin eşik seçimine girmemesi."""
    X_train = np.random.RandomState(42).randn(40, 4)
    y_train = np.array([0]*20 + [1]*20)
    X_test1 = np.zeros((10, 4))
    y_test1 = np.array([0]*5 + [1]*5)
    X_test2 = np.ones((10, 4)) * 100.0
    y_test2 = np.array([0]*5 + [1]*5)

    res1 = evaluate_model_candidates(X_train, y_train, X_test1, y_test1, n_splits=3)
    res2 = evaluate_model_candidates(X_train, y_train, X_test2, y_test2, n_splits=3)
    for r1, r2 in zip(res1, res2):
        assert r1.selected_threshold == r2.selected_threshold
        assert r1.validation_roc_auc == r2.validation_roc_auc
        assert r1.validation_recall == r2.validation_recall


def test_select_final_model_test_metrics_ignored():
    """Test 85: Test metriklerinin model seçimini etkilememesi."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, True, "OK")
    c0 = ModelEvaluationCandidateResult(
        model_name="LogisticRegression", variant_name="lr_baseline", hyperparameters=(),
        validation_roc_auc=0.8, validation_average_precision=0.8, threshold_selection=dummy_thresh,
        validation_recall=0.95, validation_precision=0.8, validation_f1_score=0.86, validation_false_positive_rate=0.04,
        selected_threshold=0.5, test_roc_auc=1.0, test_average_precision=1.0, test_accuracy=1.0, test_precision=1.0,
        test_recall=1.0, test_f1_score=1.0, test_false_positive_rate=0.0, test_confusion_matrix=((5, 0), (0, 5)),
        training_duration_seconds=0.1, is_eligible=True, ineligibility_reason=None
    )
    c1 = ModelEvaluationCandidateResult(
        model_name="RandomForestClassifier", variant_name="rf_baseline", hyperparameters=(),
        validation_roc_auc=0.9, validation_average_precision=0.9, threshold_selection=dummy_thresh,
        validation_recall=0.98, validation_precision=0.8, validation_f1_score=0.88, validation_false_positive_rate=0.04,
        selected_threshold=0.5, test_roc_auc=0.5, test_average_precision=0.5, test_accuracy=0.5, test_precision=0.5,
        test_recall=0.5, test_f1_score=0.5, test_false_positive_rate=0.5, test_confusion_matrix=((2, 3), (2, 3)),
        training_duration_seconds=0.1, is_eligible=True, ineligibility_reason=None
    )
    c_rest = tuple(
        ModelEvaluationCandidateResult(
            model_name="RandomForestClassifier", variant_name=v, hyperparameters=(),
            validation_roc_auc=0.5, validation_average_precision=0.5, threshold_selection=dummy_thresh,
            validation_recall=0.5, validation_precision=0.5, validation_f1_score=0.5, validation_false_positive_rate=0.5,
            selected_threshold=None, test_roc_auc=0.5, test_average_precision=0.5, test_accuracy=None, test_precision=None,
            test_recall=None, test_f1_score=None, test_false_positive_rate=None, test_confusion_matrix=None,
            training_duration_seconds=0.1, is_eligible=False, ineligibility_reason="Failed"
        )
        for v in ("rf_deeper", "rf_unweighted", "rf_compact")
    )
    sel = select_final_model((c0, c1) + c_rest, min_recall=0.90, max_false_positive_rate=0.10)
    assert sel.is_selected is True
    assert sel.selected_variant_name == "rf_baseline"


def test_select_final_model_min_recall_enforced():
    """Test 86: Validation Recall alt sınırının uygulanması."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, True, "OK")
    c_list = []
    for idx, v in enumerate(EXPECTED_DAY10_VARIANTS):
        c_list.append(ModelEvaluationCandidateResult(
            model_name="M", variant_name=v, hyperparameters=(), validation_roc_auc=0.8, validation_average_precision=0.8,
            threshold_selection=dummy_thresh, validation_recall=0.90, validation_precision=0.8, validation_f1_score=0.85,
            validation_false_positive_rate=0.03, selected_threshold=0.5, test_roc_auc=0.8, test_average_precision=0.8,
            test_accuracy=0.8, test_precision=0.8, test_recall=0.8, test_f1_score=0.8, test_false_positive_rate=0.05,
            test_confusion_matrix=None, training_duration_seconds=0.1, is_eligible=True, ineligibility_reason=None
        ))
    sel = select_final_model(c_list, min_recall=0.95, max_false_positive_rate=0.05)
    assert sel.is_selected is False
    assert sel.selected_variant_name is None


def test_select_final_model_max_fpr_enforced():
    """Test 87: Validation FPR üst sınırının uygulanması."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, True, "OK")
    c_list = []
    for idx, v in enumerate(EXPECTED_DAY10_VARIANTS):
        c_list.append(ModelEvaluationCandidateResult(
            model_name="M", variant_name=v, hyperparameters=(), validation_roc_auc=0.8, validation_average_precision=0.8,
            threshold_selection=dummy_thresh, validation_recall=0.96, validation_precision=0.8, validation_f1_score=0.87,
            validation_false_positive_rate=0.08, selected_threshold=0.5, test_roc_auc=0.8, test_average_precision=0.8,
            test_accuracy=0.8, test_precision=0.8, test_recall=0.8, test_f1_score=0.8, test_false_positive_rate=0.05,
            test_confusion_matrix=None, training_duration_seconds=0.1, is_eligible=True, ineligibility_reason=None
        ))
    sel = select_final_model(c_list, min_recall=0.95, max_false_positive_rate=0.05)
    assert sel.is_selected is False
    assert sel.selected_variant_name is None


def test_select_final_model_tie_break_rules():
    """Test 88: Tie-break kurallarının sırayla doğrulanması."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, True, "OK")
    c0 = ModelEvaluationCandidateResult("M", "lr_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 0.1, True, None)
    c1 = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.02, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 0.1, True, None)
    c_rest = tuple(
        ModelEvaluationCandidateResult("M", v, (), 0.5, 0.5, dummy_thresh, 0.5, 0.5, 0.5, 0.5, None, 0.5, 0.5, None, None, None, None, None, None, 0.1, False, "No")
        for v in ("rf_deeper", "rf_unweighted", "rf_compact")
    )
    sel = select_final_model((c0, c1) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)
    assert sel.selected_variant_name == "rf_baseline"


def test_select_final_model_no_eligible_candidate():
    """Test 89: Hiçbir aday uygun değilse seçim yapılmaması."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, False, "Failed")
    c_list = tuple(
        ModelEvaluationCandidateResult("M", v, (), 0.5, 0.5, dummy_thresh, None, None, None, None, None, 0.5, 0.5, None, None, None, None, None, None, 0.1, False, "Ineligible")
        for v in EXPECTED_DAY10_VARIANTS
    )
    sel = select_final_model(c_list)
    assert sel.is_selected is False
    assert sel.selected_model_name is None
    assert sel.selected_variant_name is None
    assert sel.selected_threshold is None


def test_select_final_model_no_silent_fallback():
    """Test 90: Sessiz fallback olmaması."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, False, "Failed")
    c_list = []
    for v in EXPECTED_DAY10_VARIANTS:
        c_list.append(ModelEvaluationCandidateResult("M", v, (), 0.6, 0.6, dummy_thresh, 0.80, 0.8, 0.8, 0.20, None, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.01, None, 0.1, False, "No"))
    sel = select_final_model(c_list, min_recall=0.95, max_false_positive_rate=0.05)
    assert sel.is_selected is False
    assert sel.selected_variant_name is None
    assert "No candidate model satisfied" in sel.selection_reason


def test_run_final_model_selection_determinism():
    """Test 91: Aynı girdilerle deterministik sonuç alınması."""
    X_train = np.random.RandomState(100).randn(30, 4)
    y_train = np.array([0]*15 + [1]*15)
    X_test = np.random.RandomState(101).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    with unittest.mock.patch("app.services.model_service.time.perf_counter", side_effect=[0.0, 0.1]*5):
        res1 = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=3, min_recall=0.0, max_false_positive_rate=1.0)
    with unittest.mock.patch("app.services.model_service.time.perf_counter", side_effect=[0.0, 0.1]*5):
        res2 = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=3, min_recall=0.0, max_false_positive_rate=1.0)

    assert res1.selected_variant_name == res2.selected_variant_name
    assert res1.selected_threshold == res2.selected_threshold
    assert res1.selection_reason == res2.selection_reason


def test_evaluate_model_candidates_training_duration_measured():
    """Test 92: Eğitim süresinde yalnızca fit() çağrısının ölçülmesi."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    mock_times = [10.0, 10.5, 20.0, 21.2, 30.0, 30.1, 40.0, 43.0, 50.0, 50.8]
    with unittest.mock.patch("app.services.model_service.time.perf_counter", side_effect=mock_times):
        res = evaluate_model_candidates(X_train, y_train, X_test, y_test, n_splits=2)

    assert res[0].training_duration_seconds == pytest.approx(0.5)
    assert res[1].training_duration_seconds == pytest.approx(1.2)
    assert res[2].training_duration_seconds == pytest.approx(0.1)
    assert res[3].training_duration_seconds == pytest.approx(3.0)
    assert res[4].training_duration_seconds == pytest.approx(0.8)


def test_final_selection_structures_immutability():
    """Test 93: Sonuç veri yapılarının immutable olması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=2)
    assert dataclasses.is_dataclass(res)
    with pytest.raises(dataclasses.FrozenInstanceError):
        res.is_selected = True
    assert dataclasses.is_dataclass(res.candidates[0])
    with pytest.raises(dataclasses.FrozenInstanceError):
        res.candidates[0].validation_roc_auc = 1.0
    assert isinstance(res.candidates, tuple)
    assert isinstance(res.candidates[0].hyperparameters, tuple)


def test_final_selection_native_types():
    """Test 94: JSON uyumlu Python-native değerlerin kullanılması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=2)
    assert type(res.min_recall) is float
    assert type(res.max_false_positive_rate) is float
    assert type(res.is_selected) is bool
    assert type(res.selection_reason) is str
    for c in res.candidates:
        assert type(c.validation_roc_auc) is float
        assert type(c.validation_average_precision) is float
        assert type(c.training_duration_seconds) is float
        assert type(c.is_eligible) is bool
        if c.selected_threshold is not None:
            assert type(c.selected_threshold) is float
            assert type(c.validation_recall) is float
            assert type(c.test_roc_auc) is float


def test_final_selection_no_leakage_in_results():
    """Test 95: Estimator, ham veri veya tam probability array'lerinin sonuçlara sızmaması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=2)
    for field in dataclasses.fields(res):
        val = getattr(res, field.name)
        assert not isinstance(val, (np.ndarray, pd.DataFrame, pd.Series))
        assert not hasattr(val, "predict")
    for c in res.candidates:
        for field in dataclasses.fields(c):
            val = getattr(c, field.name)
            assert not isinstance(val, (np.ndarray, pd.DataFrame, pd.Series))
            assert not hasattr(val, "predict")
            if field.name == "hyperparameters":
                assert isinstance(val, tuple)


def test_evaluate_model_candidates_no_input_mutation():
    """Test 96: Girdilerin mutasyona uğramaması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    X_train_copy = X_train.copy()
    y_train_copy = y_train.copy()
    X_test_copy = X_test.copy()
    y_test_copy = y_test.copy()

    evaluate_model_candidates(X_train, y_train, X_test, y_test, n_splits=2)

    np.testing.assert_array_equal(X_train, X_train_copy)
    np.testing.assert_array_equal(y_train, y_train_copy)
    np.testing.assert_array_equal(X_test, X_test_copy)
    np.testing.assert_array_equal(y_test, y_test_copy)


def test_final_selection_422_contract():
    """Test 97: Hataların 422 VALIDATION_ERROR sözleşmesine uyması."""
    with pytest.raises(AppException) as excinfo:
        run_final_model_selection(None, [], [], [])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        run_final_model_selection([[1, 2], [3, 4]], [0, 1], [[1, 2], [3, 4]], [0, 2])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        select_final_model([], min_recall=1.5)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        select_final_model([], min_recall=0.5)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_select_final_model_mutation_of_test_metrics_does_not_change_winner():
    """Test 98: Test metrikleri değiştirilse bile seçilen variant'ın aynı kalması."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, True, "OK")
    c0_base = ModelEvaluationCandidateResult("M", "lr_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, None, 0.1, True, None)
    c1_base = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.95, 0.8, 0.8, 0.04, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, None, 0.1, True, None)
    c_rest = tuple(
        ModelEvaluationCandidateResult("M", v, (), 0.5, 0.5, dummy_thresh, 0.5, 0.5, 0.5, 0.5, None, 0.5, 0.5, None, None, None, None, None, None, 0.1, False, "No")
        for v in ("rf_deeper", "rf_unweighted", "rf_compact")
    )
    sel1 = select_final_model((c0_base, c1_base) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)

    c1_mutated = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.95, 0.8, 0.8, 0.04, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, ((10,0),(0,10)), 0.1, True, None)
    sel2 = select_final_model((c0_base, c1_mutated) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)

    assert sel1.selected_variant_name == sel2.selected_variant_name == "lr_baseline"
    assert sel1.selected_threshold == sel2.selected_threshold


def test_classify_risk_level_boundaries():
    """Test 99: Risk seviyesi sınıflandırmasının sınır değerlerinde doğru ve boşluksuz çalışması."""
    assert classify_risk_level(0.00) == RISK_LEVEL_LOW
    assert classify_risk_level(0.30) == RISK_LEVEL_LOW
    assert classify_risk_level(0.300001) == RISK_LEVEL_MEDIUM
    assert classify_risk_level(0.60) == RISK_LEVEL_MEDIUM
    assert classify_risk_level(0.600001) == RISK_LEVEL_HIGH
    assert classify_risk_level(0.85) == RISK_LEVEL_HIGH
    assert classify_risk_level(0.850001) == RISK_LEVEL_CRITICAL
    assert classify_risk_level(1.00) == RISK_LEVEL_CRITICAL


def test_classify_risk_level_invalid():
    """Test 100: Geçersiz olasılık değerlerinin 422 VALIDATION_ERROR ile reddedilmesi."""
    for val in [-0.01, 1.01, float("nan"), float("inf"), float("-inf"), "0.5", None, True]:
        with pytest.raises(AppException) as excinfo:
            classify_risk_level(val)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_get_risk_level_policy_dict():
    """Test 101: Risk politikası sözlüğünün doğru yapıya sahip olması ve karar eşiğinden bağımsızlık notunu içermesi."""
    policy = get_risk_level_policy_dict()
    assert "low" in policy
    assert "medium" in policy
    assert "high" in policy
    assert "critical" in policy
    assert "note" in policy
    assert "independent" in policy["note"]


@pytest.fixture
def synthetic_df():
    from app.services.csv_validation_service import CICIDS2017_FEATURE_COLUMNS, CICIDS2017_OPTIONAL_LABEL
    rng = np.random.default_rng(0)
    data = {col: rng.uniform(0, 100, size=10).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    data[CICIDS2017_OPTIONAL_LABEL] = ["BENIGN"] * 5 + ["Attack"] * 5
    return pd.DataFrame(data)


def test_run_final_model_selection_workflow(synthetic_df):
    """Test 102: Sentetik veri ile nihai model seçimi iş akışının başarılı olması."""
    result, split_data = run_final_model_selection_workflow(synthetic_df, min_recall=0.01, max_false_positive_rate=0.99, cv_splits=2)
    assert isinstance(result, FinalModelSelectionResult)
    assert isinstance(split_data, SplitDataResult)
    assert len(result.candidates) == 5



def test_final_model_selection_report_to_dict_selected(synthetic_df):
    """Test 103: Seçim başarılı olduğunda rapor sözlüğünün tüm zorunlu alanları ve güvenli tipleri içermesi."""
    result, split_data = run_final_model_selection_workflow(synthetic_df, min_recall=0.01, max_false_positive_rate=0.99, cv_splits=2)
    report_dict = final_model_selection_report_to_dict(result, cv_splits=2, split_data=split_data)
def test_evaluate_model_candidates_training_duration_measured():
    """Test 92: Eğitim süresinde yalnızca fit() çağrısının ölçülmesi."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    mock_times = [10.0, 10.5, 20.0, 21.2, 30.0, 30.1, 40.0, 43.0, 50.0, 50.8]
    with unittest.mock.patch("app.services.model_service.time.perf_counter", side_effect=mock_times):
        res = evaluate_model_candidates(X_train, y_train, X_test, y_test, n_splits=2)

    assert res[0].training_duration_seconds == pytest.approx(0.5)
    assert res[1].training_duration_seconds == pytest.approx(1.2)
    assert res[2].training_duration_seconds == pytest.approx(0.1)
    assert res[3].training_duration_seconds == pytest.approx(3.0)
    assert res[4].training_duration_seconds == pytest.approx(0.8)


def test_final_selection_structures_immutability():
    """Test 93: Sonuç veri yapılarının immutable olması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=2)
    assert dataclasses.is_dataclass(res)
    with pytest.raises(dataclasses.FrozenInstanceError):
        res.is_selected = True
    assert dataclasses.is_dataclass(res.candidates[0])
    with pytest.raises(dataclasses.FrozenInstanceError):
        res.candidates[0].validation_roc_auc = 1.0
    assert isinstance(res.candidates, tuple)
    assert isinstance(res.candidates[0].hyperparameters, tuple)


def test_final_selection_native_types():
    """Test 94: JSON uyumlu Python-native değerlerin kullanılması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=2)
    assert type(res.min_recall) is float
    assert type(res.max_false_positive_rate) is float
    assert type(res.is_selected) is bool
    assert type(res.selection_reason) is str
    for c in res.candidates:
        assert type(c.validation_roc_auc) is float
        assert type(c.validation_average_precision) is float
        assert type(c.training_duration_seconds) is float
        assert type(c.is_eligible) is bool
        if c.selected_threshold is not None:
            assert type(c.selected_threshold) is float
            assert type(c.validation_recall) is float
            assert type(c.test_roc_auc) is float


def test_final_selection_no_leakage_in_results():
    """Test 95: Estimator, ham veri veya tam probability array'lerinin sonuçlara sızmaması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    res = run_final_model_selection(X_train, y_train, X_test, y_test, n_splits=2)
    for field in dataclasses.fields(res):
        val = getattr(res, field.name)
        assert not isinstance(val, (np.ndarray, pd.DataFrame, pd.Series))
        assert not hasattr(val, "predict")
    for c in res.candidates:
        for field in dataclasses.fields(c):
            val = getattr(c, field.name)
            assert not isinstance(val, (np.ndarray, pd.DataFrame, pd.Series))
            assert not hasattr(val, "predict")
            if field.name == "hyperparameters":
                assert isinstance(val, tuple)


def test_evaluate_model_candidates_no_input_mutation():
    """Test 96: Girdilerin mutasyona uğramaması."""
    X_train = np.random.RandomState(42).randn(20, 4)
    y_train = np.array([0]*10 + [1]*10)
    X_test = np.random.RandomState(43).randn(10, 4)
    y_test = np.array([0]*5 + [1]*5)

    X_train_copy = X_train.copy()
    y_train_copy = y_train.copy()
    X_test_copy = X_test.copy()
    y_test_copy = y_test.copy()

    evaluate_model_candidates(X_train, y_train, X_test, y_test, n_splits=2)

    np.testing.assert_array_equal(X_train, X_train_copy)
    np.testing.assert_array_equal(y_train, y_train_copy)
    np.testing.assert_array_equal(X_test, X_test_copy)
    np.testing.assert_array_equal(y_test, y_test_copy)


def test_final_selection_422_contract():
    """Test 97: Hataların 422 VALIDATION_ERROR sözleşmesine uyması."""
    with pytest.raises(AppException) as excinfo:
        run_final_model_selection(None, [], [], [])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        run_final_model_selection([[1, 2], [3, 4]], [0, 1], [[1, 2], [3, 4]], [0, 2])
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        select_final_model([], min_recall=1.5)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"

    with pytest.raises(AppException) as excinfo:
        select_final_model([], min_recall=0.5)
    assert excinfo.value.status_code == 422
    assert excinfo.value.code == "VALIDATION_ERROR"


def test_select_final_model_mutation_of_test_metrics_does_not_change_winner():
    """Test 98: Test metrikleri değiştirilse bile seçilen variant'ın aynı kalması."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, True, "OK")
    c0_base = ModelEvaluationCandidateResult("M", "lr_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, None, 0.1, True, None)
    c1_base = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.95, 0.8, 0.8, 0.04, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, None, 0.1, True, None)
    c_rest = tuple(
        ModelEvaluationCandidateResult("M", v, (), 0.5, 0.5, dummy_thresh, 0.5, 0.5, 0.5, 0.5, None, 0.5, 0.5, None, None, None, None, None, None, 0.1, False, "No")
        for v in ("rf_deeper", "rf_unweighted", "rf_compact")
    )
    sel1 = select_final_model((c0_base, c1_base) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)

    c1_mutated = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.95, 0.8, 0.8, 0.04, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, ((10,0),(0,10)), 0.1, True, None)
    sel2 = select_final_model((c0_base, c1_mutated) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)

    assert sel1.selected_variant_name == sel2.selected_variant_name == "lr_baseline"
    assert sel1.selected_threshold == sel2.selected_threshold


def test_classify_risk_level_boundaries():
    """Test 99: Risk seviyesi sınıflandırmasının sınır değerlerinde doğru ve boşluksuz çalışması."""
    assert classify_risk_level(0.00) == RISK_LEVEL_LOW
    assert classify_risk_level(0.30) == RISK_LEVEL_LOW
    assert classify_risk_level(0.300001) == RISK_LEVEL_MEDIUM
    assert classify_risk_level(0.60) == RISK_LEVEL_MEDIUM
    assert classify_risk_level(0.600001) == RISK_LEVEL_HIGH
    assert classify_risk_level(0.85) == RISK_LEVEL_HIGH
    assert classify_risk_level(0.850001) == RISK_LEVEL_CRITICAL
    assert classify_risk_level(1.00) == RISK_LEVEL_CRITICAL


def test_classify_risk_level_invalid():
    """Test 100: Geçersiz olasılık değerlerinin 422 VALIDATION_ERROR ile reddedilmesi."""
    for val in [-0.01, 1.01, float("nan"), float("inf"), float("-inf"), "0.5", None, True]:
        with pytest.raises(AppException) as excinfo:
            classify_risk_level(val)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "VALIDATION_ERROR"


def test_get_risk_level_policy_dict():
    """Test 101: Risk politikası sözlüğünün doğru yapıya sahip olması ve karar eşiğinden bağımsızlık notunu içermesi."""
    policy = get_risk_level_policy_dict()
    assert "low" in policy
    assert "medium" in policy
    assert "high" in policy
    assert "critical" in policy
    assert "note" in policy
    assert "independent" in policy["note"]


@pytest.fixture
def synthetic_df():
    from app.services.csv_validation_service import CICIDS2017_FEATURE_COLUMNS, CICIDS2017_OPTIONAL_LABEL
    rng = np.random.default_rng(0)
    data = {col: rng.uniform(0, 100, size=10).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    data[CICIDS2017_OPTIONAL_LABEL] = ["BENIGN"] * 5 + ["Attack"] * 5
    return pd.DataFrame(data)


def test_run_final_model_selection_workflow(synthetic_df):
    """Test 102: Sentetik veri ile nihai model seçimi iş akışının başarılı olması."""
    result, split_data = run_final_model_selection_workflow(synthetic_df, min_recall=0.01, max_false_positive_rate=0.99, cv_splits=2)
    assert isinstance(result, FinalModelSelectionResult)
    assert isinstance(split_data, SplitDataResult)
    assert len(result.candidates) == 5



def test_final_model_selection_report_to_dict_selected(synthetic_df):
    """Test 103: Seçim başarılı olduğunda rapor sözlüğünün tüm zorunlu alanları ve güvenli tipleri içermesi."""
    result, split_data = run_final_model_selection_workflow(synthetic_df, min_recall=0.01, max_false_positive_rate=0.99, cv_splits=2)
    report_dict = final_model_selection_report_to_dict(result, cv_splits=2, split_data=split_data)

    # Validate JSON serialization with allow_nan=False
    json_str = json.dumps(report_dict, allow_nan=False)
    assert len(json_str) > 0

    assert report_dict["mode"] == "select_final_model"
    assert "selection_policy" in report_dict
    assert report_dict["selection_policy"]["tie_break_order"] == [
        "validation_recall descending",
        "validation_false_positive_rate ascending",
        "validation_f1_score descending",
        "validation_average_precision descending",
        "variant_name ascending",
    ]
    assert "selected_model" in report_dict
    assert "candidates" in report_dict
    assert "risk_policy" in report_dict
    assert "dataset" in report_dict

    sel = report_dict["selected_model"]
    if sel["is_selected"]:
        assert sel["model_name"] is not None
        assert sel["variant_name"] is not None
        assert isinstance(sel["decision_threshold"], float)
        assert isinstance(sel["validation_metrics"], dict)
        assert isinstance(sel["test_metrics"], dict)
        assert isinstance(sel["training_duration_seconds"], float)

    # Verify no estimators or raw arrays
    for cand in report_dict["candidates"]:
        assert "estimator" not in cand
        assert "predictions" not in cand


def test_final_model_selection_report_to_dict_unselected(synthetic_df):
    """Test 104: Hiçbir aday seçilmediğinde rapor sözlüğünün doğru fallback yapması."""
    result, split_data = run_final_model_selection_workflow(synthetic_df, min_recall=0.9999, max_false_positive_rate=0.0001, cv_splits=2)
    report_dict = final_model_selection_report_to_dict(result, cv_splits=2, split_data=split_data)

    sel = report_dict["selected_model"]
    assert sel["is_selected"] is False
    assert sel["model_name"] is None
    assert sel["variant_name"] is None
    assert sel["decision_threshold"] is None
    assert sel["validation_metrics"] is None
    assert sel["test_metrics"] is None
    assert sel["training_duration_seconds"] is None


def test_select_final_model_determinism_ignoring_duration():
    """Test 105: Model seçiminde eğitim süresinin (runtime duration) tie-break kararına etki etmemesi ve tam determinizm."""
    dummy_thresh = ThresholdSelectionResult((), 0.5, None, 0.05, True, "OK")
    c0 = ModelEvaluationCandidateResult("M", "lr_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 10.0, True, None)
    c1 = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 0.1, True, None)
    c_rest = tuple(
        ModelEvaluationCandidateResult("M", v, (), 0.5, 0.5, dummy_thresh, 0.5, 0.5, 0.5, 0.5, None, 0.5, 0.5, None, None, None, None, None, None, 0.1, False, "No")
        for v in ("rf_deeper", "rf_unweighted", "rf_compact")
    )

    # 1 & 4: Eşit metriklerde eğitim süresi farklı olsa bile alfabetik sıra ('lr_baseline' < 'rf_baseline') kazanır
    sel1 = select_final_model((c0, c1) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)
    assert sel1.selected_variant_name == "lr_baseline"

    # 2: Süreler yer değiştirildiğinde (c0=0.1s, c1=10.0s) seçilen variant değişmez
    c0_fast = ModelEvaluationCandidateResult("M", "lr_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 0.1, True, None)
    c1_slow = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 10.0, True, None)
    sel2 = select_final_model((c0_fast, c1_slow) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)
    assert sel2.selected_variant_name == "lr_baseline"

    # 3: Aynı adaylar tamamen farklı mock süreleriyle tekrar değerlendirildiğinde aynı model seçilir
    c0_diff = ModelEvaluationCandidateResult("M", "lr_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 999.9, True, None)
    c1_diff = ModelEvaluationCandidateResult("M", "rf_baseline", (), 0.8, 0.8, dummy_thresh, 0.96, 0.8, 0.8, 0.04, 0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.05, None, 0.001, True, None)
    sel3 = select_final_model((c0_diff, c1_diff) + c_rest, min_recall=0.90, max_false_positive_rate=0.05)
    assert sel3.selected_variant_name == "lr_baseline"

    # 5 & 6: Eğitim süresinin rapor ve adaylarda kalması, ancak selection_policy içinde tie-break olarak bulunmaması
    report = final_model_selection_report_to_dict(sel1, cv_splits=5)
    assert report["selection_policy"]["tie_break_order"] == [
        "validation_recall descending",
        "validation_false_positive_rate ascending",
        "validation_f1_score descending",
        "validation_average_precision descending",
        "variant_name ascending",
    ]
    assert report["selected_model"]["training_duration_seconds"] == 10.0
    for cand in report["candidates"]:
        assert cand["training_duration_seconds"] is not None
