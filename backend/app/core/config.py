from functools import lru_cache
from pathlib import Path
from typing import Any, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Known insecure placeholder patterns that must never be used in real deployments.
# These are specific, common placeholder strings — NOT the word 'secret' alone,
# which could appear in legitimate high-entropy keys.
_INSECURE_JWT_PATTERNS: tuple[str, ...] = (
    "change_me",
    "placeholder",
    "dev_secret",
    "test_secret",
    "my_secret",
    "mysecret",
    "your_secret",
    "example_key",
    "replace_me",
    "insert_key_here",
)


class Settings(BaseSettings):
    """Application settings configuration.

    Attributes:
        app_name (str): The name of the application.
        app_version (str): The version of the application.
        environment (str): The execution environment.
        debug (bool): Flag to enable/disable debug mode.
        api_v1_prefix (str): Prefix for API v1 routes.
        database_url (str): Connection URL for the database.
        jwt_secret_key (str): Secret key for signing JWT tokens (required, min 32 chars).
        jwt_algorithm (str): Algorithm used for JWT signing.
        access_token_expire_minutes (int): JWT token expiry duration in minutes.
        upload_dir (Path): Storage directory path for uploaded CSV files.
        max_upload_size_bytes (int): Maximum allowed CSV upload size in bytes (default: 52428800 = 50MB).
    """
    app_name: str = "SecureWatch AI"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    upload_dir: Path = Path("../data/uploads")
    max_upload_size_bytes: int = 52428800

    @field_validator("upload_dir", mode="before")
    @classmethod
    def validate_upload_dir(cls, v: Any) -> Path:
        """Validate and resolve upload directory path.

        Ensures path is a pathlib.Path and relative paths are resolved relative to
        the project root to prevent working-directory dependent path issues.

        Args:
            v (Any): Raw upload directory path (str or Path).

        Returns:
            Path: Resolved pathlib.Path object.
        """
        path = Path(v) if isinstance(v, str) else v
        if not path.is_absolute():
            backend_dir = Path(__file__).resolve().parent.parent.parent
            repo_root = backend_dir.parent
            if path.parts and path.parts[0] == "..":
                return (backend_dir / path).resolve()
            return (repo_root / path).resolve()
        return path

    @field_validator("max_upload_size_bytes")
    @classmethod
    def validate_max_upload_size_bytes(cls, v: int) -> int:
        """Validate max_upload_size_bytes is strictly positive.

        Args:
            v (int): Maximum upload size in bytes.

        Returns:
            int: Validated size in bytes.

        Raises:
            ValueError: If size is zero or negative.
        """
        if v <= 0:
            raise ValueError(
                f"MAX_UPLOAD_SIZE_BYTES must be a positive integer greater than zero (got {v})."
            )
        return v

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret_key(cls, v: str) -> str:
        """Validate JWT secret key security requirements.

        Args:
            v (str): JWT secret key value from environment.

        Returns:
            str: Validated JWT secret key.

        Raises:
            ValueError: If secret is too short or contains known insecure patterns.
        """
        if len(v) < 32:
            raise ValueError(
                f"JWT_SECRET_KEY must be at least 32 characters long (got {len(v)}). "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        lower = v.lower()
        for pattern in _INSECURE_JWT_PATTERNS:
            if pattern in lower:
                raise ValueError(
                    f"JWT_SECRET_KEY contains an insecure pattern '{pattern}'. "
                    "Please set a cryptographically strong random secret in your .env file."
                )
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    """Get the application settings instance.

    Returns:
        Settings: Cached application settings.
    """
    return Settings()
