"""Official-data regression cases plus clearly synthetic private-export parser tests."""

import json
import sqlite3
from datetime import date, timedelta
from decimal import Decimal, localcontext
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import fixed_income, investment_analytics, investments, ledger, wealth
from app.demo.app import create_demo_app
from app.demo.real_market import CAIXINHA, END, START, VERSION, seed
from app.demo.real_market_report import report
from app.demo.real_market_snapshot import ETF_PLAN, load_etfs, load_official, scenario_root
from app.demo.runtime import DemoStore
from app.fixed_income_calendar import days
from app.fixed_income_models import FixedIncomeIndex
from app.historical_cdi import accumulate, parse_sgs
from app.investment_schemas import settled
from app.models import Asset, DemoFixture, InvestmentActivity, PriceObservation, Transaction
from app.wealth_models import Goal, GoalAccountFunding


@pytest.fixture
def market(tmp_path, monkeypatch):
    # Even a developer who configured a private export gets isolated test data.
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    store = DemoStore(tmp_path / "market", tmp_path / "normal.db", "real-market-br").initialize()
    try:
        with Session(store.engine) as db:
            yield db
    finally:
        store.close()


def test_official_snapshot_units_annual_crosscheck_and_calendar():
    data, factors = load_official()
    assert len(factors) == 502
    assert factors[date(2024, 10, 1)] == Decimal("1.00040168")
    assert factors[END] == Decimal("1.00050788")
    assert not (set(days(START, END)) - factors.keys())
    assert data["sources"]["treasury"]["maturity"] == "2029-03-01"
    assert data["sources"]["treasury"]["license"] == "ODbL-1.0"


@pytest.mark.parametrize("multiplier", ["100", "110", "120"])
def test_daily_cdi_percent_is_applied_per_day(multiplier):
    rates = {date(2025, 1, 6): Decimal("0.05"), date(2025, 1, 7): Decimal("0.06")}
    p = Decimal(multiplier)
    expected = (1 + Decimal("0.0005") * p / 100) * (1 + Decimal("0.0006") * p / 100)
    assert accumulate(rates, sorted(rates), p) == expected
    assert accumulate(rates, [date(2025, 1, 8)], p) is None


@pytest.mark.parametrize(
    "payload",
    [
        b'[{"data":"06/01/2025","valor":0.05}]',
        b'[{"data":"06/01/2025","valor":"NaN"}]',
        b'[{"data":"06/01/2025","valor":"-1"}]',
        b'[{"data":"06/01/2025","valor":"0.05"},{"data":"06/01/2025","valor":"0.05"}]',
    ],
)
def test_invalid_cdi_payloads_fail_closed(payload):
    with pytest.raises(ValueError):
        parse_sgs(payload)


def test_independent_real_rate_compounding_cost_tax_and_no_income(market):
    official, _ = load_official()
    rates = parse_sgs(json.dumps(official["cdi"]).encode())
    positions = report(market)["positions"]
    with localcontext() as ctx:
        ctx.prec = 60
        for position in positions:
            c = position["contract"]
            start = date.fromisoformat(c["settlement_date"])
            kind = c["instrument_type"]
            if kind == "TESOURO_SELIC":
                continue
            multiplier = Decimal(c["cdi_percent"])
            independent = Decimal(1)
            for day in days(start, END):
                independent *= (
                    Decimal("1.135") ** (Decimal(1) / 252)
                    if kind == "CDB_FIXED"
                    else 1 + rates[day] * multiplier / 10000
                )
            # Existing six-decimal per-unit settlement convention remains intact.
            expected = settled(independent) * Decimal(position["quantity"])
            assert Decimal(position["gross_value"]) == expected
            tax = fixed_income.tax_estimate(
                Decimal(position["principal"]), expected, (END - start).days
            )
            assert Decimal(position["income_tax"]) == tax["income_tax"]
    from app.models import FinancialAccount

    investment_ids = set(
        market.scalars(select(FinancialAccount.id).where(FinancialAccount.type == "INVESTMENT"))
    )
    assert all(
        t.transaction_type in {"OPENING_BALANCE", "TRANSFER"}
        for t in market.scalars(
            select(Transaction).where(Transaction.account_id.in_(investment_ids))
        )
    )
    income = investment_analytics.income(market, START, END)
    assert income["events"] == []
    totals = ledger.dashboard(market, "2026-09").totals
    assert len(totals) == 1
    assert totals[0].income == Decimal("9800")
    assert totals[0].expenses == Decimal("4129.82")


def test_caixinha_lots_treasury_portfolio_networth_and_goal(market):
    data = report(market)
    assert len(data["positions"]) == 12
    c = data["caixinha"]
    assert c["principal"] == "3300.000000"
    assert c["gross_value"] == "3865.733100"
    assert c["income_tax"] == "101.753245"
    assert c["estimated_net"] == "3763.979855"
    assert len(
        [p for p in data["positions"] if p["contract"]["instrument_type"] == "RDB_CDI"]
    ) == len(CAIXINHA)
    treasury = next(
        p for p in data["positions"] if p["contract"]["instrument_type"] == "TESOURO_SELIC"
    )
    assert treasury["contract"]["maturity_date"] == "2029-03-01"
    assert treasury["contract"]["acquisition_price"] == "15763.630000"
    assert treasury["quantity"] == "0.190000"
    assert treasury["principal"] == "2995.089700"
    assert treasury["gross_value"] == "3792.576700"
    # The prior-day purchase PU belongs to the activity's execution assumption,
    # never to a fabricated same-day closing-price observation.
    marks = list(market.scalars(select(PriceObservation)))
    assert len(marks) == 498 and {m.price_type for m in marks} == {"OFFICIAL_PU"}
    portfolio = investments.portfolio(market, as_of=END)
    assert portfolio["totals"][0]["cash"] == "0.000000"
    assert portfolio["totals"][0]["total_value"] == "14908.312300"
    goal = market.scalar(select(Goal).where(Goal.name == "Emergency reserve"))
    detail = wealth.goal_detail(market, goal, END)
    assert detail["saved"] == Decimal(c["gross_value"])
    assert detail["history"][0]["value"] == 1000
    assert detail["history"][-1]["value"] == Decimal(c["gross_value"])
    before = investments.wire(wealth.net_worth(market, END, END, "BRL"))
    assert Decimal(before["points"][0]["value"]) == Decimal("149890.182600")
    assert wealth.goal_progress(market, goal, date(2024, 12, 1))[0] == 0


def test_missing_cdi_remains_unavailable_not_zero_or_current_rate(market):
    row = market.scalar(
        select(FixedIncomeIndex).where(FixedIncomeIndex.observation_date == date(2026, 9, 1))
    )
    market.delete(row)
    market.flush()
    assert report(market)["caixinha"]["gross_value"] is None
    goal = wealth.goal_detail(
        market, market.scalar(select(Goal).where(Goal.name == "Emergency reserve")), END
    )
    assert goal["saved"] is None and goal["warnings"]
    assert investments.portfolio(market, as_of=END)["totals"][0]["total_value"] is None


def test_different_start_dates_and_contribution_independent_returns(market):
    early = fixed_income.overview(market, date(2025, 1, 7))["positions"]
    assert {p["contract"]["instrument_type"] for p in early} == {
        "CDB_CDI",
        "RDB_CDI",
        "TESOURO_SELIC",
    }
    assert not any("CDB C" in p["name"] for p in early)
    performance = investment_analytics.performance(market, START, END, "BRL")
    assert performance["absolute_gain"]["value"] == "2613.222600"
    assert performance["twr"]["quality"] == performance["xirr"]["quality"] == "COMPLETE"
    assert performance["net_external_flows"] == "12295.089700"
    assert len(performance["valuation"]["purchase_markers"]) == 12
    # Independent discounted-cash-flow residual, using the scheduled applications
    # rather than the performance service's reported flow list or root solver.
    from app.demo.real_market import CDBS

    applications = [
        (date.fromisoformat(purchase), Decimal(principal))
        for _key, purchase, _maturity, principal, *_terms in CDBS
    ]
    applications += [(date.fromisoformat(day), Decimal(amount)) for day, amount in CAIXINHA]
    applications += [(date(2025, 1, 7), Decimal("2995.089700"))]
    with localcontext() as ctx:
        ctx.prec = 60
        base_day = min(day for day, _ in applications)
        rate = Decimal(performance["xirr"]["value"]) / 100
        discounted_outflows = sum(
            amount / (1 + rate) ** (Decimal((day - base_day).days) / 365)
            for day, amount in applications
        )
        discounted_terminal = Decimal(performance["ending_value"]) / (1 + rate) ** (
            Decimal((END - base_day).days) / 365
        )
        assert abs(discounted_terminal - discounted_outflows) < Decimal("0.002")
    funding = market.scalar(select(GoalAccountFunding))
    with pytest.raises(HTTPException) as error:
        wealth.reserve_investment_account(
            market,
            market.scalar(select(Goal).where(Goal.name == "Emergency reserve")),
            funding.account_id,
            date(2024, 12, 2),
        )
    assert error.value.status_code == 409


def test_rdb_lot_specific_short_term_iof_and_ir(market):
    positions = fixed_income.overview(market, date(2026, 5, 14))["positions"]
    latest = next(p for p in positions if p["name"] == "Caixinha RDB · 2026-05-04")
    gain = Decimal(latest["gross_interest"])
    iof = settled(gain * Decimal("0.66"))  # ten calendar days, official IOF schedule
    assert gain > 0
    assert Decimal(latest["iof"]) == iof
    assert Decimal(latest["income_tax"]) == settled((gain - iof) * Decimal("0.225"))
    old = next(p for p in positions if p["name"] == "Caixinha RDB · 2024-12-02")
    assert Decimal(old["iof"]) == 0 and Decimal(old["tax_rate"]) == Decimal("17.5")


def synthetic_export():
    instruments = {}
    for symbol in ["WRLD11", "IVVB11"]:
        quotes, day = [], START
        while day <= END:
            if day.weekday() < 5:
                close = Decimal("100.25") + Decimal((day - START).days % 29) / 10
                quotes.append({"date": day.isoformat(), "close": format(close, "f")})
            day += timedelta(days=1)
        instruments[symbol] = dict(
            currency="BRL",
            exchange="B3",
            provider="Explicitly synthetic parser test",
            license="Synthetic test fixture, not market observations",
            license_terms_url="https://example.test/synthetic-license",
            actions_reviewed_through=END.isoformat(),
            source_url="https://example.test/synthetic-prices",
            action_source_url="https://example.test/synthetic-action-review",
            retrieved_on="2026-11-03",
            corporate_actions_reviewed=True,
            corporate_actions=[],
            prices=quotes,
        )
    return dict(
        start=START.isoformat(),
        end=END.isoformat(),
        convention="RAW_CLOSE",
        authorized_local_use=True,
        instruments=instruments,
    )


def test_local_export_validation_and_synthetic_multiple_purchase_integration(tmp_path, monkeypatch):
    path = tmp_path / "explicitly-synthetic-export.json"
    path.write_text(json.dumps(synthetic_export()))
    snapshot = load_etfs(path)
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: snapshot)
    store = DemoStore(tmp_path / "etf", tmp_path / "normal.db", "real-market-br").initialize()
    try:
        with Session(store.engine) as db:
            holdings = investments.portfolio(db, as_of=END)["holdings"]
            for symbol, quantity in [("WRLD11", "7"), ("IVVB11", "4")]:
                h = next(h for h in holdings if h["symbol"] == symbol)
                assert Decimal(h["quantity"]) == Decimal(quantity)
                independent_cost = sum(
                    Decimal(units)
                    * snapshot["instruments"][symbol]["quotes"][date.fromisoformat(day)]
                    for ticker, day, units in ETF_PLAN
                    if ticker == symbol
                )
                assert Decimal(h["cost_basis"]) == independent_cost
                assert Decimal(h["average_cost"]) == settled(independent_cost / Decimal(quantity))
                value = snapshot["instruments"][symbol]["quotes"][END] * Decimal(quantity)
                assert Decimal(h["unrealized"]) == value - independent_cost
                assert Decimal(h["realized"]) == 0
                aid = db.scalar(select(Asset.id).where(Asset.symbol == symbol))
                purchases = list(
                    db.scalars(select(InvestmentActivity).where(InvestmentActivity.asset_id == aid))
                )
                assert len(purchases) == 3
                assert {p.activity_date.isoformat() for p in purchases} == {
                    d for s, d, _ in ETF_PLAN if s == symbol
                }
            assert seed(db) is False
            assert investments.portfolio(db, as_of=date(2024, 11, 4))["holdings"] == []
            assert (
                db.get(DemoFixture, VERSION).payload["market_evidence"]["etf_coverage"]
                == "COMPLETE"
            )
    finally:
        store.close()


@pytest.mark.parametrize("change", ["adjusted", "action", "missing", "number", "token"])
def test_private_export_refuses_unverified_observations(tmp_path, change):
    data = synthetic_export()
    item = data["instruments"]["WRLD11"]
    if change == "adjusted":
        data["convention"] = "ADJUSTED"
    if change == "action":
        item["corporate_actions"] = [{"type": "SPLIT"}]
    if change == "missing":
        item["prices"] = item["prices"][:1]
    if change == "number":
        item["prices"][0]["close"] = 100.25
    if change == "token":
        item["source_url"] += "?token=synthetic-test-only"
    path = tmp_path / "synthetic.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        load_etfs(path)


def test_scenario_switch_reset_isolation_and_stale_generation(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export.json")
    normal = tmp_path / "normal.db"
    with sqlite3.connect(normal) as db:
        db.execute("CREATE TABLE sentinel (name TEXT)")
        db.execute("INSERT INTO sentinel VALUES ('Synthetic test sentinel')")
    before = normal.read_bytes()
    app = create_demo_app(normal, tmp_path / "demo", scenario="synthetic", legacy_fixture=True)
    with TestClient(app, base_url="http://127.0.0.1:8001") as client:
        runtime = client.get("/api/runtime").json()
        client.headers.update({"X-Finance-Demo": "1", "X-Demo-Generation": runtime["generation"]})
        response = client.post("/api/demo-control/scenario", json={"scenario": "real-market-br"})
        assert response.status_code == 200, response.text
        selected = response.json()
        assert selected["scenario"] == "real-market-br"
        assert (
            client.post(
                "/api/demo-control/reset", json={"confirmation": "RESET FICTIONAL DEMO"}
            ).status_code
            == 409
        )
        client.headers["X-Demo-Generation"] = selected["generation"]
        baseline = client.get("/api/demo-control/market-evidence").json()
        assert baseline["caixinha"]["principal"] == "3300.000000"
        assert baseline["etf_coverage"] == "UNAVAILABLE"
        response = client.post(
            "/api/demo-control/reset", json={"confirmation": "RESET FICTIONAL DEMO"}
        )
        assert response.status_code == 200, response.text
        assert client.get("/api/demo-control/market-evidence").json() == baseline
        client.headers["X-Demo-Generation"] = response.json()["generation"]
        assert (
            client.post("/api/demo-control/scenario", json={"scenario": "synthetic"}).status_code
            == 200
        )
        assert client.get("/api/runtime").json()["scenario"] == "synthetic"
    assert normal.read_bytes() == before
    assert scenario_root(tmp_path / "demo").is_dir()


def test_official_seed_is_repeatable_and_preserves_user_edits(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    from test_demo_workspace import snapshot

    one = DemoStore(tmp_path / "one", tmp_path / "normal.db", "real-market-br").initialize()
    two = DemoStore(tmp_path / "two", tmp_path / "normal.db", "real-market-br").initialize()
    try:
        assert snapshot(one.path) == snapshot(two.path)
        with Session(one.engine) as db, db.begin():
            db.scalar(select(Goal)).name = "Synthetic reviewer edit"
            assert seed(db) is False
        before = snapshot(one.path)
        one.close()
        one = DemoStore(tmp_path / "one", tmp_path / "normal.db", "real-market-br").initialize()
        assert snapshot(one.path) == before
    finally:
        one.close()
        two.close()


def test_private_export_setup_is_idempotent_and_refuses_overwrite(tmp_path, monkeypatch):
    from app.demo.prepare_real_market import install_export

    target = tmp_path / "private" / "etfs.json"
    monkeypatch.setattr("app.demo.prepare_real_market.LOCAL_ETF", target)
    source = tmp_path / "synthetic-export.json"
    source.write_text(json.dumps(synthetic_export()))
    assert install_export(source)
    assert install_export(source) is False
    old = target.read_bytes()
    data = synthetic_export()
    data["instruments"]["WRLD11"]["prices"][0]["close"] = "101.25"
    source.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="different ETF snapshot"):
        install_export(source)
    assert target.read_bytes() == old


def test_populated_contract_migration_preserves_rows_and_retention_triggers(tmp_path):
    from uuid import uuid4

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import URL, text
    from sqlalchemy.exc import IntegrityError
    from test_demo_workspace import snapshot

    from app.database import make_engine
    from app.fixed_income_schemas import Subscription
    from app.schemas import AccountCreate

    path = tmp_path / "populated-pre0017.db"
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(path))
    command.upgrade(config, "sqlite_0016")
    engine = make_engine(config.attributes["database_url"])
    with Session(engine) as db, db.begin():
        account = ledger.create_account(
            db,
            AccountCreate(
                name="Synthetic migration account",
                type="INVESTMENT",
                currency="BRL",
                opening_balance="5000",
                opening_date="2024-10-01",
            ),
        )
        for kind, quantity, price, percent in [
            ("CDB_CDI", "1000", "1", "100"),
            ("TESOURO_SELIC", "0.1", "10000", "0"),
        ]:
            fixed_income.subscribe(
                db,
                Subscription(
                    request_id=uuid4(),
                    account_id=account.id,
                    name="Synthetic migration " + kind,
                    issuer="Synthetic test issuer",
                    instrument_type=kind,
                    settlement_date="2025-01-06",
                    maturity_date="2027-01-06",
                    redemption_from="2025-01-06",
                    quantity=quantity,
                    acquisition_price=price,
                    cdi_percent=percent,
                    index_source="MANUAL",
                ),
            )
    engine.dispose()
    before = snapshot(path)
    assert len(before["fixed_income_contracts"]) == 2
    command.upgrade(config, "head")
    command.check(config)
    after = snapshot(path)
    assert {k: v for k, v in before.items() if k != "alembic_version"} == {
        k: after[k] for k in before if k != "alembic_version"
    }
    engine = make_engine(config.attributes["database_url"])
    try:
        for statement in [
            "UPDATE fixed_income_contracts SET notes='Synthetic mutation'",
            "DELETE FROM fixed_income_contracts",
        ]:
            with Session(engine) as db, pytest.raises(IntegrityError):
                db.execute(text(statement))
    finally:
        engine.dispose()


def test_official_verifier_compares_dated_observations_without_overwriting():
    from app.demo.verify_real_market import verify

    official, _ = load_official()

    def fetch(url):
        if ".sgs.12/" in url:
            return json.dumps(official["cdi"]).encode()
        if ".sgs.4389/" in url:
            return json.dumps(official["cdi_annual"]).encode()
        header = (
            "Tipo Titulo;Data Vencimento;Data Base;PU Compra Manha;PU Venda Manha;PU Base Manha"
        )
        lines = [header]
        for row in official["treasury"]:
            day = date.fromisoformat(row["date"]).strftime("%d/%m/%Y")
            lines.append(
                ";".join(
                    [
                        "Tesouro Selic",
                        "01/03/2029",
                        day,
                        row["purchase"].replace(".", ","),
                        row["sale"].replace(".", ","),
                        row["base"].replace(".", ","),
                    ]
                )
            )
        return "\n".join(lines).encode()

    assert verify(fetch)

    def corrected(url):
        if ".sgs.12/" in url:
            data = json.loads(fetch(url))
            data[0]["valor"] = "0.04"  # Deliberate test correction, never written to the snapshot.
            return json.dumps(data).encode()
        return fetch(url)

    with pytest.raises(ValueError, match="CDI history differs"):
        verify(corrected)


def test_public_demo_defaults_to_brazil_and_cannot_select_legacy_holdings(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "no-export.json")
    normal = tmp_path / "normal.db"
    app = create_demo_app(normal, tmp_path / "demo")
    with TestClient(app, base_url="http://127.0.0.1:8001") as client:
        runtime = client.get("/api/runtime").json()
        assert runtime["scenario"] == "real-market-br"
        assert [r["id"] for r in runtime["scenarios"]] == ["real-market-br"]
        accounts = client.get("/api/accounts").json()
        assert {r["name"] for r in accounts} == {
            "Checking",
            "Savings",
            "Brazilian Brokerage",
            "Caixinha — Emergency Reserve",
        }
        assert all(r["currency"] == "BRL" for r in accounts)
        assets = client.get("/api/investments/assets").json()
        assert all(r["currency"] == "BRL" and not r["symbol"].startswith("DEMO") for r in assets)
        client.headers.update({"X-Finance-Demo": "1", "X-Demo-Generation": runtime["generation"]})
        assert (
            client.post("/api/demo-control/scenario", json={"scenario": "synthetic"}).status_code
            == 422
        )
        assert client.get("/api/runtime").json()["scenario"] == "real-market-br"
        assert client.get("/api/demo-control/files/demo-checking.csv").status_code == 409
    assert not normal.exists()
    assert not (tmp_path / "demo").exists()  # Never opens/adopts the legacy root.


def test_public_cli_does_not_offer_legacy_synthetic_dataset(monkeypatch):
    from app.demo.__main__ import main

    monkeypatch.setattr("sys.argv", ["app.demo", "--scenario", "synthetic"])
    with pytest.raises(SystemExit) as error:
        main()
    assert error.value.code == 2


def test_household_history_populates_spending_and_shared_goals_without_foreign_investments(market):
    from app.models import FinancialAccount
    from app.wealth_models import GoalEntry

    goals = {g.name: wealth.goal_detail(market, g, END) for g in market.scalars(select(Goal))}
    assert set(goals) == {
        "Emergency reserve",
        "Vacation",
        "Vehicle upgrade",
        "Design course",
        "Home studio",
    }
    assert goals["Design course"]["goal"].status == "COMPLETED"
    assert goals["Home studio"]["goal"].status == "PAUSED"
    assert goals["Vacation"]["saved"] == 6000
    assert goals["Vehicle upgrade"]["saved"] == 1000
    assert goals["Vehicle upgrade"]["schedule_pace"]["status"] == "OFF_TRACK"
    assert goals["Emergency reserve"]["saved"] == Decimal("3865.733100")
    assert len(list(market.scalars(select(GoalEntry)))) == 24
    saved = next(r for r in wealth.savings_allocations(market, END) if r["name"] == "Savings")
    assert saved["balance"] == 18000 and saved["allocated"] == 12000
    assert saved["unallocated"] == 6000 and not saved["overallocated"]
    for i in range(24):
        y, m = divmod(2024 * 12 + 9 + i, 12)
        totals = ledger.dashboard(market, f"{y}-{m + 1:02}").totals[0]
        assert totals.income > 0 and totals.expenses > 0
    transactions = list(market.scalars(select(Transaction)))
    expenses = [r for r in transactions if r.transaction_type == "EXPENSE"]
    income = [r for r in transactions if r.transaction_type == "INCOME"]
    assert len(expenses) == 554 and len(income) == 32
    assert sum((r.amount for r in expenses), Decimal(0)) == Decimal("102727.04")
    assert sum((r.amount for r in income), Decimal(0)) == Decimal("225004")
    assert all(a.currency == "BRL" for a in market.scalars(select(FinancialAccount)))
    # Transfers reserve savings / fund investments, never inflate spending.
    investment_ids = set(
        market.scalars(select(FinancialAccount.id).where(FinancialAccount.type == "INVESTMENT"))
    )
    assert all(r.account_id not in investment_ids for r in expenses)
