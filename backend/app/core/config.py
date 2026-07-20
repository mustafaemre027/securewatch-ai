from functools import lru_cache
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
