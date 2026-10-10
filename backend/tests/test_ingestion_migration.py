from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, text
from sqlalchemy.orm import Session

from app.database import make_engine
from app.seed_demo import seed_demo


def test_populated_phase2b_upgrade_preserves_all_history(tmp_path):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "synthetic-phase2b.db"))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0004")
    engine = make_engine(url)
    with Session(engine) as session:
        assert seed_demo(session)
        session.commit()
    tables = [
        "financial_accounts",
        "transactions",
        "transfers",
        "payees",
        "transaction_rules",
        "schedules",
        "schedule_completions",
    ]
    with engine.connect() as conn:
        before = {
            table: list(conn.execute(text(f"SELECT * FROM {table} ORDER BY id")))
            for table in tables
        }
    command.upgrade(config, "head")
    command.check(config)
    engine.dispose()
    engine = make_engine(url)
    with engine.connect() as conn:
        assert list(conn.execute(text("PRAGMA foreign_key_check"))) == []
        after = {
            table: list(conn.execute(text(f"SELECT * FROM {table} ORDER BY id")))
            for table in tables
        }
        assert after == before
        assert len(after["transactions"]) == 500
    with Session(engine) as session:
        assert not seed_demo(session)
    engine.dispose()
