import sqlite3
from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, select, text
from sqlalchemy.orm import Session
from test_budget_migration_demo import snapshot

from app.database import make_engine
from app.market_models import AssetPricing
from app.market_valuation import history
from app.models import Asset, FinancialAccount
from app.seed_market_demo import seed_market_demo
from app.seed_spending_demo import seed_spending_demo


def test_populated_v05_copy_preserves_manual_prices_and_every_old_table(tmp_path):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    source = tmp_path / "synthetic-v05.db"
    config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(source))
    command.upgrade(config, "sqlite_0007")
    engine = make_engine(config.attributes["database_url"])
    with Session(engine) as session, session.begin():
        seed_spending_demo(session)
        asset = Asset(
            symbol="SYNTHETIC",
            name="Synthetic migration asset",
            asset_type="ETF",
            exchange="XBSP",
            currency="BRL",
        )
        session.add(asset)
        session.flush()
        # Frozen v0.5 shape, intentionally independent of the extended ORM model.
        session.execute(
            text(
                "INSERT INTO price_observations (id,asset_id,currency,price_date,price,source) "
                "VALUES (:id,:asset,'BRL','2026-09-30','000000000000000100123456','MANUAL')"
            ),
            {"id": uuid4().hex, "asset": asset.id.hex},
        )
    before = snapshot(engine)
    engine.dispose()
    copy = tmp_path / "synthetic-v05-copy.db"
    with sqlite3.connect(source) as a, sqlite3.connect(copy) as b:
        a.backup(b)
    config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(copy))
    command.upgrade(config, "head")
    command.check(config)
    engine = make_engine(config.attributes["database_url"])
    after = snapshot(engine)
    with Session(engine) as session:
        assert session.scalar(select(AssetPricing)).mode == "MANUAL"
    for table, values in before.items():
        if table != "price_observations":
            assert after[table] == values
        else:
            assert [tuple(row[: len(values[0])]) for row in after[table]] == [
                tuple(row) for row in values
            ]
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA integrity_check")).scalar() == "ok"
        assert not list(connection.execute(text("PRAGMA foreign_key_check")))
    engine.dispose()


def test_market_demo_deterministic_safe_and_persistent(db_engine, tmp_path):
    with Session(db_engine) as session, session.begin():
        assert seed_market_demo(session)
    before = snapshot(db_engine)
    assert len(before["assets"]) == 9
    assert len(before["investment_activities"]) == 30
    assert len(before["price_observations"]) > 1800
    assert len(before["fx_observations"]) > 750
    with Session(db_engine) as session, session.begin():
        assert not seed_market_demo(session)
    db_engine.dispose()
    assert snapshot(db_engine) == before
    with Session(db_engine) as session:
        usd = session.scalar(select(FinancialAccount).where(FinancialAccount.currency == "USD"))
        points = history(session, date(2025, 10, 1), date(2026, 9, 30), usd.id)["points"]
        assert any(p["value"] is None for p in points)  # Stale MSFT deliberately visible.
        assert any(p["value"] and Decimal(p["value"]) > 0 for p in points)
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = URL.create(
        "sqlite+pysqlite", database=str(tmp_path / "second.db")
    )
    command.upgrade(config, "head")
    second = make_engine(config.attributes["database_url"])
    try:
        with Session(second) as session, session.begin():
            assert seed_market_demo(session)
        assert snapshot(second) == before
    finally:
        second.dispose()
