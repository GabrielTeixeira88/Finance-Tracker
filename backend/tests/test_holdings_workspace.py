"""Exact source-UI projections must agree with the established investment ledger."""

from decimal import Decimal

from test_investments import account, asset, payload, post
from test_wealth import observe, position


def workspace(api, **params):
    response = api.get(
        "/api/investments/workspace/holdings", params={"as_of": "2026-02-03", **params}
    )
    assert response.status_code == 200, response.text
    return response.json()


def mark(api, sid, day, value):
    response = api.post(
        f"/api/investments/assets/{sid}/prices",
        json={"price_date": day, "price": value, "currency": "BRL"},
    )
    assert response.status_code == 201, response.text


def test_exact_basis_income_realized_and_cash_inclusive_weight(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid, fees="5"))
    post(
        api,
        payload(
            aid,
            sid,
            activity_type="SELL",
            activity_date="2026-02-02",
            quantity="4",
            unit_price="120",
            fees="5",
        ),
    )
    post(
        api,
        payload(
            aid,
            sid,
            activity_type="DIVIDEND",
            activity_date="2026-02-02",
            quantity="0",
            unit_price="0",
            gross_amount="20",
            taxes="2",
        ),
    )
    mark(api, sid, "2026-02-02", "125")
    mark(api, sid, "2026-02-03", "130")
    before = api.get("/api/accounts").json()
    report = workspace(api)
    holding = next(r for r in report["rows"] if r["holdingType"] == "SECURITY")
    cash = next(r for r in report["rows"] if r["holdingType"] == "CASH")
    assert holding["quantity"] == "6.000000"
    assert holding["averagePrice"] == "100.500000"
    assert holding["costBasis"]["local"] == "603.000000"
    assert holding["realizedGain"]["local"] == "73.000000"
    assert holding["unrealizedGain"]["local"] == "177.000000"
    assert holding["totalGain"]["local"] == "250.000000"
    assert holding["income"]["local"] == "18.000000"
    assert holding["totalReturn"]["local"] == "268.000000"
    assert holding["dayChange"]["local"] == "30.000000"
    assert cash["marketValue"]["local"] == "9488.000000"
    assert abs(Decimal(holding["weight"]) + Decimal(cash["weight"]) - 1) <= Decimal(".000001")
    assert api.get("/api/accounts").json() == before


def test_missing_prices_do_not_become_zero_or_inflate_weights(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid))
    report = workspace(api)
    security = next(r for r in report["rows"] if r["holdingType"] == "SECURITY")
    assert security["marketValue"]["local"] is None
    assert security["totalReturn"]["local"] is None
    assert security["price"] is None
    assert security["dayChange"]["local"] is None
    assert all(r["weight"] is None for r in report["rows"])


def test_closed_positions_and_account_scope(api):
    aid, sid = account(api), asset(api)
    other = account(api, name="Other fictional brokerage")
    post(api, payload(aid, sid))
    post(
        api,
        payload(
            aid,
            sid,
            activity_type="SELL",
            quantity="10",
            unit_price="90",
            activity_date="2026-02-02",
        ),
    )
    closed = next(r for r in workspace(api)["rows"] if r["holdingType"] == "SECURITY")
    assert closed["isClosed"]
    assert closed["realizedGain"]["local"] == "-100.000000"
    assert closed["marketValue"]["local"] == "0.000000"
    assert all(r["holdingType"] == "CASH" for r in workspace(api, account_id=other)["rows"])


def test_trade_date_daily_gain_is_unavailable_not_a_contribution_gain(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid, activity_date="2026-02-03"))
    mark(api, sid, "2026-02-02", "90")
    mark(api, sid, "2026-02-03", "100")
    row = next(r for r in workspace(api)["rows"] if r["holdingType"] == "SECURITY")
    assert row["dayChange"]["local"] is None
    assert row["totalGain"]["local"] == "0.000000"


def test_recorded_manual_balances_dates_and_associations_do_not_post(api):
    house = position(api, acquisition_cost="400000")
    debt = position(api, "Recorded mortgage", "LIABILITY", associated_asset_id=house["id"])
    observe(api, house, "500000")
    observe(api, debt, "300000")
    observe(api, debt, "290000", "2025-03-01")
    before = api.get("/api/accounts").json()
    rows = api.get("/api/investments/workspace/manual-holdings?as_of=2025-02-01").json()["rows"]
    asset_row = next(row for row in rows if row["id"] == house["id"])
    debt_row = next(row for row in rows if row["id"] == debt["id"])
    assert asset_row["marketValue"] == "500000.000000"
    assert asset_row["unrealizedGain"] == "100000.000000"
    assert asset_row["netEquity"] == "200000.000000"
    assert debt_row["linkedAssetId"] == house["id"]
    assert debt_row["recordedReduction"] == "0.000000"
    assert len(debt_row["observations"]) == 1
    later = api.get("/api/investments/workspace/manual-holdings?as_of=2025-03-01").json()["rows"]
    assert (
        next(row for row in later if row["id"] == debt["id"])["recordedReduction"] == "10000.000000"
    )
    assert api.get("/api/accounts").json() == before


def test_net_zero_round_trip_still_makes_daily_attribution_unavailable(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid))
    post(api, payload(aid, sid, activity_date="2026-02-03", quantity="1", unit_price="90"))
    post(
        api,
        payload(
            aid,
            sid,
            activity_type="SELL",
            activity_date="2026-02-03",
            quantity="1",
            unit_price="110",
        ),
    )
    mark(api, sid, "2026-02-02", "100")
    mark(api, sid, "2026-02-03", "120")
    row = next(row for row in workspace(api)["rows"] if row["holdingType"] == "SECURITY")
    assert row["quantity"] == "10.000000"
    assert row["dayChange"]["local"] is None


def test_same_security_across_accounts_is_consolidated_once(api):
    first, sid = account(api), asset(api)
    second = account(api, name="Second fictional brokerage")
    post(api, payload(first, sid))
    post(api, payload(second, sid, quantity="2", unit_price="80"))
    mark(api, sid, "2026-02-03", "100")
    rows = [row for row in workspace(api)["rows"] if row["holdingType"] == "SECURITY"]
    assert len(rows) == 1
    row = rows[0]
    assert set(row["accountIds"]) == {first, second}
    assert row["quantity"] == "12.000000"
    assert row["costBasis"]["local"] == "1160.000000"
    assert row["marketValue"]["local"] == "1200.000000"
    assert row["unrealizedGain"]["local"] == "40.000000"
    scoped = next(
        row for row in workspace(api, account_id=second)["rows"] if row["holdingType"] == "SECURITY"
    )
    assert scoped["quantity"] == "2.000000"
    assert scoped["costBasis"]["local"] == "160.000000"
