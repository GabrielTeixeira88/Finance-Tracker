"""Audit examples only enrich metadata/expectations in the owned fictional workspace."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger
from app.analytics_models import AssetClassification
from app.demo import audit_content, unified
from app.demo.runtime import DemoStore
from app.models import InvestmentActivity, Schedule, Transaction


def test_audit_examples_are_repeatable_and_do_not_post_or_erase_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), tmp_path / "personal.db", "unified")
    store.initialize()
    with Session(store.engine) as session, session.begin():
        before = ledger.balances(session)
        transactions = list(session.scalars(select(Transaction.id)))
        activities = list(session.scalars(select(InvestmentActivity.id)))
        rows = list(session.scalars(select(AssetClassification)))
        assert len(rows) >= 20
        rows[0].sector = "Fictional user correction"
        schedules = list(session.scalars(select(Schedule)))
        assert len(schedules) >= 1
        assert schedules[0].amount == Decimal("1800")
        assert not audit_content.extend(session)
        assert rows[0].sector == "Fictional user correction"
        assert ledger.balances(session) == before
        assert list(session.scalars(select(Transaction.id))) == transactions
        assert list(session.scalars(select(InvestmentActivity.id))) == activities
    store.close()
    store.initialize()
    with Session(store.engine) as session:
        assert any(
            row.sector == "Fictional user correction"
            for row in session.scalars(select(AssetClassification))
        )
        assert ledger.balances(session) == before
    store.close()
