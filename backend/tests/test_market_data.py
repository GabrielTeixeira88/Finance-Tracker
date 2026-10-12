from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session
from test_investments import account, asset, payload, post

from app.market_models import AssetPricing, FXObservation, MarketSettings, SyncState
from app.market_providers import (
    AlphaVantage,
    Brapi,
    Frankfurter,
    Instrument,
    ProviderError,
    Quote,
    decimal,
    resolve,
)
from app.market_sync import reserve, save_quotes, sync, sync_lock
from app.market_valuation import FXBook, PriceBook, history
from app.models import Asset, InvestmentActivity, PriceObservation


class FakeTransport:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, *args):
        self.calls.append(args)
        if not self.responses:
            raise AssertionError("Unexpected external request")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def test_synthetic_prices_cannot_mix_with_live_fx(api, db_engine):
    sid = UUID(asset(api, "PETR4"))
    day = date(2026, 2, 2)
    with Session(db_engine) as session, session.begin():
        config = AssetPricing(asset_id=sid, mode="AUTOMATIC", provider="SYNTHETIC")
        settings = MarketSettings(automatic=False, reporting_currency="BRL", fx_provider="ECB")
        session.add_all(
            [
                config,
                settings,
                PriceObservation(
                    asset_id=sid,
                    currency="BRL",
                    price_date=day,
                    price=Decimal("100"),
                    source="SYNTHETIC",
                ),
                PriceObservation(
                    asset_id=sid,
                    currency="BRL",
                    price_date=day,
                    price=Decimal("101"),
                    source="BRAPI",
                ),
            ]
        )
        session.flush()
        assert PriceBook(session, day).select(sid, day) is None
        settings.fx_provider = "SYNTHETIC"
        session.flush()
        assert PriceBook(session, day).select(sid, day).source == "SYNTHETIC"
        config.provider = "BRAPI"
        session.flush()
        assert PriceBook(session, day).select(sid, day) is None


def brapi_response(data, symbol="PETR4", **changes):
    return {
        "results": [
            {
                "requestedSymbol": "PETR4",
                "symbol": symbol,
                "changed": False,
                "data": data,
                **changes,
            }
        ]
    }


def test_brapi_exact_latest_bearer_currency_and_identity():
    row = {
        "currency": "BRL",
        "regularMarketPrice": Decimal("41.123456"),
        "regularMarketTime": "2026-09-30T18:00:00Z",
    }
    transport = FakeTransport(brapi_response(row))
    p = Brapi(transport, "synthetic-test-token")
    quotes = p.latest([Instrument("PETR4", "BRL", "XBSP")])
    assert quotes[0].price == Decimal("41.123456")
    assert transport.calls[0][1].endswith("/api/v2/stocks/quote")
    assert "token" not in transport.calls[0][2]
    assert transport.calls[0][3] == {"Authorization": "Bearer synthetic-test-token"}
    for response, expected in [
        (brapi_response(row, "OTHER"), "IDENTITY_MISMATCH"),
        (brapi_response({**row, "currency": "USD"}), "CURRENCY_MISMATCH"),
        (brapi_response(row, changed=True), "IDENTITY_MISMATCH"),
    ]:
        with pytest.raises(ProviderError, match=expected):
            Brapi(FakeTransport(response)).latest([Instrument("PETR4", "BRL", "XBSP")])
    with pytest.raises(ProviderError, match="MISSING_KEY"):
        Brapi(FakeTransport()).latest([Instrument("WRLD11", "BRL", "XBSP")])


def test_raw_adjusted_history_and_batch():
    point = {
        "date": int(datetime(2026, 9, 30, tzinfo=UTC).timestamp()),
        "close": Decimal("30"),
        "rawClose": Decimal("40"),
    }
    transport = FakeTransport(
        brapi_response({"historicalDataPrice": [point]}),
        brapi_response({"historicalDataPrice": [{**point, "rawClose": None}]}),
    )
    p = Brapi(transport, raw_history=True)
    instrument = Instrument("PETR4", "BRL", "XBSP")
    assert p.history(instrument, date(2026, 9, 1), date(2026, 9, 30))[0].convention == "RAW_CLOSE"
    assert p.history(instrument, date(2026, 9, 1), date(2026, 9, 30))[0].convention == "ADJUSTED"
    assert transport.calls[0][2]["includeRaw"] == "true"
    batch = {
        "results": [
            brapi_response(
                {
                    "currency": "BRL",
                    "regularMarketPrice": Decimal("1"),
                    "regularMarketTime": "2026-09-30T12:00:00Z",
                }
            )["results"][0],
            {
                "requestedSymbol": "VALE3",
                "symbol": "VALE3",
                "data": {
                    "currency": "BRL",
                    "regularMarketPrice": Decimal("2"),
                    "regularMarketTime": "2026-09-30T12:00:00Z",
                },
            },
        ]
    }
    transport = FakeTransport(batch)
    assert (
        len(Brapi(transport, batch_size=2).latest([instrument, Instrument("VALE3", "BRL", "XBSP")]))
        == 2
    )
    assert len(transport.calls) == 1


def test_alpha_verified_search_raw_history_and_mapping():
    instrument = Instrument("AAPL", "USD", "NASDAQ")
    metadata = {
        "bestMatches": [{"1. symbol": "AAPL", "4. region": "United States", "8. currency": "USD"}]
    }
    transport = FakeTransport(
        metadata,
        {
            "Meta Data": {"2. Symbol": "AAPL"},
            "Time Series (Daily)": {"2026-09-30": {"4. close": "120.123456"}},
        },
    )
    assert AlphaVantage(transport, "synthetic").history(
        instrument, date(2026, 9, 1), date(2026, 9, 30)
    )[0].price == Decimal("120.123456")
    assert transport.calls[1][2]["function"] == "TIME_SERIES_DAILY"
    assert transport.calls[1][2]["outputsize"] == "compact"
    assert (
        resolve(SimpleNamespace(symbol="VWCE", exchange="XETRA", currency="EUR"))[1].symbol
        == "VWCE.DEX"
    )
    assert (
        resolve(
            SimpleNamespace(symbol="VWCE", exchange="XETRA", currency="EUR"), override="CUSTOM.DEX"
        )[1].symbol
        == "CUSTOM.DEX"
    )
    with pytest.raises(ProviderError, match="UNSUPPORTED_EXCHANGE"):
        resolve(SimpleNamespace(symbol="AAPL", exchange="UNKNOWN", currency="USD"))
    with pytest.raises(ProviderError, match="MISSING_KEY"):
        AlphaVantage(FakeTransport()).latest([instrument])
    with pytest.raises(ProviderError, match="RATE_LIMIT"):
        AlphaVantage(FakeTransport({"Information": "rate limit"}), "synthetic").metadata(instrument)


@pytest.mark.parametrize("value", ["0", "-1", "NaN", "Infinity", 1.2, True, None, "0.1234567"])
def test_invalid_numbers(value):
    with pytest.raises(ProviderError):
        decimal(value)


def test_historical_quantities_cash_and_gaps(api, db_engine):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid, activity_date="2026-02-02"))
    post(
        api,
        payload(
            aid,
            sid,
            activity_type="SELL",
            activity_date="2026-02-04",
            quantity="4",
            unit_price="120",
        ),
    )
    post(
        api,
        payload(
            aid,
            sid,
            activity_type="SELL",
            activity_date="2026-02-06",
            quantity="6",
            unit_price="110",
        ),
    )
    for day, price in [("2026-02-02", "110"), ("2026-02-04", "120"), ("2026-02-06", "110")]:
        assert (
            api.post(
                f"/api/investments/assets/{sid}/prices",
                json={"currency": "BRL", "price_date": day, "price": price},
            ).status_code
            == 201
        )
    report = api.get("/api/market-data/history?start=2026-02-01&end=2026-02-07").json()
    assert [Decimal(p["value"]) for p in report["points"]] == list(
        map(Decimal, ["10000", "10100", "10100", "10200", "10200", "10140", "10140"])
    )
    # Current quantity is zero, but past values include ten and then six shares.
    with Session(db_engine) as session:
        queries = []

        def count(_conn, _cursor, statement, *_args):
            queries.append(statement)

        event.listen(db_engine, "before_cursor_execute", count)
        try:
            history(session, date(2026, 1, 1), date(2026, 9, 30))
        finally:
            event.remove(db_engine, "before_cursor_execute", count)
        assert len(queries) <= 9  # Batched reads independent of chart length.


def test_manual_precedence_adjusted_exclusion_and_stale(api, db_engine):
    aid, sid = account(api), asset(api, "PETR4")
    post(api, payload(aid, sid))
    api.post(
        f"/api/investments/assets/{sid}/prices",
        json={"currency": "BRL", "price_date": "2026-02-02", "price": "101"},
    )
    with Session(db_engine) as session:
        security = session.get(Asset, UUID(sid))
        session.expunge(security)
    instrument = Instrument("PETR4", "BRL", "XBSP")
    quotes = [
        Quote("PETR4", "BRL", date(2026, 2, 2), Decimal("150")),
        Quote("PETR4", "BRL", date(2026, 2, 3), Decimal("999"), "ADJUSTED"),
    ]
    save_quotes(db_engine, security, "BRAPI", instrument, quotes)
    assert (
        api.get("/api/investments/portfolio?as_of=2026-02-04").json()["holdings"][0]["last_price"]
        == "101.000000"
    )
    assert (
        api.put(
            f"/api/market-data/assets/{sid}", json={"mode": "AUTOMATIC", "provider": "BRAPI"}
        ).status_code
        == 200
    )
    holding = api.get("/api/investments/portfolio?as_of=2026-02-04").json()["holdings"][0]
    assert holding["last_price"] == "150.000000" and holding["price_source"] == "BRAPI"
    report = api.get("/api/market-data/history?start=2026-02-01&end=2026-02-12").json()
    assert report["points"][0]["value"] is None  # No future leakage.
    assert report["points"][-1]["value"] is None  # Seven-day carry bound.
    before = api.get("/api/investments/activities").json()
    save_quotes(
        db_engine,
        security,
        "BRAPI",
        instrument,
        [Quote("PETR4", "BRL", date(2026, 2, 2), Decimal("151"))],
    )
    assert api.get("/api/investments/activities").json() == before
    with Session(db_engine) as session:
        assert session.scalar(select(func.count()).select_from(PriceObservation)) == 3
    assert (
        api.put(
            f"/api/market-data/assets/{sid}",
            json={"mode": "AUTOMATIC", "provider": "BRAPI", "blocked_from": "2026-02-01"},
        ).status_code
        == 200
    )
    assert (
        api.get("/api/investments/portfolio?as_of=2026-02-04").json()["holdings"][0]["market_value"]
        is None
    )


def test_fx_exact_cross_rates_dates_and_partial(api, db_engine):
    account(api, currency="USD", opening="100")
    account(api, name="Synthetic euro", currency="EUR", opening="100")
    with Session(db_engine) as session, session.begin():
        for day, currency, rate in [
            (date(2026, 9, 25), "USD", "1.25"),
            (date(2026, 9, 25), "BRL", "6.25"),
            (date(2026, 9, 25), "JPY", "150"),
            (date(2026, 9, 28), "BRL", "9"),
        ]:
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
    with Session(db_engine) as session:
        fx = FXBook(session, date(2026, 9, 30))
        for source, target, expected in [
            ("USD", "BRL", "5"),
            ("EUR", "BRL", "6.25"),
            ("JPY", "BRL", "0.0416666666666666666666666666666666666666666666666666666666667"),
            ("BRL", "USD", "0.2"),
            ("USD", "EUR", "0.8"),
        ]:
            actual, info = fx.convert(Decimal(1), source, target, date(2026, 9, 27))
            assert actual == Decimal(expected)
            assert info["date"] == "2026-09-25"
        assert fx.convert(Decimal(1), "CHF", "USD", date(2026, 9, 27))[0] is None
    result = api.get("/api/market-data/valuation?as_of=2026-09-27").json()
    assert result["reporting"]["total_value"] == "1125.000000"
    assert (
        api.get("/api/market-data/valuation?as_of=2026-10-10").json()["reporting"]["total_value"]
        is None
    )
    transport = FakeTransport(
        [
            {
                "date": "2026-09-25",
                "base": "EUR",
                "quote": "JPY",
                "rate": Decimal("150.123456789012345678"),
            }
        ]
    )
    assert Frankfurter(transport).rates(date(2026, 9, 1), date(2026, 9, 30))[0][2] == Decimal(
        "150.123456789012345678"
    )


def test_sync_idempotent_cooldown_failure_and_overlap(api, db_engine):
    aid, sid = account(api), asset(api, "PETR4")
    post(api, payload(aid, sid))
    before = api.get("/api/investments/activities").json()

    class FakeProvider:
        def latest(self, instruments):
            return [Quote("PETR4", "BRL", date(2026, 2, 2), Decimal("101"), "LATEST")]

        def history(self, instrument, start, end):
            return [
                Quote("PETR4", "BRL", start, Decimal("100")),
                Quote("PETR4", "BRL", end, Decimal("102")),
            ]

    providers = {"BRAPI": FakeProvider()}
    result = sync(
        db_engine, asset_id=UUID(sid), end=date(2026, 2, 2), include_fx=False, providers=providers
    )
    assert result["results"][0]["status"] == "UPDATED"
    assert (
        sync(db_engine, asset_id=UUID(sid), include_fx=False, providers=providers)["results"][0][
            "status"
        ]
        == "CACHED"
    )
    sync(
        db_engine,
        asset_id=UUID(sid),
        start=date(2026, 1, 25),
        end=date(2026, 2, 2),
        force=True,
        include_fx=False,
        providers=providers,
    )
    with Session(db_engine) as session:
        assert session.scalar(select(func.count()).select_from(PriceObservation)) == 3

    class Offline(FakeProvider):
        def latest(self, instruments):
            raise ProviderError("NETWORK_UNAVAILABLE")

    result = sync(
        db_engine, asset_id=UUID(sid), force=True, include_fx=False, providers={"BRAPI": Offline()}
    )
    assert result["results"][0]["status"] == "NETWORK_UNAVAILABLE"
    assert api.get("/api/investments/activities").json() == before
    assert (
        api.get("/api/investments/portfolio?as_of=2026-02-02").json()["holdings"][0]["last_price"]
        is not None
    )
    sync_lock.acquire()
    try:
        assert api.post("/api/market-data/sync", json={}).status_code == 409
    finally:
        sync_lock.release()
    for _ in range(25):
        reserve(db_engine, "ALPHA")
    with pytest.raises(ProviderError, match="RATE_LIMIT"):
        reserve(db_engine, "ALPHA")
    with Session(db_engine) as session:
        assert session.scalar(select(SyncState)).error == "NETWORK_UNAVAILABLE"


def test_settings_and_metadata_do_not_mutate_ledger(api, db_engine):
    aid, sid = account(api), asset(api, "PETR4")
    post(api, payload(aid, sid))
    before = api.get("/api/accounts").json()
    assert (
        api.put(
            "/api/market-data/settings", json={"automatic": False, "reporting_currency": "JPY"}
        ).status_code
        == 200
    )
    assert api.put(f"/api/market-data/assets/{sid}", json={"mode": "MANUAL"}).status_code == 200
    assert api.get("/api/accounts").json() == before
    status = api.get("/api/market-data/status").json()
    assert status["settings"]["reporting_currency"] == "JPY"
    assert "token" not in str(status).lower()
    with Session(db_engine) as session:
        assert session.scalar(select(func.count()).select_from(InvestmentActivity)) == 1
        assert session.scalar(select(AssetPricing)).mode == "MANUAL"


def test_current_3900_example_and_historical_ten_fifteen_ten(api):
    aid = account(api, opening="3500")
    first, second = asset(api, "WRLD11"), asset(api, "PETR4")
    post(api, payload(aid, first, activity_date="2026-01-02", quantity="10", unit_price="100"))
    post(api, payload(aid, second, activity_date="2026-01-02", quantity="20", unit_price="25"))
    for sid, price in [(first, "120"), (second, "35")]:
        api.post(
            f"/api/investments/assets/{sid}/prices",
            json={"currency": "BRL", "price_date": "2026-01-02", "price": price},
        )
    report = api.get("/api/market-data/valuation?as_of=2026-01-02").json()
    assert report["accounts"][0]["cash"] == "2000.000000"
    assert report["reporting"]["total_value"] == "3900.000000"
    assert report["totals"][0]["unrealized"] == "400.000000"
    post(api, payload(aid, first, activity_date="2026-02-02", quantity="5", unit_price="110"))
    post(
        api,
        payload(
            aid,
            first,
            activity_date="2026-03-02",
            activity_type="SELL",
            quantity="5",
            unit_price="130",
        ),
    )
    for sid, price in [(first, "120"), (second, "35")]:
        for day in ["2026-02-02", "2026-03-02"]:
            api.post(
                f"/api/investments/assets/{sid}/prices",
                json={"currency": "BRL", "price_date": day, "price": price},
            )
    points = api.get("/api/market-data/history?start=2026-01-02&end=2026-03-02").json()["points"]
    values = {p["date"]: p["value"] for p in points}
    assert values["2026-01-02"] == "3900.000000"  # ten WRLD units
    assert values["2026-02-02"] == "3950.000000"  # fifteen units and less cash
    assert values["2026-03-02"] == "4000.000000"  # ten units and sale proceeds
    assert values["2026-02-15"] is None


def test_reporting_converts_before_settling_derived_value(api, db_engine):
    aid, sid = account(api, currency="USD", opening="1"), asset(api, "AAPL", "USD", "NASDAQ")
    post(api, payload(aid, sid, currency="USD", quantity="0.000001", unit_price="1"))
    api.post(
        f"/api/investments/assets/{sid}/prices",
        json={"currency": "USD", "price_date": "2026-02-02", "price": "0.123456"},
    )
    with Session(db_engine) as session, session.begin():
        for currency, rate in [("USD", "1"), ("JPY", "100")]:
            session.add(
                FXObservation(
                    base_currency="EUR",
                    quote_currency=currency,
                    rate_date=date(2026, 2, 2),
                    rate=Decimal(rate),
                    provider="ECB",
                    fetched_at=datetime.now(UTC),
                )
            )
    report = api.get("/api/market-data/valuation?as_of=2026-02-02&reporting_currency=JPY").json()
    assert report["reporting"]["total_value"] == "99.999912"
    point = api.get(
        "/api/market-data/history?start=2026-02-02&end=2026-02-02&reporting_currency=JPY"
    ).json()["points"][0]
    assert point["value"] == "99.999912"


def test_security_history_uses_raw_convention_and_original_currency(api):
    sid = asset(api)
    api.post(
        f"/api/investments/assets/{sid}/prices",
        json={"currency": "BRL", "price_date": "2026-02-02", "price": "101"},
    )
    response = api.get(f"/api/market-data/assets/{sid}/history?start=2026-02-01&end=2026-02-10")
    assert response.status_code == 200
    assert response.json()["currency"] == "BRL"
    assert response.json()["points"][0]["value"] is None
    assert response.json()["points"][1]["value"] == "101.000000"
    assert response.json()["points"][-1]["value"] is None
    current = api.get(f"/api/market-data/assets/{sid}?as_of=2026-02-03").json()["current"]
    assert current["source"] == "MANUAL" and current["price_date"] == "2026-02-02"
