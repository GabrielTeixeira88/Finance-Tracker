from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_wealth import account, allocate, goal, observe, position, post, summary


def test_brokerage_cash_and_holdings_once(api, db_engine):
    from test_investments import account as brokerage
    from test_investments import asset, payload
    from test_investments import post as activity

    from app.models import PriceObservation

    a, s = brokerage(api), asset(api)
    activity(api, payload(a, s, quantity="70", unit_price="100"))
    with Session(db_engine) as db, db.begin():
        db.add(
            PriceObservation(
                asset_id=UUID(s),
                currency="BRL",
                price_date=date(2026, 2, 1),
                price=Decimal("100"),
                source="MANUAL",
                price_type="RAW_CLOSE",
            )
        )
    r = summary(api, "2026-02-01")
    assert Decimal(r["assets"]) == 10000
    assert Decimal(r["liquid_share"]) == Decimal("0.3")
    assert len(r["components"]) == 1
    assert Decimal(api.get(f"/api/accounts/{a}").json()["balance"]) == 3000
    assert summary(api, "2026-02-09")["value"] is None


def test_currency_conversion_and_no_future_fx(api, db_engine):
    from app.market_models import FXObservation

    account(api, "Synthetic dollar", "100", currency="USD")
    with Session(db_engine) as db, db.begin():
        for currency, rate in [("USD", "2"), ("BRL", "10")]:
            db.add(
                FXObservation(
                    rate_date=date(2025, 2, 1),
                    base_currency="EUR",
                    quote_currency=currency,
                    rate=Decimal(rate),
                    provider="ECB",
                    fetched_at=datetime(2025, 2, 1, tzinfo=UTC),
                )
            )
    assert summary(api, "2025-01-31")["value"] is None
    assert Decimal(summary(api)["value"]) == 500
    assert summary(api, "2025-02-09")["value"] is None


@pytest.mark.parametrize(
    "opening,direction,assets,debts", [("2000", "OUT", 0, 2000), ("100", "IN", 100, 0)]
)
def test_credit_card_signs(api, opening, direction, assets, debts):
    post(
        api,
        "/accounts",
        dict(
            name="Synthetic card",
            type="CREDIT_CARD",
            currency="BRL",
            opening_balance=opening,
            opening_direction=direction,
            opening_date="2025-01-01",
        ),
    )
    r = summary(api)
    assert Decimal(r["assets"]) == assets
    assert Decimal(r["liabilities"]) == debts
    assert Decimal(r["value"]) == assets - debts


def test_correction_rolls_back_on_invalid_replacement(api):
    p = position(api)
    o = observe(api, p, "500")
    r = api.post(
        f"/api/manual-observations/{o['id']}/correct",
        json=dict(amount="600", effective_date="2024-01-01", reason="Synthetic correction"),
    )
    assert r.status_code == 422
    assert Decimal(summary(api)["value"]) == 500
    r = api.post(
        f"/api/manual-observations/{o['id']}/correct",
        json=dict(amount="600", effective_date="2025-01-01", reason="Synthetic correction"),
    )
    assert r.status_code == 200
    assert Decimal(summary(api)["value"]) == 600
    assert len(api.get(f"/api/manual-positions/{p['id']}/observations").json()) == 2


def test_goal_release_and_unallocated_savings(api):
    a = account(api)
    g, h = goal(api), goal(api, "Travel")
    allocate(api, g, a, "12000")
    allocate(api, h, a, "5000")
    rows = api.get("/api/goal-allocations").json()
    assert Decimal(rows[0]["allocated"]) == 17000
    assert Decimal(rows[0]["unallocated"]) == 3000
    assert api.post(f"/api/goals/{g['id']}/status", json={"status": "ARCHIVED"}).status_code == 200
    assert Decimal(api.get("/api/goal-allocations").json()[0]["allocated"]) == 5000
    assert (
        Decimal(api.get("/api/goal-allocations?as_of=2025-02-01").json()[0]["allocated"]) == 17000
    )


def test_manual_negative_adjustment_void_cannot_break_progress(api):
    g = goal(api, mode="MANUAL")
    initial = post(
        api, f"/goals/{g['id']}/entries", dict(amount="100", effective_date="2025-01-01")
    )
    post(
        api,
        f"/goals/{g['id']}/entries",
        dict(amount="50", direction="OUT", effective_date="2025-02-01"),
    )
    assert (
        api.post(
            f"/api/goal-entries/{initial['id']}/void", json={"reason": "Invalid reversal"}
        ).status_code
        == 409
    )
    assert Decimal(api.get(f"/api/goals/{g['id']}").json()["saved"]) == 50


def test_synthetic_wealth_seed_is_repeatable(db_engine):
    from app.seed_wealth_demo import seed_wealth_demo
    from app.wealth_models import Goal, ManualPosition

    with Session(db_engine) as db, db.begin():
        assert seed_wealth_demo(db)
        first = db.scalar(select(Goal))
        first.name = "Synthetic user edit"
    with Session(db_engine) as db, db.begin():
        assert not seed_wealth_demo(db)
        assert db.scalar(select(Goal).where(Goal.name == "Synthetic user edit"))
        assert len(list(db.scalars(select(ManualPosition)))) == 4


def test_goal_zero_target_and_no_end_of_month_before_deadline(api):
    g = post(
        api,
        "/goals",
        dict(
            name="Small target", mode="MANUAL", currency="BRL", target="0", start_date="2025-01-01"
        ),
    )
    r = api.get(f"/api/goals/{g['id']}?as_of=2025-01-01").json()
    assert r["milestones"] == [25, 50, 75, 100]
    h = goal(api, "Short deadline", "MANUAL", deadline="2025-01-20")
    r = api.get(f"/api/goals/{h['id']}?as_of=2025-01-19&monthly=1000").json()
    assert r["required_monthly"] is None


def test_invalid_foreign_key_rejected(api):
    r = api.post(
        "/api/manual-positions",
        json=dict(
            name="Missing property loan",
            kind="LIABILITY",
            category="LOAN",
            currency="BRL",
            start_date="2025-01-01",
            associated_asset_id=str(uuid4()),
        ),
    )
    assert r.status_code == 404


def test_required_consolidated_net_worth_example(api):
    account(api, "Checking", "5000", kind="CHECKING")
    account(api, "Savings", "10000")
    account(api, "Brokerage", "25000", kind="INVESTMENT")
    post(
        api,
        "/accounts",
        dict(
            name="Card",
            type="CREDIT_CARD",
            currency="BRL",
            opening_balance="2000",
            opening_direction="OUT",
            opening_date="2025-01-01",
        ),
    )
    for name, kind, amount in [
        ("Home", "ASSET", "300000"),
        ("Car", "ASSET", "40000"),
        ("Loan", "LIABILITY", "8000"),
        ("Mortgage", "LIABILITY", "150000"),
    ]:
        observe(api, position(api, name, kind), amount)
    result = summary(api)
    assert Decimal(result["assets"]) == 380000
    assert Decimal(result["liabilities"]) == 160000
    assert Decimal(result["value"]) == 220000


def test_simultaneous_allocations_cannot_overreserve(api):
    from concurrent.futures import ThreadPoolExecutor

    a = account(api)
    goals = [goal(api, "First"), goal(api, "Second")]

    def reserve(g):
        return api.post(
            f"/api/goals/{g['id']}/entries",
            json=dict(account_id=a["id"], amount="12000", effective_date="2025-01-01"),
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(reserve, goals))
    assert sorted(statuses) == [201, 409]
    assert Decimal(api.get("/api/goal-allocations").json()[0]["allocated"]) == 12000


def test_ledger_scenario_net_worth_and_cash_flow(api):
    checking = account(api, "Checking", "5000", kind="CHECKING")
    savings = account(api, "Savings", "2000")
    for kind, amount in [("EXPENSE", "200"), ("INCOME", "1000")]:
        post(
            api,
            "/transactions",
            dict(
                account_id=checking["id"],
                transaction_type=kind,
                amount=amount,
                currency="BRL",
                transaction_date="2025-01-02",
                description="Synthetic regression",
            ),
        )
    post(
        api,
        "/transfers",
        dict(
            source_account_id=checking["id"],
            destination_account_id=savings["id"],
            amount="500",
            currency="BRL",
            transaction_date="2025-01-02",
            description="Synthetic transfer",
        ),
    )
    r = summary(api, "2025-01-02")
    values = {c["name"]: Decimal(c["native_value"]) for c in r["components"]}
    assert values == {"Checking": Decimal("5300"), "Savings": Decimal("2500")}
    assert Decimal(r["value"]) == 7800
    totals = api.get("/api/dashboard?month=2025-01").json()["totals"][0]
    assert Decimal(totals["income"]) == 1000
    assert Decimal(totals["expenses"]) == 200
    history = api.get("/api/net-worth/history?start=2025-01-01&end=2025-01-02").json()
    assert Decimal(history["change"]) == 800
    assert Decimal(history["change_ratio"]) == Decimal("0.114286")


def test_optional_debt_terms_are_descriptive_and_exact(api):
    debt = position(
        api,
        "Synthetic fixed loan",
        "LIABILITY",
        interest_rate="4.125",
        minimum_payment="250.50",
        payment_frequency="MONTHLY",
        expected_payoff_date="2035-01-01",
    )
    assert Decimal(debt["interest_rate"]) == Decimal("4.125")
    assert Decimal(debt["minimum_payment"]) == Decimal("250.50")
    observe(api, debt, "10000")
    assert Decimal(summary(api)["value"]) == -10000
    assert Decimal(summary(api, "2026-10-01")["value"]) == -10000
    assert api.get("/api/accounts").json() == []
    bad = api.post(
        "/api/manual-positions",
        json=dict(
            name="Invalid asset terms",
            kind="ASSET",
            category="VEHICLE",
            currency="BRL",
            start_date="2025-01-01",
            interest_rate="5",
        ),
    )
    assert bad.status_code == 422
