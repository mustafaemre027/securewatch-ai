from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings configuration.

    Attributes:
        app_name (str): The name of the application.
        app_version (str): The version of the application.
        environment (str): The execution environment.
        debug (bool): Flag to enable/disable debug mode.
        api_v1_prefix (str): Prefix for API v1 routes.
        database_url (str): Connection URL for the database.
    """
    app_name: str = "SecureWatch AI"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    database_url: str

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
