"""Read-only allocation projection: exact basis, real contract identity and coverage."""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session
from test_fixed_income import funded, indices, subscribe, terms
from test_investment_analytics import price
from test_investments import account, asset, payload, post

from app.market_models import FXObservation


def allocation(api, **params):
    response = api.get(
        "/api/investments/analytics/allocation",
        params={"as_of": "2026-02-02", "currency": "BRL", **params},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_summary_uses_remaining_basis_and_keeps_cash_once(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid, quantity="10", fees="5"))
    post(api, payload(aid, sid, activity_type="SELL", quantity="4", unit_price="120"))
    price(api, sid, "2026-02-02", "130")
    result = allocation(api, account_ids=aid)
    summary = result["summary"]
    assert Decimal(summary["cost_basis"]) == Decimal("603")
    assert Decimal(summary["unrealized"]) == Decimal("177")
    assert Decimal(summary["invested_value"]) == Decimal("780")
    assert Decimal(summary["cash_value"]) == Decimal("9475")
    assert Decimal(result["total_value"]) == Decimal("10255")
    holding = next(row for row in result["rows"] if row["asset_id"])
    assert holding["instrument_type"] == "ETF"
    assert holding["geography"] == holding["sector"] == "Unknown"
    assert holding["price_source"] == "MANUAL"
    assert holding["price_date"] == "2026-02-02"
    # Read-only projections neither post movements nor mutate native accounting.
    again = allocation(api, account_ids=aid)
    assert result == again
    assert len(api.get("/api/investments/activities").json()) == 2


def test_reporting_basis_uses_dated_fx_without_changing_native_basis(api, db_engine):
    aid, sid = account(api, currency="USD"), asset(api, currency="USD")
    post(api, payload(aid, sid, currency="USD"))
    price(api, sid, "2026-02-02", "110", "USD")
    # Future FX must not leak into the as-of valuation.
    with Session(db_engine) as session, session.begin():
        for day, brl in [(date(2026, 2, 2), "5"), (date(2026, 2, 3), "9")]:
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
    result = allocation(api)
    assert Decimal(result["summary"]["cost_basis"]) == 5000
    assert Decimal(result["summary"]["unrealized"]) == 500
    assert Decimal(result["rows"][0]["cost_basis"]) == 1000
    assert Decimal(result["total_value"]) == 50500
    assert result["summary"]["basis_fx_policy"].endswith("AS_OF_FX")


def test_partial_and_empty_summaries_never_invent_values(api):
    empty = allocation(api)
    assert Decimal(empty["total_value"]) == 0
    assert empty["summary"]["holdings_count"] == 0
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid))
    missing_price = allocation(api)
    assert missing_price["total_value"] is None
    assert missing_price["summary"]["invested_value"] is None
    assert missing_price["summary"]["unrealized"] is None
    assert Decimal(missing_price["summary"]["cost_basis"]) == 1000
    missing_fx = allocation(api, currency="USD")
    assert missing_fx["summary"]["cost_basis"] is None
    assert missing_fx["summary"]["cash_value"] is None
    assert all(g["weight_percent"] is None for g in missing_fx["groups"]["security"])


def test_contract_type_and_issuer_use_contract_not_account_name(api):
    aid = funded(api)
    contract_terms = terms(aid)
    contract_terms["instrument_type"] = "RDB_CDI"
    contract = subscribe(api, contract_terms)
    indices(api)
    result = allocation(api, as_of="2026-01-08", account_ids=aid)
    holding = next(row for row in result["rows"] if row["asset_id"] == contract["asset_id"])
    assert holding["asset_class"] == "BOND"
    assert holding["instrument_type"] == "RDB_CDI"
    assert holding["issuer"] == "Fictional bank"
    assert Decimal(result["summary"]["cash_value"]) == 42000
    assert Decimal(result["summary"]["invested_value"]) == Decimal("8024.024")
    assert Decimal(result["summary"]["unrealized"]) == Decimal("24.024")
    assert any(g["name"] == "RDB_CDI" for g in result["groups"]["instrument_type"])
