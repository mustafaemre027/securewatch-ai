from datetime import timedelta
import pytest

from app.core.exceptions import AppException
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_password_and_verify_success() -> None:
    """Test that password hashing and verification work as expected for correct credentials."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True


def test_verify_password_failure() -> None:
    """Test that password verification returns False for an incorrect password."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    assert verify_password("WrongPassword123!", hashed) is False


def test_create_and_decode_access_token() -> None:
    """Test JWT token generation and successful decoding of claims payload."""
    payload = {"sub": "analyst_emre", "role": "ANALYST", "user_id": 42}
    token = create_access_token(payload)

    decoded = decode_access_token(token)
    assert decoded["sub"] == "analyst_emre"
    assert decoded["role"] == "ANALYST"
    assert decoded["user_id"] == 42
    assert "exp" in decoded
    assert "iat" in decoded


def test_decode_expired_token() -> None:
    """Test that decoding an expired JWT token raises AppException with TOKEN_EXPIRED code."""
    payload = {"sub": "test_user"}
    expired_delta = timedelta(seconds=-10)
    token = create_access_token(payload, expires_delta=expired_delta)

    with pytest.raises(AppException) as exc_info:
        decode_access_token(token)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "TOKEN_EXPIRED"


def test_decode_invalid_token() -> None:
    """Test that decoding a malformed or altered JWT token raises AppException with TOKEN_INVALID code."""
    invalid_token = "invalid.jwt.token_string"

    with pytest.raises(AppException) as exc_info:
        decode_access_token(invalid_token)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "TOKEN_INVALID"
