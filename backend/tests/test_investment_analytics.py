from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from test_investments import account, asset, payload, post

from app.market_models import FXObservation
from app.market_valuation import history
from app.models import PriceObservation


def price(api, sid, day, value, currency="BRL"):
    response = api.post(
        f"/api/investments/assets/{sid}/prices",
        json={"price_date": day, "price": value, "currency": currency},
    )
    assert response.status_code == 201, response.text


def transfer(api, source, destination, amount="1000", day="2026-02-02"):
    response = api.post(
        "/api/transfers",
        json={
            "source_account_id": source,
            "destination_account_id": destination,
            "amount": amount,
            "currency": "BRL",
            "transaction_date": day,
            "description": "Synthetic scope transfer",
        },
    )
    assert response.status_code == 201, response.text


def report(api, **params):
    response = api.get(
        "/api/investments/analytics/performance",
        params={"start": "2026-02-01", "end": "2026-02-02", **params},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_contribution_is_not_gain_and_scope_transfer_is_internal(api):
    a, b = account(api), account(api, "Other synthetic account")
    sid = asset(api)
    post(api, payload(a, sid, quantity="100"))
    price(api, sid, "2026-02-01", "100")
    price(api, sid, "2026-02-02", "110")
    transfer(api, b, a, "9000")
    individual = report(api, account_ids=a)
    assert Decimal(individual["ending_value"]) == 20000
    assert Decimal(individual["twr"]["value"]) == 10
    assert Decimal(individual["absolute_gain"]["value"]) == 1000
    whole = report(api)
    assert whole["flows"] == []
    assert Decimal(whole["net_external_flows"]) == 0
    assert Decimal(whole["twr"]["value"]) == 5
    explicit_group = report(api, account_ids=[a, b])
    assert explicit_group == whole


def test_release_funding_purchase_and_cash_allocation(api):
    checking = api.post(
        "/api/accounts",
        json={
            "name": "Synthetic release checking",
            "type": "CHECKING",
            "currency": "BRL",
            "opening_balance": "10000",
            "opening_date": "2026-01-01",
        },
    )
    assert checking.status_code == 201
    brokerage = account(api, opening="0")
    sid = asset(api)
    transfer(api, checking.json()["id"], brokerage, "10000", "2026-02-01")
    post(api, payload(brokerage, sid, quantity="70"))
    price(api, sid, "2026-02-01", "100")
    result = report(api, start="2026-01-31", account_ids=brokerage)
    assert len(result["flows"]) == 1
    assert Decimal(result["net_external_flows"]) == 10000
    assert Decimal(result["ending_value"]) == 10000
    assert Decimal(result["absolute_gain"]["value"]) == 0
    assert Decimal(result["twr"]["value"]) == 0
    allocation = api.get(
        "/api/investments/analytics/allocation",
        params={"as_of": "2026-02-02", "account_ids": brokerage},
    ).json()
    assert Decimal(allocation["total_value"]) == 10000
    assert sorted(Decimal(row["value"]) for row in allocation["rows"]) == [3000, 7000]
    assert sum(Decimal(row["weight_percent"]) for row in allocation["groups"]["security"]) == 100


def test_release_5000_transfer_scope_changes_without_gain(api):
    a, b = account(api), account(api, "Synthetic destination", opening="0")
    transfer(api, a, b, "5000")
    for scope, expected in ((a, -5000), (b, 5000)):
        result = report(api, account_ids=scope)
        assert Decimal(result["net_external_flows"]) == expected
        assert Decimal(result["absolute_gain"]["value"]) == 0
    consolidated = report(api)
    assert consolidated["flows"] == []
    assert Decimal(consolidated["ending_value"]) == 10000
    assert Decimal(consolidated["twr"]["value"]) == 0


def test_income_fees_tax_components_and_ledger_unchanged(api):
    a, sid = account(api), asset(api)
    post(api, payload(a, sid))
    price(api, sid, "2026-02-01", "100")
    post(
        api,
        payload(
            a,
            sid,
            activity_type="DIVIDEND",
            activity_date="2026-02-02",
            quantity="0",
            unit_price="0",
            gross_amount="100",
            fees="2",
            taxes="3",
        ),
    )
    before = api.get(f"/api/accounts/{a}").json()
    result = report(api)
    assert result["flows"] == []
    assert Decimal(result["absolute_gain"]["value"]) == 95
    income = api.get("/api/investments/analytics/income?start=2026-02-01&end=2026-02-02").json()
    assert [Decimal(income["months"][0][k]) for k in ("gross", "fees", "taxes", "net")] == [
        100,
        2,
        3,
        95,
    ]
    components = api.get(
        "/api/investments/analytics/insights?start=2026-02-01&end=2026-02-02"
    ).json()
    assert Decimal(components["positions"][0]["total_gain"]) == 95
    assert api.get(f"/api/accounts/{a}").json() == before


def test_allocation_missing_values_never_reweight_known_subset(api):
    a, sid = account(api), asset(api)
    post(api, payload(a, sid))
    result = api.get("/api/investments/analytics/allocation?as_of=2026-02-02").json()
    assert result["quality"] == "PARTIAL"
    assert result["total_value"] is None
    assert all(row["weight_percent"] is None for row in result["groups"]["security"])
    price(api, sid, "2026-02-01", "100")
    complete = api.get("/api/investments/analytics/allocation?as_of=2026-02-02").json()
    assert Decimal(complete["total_value"]) == 10000
    assert sum(Decimal(r["weight_percent"]) for r in complete["groups"]["security"]) == 100
    assert "Unknown" in [r["name"] for r in complete["groups"]["sector"]]
    saved = api.put(
        f"/api/investments/analytics/assets/{sid}/classification",
        json={"sector": " Fictional sector ", "geography": "Synthetic region"},
    )
    assert saved.status_code == 200
    assert (
        api.get(f"/api/investments/analytics/assets/{sid}/classification").json()["sector"]
        == "Fictional sector"
    )


def test_benchmark_shared_boundary_price_return_and_gap(api):
    account(api)
    sid = asset(api)
    price(api, sid, "2026-02-01", "100")
    price(api, sid, "2026-02-02", "110")
    result = report(api, benchmark_id=sid)
    assert Decimal(result["benchmark"]["return"]["value"]) == 10
    assert Decimal(result["benchmark"]["difference_percentage_points"]) == -10
    missing = report(api, start="2026-01-31", benchmark_id=sid)
    assert missing["benchmark"]["return"]["value"] is None


def test_unrounded_history_and_unknown_fx(api, db_engine):
    a, sid = account(api), asset(api)
    post(api, payload(a, sid, quantity="0.000001", unit_price="1"))
    price(api, sid, "2026-02-01", "0.000001")
    with Session(db_engine) as session:
        raw = history(
            session, date(2026, 2, 1), date(2026, 2, 2), account_ids=[UUID(a)], serialize=False
        )
        assert raw["points"][-1]["value"] == Decimal("9999.999999000001")
        assert len(list(session.scalars(select(PriceObservation)))) == 1
    result = report(api, currency="USD")
    assert result["twr"]["value"] is None
    assert result["xirr"]["value"] is None


def test_dated_fx_benchmark_and_unchanged_position_decomposition(api, db_engine):
    a = account(api, currency="USD")
    sid = asset(api, "AAPL", "USD", "NASDAQ")
    post(api, payload(a, sid, currency="USD"))
    price(api, sid, "2026-02-01", "100", "USD")
    price(api, sid, "2026-02-02", "100", "USD")
    with Session(db_engine) as session, session.begin():
        for day, brl in [(date(2026, 2, 1), "5"), (date(2026, 2, 2), "6")]:
            for currency, rate in [("USD", "1"), ("BRL", brl)]:
                session.add(
                    FXObservation(
                        base_currency="EUR",
                        quote_currency=currency,
                        rate_date=day,
                        rate=Decimal(rate),
                        provider="ECB",
                        fetched_at=datetime.now(UTC),
                    )
                )
    result = report(api, currency="BRL", benchmark_id=sid)
    assert Decimal(result["twr"]["value"]) == 20
    assert Decimal(result["benchmark"]["return"]["value"]) == 20
    assert Decimal(result["benchmark"]["difference_percentage_points"]) == 0
    breakdown = api.get(
        "/api/investments/analytics/insights?start=2026-02-01&end=2026-02-02&currency=BRL"
    ).json()["positions"][0]
    assert Decimal(breakdown["fx_contribution"]["value"]) == 1000
    assert Decimal(breakdown["fx_contribution"]["local_price_effect"]) == 0
    assert Decimal(breakdown["total_gain"]) == 0  # Original USD price did not change.


def test_closed_position_income_historical_allocation_and_net_fees(api):
    a, sid = account(api), asset(api)
    post(api, payload(a, sid, fees="10"))
    price(api, sid, "2026-02-01", "100")
    post(
        api,
        payload(
            a,
            sid,
            activity_type="DIVIDEND",
            activity_date="2026-02-02",
            quantity="0",
            unit_price="0",
            gross_amount="100",
            taxes="10",
        ),
    )
    post(
        api,
        payload(
            a, sid, activity_type="SELL", activity_date="2026-02-02", unit_price="110", fees="5"
        ),
    )
    post(
        api,
        payload(
            a,
            activity_type="FEE",
            activity_date="2026-02-02",
            quantity="0",
            unit_price="0",
            gross_amount="3",
        ),
    )
    result = report(api)
    assert Decimal(result["absolute_gain"]["value"]) == 182  # 95 sale uplift + 90 net income - 3.
    income = api.get("/api/investments/analytics/income?start=2026-01-01&end=2026-09-30").json()
    for group in ("year", "account", "security", "type"):
        assert Decimal(income["breakdowns"][group][0]["net"]) == 90
    current = api.get("/api/investments/analytics/allocation?as_of=2026-02-02").json()
    assert len(current["groups"]["security"]) == 1
    past = api.get("/api/investments/analytics/allocation?as_of=2026-02-01").json()
    assert len(past["groups"]["security"]) == 2
    breakdown = api.get(
        "/api/investments/analytics/insights?start=2026-02-01&end=2026-02-02"
    ).json()
    assert sum(Decimal(p["total_gain"]) for p in breakdown["positions"]) == 182
    closed = next(p for p in breakdown["positions"] if p["asset_id"])
    assert Decimal(closed["quantity"]) == 0 and Decimal(closed["realized"]) == 85


def test_benchmark_future_adjusted_and_stale_data_are_unavailable(api, db_engine):
    account(api)
    sid = asset(api)
    price(api, sid, "2026-02-03", "100")
    assert report(api, benchmark_id=sid)["benchmark"]["return"]["value"] is None
    price(api, sid, "2026-02-01", "90")
    with Session(db_engine) as session, session.begin():
        quote = session.scalar(
            select(PriceObservation).where(PriceObservation.price_date == date(2026, 2, 1))
        )
        quote.price_type = "ADJUSTED"
    assert report(api, benchmark_id=sid)["benchmark"]["return"]["value"] is None
    assert (
        report(api, start="2026-03-01", end="2026-03-02", benchmark_id=sid)["benchmark"]["return"][
            "value"
        ]
        is None
    )


def test_zero_length_performance_and_invalid_scope_are_rejected(api):
    sid = asset(api)
    response = api.get(
        "/api/investments/analytics/performance",
        params={"start": "2026-02-01", "end": "2026-02-01", "benchmark_id": sid},
    )
    assert response.status_code == 422
    response = api.get(
        "/api/investments/analytics/performance",
        params={
            "start": "2026-02-01",
            "end": "2026-02-02",
            "account_ids": "00000000-0000-0000-0000-000000000001",
        },
    )
    assert response.status_code == 404
