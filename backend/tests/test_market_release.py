from datetime import date
from decimal import Decimal
from threading import Event

from sqlalchemy import event, select
from sqlalchemy.orm import Session
from test_investments import account, asset, payload, post

from app.market_models import FXObservation
from app.market_providers import ProviderError, Quote, Transport
from app.market_sync import sync
from app.market_valuation import history


def test_release_offline_historical_ten_twenty_fifteen(api, db_engine, monkeypatch):
    def offline(*_args, **_kwargs):
        raise AssertionError("Read endpoints attempted external HTTP")

    monkeypatch.setattr(Transport, "get", offline)
    aid, sid = account(api), asset(api)
    for day, kind, quantity in [
        ("2026-01-02", "BUY", "10"),
        ("2026-03-02", "BUY", "10"),
        ("2026-06-02", "SELL", "5"),
    ]:
        post(api, payload(aid, sid, activity_date=day, activity_type=kind, quantity=quantity))
        assert (
            api.post(
                f"/api/investments/assets/{sid}/prices",
                json={
                    "currency": "BRL",
                    "price_date": day,
                    "price": "120",
                },
            ).status_code
            == 201
        )
    for day, quantity, cash, value in [
        ("2026-01-02", "10.000000", "9000.000000", "10200.000000"),
        ("2026-03-02", "20.000000", "8000.000000", "10400.000000"),
        ("2026-06-02", "15.000000", "8500.000000", "10300.000000"),
    ]:
        result = api.get(f"/api/market-data/valuation?as_of={day}").json()
        assert result["holdings"][0]["quantity"] == quantity
        assert result["accounts"][0]["cash"] == cash
        assert result["reporting"]["total_value"] == value
    queries = []

    def count(_conn, _cursor, statement, *_args):
        queries.append(statement)

    event.listen(db_engine, "before_cursor_execute", count)
    try:
        with Session(db_engine) as session:
            points = history(session, date(2023, 1, 1), date(2026, 6, 2))["points"]
        assert len(queries) <= 9
    finally:
        event.remove(db_engine, "before_cursor_execute", count)
    values = {p["date"]: p["value"] for p in points}
    assert values["2026-01-02"] == "10200.000000"
    assert values["2026-03-02"] == "10400.000000"
    assert values["2026-06-02"] == "10300.000000"
    for path in [
        "/accounts",
        "/transactions",
        "/budgets/monthly?month=2026-06&currency=BRL",
        "/investments/holdings",
        f"/market-data/assets/{sid}",
    ]:
        assert api.get("/api" + path).status_code == 200


def test_raw_backfill_partial_failure_and_interruption(api, db_engine):
    aid = account(api)
    good, bad = asset(api, "PETR4"), asset(api, "VALE3")
    for sid in [good, bad]:
        post(api, payload(aid, sid, activity_date="2026-01-02"))
    before = api.get("/api/investments/activities").json()
    ranges = []

    class Provider:
        def latest(self, instruments):
            i = instruments[0]
            if i.symbol == "VALE3":
                raise ProviderError("NETWORK_UNAVAILABLE")
            return [Quote(i.symbol, i.currency, date(2026, 9, 30), Decimal("120"), "LATEST")]

        def history(self, instrument, start, end):
            ranges.append(start)
            return [Quote(instrument.symbol, instrument.currency, start, Decimal("110"))]

    providers = {"BRAPI": Provider()}
    for _ in range(2):
        result = sync(
            db_engine, force=True, end=date(2026, 9, 30), include_fx=False, providers=providers
        )
        assert "UPDATED" in [r["status"] for r in result["results"]]
    # Today's latest quote does not pretend to cover raw daily history through today.
    assert ranges == [date(2025, 12, 26), date(2025, 12, 26)]
    cancel = Event()
    cancel.set()
    assert sync(db_engine, force=True, include_fx=False, providers=providers, cancel=cancel) == {
        "results": []
    }
    assert api.get("/api/investments/activities").json() == before
    assert api.get(f"/api/market-data/assets/{good}").json()["current"] is not None


def test_fx_backfills_new_earlier_cash_and_repeat_is_idempotent(api, db_engine):
    ranges = []

    class FX:
        def rates(self, start, end):
            ranges.append(start)
            return [(start, "BRL", Decimal("5")), (end, "BRL", Decimal("6"))]

    sync(db_engine, start=date(2026, 6, 1), end=date(2026, 6, 30), providers={"ECB": FX()})
    account(api)  # New older investment opening: January 1.
    for _ in range(2):
        sync(db_engine, force=True, end=date(2026, 6, 30), providers={"ECB": FX()})
    assert ranges == [date(2026, 6, 1), date(2025, 12, 25), date(2026, 6, 23)]
    with Session(db_engine) as session:
        rows = list(session.scalars(select(FXObservation)))
        assert len(rows) == len({(r.rate_date, r.quote_currency) for r in rows}) == 4
