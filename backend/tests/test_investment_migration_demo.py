import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, text
from sqlalchemy.orm import Session
from test_budget_migration_demo import snapshot

from app.database import make_engine
from app.seed_investment_demo import seed_investment_demo
from app.seed_spending_demo import seed_spending_demo


def test_phase4_copy_upgrade_preserves_all_history(tmp_path):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    source = tmp_path / "synthetic-phase4.db"
    url = URL.create("sqlite+pysqlite", database=str(source))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0006")
    engine = make_engine(url)
    with Session(engine) as session, session.begin():
        seed_spending_demo(session)
    before = snapshot(engine)
    engine.dispose()
    copy = tmp_path / "synthetic-phase4-copy.db"
    with sqlite3.connect(source) as a, sqlite3.connect(copy) as b:
        a.backup(b)
    config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(copy))
    command.upgrade(config, "head")
    command.check(config)
    engine = make_engine(config.attributes["database_url"])
    after = snapshot(engine)
    assert all(after[key] == value for key, value in before.items())
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA integrity_check")).scalar() == "ok"
        assert not list(connection.execute(text("PRAGMA foreign_key_check")))
    with Session(engine) as session, session.begin():
        assert not seed_investment_demo(session)
    assert snapshot(engine) == after
    engine.dispose()


def test_investment_demo_deterministic_persistent_and_repeat_safe(db_engine, tmp_path):
    with Session(db_engine) as session, session.begin():
        assert seed_investment_demo(session)
    first = snapshot(db_engine)
    assert len(first["investment_activities"]) == 14
    assert len(first["investment_source_links"]) == 2
    assert len(first["assets"]) == 5
    assert len(first["price_observations"]) == 4
    with Session(db_engine) as session, session.begin():
        assert not seed_investment_demo(session)
    db_engine.dispose()
    assert snapshot(db_engine) == first
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = URL.create(
        "sqlite+pysqlite", database=str(tmp_path / "second.db")
    )
    command.upgrade(config, "head")
    other = make_engine(config.attributes["database_url"])
    try:
        with Session(other) as session, session.begin():
            assert seed_investment_demo(session)
        assert snapshot(other) == first
    finally:
        other.dispose()
