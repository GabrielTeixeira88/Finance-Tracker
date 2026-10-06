from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    postgres_user: str = "finance_tracker"
    postgres_password: SecretStr
    postgres_db: str = "finance_tracker"
    postgres_host: str = "127.0.0.1"
    postgres_port: int = 5432

    @property
    def database_url(self) -> URL:
        # URL.create safely handles passwords containing URL-reserved characters.
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
