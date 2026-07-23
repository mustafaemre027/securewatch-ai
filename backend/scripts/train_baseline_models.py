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
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="train_baseline_models",
        description=(
            "Train DummyClassifier and LogisticRegression baselines on a "
            "CIC-IDS2017 CSV file and print a JSON evaluation report to stdout."
        ),
    )
    parser.add_argument(
        "--input",
        required=True,
        metavar="CSV_PATH",
        help="Path to the CIC-IDS2017 CSV training file.",
    )
    return parser


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
    from app.services.model_service import baseline_report_to_dict, train_baseline_models

    parser = _build_parser()
    args = parser.parse_args()

    csv_path = _validate_input_path(args.input)

    try:
        df = pd.read_csv(csv_path)
    except Exception:
        print("Error: Could not read CSV file.", file=sys.stderr)
        sys.exit(1)

    try:
        report = train_baseline_models(df)
    except Exception as exc:
        # Emit only the exception message, never a traceback or raw data
        short_msg = str(exc)
        # Truncate to avoid accidentally leaking long messages with row data
        if len(short_msg) > 300:
            short_msg = short_msg[:300] + "..."
        print(f"Error: Training failed. {short_msg}", file=sys.stderr)
        sys.exit(2)

    try:
        report_dict = baseline_report_to_dict(report)
        json.dump(report_dict, sys.stdout, indent=2, allow_nan=False)
        print()  # Trailing newline after JSON
    except Exception:
        print("Error: Failed to serialize report to JSON.", file=sys.stderr)
        sys.exit(3)

    sys.exit(0)


if __name__ == "__main__":
    main()
