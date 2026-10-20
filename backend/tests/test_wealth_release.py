"""Release acceptance scenarios, using only isolated synthetic records."""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session
from test_wealth import account, allocate, goal, observe, position, post, summary

from app.market_models import FXObservation


def test_historical_eur_jpy_debt_fx_and_summary_agree(api, db_engine):
    account(api, "Synthetic BRL", "5000", currency="BRL")
    account(api, "Synthetic USD", "100", currency="USD")
    rows = []
    for name, kind, currency, amount in [
        ("Synthetic EUR property", "ASSET", "EUR", "1000"),
        ("Synthetic JPY debt", "LIABILITY", "JPY", "10000"),
    ]:
        p = post(
            api,
            "/manual-positions",
            dict(
                name=name, kind=kind, category="OTHER", currency=currency, start_date="2025-01-01"
            ),
        )
        observe(api, p, amount)
        rows.append(p)
    with Session(db_engine) as db, db.begin():
        for day, brl in [(date(2025, 2, 1), "5"), (date(2025, 2, 2), "6")]:
            for currency, rate in [("BRL", brl), ("USD", "2"), ("JPY", "100")]:
                db.add(
                    FXObservation(
                        rate_date=day,
                        base_currency="EUR",
                        quote_currency=currency,
                        rate=Decimal(rate),
                        provider="ECB",
                        fetched_at=datetime(2025, 2, 2, tzinfo=UTC),
                    )
                )
    assert summary(api, "2025-01-31")["value"] is None
    history = api.get("/api/net-worth/history?start=2025-02-01&end=2025-02-02").json()
    assert [Decimal(p["value"]) for p in history["points"]] == [Decimal("9750"), Decimal("10700")]
    for p in history["points"]:
        assert p["value"] == summary(api, p["date"])["value"]
    assert summary(api, "2025-02-10")["value"] is None


def test_missing_liability_fx_never_inflates_complete_total(api):
    account(api, amount="10000")
    debt = post(
        api,
        "/manual-positions",
        dict(
            name="Foreign debt",
            kind="LIABILITY",
            category="LOAN",
            currency="JPY",
            start_date="2025-01-01",
        ),
    )
    observe(api, debt, "1000")
    result = summary(api)
    assert result["value"] is None and not result["complete"]
    assert Decimal(result["known_value"]) == 10000
    assert any("Missing historical FX" in p["missing"] for p in result["components"])


def test_goal_monthly_1500_lifecycle_and_no_deadline(api):
    g = post(
        api,
        "/goals",
        dict(
            name="Synthetic target",
            mode="MANUAL",
            currency="BRL",
            target="30000",
            start_date="2025-01-01",
            deadline="2025-12-31",
        ),
    )
    post(api, f"/goals/{g['id']}/entries", dict(amount="12000", effective_date="2025-01-01"))
    detail = api.get(f"/api/goals/{g['id']}?as_of=2025-01-01&monthly=1500").json()
    assert Decimal(detail["required_monthly"]) == 1500
    assert detail["projected_completion"] == "2025-12-31"
    assert (
        api.get(f"/api/goals/{g['id']}?as_of=2025-01-01&monthly=0").json()["projected_completion"]
        is None
    )
    for status in ["PAUSED", "ACTIVE", "COMPLETED", "ACTIVE"]:
        assert api.post(f"/api/goals/{g['id']}/status", json={"status": status}).status_code == 200
    post(api, f"/goals/{g['id']}/entries", dict(amount="20000", effective_date="2025-02-01"))
    detail = api.get(f"/api/goals/{g['id']}?as_of=2025-02-01").json()
    assert Decimal(detail["remaining"]) == 0
    assert detail["milestones"] == [25, 50, 75, 100]
    assert detail["projected_completion"] == "2025-02-01"
    h = goal(api, "No deadline", "MANUAL")
    assert api.get(f"/api/goals/{h['id']}").json()["required_monthly"] is None


def test_goal_currency_rejection_and_later_cash_shortfall(api):
    a = account(api)
    foreign = account(api, "Foreign savings", "20000", currency="USD")
    g = goal(api)
    bad = api.post(
        f"/api/goals/{g['id']}/entries",
        json=dict(account_id=foreign["id"], amount="1000", effective_date="2025-01-01"),
    )
    assert bad.status_code == 422
    allocate(api, g, a, "12000")
    post(
        api,
        "/transactions",
        dict(
            account_id=a["id"],
            transaction_type="EXPENSE",
            amount="10000",
            currency="BRL",
            transaction_date="2025-02-01",
            description="Synthetic later expense",
        ),
    )
    detail = api.get(f"/api/goals/{g['id']}?as_of=2025-02-01").json()
    assert detail["saved"] is None and detail["warnings"]
    assert detail["history"][-1]["value"] is None
    assert Decimal(api.get(f"/api/accounts/{a['id']}").json()["balance"]) == 10000


def test_manual_debt_reduction_and_interest_are_separate(api):
    a = account(api, amount="5000")
    debt = position(api, "Synthetic manual loan", "LIABILITY")
    observe(api, debt, "8000")
    observe(api, debt, "7000", "2025-02-01")
    # Manual principal observations never fabricate bank movements or spending.
    assert Decimal(api.get(f"/api/accounts/{a['id']}").json()["balance"]) == 5000
    for amount in ["450", "50"]:
        post(
            api,
            "/transactions",
            dict(
                account_id=a["id"],
                transaction_type="EXPENSE",
                amount=amount,
                currency="BRL",
                transaction_date="2025-02-01",
                description="Synthetic interest or fee",
            ),
        )
    totals = api.get("/api/dashboard?month=2025-02").json()["totals"][0]
    assert Decimal(totals["expenses"]) == 500
    assert Decimal(summary(api)["liabilities"]) == 7000
    assert Decimal(api.get(f"/api/accounts/{a['id']}").json()["balance"]) == 4500
    # This manual workflow intentionally does not claim an integrated 1,500 payment.
