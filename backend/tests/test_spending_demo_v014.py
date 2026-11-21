from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import budgets, life_events, spending
from app.demo import spending_content, unified
from app.demo.real_market_snapshot import END, START
from app.demo.runtime import DemoStore
from app.life_event_models import LifeEvent
from app.models import BudgetGroup, DemoFixture, Transaction
from app.spending_appearance import ClassificationAppearance


def test_spending_demo_is_populated_exact_repeat_safe_and_resettable(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    personal = tmp_path / "personal.db"
    personal.write_bytes(b"unchanged personal workspace")
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), personal, "unified").initialize()
    with Session(store.engine) as db, db.begin():
        fixture = db.get(DemoFixture, unified.VERSION)
        before = [
            (row.id, row.amount) for row in db.scalars(select(Transaction).order_by(Transaction.id))
        ]
        assert spending_content.extend(db) is False
        assert [
            (row.id, row.amount) for row in db.scalars(select(Transaction).order_by(Transaction.id))
        ] == before
        totals = spending.calculate(db, START, END + timedelta(days=1), "BRL")["BRL"]
        assert totals["expenses"] == Decimal(fixture.payload["household"]["expenses"]) + 90 - 35
        assert totals["income"] == Decimal(fixture.payload["household"]["income"])
        assert len(list(db.scalars(select(BudgetGroup)))) == 4
        assert len(list(db.scalars(select(ClassificationAppearance)))) >= 18
        report = budgets.monthly(db, "2026-09", "BRL", END)
        assert any(Decimal(row["carryover"]) > 0 for row in report["categories"])
        assert any(Decimal(row["carryover"]) < 0 for row in report["categories"])
        assert any(
            row["category_id"] is None and Decimal(row["spent"]) == 90
            for row in report["categories"]
        )
        events = list(db.scalars(select(LifeEvent)))
        assert len(events) == 4
        assert all(
            Decimal(life_events.detail(db, event, END)["actual_cost"]) > 0 for event in events
        )
        count = len(before)
    store.reset()
    with Session(store.engine) as db:
        assert len(list(db.scalars(select(Transaction)))) == count
        assert db.get(DemoFixture, unified.VERSION).payload[spending_content.MARKER] == 1
    store.close()
    assert personal.read_bytes() == b"unchanged personal workspace"
