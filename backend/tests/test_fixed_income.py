"""Synthetic financial regressions against migrated SQLite and real posting services."""

from datetime import date, timedelta
from decimal import Decimal, localcontext
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.fixed_income import tax_estimate
from app.fixed_income_calendar import business_day
from app.fixed_income_models import FixedIncomeContract
from app.investment_schemas import settled


def funded(api, currency="BRL", amount="50000"):
    response = api.post(
        "/api/accounts",
        json=dict(
            name="Synthetic FI brokerage",
            type="INVESTMENT",
            currency=currency,
            opening_balance=amount,
            opening_date="2024-01-01",
        ),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def terms(account, **changes):
    return dict(
        request_id=str(uuid4()),
        account_id=account,
        name="Synthetic CDB",
        issuer="Fictional bank",
        instrument_type="CDB_CDI",
        settlement_date="2026-01-05",
        maturity_date="2027-01-05",
        redemption_from="2026-01-05",
        liquidity="DAILY",
        quantity="8000",
        acquisition_price="1",
        cdi_percent="100",
        index_source="MANUAL",
        **changes,
    )


def subscribe(api, data):
    r = api.post("/api/investments/fixed-income", json=data)
    assert r.status_code == 201, r.text
    return r.json()


def indices(api):
    for day in (5, 6, 7, 8):
        r = api.post(
            "/api/investments/fixed-income/indices",
            json=dict(
                index_name="CDI",
                observation_date=f"2026-01-{day:02}",
                source="MANUAL",
                factor="1.001",
            ),
        )
        assert r.status_code == 201, r.text


def report(api, as_of="2026-01-08"):
    r = api.get("/api/investments/fixed-income", params={"as_of": as_of})
    assert r.status_code == 200, r.text
    return r.json()["positions"]


@pytest.mark.parametrize(
    "percent,expected", [("100", "1.003003"), ("110", "1.003304"), ("120", "1.003604")]
)
def test_cdi_daily_compounding_and_date_boundaries(api, percent, expected):
    account = funded(api)
    data = terms(account)
    data["cdi_percent"] = percent
    contract = subscribe(api, data)
    assert subscribe(api, data)["id"] == contract["id"]
    indices(api)
    row = report(api)[0]
    assert Decimal(row["gross_value"]) == 8000 * Decimal(expected)
    assert Decimal(report(api, "2026-01-05")[0]["gross_interest"]) == 0
    assert report(api, "2026-01-04") == []
    assert report(api, "2026-01-12")[0]["gross_value"] is None  # Jan 9 missing, no invented carry.
    assert len(api.get("/api/investments/activities").json()) == 1
    assert Decimal(api.get("/api/accounts").json()[0]["balance"]) == 42000
    history = api.get(
        f"/api/investments/fixed-income/{contract['id']}/history?start=2026-01-05&end=2026-01-08"
    ).json()
    assert history["points"][-1]["value"] == row["gross_value"]
    assert history["points"][0]["cdi_return_percent"] == "0.000000"
    assert Decimal(history["points"][-1]["cdi_return_percent"]) == Decimal("0.300300")


def test_fixed_rate_maturity_redemption_and_realized_tax_once(api):
    account = funded(api)
    data = terms(account)
    data.update(
        instrument_type="CDB_FIXED",
        cdi_percent="0",
        annual_rate="13.50",
        maturity_date="2026-01-09",
        redemption_from="2026-01-09",
        liquidity="AT_MATURITY",
    )
    contract = subscribe(api, data)
    with localcontext() as ctx:
        ctx.prec = 60
        expected = settled(Decimal("1.135") ** (Decimal(4) / 252)) * 8000
    row = report(api, "2026-01-09")[0]
    assert Decimal(row["gross_value"]) == expected
    assert row["status"] == "MATURED"
    assert report(api, "2026-01-12")[0]["gross_value"] == row["gross_value"]
    path = f"/api/investments/fixed-income/{contract['id']}/redemptions"
    request = dict(request_id=str(uuid4()), settlement_date="2026-01-08", quantity="3000")
    assert api.post(path, json=request).status_code == 422
    request["settlement_date"] = "2026-01-09"
    preview = api.post(path + "/preview", json=request)
    assert preview.status_code == 200, preview.text
    assert len(api.get("/api/investments/activities").json()) == 1
    r = api.post(path, json=request)
    assert r.status_code == 201, r.text
    assert api.post(path, json=request).json() == r.json()
    assert Decimal(api.get("/api/accounts").json()[0]["balance"]) == 42000 + Decimal(
        r.json()["cash_proceeds"]
    )
    assert report(api, "2026-01-08")[0]["quantity"] == "8000.000000"
    request.update(request_id=str(uuid4()), quantity="5000")
    assert api.post(path, json=request).status_code == 201
    assert report(api, "2026-01-09")[0]["status"] == "REDEEMED"
    portfolio = api.get("/api/investments/portfolio?as_of=2026-01-09").json()
    assert portfolio["holdings"][0]["quantity"] == "0.000000"
    assert Decimal(portfolio["holdings"][0]["realized"]) > 0
    income = api.get("/api/investments/analytics/income?start=2026-01-05&end=2026-01-09").json()
    assert income["events"] == [] and income["months"] == []
    assert sum(Decimal(r["principal"]) for r in income["redemptions"]) == 8000
    assert sum(Decimal(r["realized"]) for r in income["redemptions"]) == Decimal(
        portfolio["holdings"][0]["realized"]
    )
    # Only opening plus three investment activities; no income/expense transaction twins.
    assert [r["transaction_type"] for r in api.get("/api/transactions").json()] == [
        "OPENING_BALANCE"
    ]
    assert api.post(path, json=request | {"request_id": str(uuid4())}).status_code == 422


def test_tesouro_fractional_market_loss_and_no_fgc(api):
    data = terms(funded(api))
    data.update(
        instrument_type="TESOURO_SELIC",
        cdi_percent="0",
        quantity="0.6",
        acquisition_price="10000",
        fgc_eligible=True,
    )
    assert api.post("/api/investments/fixed-income", json=data).status_code == 422
    data["fgc_eligible"] = False
    contract = subscribe(api, data)
    api.post(
        f"/api/investments/assets/{contract['asset_id']}/prices",
        json=dict(price_date="2026-01-08", price="9950", currency="BRL"),
    )
    row = report(api)[0]
    assert Decimal(row["gross_value"]) == 5970
    assert Decimal(row["gross_interest"]) == -30
    assert Decimal(row["income_tax"]) == Decimal(row["iof"]) == 0
    path = f"/api/investments/fixed-income/{contract['id']}/redemptions"
    request = dict(request_id=str(uuid4()), settlement_date="2026-01-08", quantity="0.2")
    assert api.post(path, json=request).status_code == 422
    r = api.post(path, json=request | {"unit_price": "9940", "fees": "1"})
    assert r.status_code == 201, r.text
    assert Decimal(r.json()["cash_proceeds"]) == 1987
    row = report(api)[0]
    assert row["status"] == "PARTIALLY_REDEEMED"
    assert Decimal(row["principal"]) == 4000
    assert Decimal(row["realized_net"]) == -13


@pytest.mark.parametrize(
    "days,rate",
    [(180, "22.5"), (181, "20"), (360, "20"), (361, "17.5"), (720, "17.5"), (721, "15")],
)
def test_ir_calendar_brackets(days, rate):
    result = tax_estimate(Decimal("1000"), Decimal("1100"), days)
    assert result["tax_rate"] == Decimal(rate)
    assert result["income_tax"] == Decimal(rate)
    assert result["estimated_net"] == 1100 - Decimal(rate)


@pytest.mark.parametrize("day,iof", [(1, 96), (10, 66), (15, 50), (29, 3), (30, 0)])
def test_iof_before_ir(day, iof):
    r = tax_estimate(Decimal("1000"), Decimal("1100"), day)
    assert r["iof"] == iof
    assert r["income_tax"] == (100 - Decimal(iof)) * Decimal("0.225")


def test_calendar_known_holidays_and_weekends():
    for day in (
        "2024-11-20",
        "2025-03-03",
        "2025-03-04",
        "2025-04-18",
        "2026-02-16",
        "2026-06-04",
        "2026-09-07",
        "2026-09-27",
    ):
        assert not business_day(date.fromisoformat(day))
    assert business_day(date(2026, 2, 18))


def test_shared_valuation_allocation_returns_and_net_worth(api):
    contract = subscribe(api, terms(funded(api)))
    indices(api)
    total = Decimal("50024.024")
    portfolio = api.get("/api/investments/portfolio?as_of=2026-01-08").json()
    assert Decimal(portfolio["totals"][0]["total_value"]) == total
    allocation = api.get(
        "/api/investments/analytics/allocation?as_of=2026-01-08&currency=BRL"
    ).json()
    assert allocation["quality"] == "COMPLETE"
    bond = next(r for r in allocation["groups"]["asset_class"] if r["name"] == "BOND")
    assert Decimal(bond["value"]) == Decimal("8024.024")
    performance = api.get(
        "/api/investments/analytics/performance?start=2026-01-05&end=2026-01-08&currency=BRL"
    ).json()
    assert Decimal(performance["ending_value"]) == total
    assert Decimal(performance["twr"]["value"]) == Decimal("0.048048")
    assert (
        Decimal(api.get("/api/net-worth/summary?as_of=2026-01-08&currency=BRL").json()["value"])
        == total
    )
    assert (
        api.post(
            f"/api/investments/assets/{contract['asset_id']}/prices",
            json=dict(price_date="2026-01-08", price="999", currency="BRL"),
        ).status_code
        == 422
    )


def test_integrity_failed_subscription_and_generic_mutation_guards(api, db_engine):
    data = terms(funded(api, amount="5"))
    assert api.post("/api/investments/fixed-income", json=data).status_code == 422
    assert api.get("/api/investments/assets").json() == []
    data["account_id"] = funded(api, currency="USD")
    assert api.post("/api/investments/fixed-income", json=data).status_code == 422
    data["account_id"] = funded(api)
    contract = subscribe(api, data)
    activity = api.get("/api/investments/activities").json()[0]
    assert api.post(f"/api/investments/activities/{activity['id']}/void").status_code == 422
    ordinary = {
        k: activity[k]
        for k in (
            "account_id",
            "asset_id",
            "activity_type",
            "activity_date",
            "quantity",
            "unit_price",
            "currency",
        )
    }
    assert (
        api.post(
            "/api/investments/activities", json=ordinary | {"request_id": str(uuid4())}
        ).status_code
        == 422
    )
    with Session(db_engine) as db:
        row = db.scalar(select(FixedIncomeContract))
        row.annual_rate = Decimal("22")
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()
        assert db.execute(text("PRAGMA foreign_key_check")).all() == []
    assert contract["currency"] == "BRL"


def test_future_values_and_blocked_coverage_are_not_historical_quotes(api, db_engine):
    from uuid import UUID

    from app.market_models import AssetPricing
    from app.market_valuation import PriceBook

    data = terms(funded(api))
    data.update(instrument_type="CDB_FIXED", cdi_percent="0", annual_rate="13.5")
    contract = subscribe(api, data)
    tomorrow = date.today() + timedelta(days=1)
    assert (
        api.get("/api/investments/fixed-income", params={"as_of": tomorrow.isoformat()}).status_code
        == 422
    )
    asset_id = UUID(contract["asset_id"])
    with Session(db_engine) as db, db.begin():
        config = db.scalar(select(AssetPricing).where(AssetPricing.asset_id == asset_id))
        config.blocked_from = date(2026, 1, 7)
        config.blocked_to = date(2026, 1, 9)
        db.flush()
        book = PriceBook(db, tomorrow)
        assert book.select(asset_id, tomorrow) is None
        assert book.select(asset_id, date(2026, 1, 8)) is None
        assert book.select(asset_id, date(2026, 1, 6)) is not None
