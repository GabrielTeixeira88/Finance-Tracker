from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import URL
from sqlalchemy.orm import Session

from app.database import get_session, make_engine
from app.main import app


@pytest.fixture
def db_engine(tmp_path):
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "synthetic.db"))
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    command.check(config)
    engine = make_engine(url)
    yield engine
    engine.dispose()


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
