import sqlite3
from decimal import Decimal
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import URL, inspect, text
from sqlalchemy.orm import Session
from test_ingestion import CONFIG, account, confirm, upload

from app import budgets
from app.database import get_session, make_engine
from app.main import app
from app.seed_demo import seed_demo
from app.seed_spending_demo import seed_spending_demo


def snapshot(engine):
    with engine.connect() as connection:
        return {
            table: list(connection.execute(text(f'SELECT * FROM "{table}" ORDER BY id')))
            for table in inspect(connection).get_table_names()
            if table != "alembic_version"
        }


def test_populated_phase3_migration_preserves_every_existing_table(tmp_path):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "synthetic-phase3.db"))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0005")
    engine = make_engine(url)
    with Session(engine) as session, session.begin():
        assert seed_demo(session)

    def session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    try:
        with TestClient(app) as api:
            aid = account(api, "Synthetic migration import account")
            confirm(api, upload(api, aid))
            assert (
                api.post(
                    "/api/imports/profiles",
                    json={"name": "Synthetic migration profile", "configuration": CONFIG},
                ).status_code
                == 201
            )
    finally:
        app.dependency_overrides.clear()
    before = snapshot(engine)
    assert before["import_batches"] and before["source_records"] and before["import_profiles"]
    # Upgrade a backup copy, leaving the populated Phase 3 source untouched.
    copied = tmp_path / "synthetic-phase3-copy.db"
    with sqlite3.connect(url.database) as source, sqlite3.connect(copied) as destination:
        source.backup(destination)
    original = engine
    url = URL.create("sqlite+pysqlite", database=str(copied))
    config.attributes["database_url"] = url
    engine = make_engine(url)
    command.upgrade(config, "head")
    command.check(config)
    after = snapshot(engine)
    assert all(after[table] == rows for table, rows in before.items())
    with engine.connect() as connection:
        assert list(connection.execute(text("PRAGMA foreign_key_check"))) == []
    with Session(engine) as session, session.begin():
        assert not seed_spending_demo(session)
    assert snapshot(engine) == after
    assert snapshot(original) == before
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA integrity_check")).scalar() == "ok"
    engine.dispose()
    original.dispose()


def test_full_spending_demo_is_deterministic_repeat_safe_and_persistent(db_engine, tmp_path):
    with Session(db_engine) as session, session.begin():
        assert seed_spending_demo(session)
    first = snapshot(db_engine)
    assert len(first["transactions"]) == 502
    assert len(first["budget_targets"]) == 10
    assert len(first["budget_groups"]) == 3
    assert len(first["refund_links"]) == 1
    with Session(db_engine) as session, session.begin():
        assert not seed_spending_demo(session)
        report = budgets.monthly(session, "2026-09", "BRL")
        assert Decimal(report["summary"]["expenses"]) == Decimal("5753.48")
        assert Decimal(report["summary"]["income"]) == Decimal("9650")
        assert any(Decimal(c["carryover"]) > 0 for c in report["categories"])
        assert any(Decimal(c["carryover"]) < 0 for c in report["categories"])
        assert any(c["category_id"] is None for c in report["categories"])
    db_engine.dispose()
    assert snapshot(db_engine) == first
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "second-synthetic.db"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    other = make_engine(url)
    try:
        with Session(other) as session, session.begin():
            assert seed_spending_demo(session)
        assert snapshot(other) == first
    finally:
        other.dispose()
