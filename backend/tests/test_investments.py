import base64
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import InvestmentActivity, InvestmentSourceLink


def account(api, name="Synthetic Brokerage", currency="BRL", opening="10000"):
    r = api.post(
        "/api/accounts",
        json={
            "name": name,
            "type": "INVESTMENT",
            "currency": currency,
            "opening_balance": opening,
            "opening_date": "2026-01-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def asset(api, symbol="FAKE11", currency="BRL", exchange="XBSP"):
    r = api.post(
        "/api/investments/assets",
        json={
            "symbol": symbol,
            "name": "Synthetic fund",
            "asset_type": "ETF",
            "exchange": exchange,
            "currency": currency,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def payload(aid, sid=None, **changes):
    return {
        "request_id": str(uuid4()),
        "account_id": aid,
        "asset_id": sid,
        "activity_type": "BUY",
        "activity_date": "2026-02-01",
        "quantity": "10",
        "unit_price": "100",
        "currency": "BRL",
        **changes,
    }


def post(api, data, status=201):
    r = api.post("/api/investments/activities", json=data)
    assert r.status_code == status, r.text
    return r.json()


def portfolio(api):
    r = api.get("/api/investments/portfolio?as_of=2026-09-30")
    assert r.status_code == 200, r.text
    return r.json()


def test_buy_sell_fees_average_and_cash(api):
    aid, sid = account(api), asset(api)
    buy = payload(aid, sid, fees="5")
    assert (
        api.post("/api/investments/activities/preview", json=buy).json()["cash_amount"]
        == "1005.000000"
    )
    assert api.get("/api/investments/activities").json() == []
    post(api, buy)
    post(api, payload(aid, sid, activity_type="SELL", quantity="4", unit_price="120", fees="5"))
    result = portfolio(api)
    h = result["holdings"][0]
    assert [Decimal(h[k]) for k in ("quantity", "cost_basis", "average_cost", "realized")] == [
        6,
        603,
        Decimal("100.50"),
        73,
    ]
    assert Decimal(result["accounts"][0]["cash"]) == 9470
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "9470.000000"
    assert (
        Decimal(
            api.get("/api/history?period=ALL&end=2026-09-30").json()["series"][0]["total_balance"]
        )
        == 9470
    )
    summary = api.get("/api/budgets/monthly?month=2026-02&currency=BRL").json()["summary"]
    assert Decimal(summary["expenses"]) == Decimal(summary["income"]) == 0


def test_weighted_average_full_close_and_loss(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid))
    post(api, payload(aid, sid, unit_price="120"))
    post(api, payload(aid, sid, activity_type="SELL", quantity="5", unit_price="100"))
    h = portfolio(api)["holdings"][0]
    assert Decimal(h["cost_basis"]) == 1650 and Decimal(h["realized"]) == -50
    post(api, payload(aid, sid, activity_type="SELL", quantity="15", unit_price="130", taxes="10"))
    h = portfolio(api)["holdings"][0]
    assert Decimal(h["quantity"]) == Decimal(h["cost_basis"]) == 0
    assert Decimal(h["realized"]) == 240


@pytest.mark.parametrize(
    "kind,gross,fees,taxes,expected,income",
    [
        ("DIVIDEND", "100", "2", "3", "10095", "95"),
        ("INTEREST", "20", "0", "0", "10020", "20"),
        ("FEE", "5", "0", "0", "9995", "0"),
        ("TAX", "10", "0", "0", "9990", "0"),
    ],
)
def test_income_fee_tax_once(api, kind, gross, fees, taxes, expected, income):
    aid = account(api)
    post(
        api,
        payload(
            aid,
            activity_type=kind,
            quantity="0",
            unit_price="0",
            gross_amount=gross,
            fees=fees,
            taxes=taxes,
        ),
    )
    result = portfolio(api)
    assert Decimal(result["totals"][0]["cash"]) == Decimal(expected)
    assert Decimal(result["totals"][0]["income"]) == Decimal(income)
    assert result["holdings"] == []


@pytest.mark.parametrize(
    "change",
    [
        {"quantity": "-1"},
        {"quantity": "0"},
        {"unit_price": "0"},
        {"unit_price": "-1"},
        {"quantity": 0.5},
        {"gross_amount": "999"},
        {"activity_type": "SELL"},
        {"quantity": "1000"},
        {"currency": "USD"},
        {"quantity": "0.0000001"},
    ],
)
def test_invalid_post_rolls_back_cash_and_activity(api, change):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid, **change), 422)
    assert api.get("/api/investments/activities").json() == []
    assert Decimal(api.get(f"/api/accounts/{aid}").json()["balance"]) == 10000


def test_request_retry_conflict_and_validated_historical_void(api):
    aid, sid = account(api), asset(api)
    data = payload(aid, sid)
    first = post(api, data)
    assert post(api, data)["id"] == first["id"]
    post(api, {**data, "quantity": "11"}, 409)
    sale = post(
        api, payload(aid, sid, activity_type="SELL", quantity="5", activity_date="2026-03-01")
    )
    assert api.post(f"/api/investments/activities/{first['id']}/void").status_code == 422
    post(
        api, payload(aid, sid, activity_type="SELL", quantity="6", activity_date="2026-02-15"), 422
    )
    assert api.post(f"/api/investments/activities/{sale['id']}/void").status_code == 200
    assert api.post(f"/api/investments/activities/{first['id']}/void").status_code == 200
    assert portfolio(api)["holdings"] == []
    assert Decimal(api.get(f"/api/accounts/{aid}").json()["balance"]) == 10000


def test_historical_insert_consolidation_prices_and_no_double_count(api):
    a, b, sid = account(api), account(api, "Synthetic Brokerage B"), asset(api)
    post(api, payload(a, sid, activity_date="2026-03-01", unit_price="120"))
    post(api, payload(a, sid, activity_date="2026-02-01"))
    post(api, payload(b, sid, quantity="5"))
    result = portfolio(api)
    assert Decimal(result["holdings"][0]["quantity"]) == 25
    assert result["totals"][0]["total_value"] is None
    for day, price in [("2026-08-01", "130"), ("2026-09-01", "140"), ("2027-01-01", "999")]:
        assert (
            api.post(
                f"/api/investments/assets/{sid}/prices",
                json={"price_date": day, "price": price, "currency": "BRL"},
            ).status_code
            == 201
        )
    result = portfolio(api)
    h = result["holdings"][0]
    assert Decimal(h["cost_basis"]) == 2700 and Decimal(h["market_value"]) == 3500
    assert Decimal(h["unrealized"]) == 800 and h["price_stale"]
    assert h["price_date"] == "2026-09-01" and h["price_source"] == "MANUAL"
    assert Decimal(result["totals"][0]["total_value"]) == 20800
    assert len(api.get(f"/api/investments/assets/{sid}").json()["positions"]) == 2
    assert (
        api.post(
            f"/api/investments/assets/{sid}/prices",
            json={"price_date": "2026-09-02", "price": "140", "currency": "USD"},
        ).status_code
        == 409
    )
    assert len(api.get(f"/api/investments/accounts/{a}").json()["positions"]) == 1


def test_asset_identity_and_currency_accounts(api):
    assert (
        api.post(
            "/api/investments/assets",
            json={
                "symbol": "   ",
                "name": "Fake",
                "asset_type": "ETF",
                "exchange": "XBSP",
                "currency": "BRL",
            },
        ).status_code
        == 422
    )
    first = asset(api, "Same")
    assert first != asset(api, "Same", exchange="XNYS")
    response = api.post(
        "/api/investments/assets",
        json={
            "symbol": " same ",
            "name": "Fake",
            "asset_type": "ETF",
            "exchange": "xbsp",
            "currency": "BRL",
        },
    )
    assert response.status_code == 409
    usd = asset(api, "Same", currency="USD")
    post(api, payload(account(api), usd), 422)


MAPPING = {
    "columns": {
        "date": 0,
        "type": 1,
        "symbol": 2,
        "exchange": 3,
        "quantity": 4,
        "unit_price": 5,
        "gross_amount": 6,
        "fees": 7,
        "taxes": 8,
        "currency": 9,
        "external_id": 10,
    },
    "source_namespace": "synthetic-broker",
}
CSV = (
    "date,type,symbol,exchange,quantity,price,gross,fees,taxes,currency,id\n"
    "2026-02-01,BUY,FAKE11,XBSP,10,100,1000,5,0,BRL,synthetic1\n"
    "2026-03-01,SELL,FAKE11,XBSP,4,120,480,5,0,BRL,synthetic2\n"
)


def upload(api, aid, content=CSV, config=None):
    r = api.post(
        "/api/investments/imports/preview",
        json={
            "filename": "synthetic-broker.csv",
            "account_id": aid,
            "content_base64": base64.b64encode(content.encode()).decode(),
            "configuration": config or MAPPING,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def confirm(api, batch, status=200):
    r = api.post(
        f"/api/investments/imports/{batch['id']}/confirm",
        json={"preview_token": batch["preview_token"] or "0" * 64, "account_confirmed": True},
    )
    assert r.status_code == status, r.text
    return r.json()


def test_brokerage_preview_confirm_repeat_provenance_and_profiles(api, db_engine):
    aid = account(api)
    asset(api)
    first = upload(api, aid)
    assert first["ready"]
    assert api.get("/api/investments/activities").json() == []
    assert Decimal(api.get(f"/api/accounts/{aid}").json()["balance"]) == 10000
    result = confirm(api, first)
    assert result["counts"]["imported"] == 2
    assert confirm(api, first) == result
    assert confirm(api, upload(api, aid))["counts"]["duplicate"] == 2
    assert Decimal(portfolio(api)["holdings"][0]["quantity"]) == 6
    with Session(db_engine) as session:
        assert len(list(session.scalars(select(InvestmentSourceLink)))) == 4
        assert len(list(session.scalars(select(InvestmentActivity)))) == 2
    profile = api.post(
        "/api/investments/imports/profiles",
        json={"name": "Synthetic profile", "configuration": MAPPING},
    )
    assert profile.status_code == 201
    assert len(api.get("/api/investments/imports/profiles").json()) == 1
    assert api.get("/api/imports/profiles").json() == []
    assert (
        api.put(
            f"/api/imports/profiles/{profile.json()['id']}",
            json={
                "name": "Do not overwrite brokerage mapping",
                "configuration": {
                    "date_format": "%Y-%m-%d",
                    "decimal_separator": ".",
                    "columns": {"date": 0, "description": 1, "amount": 2},
                },
            },
        ).status_code
        == 409
    )
    assert api.get("/api/imports").json() == []
    assert api.get(f"/api/imports/{first['id']}").status_code == 422


def test_import_invalid_and_same_day_legitimate_twins(api):
    aid = account(api)
    missing = upload(api, aid)
    assert not missing["ready"]
    asset(api)
    raw = CSV.splitlines()[0] + "\n" + CSV.splitlines()[1].replace(",synthetic1", ",") + "\n"
    twins = upload(api, aid, raw + raw.splitlines()[1] + "\n")
    assert twins["rows"][1]["status"] == "POSSIBLE_DUPLICATE" and not twins["ready"]
    response = api.patch(
        f"/api/investments/imports/{twins['id']}/rows/{twins['rows'][1]['id']}",
        json={"action": "NEW"},
    )
    assert response.status_code == 200, response.text
    assert confirm(api, response.json())["counts"]["imported"] == 2
    assert Decimal(portfolio(api)["holdings"][0]["quantity"]) == 20
    invalid = upload(api, aid, CSV.replace("4,120,480", "400,120,48000"))
    assert not invalid["ready"]
    confirm(api, invalid, 422)
    assert Decimal(portfolio(api)["holdings"][0]["quantity"]) == 20


def test_direct_database_guards(api, db_engine):
    aid, sid = account(api), asset(api)
    activity = post(api, payload(aid, sid))
    from sqlalchemy.exc import IntegrityError

    with Session(db_engine) as session, pytest.raises(IntegrityError):
        session.execute(
            text("DELETE FROM investment_activities WHERE id=:id"), {"id": UUID(activity["id"]).hex}
        )
        session.commit()
    assert (
        api.put(
            f"/api/accounts/{aid}", json={"name": "Synthetic", "type": "CHECKING", "active": True}
        ).status_code
        == 409
    )


def test_import_failure_during_confirmation_rolls_back_every_row(api, db_engine, monkeypatch):
    from app import investments

    aid = account(api)
    asset(api)
    batch = upload(api, aid)
    original = investments.post
    calls = 0

    def fail_final_second(session, data):
        nonlocal calls
        calls += 1
        # Confirmation first simulates two rows, then posts them atomically.
        if calls == 4:
            from fastapi import HTTPException

            raise HTTPException(422, "Synthetic posting interruption")
        return original(session, data)

    monkeypatch.setattr(investments, "post", fail_final_second)
    confirm(api, batch, 422)
    with Session(db_engine) as session:
        assert list(session.scalars(select(InvestmentActivity))) == []
        assert list(session.scalars(select(InvestmentSourceLink))) == []
    assert Decimal(api.get(f"/api/accounts/{aid}").json()["balance"]) == 10000
    monkeypatch.setattr(investments, "post", original)
    assert confirm(api, batch)["counts"]["imported"] == 2


def test_funding_withdrawal_and_investment_budget_exclusion(api):
    checking = api.post(
        "/api/accounts",
        json={
            "name": "Synthetic checking",
            "type": "CHECKING",
            "currency": "BRL",
            "opening_balance": "5000",
            "opening_date": "2026-01-01",
        },
    ).json()["id"]
    aid, sid = account(api, opening="0"), asset(api)
    for source, destination, amount in [(checking, aid, "2000"), (aid, checking, "100")]:
        response = api.post(
            "/api/transfers",
            json={
                "source_account_id": source,
                "destination_account_id": destination,
                "amount": amount,
                "currency": "BRL",
                "transaction_date": "2026-02-01",
            },
        )
        assert response.status_code == 201
    post(api, payload(aid, sid, quantity="15"))
    assert Decimal(api.get(f"/api/accounts/{aid}").json()["balance"]) == 400
    assert Decimal(portfolio(api)["holdings"][0]["cost_basis"]) == 1500
    summary = api.get("/api/dashboard?month=2026-02").json()["totals"][0]
    assert Decimal(summary["income"]) == Decimal(summary["expenses"]) == 0


def test_fractional_basis_full_close_releases_residual(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid, quantity="3", unit_price="0.333333", fees="0.000001"))
    for _ in range(3):
        post(api, payload(aid, sid, activity_type="SELL", quantity="1", unit_price="1"))
    result = portfolio(api)["holdings"][0]
    assert Decimal(result["cost_basis"]) == 0
    assert Decimal(result["realized"]) == 2


def test_release_weighted_average_example(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid))
    post(api, payload(aid, sid, unit_price="120"))
    h = portfolio(api)["holdings"][0]
    assert [Decimal(h[k]) for k in ("quantity", "cost_basis", "average_cost")] == [20, 2200, 110]
    sale = post(api, payload(aid, sid, activity_type="SELL", quantity="5", unit_price="130"))
    h = portfolio(api)["holdings"][0]
    assert Decimal(sale["gross_amount"]) == 650
    assert Decimal("2200") - Decimal(h["cost_basis"]) == 550
    assert [Decimal(h[k]) for k in ("quantity", "cost_basis", "realized")] == [15, 1650, 100]


def test_release_funding_and_acquisition_no_double_count(api):
    checking = api.post(
        "/api/accounts",
        json={
            "name": "Synthetic funding",
            "type": "CHECKING",
            "currency": "BRL",
            "opening_balance": "10000",
            "opening_date": "2026-01-01",
        },
    ).json()["id"]
    aid, sid = account(api, opening="0"), asset(api)
    response = api.post(
        "/api/transfers",
        json={
            "source_account_id": checking,
            "destination_account_id": aid,
            "amount": "10000",
            "currency": "BRL",
            "transaction_date": "2026-02-01",
            "description": "Synthetic investment funding",
        },
    )
    assert response.status_code == 201, response.text
    post(api, payload(aid, sid, quantity="70"))
    report = portfolio(api)
    assert Decimal(report["accounts"][0]["cash"]) == 3000
    assert Decimal(report["holdings"][0]["cost_basis"]) == 7000
    assert report["accounts"][0]["total_value"] is None
    assert (
        api.post(
            f"/api/investments/assets/{sid}/prices",
            json={
                "price_date": "2026-02-01",
                "price": "100",
                "currency": "BRL",
            },
        ).status_code
        == 201
    )
    assert Decimal(portfolio(api)["totals"][0]["total_value"]) == 10000
    summary = api.get("/api/budgets/monthly?month=2026-02&currency=BRL").json()["summary"]
    assert Decimal(summary["income"]) == Decimal(summary["expenses"]) == 0
