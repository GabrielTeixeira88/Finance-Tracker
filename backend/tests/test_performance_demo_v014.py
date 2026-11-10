from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import allocation_targets, investment_analytics, ledger
from app.allocation_models import AllocationTarget
from app.demo import performance_content, unified
from app.demo.runtime import DemoStore
from app.models import DemoFixture, PriceObservation


def test_performance_content_is_additive_repeatable_and_isolated(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    personal = tmp_path / "personal.db"
    personal.write_bytes(b"untouched personal data")
    root = unified.scenario_root(tmp_path / "demo")
    store = DemoStore(root, personal, "unified").initialize()
    day = date(2026, 9, 30)
    with Session(store.engine) as session, session.begin():
        before = ledger.balances(session, cutoff=day)
        prices = [(p.id, p.price, p.source) for p in session.scalars(select(PriceObservation))]
        assert performance_content.extend(session) is False
        target = session.get(AllocationTarget, performance_content.identity("household-target"))
        assert sum(w.target_bps for w in allocation_targets.weights(session, target)) == 10000
        report = allocation_targets.drift(session, target, day)
        assert report["quality"] == "COMPLETE"
        assert (
            report["total_value"]
            == investment_analytics.allocation(session, day, "BRL")["total_value"]
        )
        assert ledger.balances(session, cutoff=day) == before
        assert prices == [
            (p.id, p.price, p.source) for p in session.scalars(select(PriceObservation))
        ]
        target.name = "Saved planning edit"
    store.close()
    store = DemoStore(root, personal, "unified").initialize()
    with Session(store.engine) as session:
        assert (
            session.get(AllocationTarget, performance_content.identity("household-target")).name
            == "Saved planning edit"
        )
        assert session.get(DemoFixture, unified.VERSION).payload[performance_content.MARKER] == 1
    store.reset()
    with Session(store.engine) as session:
        assert (
            session.get(AllocationTarget, performance_content.identity("household-target")).name
            == "Household investment plan"
        )
        assert ledger.balances(session, cutoff=day) == before
    store.close()
    assert personal.read_bytes() == b"untouched personal data"
