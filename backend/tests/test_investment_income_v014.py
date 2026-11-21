"""Income projections use isolated migrated SQLite and real financial services."""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session
from test_fixed_income import funded, indices, subscribe, terms
from test_investments import account, payload, post

from app.market_models import FXObservation


def interest(api, aid, day, value="100", currency="USD"):
    return post(
        api,
        payload(
            aid,
            activity_type="INTEREST",
            activity_date=day,
            quantity="0",
            unit_price="0",
            gross_amount=value,
            currency=currency,
        ),
    )


def income(api, **params):
    response = api.get(
        "/api/investments/analytics/income",
        params={"start": "2026-02-01", "end": "2026-02-10", "currency": "BRL", **params},
    )
    assert response.status_code == 200, response.text
    return response.json()


def fx(db_engine, day, rate):
    with Session(db_engine) as session, session.begin():
        for currency, value in [("USD", "1"), ("BRL", rate)]:
            session.add(
                FXObservation(
                    base_currency="EUR",
                    quote_currency=currency,
                    rate_date=date.fromisoformat(day),
                    rate=Decimal(value),
                    provider="ECB",
                    fetched_at=datetime.now(UTC),
                )
            )


def test_reporting_uses_each_payment_date_and_preserves_native_income(api, db_engine):
    aid = account(api, currency="USD")
    interest(api, aid, "2026-02-01")
    interest(api, aid, "2026-02-02")
    fx(db_engine, "2026-02-01", "5")
    fx(db_engine, "2026-02-02", "6")
    fx(db_engine, "2026-02-11", "99")
    result = income(api)
    report = result["reporting"]
    assert report["quality"] == "COMPLETE"
    assert Decimal(report["totals"]["net"]) == 1100
    assert [Decimal(event["net"]) for event in report["events"]] == [500, 600]
    assert all(event["currency"] == "USD" for event in result["events"])
    assert [row["fx"]["date"] for row in report["events"]] == ["2026-02-01", "2026-02-02"]
    assert Decimal(report["breakdowns"]["account"][0]["net"]) == 1100
    assert Decimal(report["months"][0]["net"]) == 1100
    assert len(api.get("/api/investments/activities").json()) == 2


def test_reporting_retains_partial_coverage_and_does_not_use_future_or_stale_fx(api, db_engine):
    aid = account(api, currency="USD")
    interest(api, aid, "2026-02-01")
    interest(api, aid, "2026-02-10")
    fx(db_engine, "2026-02-01", "5")
    fx(db_engine, "2026-02-11", "99")
    result = income(api)["reporting"]
    assert result["quality"] == "PARTIAL"
    assert result["totals"]["net"] is None
    assert Decimal(result["known_net"]) == 500
    assert result["events"][1]["net"] is None
    assert result["months"][0]["net"] is None
    assert result["missing_currencies"] == ["USD"]


def accrual(api, start="2026-01-05", end="2026-01-08", **params):
    response = api.get(
        "/api/investments/analytics/income/accrual", params={"start": start, "end": end, **params}
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_gross_net_history_and_redemption_adjusted_period_earnings(api):
    aid = funded(api)
    contract = subscribe(api, terms(aid))
    indices(api)
    before = accrual(api)
    assert Decimal(before["period"]["gross"]) == Decimal("24.024")
    assert Decimal(before["closing"]["gross_interest"]) == Decimal("24.024")
    # Each day independently reuses the existing calendar-day IR/IOF tax service.
    assert Decimal(before["closing"]["estimated_net_earnings"]) < Decimal("24.024")
    history = api.get(
        f"/api/investments/fixed-income/{contract['id']}/history?start=2026-01-05&end=2026-01-08"
    ).json()
    assert (
        history["points"][-1]["estimated_net_earnings"]
        == before["closing"]["estimated_net_earnings"]
    )
    from uuid import uuid4

    result = api.post(
        f"/api/investments/fixed-income/{contract['id']}/redemptions",
        json={
            "request_id": str(uuid4()),
            "settlement_date": "2026-01-08",
            "quantity": "8000",
            "fees": "0",
        },
    )
    assert result.status_code == 201, result.text
    after = accrual(api)
    assert Decimal(after["closing"]["gross_interest"]) == 0
    assert Decimal(after["period"]["gross"]) == Decimal("24.024")
    assert Decimal(after["period"]["redeemed_gross"]) == Decimal("24.024")
    received = income(api, start="2026-01-05", end="2026-01-08")
    assert received["events"] == []
    assert len(received["redemptions"]) == 1


def test_accrual_missing_indices_remain_unavailable_and_scopes_are_respected(api):
    aid = funded(api)
    subscribe(api, terms(aid))
    missing = accrual(api)
    assert missing["closing"]["gross_interest"] is None
    assert missing["period"]["gross"] is None
    assert missing["quality"] == "PARTIAL"
    other = account(api, "Fictional empty investment account")
    empty = accrual(api, account_ids=other)
    assert empty["contracts_count"] == 0
    assert Decimal(empty["closing"]["gross_interest"]) == 0
    assert empty["history"]["points"] == []


def test_partial_redemption_and_subperiod_do_not_lose_earned_interest(api):
    from uuid import uuid4

    aid = funded(api)
    contract = subscribe(api, terms(aid))
    indices(api)
    response = api.post(
        f"/api/investments/fixed-income/{contract['id']}/redemptions",
        json={
            "request_id": str(uuid4()),
            "settlement_date": "2026-01-08",
            "quantity": "4000",
            "fees": "0",
        },
    )
    assert response.status_code == 201, response.text
    result = accrual(api)
    assert Decimal(result["closing"]["principal"]) == 4000
    assert Decimal(result["closing"]["gross_interest"]) == Decimal("12.012")
    assert Decimal(result["period"]["redeemed_gross"]) == Decimal("12.012")
    assert Decimal(result["period"]["gross"]) == Decimal("24.024")
    subperiod = accrual(api, start="2026-01-07")
    # Gross balance on Jan 6 was 8; only subsequent growth belongs in this window.
    assert Decimal(subperiod["opening"]["gross_interest"]) == 8
    assert Decimal(subperiod["period"]["gross"]) == Decimal("16.024")
    assert Decimal(subperiod["period"]["estimated_net"]) == (
        Decimal(subperiod["closing"]["estimated_net_earnings"])
        - Decimal(subperiod["opening"]["estimated_net_earnings"])
        + Decimal(subperiod["period"]["redeemed_net"])
    )
    full = accrual(api, start="2016-09-30")
    assert full["history"]["points"][0]["date"] == "2026-01-05"


def test_reporting_six_decimal_payment_boundary_reconciles_every_group(api, db_engine):
    aid = account(api, currency="USD")
    for day in ("2026-02-01", "2026-02-02"):
        interest(api, aid, day, value="0.000001")
    fx(db_engine, "2026-02-01", "1.5")
    result = income(api)["reporting"]
    assert result["quality"] == "COMPLETE"
    total = sum((Decimal(e["net"]) for e in result["events"]), Decimal(0))
    assert Decimal(result["totals"]["net"]) == total == Decimal("0.000004")
    for dimension in ("year", "type", "account", "security"):
        assert (
            sum((Decimal(e["net"]) for e in result["breakdowns"][dimension]), Decimal(0)) == total
        )
    assert all(e["original"]["net"] == "0.000001" for e in result["events"])
