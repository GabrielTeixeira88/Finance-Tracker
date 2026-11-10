"""Clearly fictional, migrated-database regressions for read-only Net Worth displays."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.market_models import FXObservation


def post(api, path, **data):
    response = api.post("/api" + path, json=data)
    assert response.status_code == 201, response.text
    return response.json()


def account(api, name, kind="CHECKING", opening="5000", currency="BRL"):
    return post(
        api,
        "/accounts",
        name=name,
        type=kind,
        currency=currency,
        opening_balance=opening,
        opening_date="2025-01-01",
    )["id"]


def report(api, start="2025-01-01", end="2025-01-31", **params):
    response = api.get(
        "/api/net-worth/history", params=dict(start=start, end=end, details="true", **params)
    )
    assert response.status_code == 200, response.text
    return response.json()


def manual(api, name, kind, category, first, last=None):
    position = post(
        api,
        "/manual-positions",
        name=name,
        kind=kind,
        category=category,
        currency="BRL",
        start_date="2025-01-01",
    )
    if first is not None:
        post(
            api,
            f"/manual-positions/{position['id']}/observations",
            effective_date="2025-01-01",
            amount=first,
        )
    if last is not None:
        post(
            api,
            f"/manual-positions/{position['id']}/observations",
            effective_date="2025-01-31",
            amount=last,
        )
    return position


def test_exact_driver_bridge_internal_transfers_and_history_are_read_only(api):
    checking = account(api, "Fictional checking")
    brokerage = account(api, "Fictional brokerage", "INVESTMENT", "0")
    for kind, amount in [("INCOME", "1000"), ("EXPENSE", "200")]:
        post(
            api,
            "/transactions",
            account_id=checking,
            transaction_type=kind,
            amount=amount,
            currency="BRL",
            transaction_date="2025-01-05",
            description="Synthetic ledger funding",
        )
    post(
        api,
        "/transfers",
        source_account_id=checking,
        destination_account_id=brokerage,
        amount="500",
        currency="BRL",
        transaction_date="2025-01-10",
        description="Synthetic internal contribution",
    )
    asset = post(
        api,
        "/investments/assets",
        symbol="FAKE14",
        name="Synthetic security",
        asset_type="ETF",
        exchange="XBSP",
        currency="BRL",
    )
    post(
        api,
        "/investments/activities",
        request_id=str(uuid4()),
        account_id=brokerage,
        asset_id=asset["id"],
        activity_type="BUY",
        activity_date="2025-01-11",
        quantity="4",
        unit_price="100",
        currency="BRL",
    )
    for day, price in [("2025-01-11", "100"), ("2025-01-31", "110")]:
        post(
            api,
            f"/investments/assets/{asset['id']}/prices",
            price_date=day,
            price=price,
            currency="BRL",
        )
    property = manual(api, "Synthetic property", "ASSET", "REAL_ESTATE", "100000", "101000")
    debt = manual(api, "Synthetic mortgage", "LIABILITY", "MORTGAGE", "50000", "49000")
    before = api.get("/api/accounts").json()
    result = report(api)
    values = {r["key"]: Decimal(r["value"]) for r in result["insights"]["velocity"]["drivers"]}
    assert values == dict(
        funding=Decimal(800),
        investment=Decimal(40),
        other=Decimal(1000),
        debt=Decimal(1000),
        cash_fx=Decimal(0),
    )
    assert sum(values.values()) == Decimal(result["change"]) == 2840
    assert Decimal(result["value"]) == 57840
    assert Decimal(result["points"][0]["breakdown"]["ASSET:REAL_ESTATE"]) == 100000
    assert Decimal(result["points"][-1]["breakdown"]["ASSET:REAL_ESTATE"]) == 101000
    assert result["insights"]["unlinked_mortgages"] == [debt["id"]]
    assert api.get("/api/accounts").json() == before
    assert len(api.get(f"/api/manual-positions/{property['id']}/observations").json()) == 2
    old = api.get("/api/net-worth/history?start=2025-01-01&end=2025-01-31").json()
    assert "insights" not in old and "breakdown" not in old["points"][0]
    assert old["value"] == result["value"]


def test_missing_values_never_become_zero_and_disposed_assets_are_not_stale(api):
    position = manual(api, "Unknown synthetic property", "ASSET", "REAL_ESTATE", None)
    result = report(api)
    assert result["value"] is None
    assert result["points"][0]["breakdown"]["ASSET:REAL_ESTATE"] is None
    assert result["insights"]["velocity"]["available"] is False
    assert result["insights"]["momentum"]["current_change"] is None
    post(
        api,
        f"/manual-positions/{position['id']}/observations",
        effective_date="2025-01-01",
        amount="100",
    )
    assert report(api, end="2025-04-02")["insights"]["stale"][0]["days"] == 91
    assert (
        api.post(
            f"/api/manual-positions/{position['id']}/close", json={"end_date": "2025-04-01"}
        ).status_code
        == 200
    )
    assert report(api, end="2025-04-02")["insights"]["stale"] == []


def test_currency_translation_is_an_explicit_driver_not_a_contribution(api, db_engine):
    account(api, "Synthetic USD cash", opening="100", currency="USD")
    with Session(db_engine) as db, db.begin():
        for day, rate in [(date(2025, 1, 1), "5"), (date(2025, 1, 31), "6")]:
            for quote, value in [("USD", "1"), ("BRL", rate)]:
                db.add(
                    FXObservation(
                        base_currency="EUR",
                        quote_currency=quote,
                        rate_date=day,
                        rate=Decimal(value),
                        provider="ECB",
                        fetched_at=datetime(2025, 2, 1, tzinfo=UTC),
                    )
                )
    result = report(api)
    values = {r["key"]: Decimal(r["value"]) for r in result["insights"]["velocity"]["drivers"]}
    assert values["funding"] == 0 and values["cash_fx"] == 100
    assert sum(values.values()) == Decimal(result["change"]) == 100
    post(
        api,
        "/transactions",
        account_id=api.get("/api/accounts").json()[0]["id"],
        transaction_type="INCOME",
        amount="10",
        currency="USD",
        transaction_date="2025-01-15",
        description="Synthetic missing dated FX",
    )
    missing = report(api)
    assert missing["value"] is not None  # Endpoint FX exists, but the flow-date FX does not.
    assert not missing["insights"]["velocity"]["available"]
    assert "MISSING_FLOW_FX" in missing["insights"]["velocity"]["reasons"]


def test_empty_short_and_bounded_histories(api):
    empty = report(api)
    assert Decimal(empty["value"]) == 0 and empty["components"] == []
    assert all(Decimal(p["value"]) == 0 for p in empty["points"])
    assert (
        report(api, start="2025-01-01", end="2025-01-01")["insights"]["velocity"]["available"]
        is False
    )
    assert (
        api.get("/api/net-worth/history?start=2025-02-01&end=2025-01-01&details=true").status_code
        == 422
    )


def test_momentum_restored_with_explicit_missing_prior_baseline(api):
    account(api, "Checking")
    result = report(api)
    assert Decimal(result["insights"]["momentum"]["current_change"]) == 0
    assert result["insights"]["momentum"]["prior_change"] is None
    assert Decimal(result["value"]) == Decimal("5000")
    assert result["insights"]["velocity"]["available"]


def test_real_market_fixed_income_and_goal_reservation_count_once(tmp_path, monkeypatch):
    from app import wealth
    from app.demo.real_market import END
    from app.demo.runtime import DemoStore
    from app.net_worth_view import history_view

    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    store = DemoStore(
        tmp_path / "owned-brazil", tmp_path / "never-open-normal.db", "real-market-br"
    ).initialize()
    try:
        with Session(store.engine) as db:
            result = history_view(db, date(2026, 9, 1), END, "BRL")
            ordinary = wealth.net_worth(db, date(2026, 9, 1), END, "BRL")
            assert result["value"] == ordinary["value"]
            assert result["insights"]["velocity"]["available"]
            drivers = {d["key"]: d["value"] for d in result["insights"]["velocity"]["drivers"]}
            assert sum(drivers.values()) == result["insights"]["velocity"]["change"]
            assert drivers["investment"] > 0
            assert drivers["other"] == Decimal("8000")  # House +10,000; car -2,000.
            assert drivers["debt"] == 0
            assert len([c for c in result["components"] if "Caixinha" in c["name"]]) == 1
    finally:
        store.close()
