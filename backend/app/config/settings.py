"""
Brandflow AI - Configuration Management
========================================
Centralised settings loaded from environment variables using Pydantic Settings.
All configuration values are validated at startup.
"""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Pydantic validates all fields at startup — the app won't start
    if required env vars are missing or have wrong types.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # ignore unknown env vars
    )

    # ----------------------------------------------------------
    # Application
    # ----------------------------------------------------------
    APP_NAME: str = "Brandflow AI"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "AI-powered Instagram Content Automation Platform"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # ----------------------------------------------------------
    # API
    # ----------------------------------------------------------
    API_V1_PREFIX: str = "/api/v1"

    # ----------------------------------------------------------
    # MongoDB
    # ----------------------------------------------------------
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "brandflow_ai"

    # ----------------------------------------------------------
    # JWT
    # ----------------------------------------------------------
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ----------------------------------------------------------
    # CORS  (stored as comma-separated string in .env)
    # ----------------------------------------------------------
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # ----------------------------------------------------------
    # Security
    # ----------------------------------------------------------
    BCRYPT_ROUNDS: int = 12

    # ----------------------------------------------------------
    # Derived helpers
    # ----------------------------------------------------------
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a Python list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        """True when running in production environment."""
        return self.ENVIRONMENT.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the cached Settings singleton.
    lru_cache ensures .env is only read once, reducing I/O overhead.
    """
    return Settings()


# Module-level convenience alias
settings: Settings = get_settings()
