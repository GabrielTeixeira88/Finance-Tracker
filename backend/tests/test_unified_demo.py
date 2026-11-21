"""One owned demo, exact combined finances, preserved household edits and safe reset."""

import hashlib
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import investment_analytics, investments, ledger, wealth
from app.demo import holdings_activities, real_market, settings_content, unified
from app.demo.app import create_demo_app
from app.demo.real_market_snapshot import END, START
from app.demo.real_market_snapshot import scenario_root as historical_root
from app.demo.runtime import DemoStore
from app.fixed_income_models import FixedIncomeIndex
from app.market_models import MarketSettings
from app.models import DemoFixture, FinancialAccount, InvestmentActivity, Transaction
from app.settings_models import AccountGroup
from app.wealth_models import Goal, ManualPosition


def test_settings_examples_preserve_saved_metadata_and_balances(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), tmp_path / "personal.db", "unified")
    store.initialize()
    with Session(store.engine) as db, db.begin():
        groups = list(db.scalars(select(AccountGroup)))
        assert len(groups) == 2
        groups[0].description = "Fictional user edit"
        before = ledger.balances(db, cutoff=END)
        assert settings_content.extend(db) is False
        assert ledger.balances(db, cutoff=END) == before
    store.close()

    store.initialize()
    with Session(store.engine) as db:
        assert len(list(db.scalars(select(AccountGroup)))) == 2
        assert any(g.description == "Fictional user edit" for g in db.scalars(select(AccountGroup)))
        assert ledger.balances(db, cutoff=END) == before
    store.close()


def test_settings_upgrade_from_v020_preserves_owned_ledger(tmp_path, monkeypatch):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import URL

    from app.config import PROJECT_ROOT

    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), tmp_path / "personal.db", "unified")
    store.initialize()
    with Session(store.engine) as db, db.begin():
        account = db.scalar(select(FinancialAccount).where(FinancialAccount.name == "Checking"))
        account.name = "Fictional saved checking edit"
        fixture = db.get(DemoFixture, unified.VERSION)
        fixture.payload = {
            key: value for key, value in fixture.payload.items() if key != settings_content.MARKER
        }
        before = ledger.balances(db, cutoff=END)
    previous = store.path
    store.close()
    config = Config(str(PROJECT_ROOT / "backend/alembic.ini"))
    config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(previous))
    command.downgrade(config, "sqlite_0020")
    digest = hashlib.sha256(previous.read_bytes()).hexdigest()
    store.initialize()
    assert store.path != previous
    assert hashlib.sha256(previous.read_bytes()).hexdigest() == digest
    with Session(store.engine) as db:
        assert db.scalar(
            select(FinancialAccount).where(FinancialAccount.name == "Fictional saved checking edit")
        )
        assert len(list(db.scalars(select(AccountGroup)))) == 2
        assert ledger.balances(db, cutoff=END) == before
    store.close()


def test_default_combines_household_fixed_income_equities_and_paid_income(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    personal = tmp_path / "personal.db"
    personal.write_bytes(b"untouched personal data")
    with TestClient(
        create_demo_app(personal, tmp_path / "demo"), base_url="http://127.0.0.1:8001"
    ) as api:
        runtime = api.get("/api/runtime").json()
        assert runtime["scenario"] == "unified"
        assert [s["id"] for s in runtime["scenarios"]] == ["unified"]
        store = api.app.state.demo_store
        with Session(store.engine) as db:
            assert unified.seed(db) is False
            assert len(list(db.scalars(select(Goal)))) == 7
            assert len(list(db.scalars(select(ManualPosition)))) == 6
            assert (
                len(
                    list(
                        db.scalars(
                            select(Transaction).where(Transaction.transaction_type == "EXPENSE")
                        )
                    )
                )
                == 555  # Spending extension adds one unbudgeted bicycle repair.
            )
            assert db.scalar(select(MarketSettings)).fx_provider == "SYNTHETIC"
            assert {row.source for row in db.scalars(select(FixedIncomeIndex))} == {"MANUAL"}
            income = investment_analytics.income(db, START, END, currency="BRL")
            assert len(income["events"]) == 135
            assert len(income["breakdowns"]["security"]) == 10
            assert Decimal(income["reporting"]["totals"]["net"]) == Decimal("2564.587500")
            balances = ledger.balances(db, cutoff=END)
            checking = db.get(FinancialAccount, real_market.identity("row/2"))
            # A 35 partial refund and 90 repair are genuine demo ledger additions.
            assert balances[checking.id] == Decimal("116981.870300") + 35 - 90
            assert all(balance >= 0 for balance in balances.values())
            portfolio = investments.portfolio(db, as_of=END, serialize=False)
            assert len(portfolio["positions"]) == 25
            assert investment_analytics.allocation(db, END, "BRL")["quality"] == "COMPLETE"
            net_worth = wealth.net_worth(db, END, END, "BRL")
            # Cash/securities once, plus house/car/equipment less recorded debts.
            assert net_worth["value"] == (
                sum(balances.values(), Decimal(0))
                + sum((row["market_value"] for row in portfolio["positions"]), Decimal(0))
                + Decimal("222500")  # Includes the recorded 2,600 audio collection.
            )
            closed = {
                row["symbol"]: row
                for row in portfolio["positions"]
                if row["symbol"].startswith("SIM-CLOSED-")
            }
            assert closed["SIM-CLOSED-GAIN"]["quantity"] == 0
            assert closed["SIM-CLOSED-GAIN"]["realized"] == Decimal("116")
            assert closed["SIM-CLOSED-LOSS"]["realized"] == Decimal("-154")
            performance = investment_analytics.performance(db, START, END, "BRL")
            assert performance["twr"]["value"] is not None
            assert performance["xirr"]["value"] is not None
        evidence = api.get("/api/demo-control/market-evidence").json()
        assert evidence["enabled"]
        headers = {"X-Finance-Demo": "1", "X-Demo-Generation": runtime["generation"]}
        assert (
            api.post(
                "/api/demo-control/scenario", json={"scenario": "income-portfolio"}, headers=headers
            ).status_code
            == 422
        )
    assert personal.read_bytes() == b"untouched personal data"


def test_existing_household_is_copied_once_with_edits_and_reset_never_touches_archive(
    tmp_path, monkeypatch
):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    base, personal = tmp_path / "demo", tmp_path / "personal.db"
    original = DemoStore(historical_root(base), personal, "real-market-br").initialize()
    with Session(original.engine) as db, db.begin():
        db.get(FinancialAccount, real_market.identity("row/2")).name = "My saved checking"
        goal = db.scalar(select(Goal).order_by(Goal.id))
        goal.name = "My saved goal"
    path = original.path
    original.close()
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    store = DemoStore(
        unified.scenario_root(base), personal, "unified", household_root=historical_root(base)
    ).initialize()
    with Session(store.engine) as db:
        assert db.get(FinancialAccount, real_market.identity("row/2")).name == "My saved checking"
        assert db.scalar(select(Goal).where(Goal.name == "My saved goal")) is not None
        assert db.get(DemoFixture, unified.VERSION) is not None
        count = len(list(db.scalars(select(InvestmentActivity))))
    active = store.path
    store.close()
    store.initialize()
    assert store.path == active
    with Session(store.engine) as db:
        assert len(list(db.scalars(select(InvestmentActivity)))) == count
    store.reset()
    with Session(store.engine) as db:
        assert db.get(FinancialAccount, real_market.identity("row/2")).name == "Checking"
        assert len(list(db.scalars(select(InvestmentActivity)))) == count
    store.close()
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    assert not personal.exists()


def test_failed_household_extension_never_publishes_or_mutates_original(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    base, personal = tmp_path / "demo", tmp_path / "personal.db"
    original = DemoStore(historical_root(base), personal, "real-market-br").initialize()
    path = original.path
    original.close()
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    real_extend, calls = unified.extend, 0

    def fail_copy(session):
        nonlocal calls
        calls += 1
        result = real_extend(session)
        if calls == 2:
            raise ValueError("Injected failure before publishing the extended household")
        return result

    monkeypatch.setattr(unified, "extend", fail_copy)
    store = DemoStore(
        unified.scenario_root(base), personal, "unified", household_root=historical_root(base)
    )
    with pytest.raises(ValueError, match="Injected failure"):
        store.initialize()
    assert not (store.root / "active.json").exists()
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    monkeypatch.setattr(unified, "extend", real_extend)
    store.initialize()
    with Session(store.engine) as db:
        assert len(investment_analytics.income(db, START, END)["events"]) == 135
    store.close()
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    assert not personal.exists()


def test_additive_holdings_upgrade_preserves_old_generation_and_saved_edits(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), tmp_path / "personal.db", "unified")
    # Prepare the previous owned content version, not a personal database.
    with monkeypatch.context() as old:
        old.setattr(holdings_activities, "extend", lambda session: False)
        old.setattr(DemoStore, "needs_content_upgrade", lambda self, path: False)
        store.initialize()
    with Session(store.engine) as db, db.begin():
        checking = db.get(FinancialAccount, real_market.identity("row/2"))
        checking.name = "My preserved account name"
        checking_id = checking.id
        previous_cash = ledger.balances(db, cutoff=END)
        previous_ids = set(db.scalars(select(Transaction.id)))
        goal = db.scalar(select(Goal).order_by(Goal.id))
        goal.name = "My preserved goal"
    previous = store.path
    store.close()
    original_hash = hashlib.sha256(previous.read_bytes()).hexdigest()
    store.initialize()
    assert store.path != previous
    with Session(store.engine) as db:
        assert db.get(FinancialAccount, checking_id).name == "My preserved account name"
        assert db.scalar(select(Goal).where(Goal.name == "My preserved goal"))
        assert set(db.scalars(select(Transaction.id))) == previous_ids
        current_cash = ledger.balances(db, cutoff=END)
        assert current_cash[checking_id] == previous_cash[checking_id]
        assert sum(current_cash.values(), Decimal(0)) - sum(
            previous_cash.values(), Decimal(0)
        ) == Decimal("-38")
        assert holdings_activities.extend(db) is False
        assert len(list(db.scalars(select(ManualPosition)))) == 6
        published = store.path
    store.close()
    assert hashlib.sha256(previous.read_bytes()).hexdigest() == original_hash
    store.initialize()
    assert store.path == published
    store.reset()
    with Session(store.engine) as db:
        assert len(list(db.scalars(select(ManualPosition)))) == 6
    store.close()


def test_holdings_content_failure_leaves_saved_generation_and_pointer_untouched(
    tmp_path, monkeypatch
):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export")
    store = DemoStore(unified.scenario_root(tmp_path / "demo"), tmp_path / "personal.db", "unified")
    with monkeypatch.context() as old:
        old.setattr(holdings_activities, "extend", lambda session: False)
        old.setattr(DemoStore, "needs_content_upgrade", lambda self, path: False)
        store.initialize()
    previous = store.path
    store.close()
    pointer = (store.root / "active.json").read_bytes()
    before = hashlib.sha256(previous.read_bytes()).hexdigest()
    original = holdings_activities.extend
    calls = 0

    def fail_active(session):
        nonlocal calls
        calls += 1
        original(session)
        if calls == 2:
            raise ValueError("Injected additive content failure")

    monkeypatch.setattr(holdings_activities, "extend", fail_active)
    with pytest.raises(ValueError, match="Injected additive"):
        store.initialize()
    assert (store.root / "active.json").read_bytes() == pointer
    assert hashlib.sha256(previous.read_bytes()).hexdigest() == before
    monkeypatch.setattr(holdings_activities, "extend", original)
    store.initialize()
    with Session(store.engine) as db:
        assert len(list(db.scalars(select(ManualPosition)))) == 6
    store.close()
