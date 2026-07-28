"""Baseline model training CLI script.

Usage (from the backend/ directory):
    python -m scripts.train_baseline_models --input path/to/training.csv

Outputs a JSON report to stdout on success (exit code 0).
Prints a short error message to stderr and exits with a non-zero code on failure.

No model files, Joblib artifacts, or persistent runtime report files are produced.
"""
import argparse
import json
import logging
import math
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="train_baseline_models",
        description=(
            "Train baseline models, run Random Forest comparisons, or perform "
            "validation-based final model selection on a CIC-IDS2017 CSV file "
            "and print a JSON evaluation report to stdout."
        ),
    )
    parser.add_argument(
        "--input",
        required=True,
        metavar="CSV_PATH",
        help="Path to the CIC-IDS2017 CSV training file.",
    )
    parser.add_argument(
        "--compare-random-forest",
        action="store_true",
        help="Run model comparison with Logistic Regression and Random Forest variants.",
    )
    parser.add_argument(
        "--select-final-model",
        action="store_true",
        help="Run validation-based final model selection across candidate variants.",
    )
    parser.add_argument(
        "--min-recall",
        type=float,
        default=0.95,
        help="Minimum required validation recall score (default: 0.95).",
    )
    parser.add_argument(
        "--max-fpr",
        type=float,
        default=0.05,
        help="Maximum allowed validation false positive rate (default: 0.05).",
    )
    parser.add_argument(
        "--cv-splits",
        type=int,
        default=5,
        help="Number of Stratified K-Fold splits for validation (default: 5).",
    )
    return parser


def _validate_selection_args(args: argparse.Namespace) -> None:
    if args.compare_random_forest and args.select_final_model:
        print("Error: --compare-random-forest and --select-final-model cannot be used together.", file=sys.stderr)
        sys.exit(1)

    if math.isnan(args.min_recall) or math.isinf(args.min_recall) or not (0.0 <= args.min_recall <= 1.0):
        print("Error: --min-recall must be a finite number between 0.0 and 1.0.", file=sys.stderr)
        sys.exit(1)

    if math.isnan(args.max_fpr) or math.isinf(args.max_fpr) or not (0.0 <= args.max_fpr <= 1.0):
        print("Error: --max-fpr must be a finite number between 0.0 and 1.0.", file=sys.stderr)
        sys.exit(1)

    if args.cv_splits < 2:
        print("Error: --cv-splits must be an integer greater than or equal to 2.", file=sys.stderr)
        sys.exit(1)


def _validate_input_path(raw_path: str) -> Path:
    """Validates the provided path is a .csv file that exists.

    Raises SystemExit with a short, safe error message on failure.
    No absolute paths or user-identifying information is included in output.
    """
    path = Path(raw_path)

    if not path.exists():
        print("Error: Input file not found.", file=sys.stderr)
        sys.exit(1)

    if not path.is_file():
        print("Error: Input path is not a regular file.", file=sys.stderr)
        sys.exit(1)

    if path.suffix.lower() != ".csv":
        print("Error: Input file must have a .csv extension.", file=sys.stderr)
        sys.exit(1)

    return path


def main() -> None:
    """Entry point for the baseline training CLI."""
    import pandas as pd
    from app.core.exceptions import AppException
    from app.services.model_service import (
        baseline_report_to_dict,
        train_baseline_models,
        comparison_report_to_dict,
        run_model_comparison,
        final_model_selection_report_to_dict,
        run_final_model_selection_workflow,
    )

    parser = _build_parser()
    args = parser.parse_args()
    _validate_selection_args(args)

    csv_path = _validate_input_path(args.input)

    try:
        df = pd.read_csv(csv_path)
    except Exception:
        print("Error: Could not read CSV file.", file=sys.stderr)
        sys.exit(1)

    try:
        if args.select_final_model:
            report, split_data = run_final_model_selection_workflow(
                df,
                min_recall=args.min_recall,
                max_false_positive_rate=args.max_fpr,
                cv_splits=args.cv_splits,
            )
        elif args.compare_random_forest:
            report = run_model_comparison(df)
            split_data = None
        else:
            report = train_baseline_models(df)
            split_data = None
    except Exception as exc:
        # Emit only the exception message, never a traceback or raw data
        if isinstance(exc, AppException):
            short_msg = f"[{exc.code}] {exc.message}"
        else:
            short_msg = str(exc)
        # Truncate to avoid accidentally leaking long messages with row data
        if len(short_msg) > 300:
            short_msg = short_msg[:300] + "..."
        print(f"Error: Training failed. {short_msg}", file=sys.stderr)
        sys.exit(2)

    try:
        if args.select_final_model:
            report_dict = final_model_selection_report_to_dict(
                report, cv_splits=args.cv_splits, split_data=split_data
            )
        elif args.compare_random_forest:
            report_dict = comparison_report_to_dict(report)
        else:
            report_dict = baseline_report_to_dict(report)
        json.dump(report_dict, sys.stdout, indent=2, allow_nan=False)
        print()  # Trailing newline after JSON
    except Exception:
        print("Error: Failed to serialize report to JSON.", file=sys.stderr)
        sys.exit(3)

    sys.exit(0)


if __name__ == "__main__":
    main()
