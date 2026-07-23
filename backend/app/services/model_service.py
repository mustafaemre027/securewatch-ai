import logging
import numpy as np
import pandas as pd

from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

def encode_binary_labels(labels: pd.Series) -> pd.Series:
    """
    Encodes CIC-IDS2017 labels into binary classification targets.
    BENIGN -> 0, any attack -> 1.
    
    Args:
        labels: A pandas Series containing string labels.
        
    Returns:
        pd.Series: A new Series containing only integer 0 and 1 values,
                   with the same index and name as the input.
                   
    Raises:
        AppException: If input validation fails.
    """
    if not isinstance(labels, pd.Series):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Input must be a pandas Series."
        )

    if labels.empty:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Input Series cannot be empty."
        )

    if labels.isna().any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Labels cannot contain NaN or None values."
        )

    if not all(isinstance(val, str) for val in labels):
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="All label values must be strings."
        )

    # Operate on a deep copy to ensure original series is untouched
    processed = labels.copy(deep=True)
    
    # Clean whitespace and normalize case
    processed = processed.str.strip().str.upper()

    if (processed == "").any():
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Labels cannot contain empty or whitespace-only strings."
        )

    # BENIGN becomes 0, all other attacks become 1
    encoded = pd.Series(1, index=processed.index, name=processed.name, dtype=int)
    
    benign_mask = processed == "BENIGN"
    encoded.loc[benign_mask] = 0

    return encoded
