from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )
    database_path: Path = Path("data/finance-tracker.db")
    sqlite_busy_timeout_ms: int = Field(default=5000, ge=1, le=60000)
    learning_min_examples: int = Field(default=3, ge=3, le=100)
    schedule_match_days: int = Field(default=3, ge=0, le=14)

    @property
    def resolved_database_path(self) -> Path:
        path = self.database_path.expanduser()
        return path.resolve() if path.is_absolute() else (PROJECT_ROOT / path).resolve()

    @property
    def database_url(self) -> URL:
        return URL.create("sqlite+pysqlite", database=str(self.resolved_database_path))


@lru_cache
def get_settings() -> Settings:
    return Settings()
