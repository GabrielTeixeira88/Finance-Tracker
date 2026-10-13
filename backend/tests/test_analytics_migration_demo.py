from datetime import date
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, event, select, text
from sqlalchemy.orm import Session
from test_budget_migration_demo import snapshot

from app.database import make_engine
from app.investment_analytics import allocation, performance
from app.models import FinancialAccount
from app.seed_analytics_demo import seed_analytics_demo
from app.seed_market_demo import seed_market_demo


def config_for(path):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(path))
    return config


def test_v06_upgrade_preserves_every_old_record(tmp_path):
    config = config_for(tmp_path / "synthetic-v06.db")
    command.upgrade(config, "sqlite_0008")
    engine = make_engine(config.attributes["database_url"])
    with Session(engine) as session, session.begin():
        seed_market_demo(session)
    before = snapshot(engine)
    engine.dispose()
    command.upgrade(config, "head")
    command.check(config)
    after = snapshot(engine)
    assert all(after[table] == rows for table, rows in before.items())
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA integrity_check")).scalar() == "ok"
        assert not list(connection.execute(text("PRAGMA foreign_key_check")))
    engine.dispose()


def test_analytics_seed_repeatability_persistence_and_batched_reads(db_engine, tmp_path):
    with Session(db_engine) as session, session.begin():
        assert seed_analytics_demo(session)
    before = snapshot(db_engine)
    assert len(before["investment_activities"]) == 39
    assert len(before["assets"]) == 12
    assert len(before["financial_accounts"]) == 10
    with Session(db_engine) as session, session.begin():
        assert not seed_analytics_demo(session)
    db_engine.dispose()
    assert snapshot(db_engine) == before
    queries = []

    def record(_conn, _cursor, statement, _parameters, _context, _many):
        queries.append(statement)

    event.listen(db_engine, "before_cursor_execute", record)
    try:
        with Session(db_engine) as session:
            account = session.scalar(
                select(FinancialAccount).where(
                    FinancialAccount.name == "Synthetic Analytics Portfolio"
                )
            )
            data = performance(session, date(2025, 10, 1), date(2026, 9, 30), "BRL", [account.id])
            assert data["twr"]["quality"] == "COMPLETE"
            assert data["xirr"]["quality"] == "COMPLETE"
            assert (
                allocation(session, date(2026, 9, 30), "BRL", [account.id])["quality"] == "COMPLETE"
            )
        assert len(queries) < 35  # Batched reads, independent of number of chart days.
    finally:
        event.remove(db_engine, "before_cursor_execute", record)
    assert snapshot(db_engine) == before
    config = config_for(tmp_path / "second-synthetic.db")
    command.upgrade(config, "head")
    second = make_engine(config.attributes["database_url"])
    try:
        with Session(second) as session, session.begin():
            assert seed_analytics_demo(session)
        assert snapshot(second) == before
    finally:
        second.dispose()
