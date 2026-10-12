import io
from datetime import date
from decimal import Decimal
from email.message import Message
from urllib.error import HTTPError, URLError

import pytest

from app import market_providers as providers


def test_transport_exact_json_retry_after_and_timeout(monkeypatch):
    sleeps, reserves = [], []
    headers = Message()
    headers["Retry-After"] = "2"
    replies = [
        HTTPError("https://synthetic.invalid", 429, "limited", headers, None),
        io.BytesIO(b'{"price":123.123456,"rate":0.123456789012345678}'),
    ]

    class Opener:
        def open(self, request, timeout):
            assert timeout == 15
            item = replies.pop(0)
            if isinstance(item, Exception):
                raise item
            return item

    monkeypatch.setattr(providers, "build_opener", lambda *_: Opener())
    transport = providers.Transport(reserve=reserves.append, sleep=sleeps.append)
    data = transport.get("BRAPI", "https://synthetic.invalid", {})
    assert data["price"] == Decimal("123.123456")
    assert data["rate"] == Decimal("0.123456789012345678")
    assert reserves == ["BRAPI", "BRAPI"] and 2 in sleeps
    replies.extend([URLError("private-token-must-not-escape")] * 3)
    with pytest.raises(providers.ProviderError, match="NETWORK_UNAVAILABLE") as caught:
        transport.get("ALPHA", "https://synthetic.invalid", {"apikey": "secret"})
    assert "secret" not in str(caught.value)
    assert not replies


@pytest.mark.parametrize(
    "status,code",
    [
        (401, "AUTHENTICATION"),
        (403, "PLAN_REQUIRED"),
        (404, "INVALID_SYMBOL"),
        (429, "RATE_LIMIT"),
        (503, "TEMPORARY_OUTAGE"),
    ],
)
def test_http_error_classification_and_bounded_retries(monkeypatch, status, code):
    calls = []

    class Opener:
        def open(self, *_args, **_kwargs):
            calls.append(status)
            headers = Message()
            headers["Retry-After"] = "120"
            raise HTTPError(
                "https://synthetic.invalid?apikey=secret", status, "secret payload", headers, None
            )

    monkeypatch.setattr(providers, "build_opener", lambda *_: Opener())
    with pytest.raises(providers.ProviderError, match=code) as caught:
        providers.Transport(sleep=lambda _: None).get("BRAPI", "https://synthetic.invalid", {})
    assert calls == [status]
    assert "secret" not in str(caught.value)


def test_malformed_future_and_unknown_data(monkeypatch):
    class Opener:
        def open(self, *_args, **_kwargs):
            return io.BytesIO(b"not-json")

    monkeypatch.setattr(providers, "build_opener", lambda *_: Opener())
    with pytest.raises(providers.ProviderError, match="MALFORMED_PAYLOAD"):
        providers.Transport().get("ECB", "https://synthetic.invalid", {})
    with pytest.raises(providers.ProviderError, match="INVALID_DATE"):
        providers.quote("FAKE", "USD", date(2099, 1, 1), "1")

    class Broken:
        def get(self, *_):
            return {"results": [{}]}

    with pytest.raises(providers.ProviderError, match="MALFORMED_PAYLOAD"):
        providers.Brapi(Broken()).latest([providers.Instrument("PETR4", "BRL", "XBSP")])


def test_authentication_payload_and_conflicting_fx_are_safe():
    class Response:
        def __init__(self, payload):
            self.payload = payload

        def get(self, *_args):
            return self.payload

    with pytest.raises(providers.ProviderError, match="AUTHENTICATION"):
        providers.AlphaVantage(
            Response({"Information": "Invalid API key: synthetic-test-only"}), "test-only"
        ).request("TIME_SERIES_DAILY")
    row = {"date": "2026-01-02", "base": "EUR", "quote": "USD", "rate": "1.1"}
    provider = providers.Frankfurter(Response([row, row]))
    assert provider.rates(date(2026, 1, 1), date(2026, 1, 3)) == [
        (date(2026, 1, 2), "USD", Decimal("1.1"))
    ]
    provider = providers.Frankfurter(Response([row, {**row, "rate": "1.2"}]))
    with pytest.raises(providers.ProviderError, match="MALFORMED_PAYLOAD"):
        provider.rates(date(2026, 1, 1), date(2026, 1, 3))
