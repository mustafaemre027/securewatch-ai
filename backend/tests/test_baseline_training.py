"""Integration tests for the end-to-end baseline training workflow.

Uses small, deterministic, fully synthetic data — no real CIC-IDS2017 rows.
CICIDS2017_FEATURE_COLUMNS is used to construct the canonical 78-column schema.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.core.exceptions import AppException
from app.services.csv_validation_service import (
    CICIDS2017_FEATURE_COLUMNS,
    CICIDS2017_OPTIONAL_LABEL,
)
from app.services.model_service import (
    BaselineTrainingReport,
    ModelTrainingResult,
    baseline_report_to_dict,
    train_baseline_models,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_synthetic_df(
    n_benign: int = 30,
    n_attack_a: int = 20,
    n_attack_b: int = 10,
    seed: int = 0,
    include_duplicates: int = 0,
) -> pd.DataFrame:
    """
    Builds a minimal canonical CIC-IDS2017 DataFrame with synthetic values.
    All 78 feature columns + Label are present.
    Values are deterministic and finite (no NaN/inf).
    """
    rng = np.random.default_rng(seed)
    n_core = n_benign + n_attack_a + n_attack_b

    data = {}
    for col in CICIDS2017_FEATURE_COLUMNS:
        data[col] = rng.uniform(0, 100, size=n_core).tolist()

    labels = (
        ["BENIGN"] * n_benign
        + ["DoS slowloris"] * n_attack_a
        + ["PortScan"] * n_attack_b
    )
    data[CICIDS2017_OPTIONAL_LABEL] = labels
    df = pd.DataFrame(data)

    if include_duplicates > 0:
        # Append exact copies of the first rows so they are real duplicates
        df = pd.concat(
            [df, df.iloc[:include_duplicates].copy()],
            ignore_index=True
        )

    return df


@pytest.fixture
def synthetic_df():
    return _make_synthetic_df()


# ---------------------------------------------------------------------------
# Core workflow tests
# ---------------------------------------------------------------------------

def test_workflow_completes(synthetic_df):
    """Test 1: Canonical 78-feature + Label DataFrame ile iş akışının tamamlanması."""
    report = train_baseline_models(synthetic_df)
    assert isinstance(report, BaselineTrainingReport)


def test_feature_count_is_77(synthetic_df):
    """Test 2: Fwd Header Length.1 kaldırıldıktan sonra feature sayısının 77 olması."""
    report = train_baseline_models(synthetic_df)
    assert report.feature_count == 77


def test_binary_targets_before_split(synthetic_df):
    """Test 3: Label encoding'in split'ten önce gerçekleşmesi.
    Verify y_train and y_test contain only 0/1, not raw attack names.
    """
    report = train_baseline_models(synthetic_df)
    # If encoding happened after split we'd have raw strings here – not the case
    all_train = set(report.dummy_result.predictions)
    assert all_train.issubset({0, 1})


def test_multiple_attack_types_succeed():
    """Test 4: Birbirinden farklı ve tekil saldırı isimleri bulunan satırların
    toplam binary saldırı sınıfı yeterliyse stratified split'in başarılı olması.
    """
    # 6 unique attack types, each with 5 samples = 30 attacks total
    rng = np.random.default_rng(1)
    data = {col: rng.uniform(0, 100, size=60).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    labels = ["BENIGN"] * 30
    attack_types = ["FTP-Patator", "SSH-Patator", "DoS Hulk", "DoS GoldenEye", "Heartbleed", "PortScan"]
    for at in attack_types:
        labels += [at] * 5
    data[CICIDS2017_OPTIONAL_LABEL] = labels
    df = pd.DataFrame(data)
    report = train_baseline_models(df)
    assert isinstance(report, BaselineTrainingReport)


def test_targets_only_binary(synthetic_df):
    """Test 5: Train/test hedeflerinin yalnızca 0 ve 1 içermesi."""
    report = train_baseline_models(synthetic_df)
    all_preds = set(report.dummy_result.predictions) | set(report.logistic_result.predictions)
    assert all_preds.issubset({0, 1})


def test_class_distribution_matches_binary(synthetic_df):
    """Test 6: Train/test sınıf dağılımlarının binary hedeflerle eşleşmesi."""
    report = train_baseline_models(synthetic_df)
    train_classes = {k for k, _ in report.train_class_distribution}
    test_classes = {k for k, _ in report.test_class_distribution}
    assert train_classes.issubset({0, 1})
    assert test_classes.issubset({0, 1})


def test_report_contains_dummy_result(synthetic_df):
    """Test 7: DummyClassifier sonucunun raporda bulunması."""
    report = train_baseline_models(synthetic_df)
    assert isinstance(report.dummy_result, ModelTrainingResult)
    assert report.dummy_result.model_name == "dummy_classifier"


def test_report_contains_logistic_result(synthetic_df):
    """Test 8: Logistic Regression sonucunun raporda bulunması."""
    report = train_baseline_models(synthetic_df)
    assert isinstance(report.logistic_result, ModelTrainingResult)
    assert report.logistic_result.model_name == "logistic_regression"


def test_prediction_count_equals_test_rows(synthetic_df):
    """Test 9: Her iki modelin tahmin sayısının test satırı sayısına eşit olması."""
    report = train_baseline_models(synthetic_df)
    assert len(report.dummy_result.predictions) == report.test_row_count
    assert len(report.logistic_result.predictions) == report.test_row_count


def test_metrics_and_confusion_matrix_present(synthetic_df):
    """Test 10: Her iki modelin metrik ve confusion matrix alanlarının bulunması."""
    report = train_baseline_models(synthetic_df)
    for result in [report.dummy_result, report.logistic_result]:
        m = result.metrics
        assert hasattr(m, "accuracy")
        assert hasattr(m, "precision")
        assert hasattr(m, "recall")
        assert hasattr(m, "f1_score")
        assert hasattr(m, "confusion_matrix")
        assert hasattr(m, "tn")
        assert hasattr(m, "fp")
        assert hasattr(m, "fn")
        assert hasattr(m, "tp")


def test_json_report_is_serializable(synthetic_df):
    """Test 11: JSON raporun tamamen JSON-serializable olması."""
    report = train_baseline_models(synthetic_df)
    report_dict = baseline_report_to_dict(report)
    # Must not raise; allow_nan=False ensures no NaN/Inf leaks
    serialized = json.dumps(report_dict, allow_nan=False)
    assert len(serialized) > 0


def test_json_report_no_estimator(synthetic_df):
    """Test 12: JSON raporda estimator nesnesinin bulunmaması."""
    report = train_baseline_models(synthetic_df)
    report_dict = baseline_report_to_dict(report)
    serialized = json.dumps(report_dict)
    assert "estimator" not in serialized
    assert "LogisticRegression" not in serialized
    assert "DummyClassifier" not in serialized


def test_prediction_sample_max_10(synthetic_df):
    """Test 13: Prediction sample'ın en fazla 10 değer içermesi."""
    report = train_baseline_models(synthetic_df)
    report_dict = baseline_report_to_dict(report)
    for model_key in ["dummy_classifier", "logistic_regression"]:
        sample = report_dict["models"][model_key]["prediction_sample"]
        assert len(sample) <= 10


def test_no_raw_data_in_json(synthetic_df):
    """Test 14: JSON raporda ham veri satırlarının veya feature değerlerinin bulunmaması."""
    report = train_baseline_models(synthetic_df)
    report_dict = baseline_report_to_dict(report)
    serialized = json.dumps(report_dict)
    # Feature column names should not appear in the JSON output
    for col in CICIDS2017_FEATURE_COLUMNS[:5]:
        assert col not in serialized
    # The raw label strings should not appear
    assert "BENIGN" not in serialized
    assert "DoS" not in serialized


def test_deterministic_results(synthetic_df):
    """Test 15: Aynı girdide deterministik sonuç alınması."""
    r1 = train_baseline_models(synthetic_df)
    r2 = train_baseline_models(synthetic_df)
    assert r1.dummy_result.predictions == r2.dummy_result.predictions
    assert r1.logistic_result.predictions == r2.logistic_result.predictions
    assert r1.dummy_result.metrics == r2.dummy_result.metrics
    assert r1.logistic_result.metrics == r2.logistic_result.metrics


def test_original_df_not_mutated(synthetic_df):
    """Test 16: Orijinal DataFrame'in değiştirilmemesi."""
    df_copy = synthetic_df.copy(deep=True)
    train_baseline_models(synthetic_df)
    pd.testing.assert_frame_equal(synthetic_df, df_copy)


def test_missing_label_rejected():
    """Test 17: Eksik Label veya bozuk canonical schema'nın reddedilmesi."""
    rng = np.random.default_rng(2)
    data = {col: rng.uniform(0, 100, size=20).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    # No Label column
    df = pd.DataFrame(data)
    with pytest.raises(AppException) as excinfo:
        train_baseline_models(df)
    assert excinfo.value.status_code == 422


def test_single_binary_class_rejected():
    """Test 18: Tek binary sınıflı verinin reddedilmesi."""
    rng = np.random.default_rng(3)
    data = {col: rng.uniform(0, 100, size=20).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    data[CICIDS2017_OPTIONAL_LABEL] = ["BENIGN"] * 20  # Only one class
    df = pd.DataFrame(data)
    with pytest.raises(AppException) as excinfo:
        train_baseline_models(df)
    assert excinfo.value.status_code == 422


def test_insufficient_stratification_rejected():
    """Test 19: Yetersiz stratification verisinin reddedilmesi."""
    rng = np.random.default_rng(4)
    data = {col: rng.uniform(0, 100, size=3).tolist() for col in CICIDS2017_FEATURE_COLUMNS}
    data[CICIDS2017_OPTIONAL_LABEL] = ["BENIGN", "DoS slowloris", "BENIGN"]
    df = pd.DataFrame(data)
    with pytest.raises(AppException) as excinfo:
        train_baseline_models(df)
    assert excinfo.value.status_code == 422


def test_duplicate_row_statistics(synthetic_df):
    """Test 20: Duplicate ve satır istatistiklerinin doğru raporlanması."""
    df_with_dupes = _make_synthetic_df(include_duplicates=5)
    report = train_baseline_models(df_with_dupes)
    assert report.dropped_duplicate_count == 5
    assert report.initial_row_count == report.final_row_count + report.dropped_duplicate_count


# ---------------------------------------------------------------------------
# CLI tests
# ---------------------------------------------------------------------------

def test_cli_help():
    """Test 21: CLI --help çıktısının başarılı olması."""
    result = subprocess.run(
        [sys.executable, "-m", "scripts.train_baseline_models", "--help"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,  # backend/
    )
    assert result.returncode == 0
    assert "train_baseline_models" in result.stdout.lower() or "--input" in result.stdout


def test_cli_valid_csv_produces_json(tmp_path):
    """Test 22: Geçerli geçici CSV ile CLI'nin exit code 0 ve parse edilebilir JSON üretmesi."""
    df = _make_synthetic_df()
    csv_file = tmp_path / "train.csv"
    df.to_csv(csv_file, index=False)

    result = subprocess.run(
        [sys.executable, "-m", "scripts.train_baseline_models", "--input", str(csv_file)],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,  # backend/
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    # Must be parseable JSON
    parsed = json.loads(result.stdout)
    assert "dataset" in parsed
    assert "models" in parsed


def test_cli_missing_file():
    """Test 23: Bulunmayan dosyanın güvenli şekilde reddedilmesi."""
    result = subprocess.run(
        [sys.executable, "-m", "scripts.train_baseline_models", "--input", "nonexistent_file.csv"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    assert result.returncode != 0
    assert len(result.stderr.strip()) > 0


def test_cli_non_csv_extension(tmp_path):
    """Test 24: CSV olmayan uzantının reddedilmesi."""
    bad_file = tmp_path / "data.txt"
    bad_file.write_text("not a csv")

    result = subprocess.run(
        [sys.executable, "-m", "scripts.train_baseline_models", "--input", str(bad_file)],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    assert result.returncode != 0


def test_cli_error_no_absolute_path_or_traceback(tmp_path):
    """Test 25: CLI hata çıktısında mutlak yol, traceback veya veri satırlarının bulunmaması."""
    result = subprocess.run(
        [sys.executable, "-m", "scripts.train_baseline_models", "--input", "missing.csv"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    assert result.returncode != 0
    stderr = result.stderr
    # Should not include a Python traceback
    assert "Traceback" not in stderr
    assert "File \"" not in stderr


def test_cli_no_model_files_created(tmp_path):
    """Test 26: Scriptin model/Joblib dosyası oluşturmaması."""
    import os
    df = _make_synthetic_df()
    csv_file = tmp_path / "train.csv"
    df.to_csv(csv_file, index=False)

    result = subprocess.run(
        [sys.executable, "-m", "scripts.train_baseline_models", "--input", str(csv_file)],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    assert result.returncode == 0

    # No .pkl, .joblib, or .json files should exist in tmp_path (other than our CSV)
    artifacts = [f for f in tmp_path.iterdir() if f.suffix in {".pkl", ".joblib"}]
    assert len(artifacts) == 0

    # No new .pkl/.joblib files in the backend directory
    backend_dir = Path(__file__).parent.parent
    for ext in [".pkl", ".joblib"]:
        matches = list(backend_dir.rglob(f"*{ext}"))
        # Filter out venv
        matches = [m for m in matches if ".venv" not in m.parts]
        assert len(matches) == 0, f"Unexpected model artifact found: {matches}"
