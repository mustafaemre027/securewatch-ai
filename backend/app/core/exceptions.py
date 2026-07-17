from typing import Any, Optional


class AppException(Exception):
    """Base application exception for controlled domain errors.

    Attributes:
        status_code (int): The HTTP status code to return.
        code (str): A stable, unique error code identifying the type of error.
        message (str): A user-friendly message describing the error.
        details (Optional[Any]): Optional additional details about the error.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
