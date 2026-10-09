from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import URL, event, func, select
from sqlalchemy.orm import Session
from test_ledger import account, entry, transfer

from app.database import make_engine
from app.history import history
from app.models import Category, DemoFixture, FinancialAccount, Transaction, Transfer
from app.seed_demo import END, VERSION, seed_demo


def test_history_financial_scenario_and_daily_transfer_netting(api):
    checking = account(api, opening="5000", opening_date="2026-09-30")
    savings = account(api, "Savings", "2000", opening_date="2026-09-30")
    assert entry(api, checking).status_code == 201
    assert entry(api, checking, "INCOME", "1000").status_code == 201
    assert transfer(api, checking, savings).status_code == 201
    data = api.get("/api/history?period=1M&end=2026-10-31").json()
    total = data["series"][0]
    assert {a["name"]: Decimal(a["balance"]) for a in data["accounts"]} == {
        "Checking": Decimal("5300"),
        "Savings": Decimal("2500"),
    }
    assert Decimal(total["opening_balance"]) == 7000
    assert Decimal(total["income"]) == 1000
    assert Decimal(total["expenses"]) == 200
    assert Decimal(total["change"]) == Decimal(total["net_flow"]) == 800
    assert [Decimal(p["balance"]) for p in total["points"]] == [7000, 7800, 7800]
    assert total["spending"][0]["name"] == "Uncategorized"
    # ALL includes the auditable openings in balance change, never in reported income.
    all_time = api.get("/api/history?period=ALL&end=2026-10-31").json()["series"][0]
    assert Decimal(all_time["change"]) == 7800
    assert Decimal(all_time["income"]) == 1000
    assert all_time["change_percent"] is None


def test_history_as_of_dates_soft_deletes_and_currencies(api):
    checking = account(api, opening="5000")
    account(api, "USD", "123.123456", currency="USD")
    deleted = entry(api, checking, amount="99").json()
    assert api.delete(f"/api/transactions/{deleted['id']}").status_code == 204
    entry(api, checking, "INCOME", "700", transaction_date="2026-11-01")
    data = api.get("/api/history?period=1M&end=2026-10-31").json()
    assert [Decimal(s["total_balance"]) for s in data["series"]] == [5000, Decimal("123.123456")]
    assert all(Decimal(s["income"]) == Decimal(s["expenses"]) == 0 for s in data["series"])
    assert all(t["id"] != deleted["id"] for t in data["recent_transactions"])
    before = api.get("/api/history?period=1M&end=2026-09-30").json()
    assert all(Decimal(a["balance"]) == 0 for a in before["accounts"])


@pytest.mark.parametrize(
    "period,start",
    [("1M", "2024-02-01"), ("3M", "2023-12-01"), ("YTD", "2024-01-01"), ("1Y", "2023-03-01")],
)
def test_history_calendar_ranges(api, period, start):
    data = api.get(f"/api/history?period={period}&end=2024-02-29")
    assert data.status_code == 200
    assert data.json()["date_from"] == start


def test_history_invalid_and_empty(api):
    assert api.get("/api/history?period=2Y&end=2026-10-01").status_code == 422
    assert api.get("/api/history?period=ALL&end=0001-01-01").status_code == 422
    assert api.get("/api/history?end=2026-02-30").status_code == 422
    assert api.get("/api/history?end=2026-10-01").json()["series"] == []
    assert api.get("/api/demo").json() == {"enabled": False}


def snapshot(engine):
    with Session(engine) as session:
        return {
            model.__tablename__: [
                {column.name: getattr(row, column.name) for column in model.__table__.columns}
                for row in session.scalars(select(model).order_by(model.id))
            ]
            for model in (FinancialAccount, Category, Transaction, Transfer, DemoFixture)
        }


def test_demo_deterministic_repeatable_and_persisted(db_engine, tmp_path, api):
    with Session(db_engine) as session, session.begin():
        assert seed_demo(session)
    first = snapshot(db_engine)
    assert len(first["transactions"]) == 500
    assert len(first["transfers"]) == 72
    assert len(first["financial_accounts"]) == 5
    assert len(first["categories"]) == 15
    with Session(db_engine) as session, session.begin():
        assert not seed_demo(session)
    assert snapshot(db_engine) == first
    db_engine.dispose()
    assert snapshot(db_engine) == first
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "second-demo.db"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    other = make_engine(url)
    try:
        with Session(other) as session, session.begin():
            assert seed_demo(session)
        assert snapshot(other) == first
    finally:
        other.dispose()
    with Session(db_engine) as session:
        result = history(session, "ALL", END)
        reconstructed = sum((a.balance for a in result.accounts), Decimal("0"))
        assert result.series[0].total_balance == reconstructed
        assert result.series[0].total_balance == result.series[0].income - result.series[
            0
        ].expenses + Decimal("35300")
        monthly = history(session, "1M", END).series[0]
        assert monthly.income == Decimal("9650")
        assert monthly.expenses > 0
        assert session.get(DemoFixture, VERSION).end_date == date(2026, 9, 30)
    assert api.get("/api/demo").json()["enabled"] is True

    # Re-running the seed must preserve changes made while evaluating the UI.
    with Session(db_engine) as session, session.begin():
        checking = session.scalar(
            select(FinancialAccount).where(FinancialAccount.name == "Checking")
        )
        checking.name = "Edited synthetic checking"
    edited = snapshot(db_engine)
    with Session(db_engine) as session, session.begin():
        assert not seed_demo(session)
    assert snapshot(db_engine) == edited


def test_demo_refuses_existing_workspace(api, db_engine):
    account(api)
    with Session(db_engine) as session, session.begin(), pytest.raises(ValueError, match="empty"):
        seed_demo(session)
    with Session(db_engine) as session:
        assert session.scalar(select(func.count()).select_from(FinancialAccount)) == 1
        assert session.scalar(select(func.count()).select_from(DemoFixture)) == 0


def test_demo_seed_failure_is_atomic(db_engine):
    def fail(mapper, connection, row):
        if row.transaction_type == "TRANSFER" and row.direction == "IN":
            raise RuntimeError("Synthetic seed failure")

    event.listen(Transaction, "before_insert", fail)
    try:
        with (
            pytest.raises(RuntimeError, match="seed failure"),
            Session(db_engine) as session,
            session.begin(),
        ):
            seed_demo(session)
    finally:
        event.remove(Transaction, "before_insert", fail)
    with Session(db_engine) as session:
        for model in (FinancialAccount, Category, Transaction, Transfer, DemoFixture):
            assert session.scalar(select(func.count()).select_from(model)) == 0
