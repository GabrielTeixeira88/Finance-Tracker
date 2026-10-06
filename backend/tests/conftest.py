from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session
from app.main import app


@pytest.fixture(scope="session")
def postgres_engine():
    # Only this freshly generated database is ever reset or dropped.
    name = "finance_tracker_test_" + uuid4().hex
    url = get_settings().database_url
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    engine = create_engine(url.set(database=name))
    try:
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        config.attributes["database_url"] = engine.url
        command.upgrade(config, "head")
        command.check(config)
        yield engine
    finally:
        engine.dispose()
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture
def db_engine(postgres_engine):
    assert postgres_engine.url.database.startswith("finance_tracker_test_")
    with postgres_engine.begin() as conn:
        conn.execute(
            text("TRUNCATE transactions, transfers, financial_accounts, categories CASCADE")
        )
    return postgres_engine


@pytest.fixture
def api(db_engine):
    def session_override():
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
