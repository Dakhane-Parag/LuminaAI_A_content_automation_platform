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
    # Gemini AI
    # ----------------------------------------------------------
    GEMINI_API_KEY: str = ""          # Required for AI generation routes (set this in .env)
    GEMINI_MODEL: str = "gemini-2.5-flash"  # Model to use for content generation

    # ----------------------------------------------------------
    # Replicate AI (Image Generation)
    # ----------------------------------------------------------
    REPLICATE_API_TOKEN: str = ""     # Required for image generation routes (set this in .env)

    # ----------------------------------------------------------
    # Amazon S3 (Cloud Image Storage)
    # ----------------------------------------------------------
    AWS_ACCESS_KEY_ID: str = ""       # AWS IAM access key (set this in .env)
    AWS_SECRET_ACCESS_KEY: str = ""   # AWS IAM secret key (set this in .env)
    AWS_REGION: str = "eu-north-1"    # S3 bucket region
    AWS_BUCKET_NAME: str = ""         # S3 bucket name (set this in .env)

    # ----------------------------------------------------------
    # Redis (Celery Broker & Task Queue)
    # ----------------------------------------------------------
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # ----------------------------------------------------------
    # Meta / Instagram (Graph API)
    # ----------------------------------------------------------
    META_APP_ID: str = ""        # From Meta App Dashboard (App ID)
    META_APP_SECRET: str = ""    # From Meta App Dashboard (App Secret)
    META_REDIRECT_URI: str = "http://localhost:5173/auth/instagram/callback"  # Must match Meta App Dashboard

    # ----------------------------------------------------------
    # Derived helpers
    # ----------------------------------------------------------
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a Python list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def redis_url(self) -> str:
        """Full Redis URL for Celery broker/backend."""
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

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
