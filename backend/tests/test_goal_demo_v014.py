from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger, wealth
from app.demo import goal_content, unified
from app.demo.runtime import DemoStore
from app.models import DemoFixture
from app.wealth_models import Goal, GoalEntry


def test_goal_extension_is_funded_repeatable_varied_and_isolated(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    personal = tmp_path / "personal.db"
    personal.write_bytes(b"untouched personal workspace")
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), personal, "unified").initialize()
    with Session(store.engine) as session, session.begin():
        before = ledger.balances(session, cutoff=date(2026, 9, 30))
        assert goal_content.extend(session) is False
        assert ledger.balances(session, cutoff=date(2026, 9, 30)) == before
        goals = {row.name: row for row in session.scalars(select(Goal))}
        assert len(goals) == 7
        reports = {
            name: wealth.goal_detail(session, row, date(2026, 9, 30)) for name, row in goals.items()
        }
        assert reports["Wedding celebration"]["saved"] == Decimal("4800")
        assert reports["Wedding celebration"]["trajectory"]["status"] == "AT_RISK"
        assert reports["Vacation"]["trajectory"]["status"] == "ON_TRACK"
        assert reports["Vehicle upgrade"]["trajectory"]["status"] == "OFF_TRACK"
        assert reports["Home studio"]["trajectory"]["status"] == "PAUSED"
        assert reports["Design course"]["saved"] == Decimal("3000")
        assert reports["Photography workshop"]["saved"] == Decimal("1200")
        assert goals["Photography workshop"].status == "ARCHIVED"
        assert reports["Emergency reserve"]["funding_account_id"] is not None
        assert any(row.voided_at for row in session.scalars(select(GoalEntry)))
        ids = sorted(str(row.id) for row in goals.values())
        goals["Wedding celebration"].notes = "Saved demo edit"
    store.close()
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), personal, "unified").initialize()
    with Session(store.engine) as session:
        assert (
            session.get(Goal, goal_content.identity("goal/Wedding celebration")).notes
            == "Saved demo edit"
        )
        assert session.get(DemoFixture, unified.VERSION).payload[goal_content.MARKER] == 1
    store.reset()
    with Session(store.engine) as session:
        assert sorted(str(row.id) for row in session.scalars(select(Goal))) == ids
    store.close()
    assert personal.read_bytes() == b"untouched personal workspace"
