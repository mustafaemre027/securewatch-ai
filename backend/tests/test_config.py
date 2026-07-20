"""Tests for Settings configuration validation, particularly JWT secret security requirements."""
import os
import pytest
from unittest.mock import patch
from pydantic import ValidationError


def _make_settings(**overrides):
    """Helper to instantiate Settings with controlled environment variables."""
    from app.core.config import Settings
    base_env = {
        "DATABASE_URL": "postgresql+psycopg://user:pass@localhost/db",
        "JWT_SECRET_KEY": "a_strong_secret_key_that_is_at_least_32_chars_long",
    }
    base_env.update(overrides)
    with patch.dict(os.environ, base_env, clear=False):
        return Settings()


def test_valid_jwt_secret_accepted() -> None:
    """Test that a strong, valid JWT secret passes validation."""
    settings = _make_settings(JWT_SECRET_KEY="a_strong_secret_key_that_is_at_least_32_chars_long")
    assert len(settings.jwt_secret_key) >= 32


def test_jwt_secret_too_short_rejected() -> None:
    """Test that a JWT secret shorter than 32 characters raises a ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        _make_settings(JWT_SECRET_KEY="short_key")
    errors = exc_info.value.errors()
    assert any("32" in str(e) for e in errors)


def test_jwt_secret_exactly_31_chars_rejected() -> None:
    """Test that a JWT secret of exactly 31 characters is rejected."""
    with pytest.raises(ValidationError):
        _make_settings(JWT_SECRET_KEY="a" * 31)


def test_jwt_secret_exactly_32_chars_accepted() -> None:
    """Test that a JWT secret of exactly 32 characters is accepted."""
    settings = _make_settings(JWT_SECRET_KEY="a" * 32)
    assert len(settings.jwt_secret_key) == 32


def test_jwt_secret_change_me_pattern_rejected() -> None:
    """Test that a JWT secret containing 'change_me' pattern is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        _make_settings(JWT_SECRET_KEY="CHANGE_ME_please_use_a_real_key_here_ok_abcdefghij")
    errors = exc_info.value.errors()
    assert any("insecure" in str(e).lower() or "change_me" in str(e).lower() for e in errors)


def test_jwt_secret_placeholder_pattern_rejected() -> None:
    """Test that a JWT secret containing 'placeholder' pattern is rejected."""
    with pytest.raises(ValidationError):
        _make_settings(JWT_SECRET_KEY="this_is_a_placeholder_key_that_is_long_enough_test_abc")


def test_jwt_secret_dev_secret_pattern_rejected() -> None:
    """Test that a JWT secret containing 'dev_secret' pattern is rejected."""
    with pytest.raises(ValidationError):
        _make_settings(JWT_SECRET_KEY="dev_secret_key_for_local_env_abcdefghijklmnopqrstuvwxy")


def test_jwt_secret_missing_raises_error() -> None:
    """Test that missing JWT_SECRET_KEY environment variable raises a ValidationError."""
    with patch.dict(os.environ, {}, clear=False):
        env = {
            "DATABASE_URL": "postgresql+psycopg://user:pass@localhost/db",
        }
        env_backup = os.environ.pop("JWT_SECRET_KEY", None)
        try:
            with pytest.raises(ValidationError):
                from app.core.config import Settings
                Settings()
        finally:
            if env_backup is not None:
                os.environ["JWT_SECRET_KEY"] = env_backup
