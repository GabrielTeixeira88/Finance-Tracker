"""Documented provider adapters. No SQLAlchemy, ledger or application state here."""

import json
import re
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation, localcontext
from email.utils import parsedate_to_datetime
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


class ProviderError(Exception):
    def __init__(self, code, retry_after=0):
        # Never retain response bodies, request URLs or credentials in errors.
        super().__init__(code)
        self.code = code
        self.retry_after = retry_after


@dataclass(frozen=True)
class Instrument:
    symbol: str
    currency: str
    exchange: str


@dataclass(frozen=True)
class Quote:
    symbol: str
    currency: str
    day: date
    price: Decimal
    convention: str = "RAW_CLOSE"
    observed_at: datetime | None = None


@dataclass(frozen=True)
class Capabilities:
    latest: bool = True
    history: bool = True
    metadata: bool = True
    batch: bool = False
    fx: bool = False
    asset_types: tuple[str, ...] = ("STOCK", "ETF")
    exchanges: tuple[str, ...] = ()


class Provider(Protocol):
    id: str
    capabilities: Capabilities

    def latest(self, instruments: list[Instrument]) -> list[Quote]: ...
    def history(self, instrument: Instrument, start: date, end: date) -> list[Quote]: ...
    def metadata(self, instrument: Instrument) -> dict: ...


def decimal(value, places=6):
    if isinstance(value, (float, bool)):
        raise ProviderError("MALFORMED_PAYLOAD")
    try:
        number = Decimal(value)
        if not number.is_finite() or not 0 < number < Decimal("1e18"):
            raise ProviderError("INVALID_PRICE")
        with localcontext() as context:
            context.prec = 60
            if number != number.quantize(Decimal(1).scaleb(-places)):
                raise ProviderError("INVALID_PRECISION")
        return number
    except (InvalidOperation, ValueError, TypeError):
        raise ProviderError("MALFORMED_PAYLOAD") from None


def quote(symbol, currency, day, price, convention="RAW_CLOSE", observed_at=None):
    try:
        if not isinstance(day, date):
            day = date.fromisoformat(day)
        if day > date.today() or day < date(1900, 1, 1):
            raise ProviderError("INVALID_DATE")
        if observed_at is not None and (observed_at.tzinfo is None or observed_at.date() != day):
            raise ProviderError("INVALID_DATE")
        return Quote(symbol, currency, day, decimal(price), convention, observed_at)
    except (ValueError, TypeError):
        raise ProviderError("MALFORMED_PAYLOAD") from None


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Credentials must never follow an untrusted redirect.


class Transport:
    # Sync runs are serialized; retain throttling across explicit refreshes.
    last_request: dict[str, float] = {}

    def __init__(self, reserve=lambda provider: None, sleep=time.sleep):
        self.reserve = reserve
        self.sleep = sleep

    def get(self, provider, url, params, headers=None):
        delay = 3.1 if provider == "BRAPI" else 12.1 if provider == "ALPHA" else 1.0
        for attempt in range(3):
            self.reserve(provider)
            self.sleep(max(0, self.last_request.get(provider, 0) + delay - time.monotonic()))
            self.last_request[provider] = time.monotonic()
            try:
                request = Request(
                    url + "?" + urlencode(params),
                    headers={
                        "User-Agent": "FinanceTracker local market-data client",
                        "Accept": "application/json",
                        **(headers or {}),
                    },
                )
                with build_opener(NoRedirect()).open(request, timeout=15) as response:
                    raw = response.read(8_000_001)
                    if len(raw) > 8_000_000:
                        raise ProviderError("PAYLOAD_TOO_LARGE")
                    return json.loads(raw, parse_float=Decimal, parse_constant=lambda _: None)
            except HTTPError as error:
                code = error.code
                wait = 2**attempt
                retry = error.headers.get("Retry-After")
                if retry:
                    try:
                        wait = max(wait, int(retry))
                    except ValueError:
                        try:
                            wait = max(
                                wait,
                                int(
                                    (
                                        parsedate_to_datetime(retry) - datetime.now(UTC)
                                    ).total_seconds()
                                ),
                            )
                        except (ValueError, TypeError):
                            wait = 60
                classified = {
                    401: "AUTHENTICATION",
                    403: "ACCESS_DENIED" if provider == "ECB" else "PLAN_REQUIRED",
                    404: "INVALID_SYMBOL",
                    400: "UNSUPPORTED_REQUEST",
                    422: "UNSUPPORTED_REQUEST",
                    429: "RATE_LIMIT",
                }.get(code, "TEMPORARY_OUTAGE" if code >= 500 else "HTTP_ERROR")
                if code not in {408, 429, 500, 502, 503, 504} or attempt == 2 or wait > 30:
                    raise ProviderError(classified, wait if code == 429 else 0) from None
                self.sleep(wait)
            except (URLError, TimeoutError, OSError):
                if attempt == 2:
                    raise ProviderError("NETWORK_UNAVAILABLE") from None
                self.sleep(2**attempt)
            except (ValueError, UnicodeError):
                raise ProviderError("MALFORMED_PAYLOAD") from None
        raise ProviderError("TEMPORARY_OUTAGE")


def resolve(asset, provider=None, override=None):
    exchange = asset.exchange.upper().strip()
    if provider is None:
        provider = "BRAPI" if exchange in {"B3", "BVMF", "XBSP"} else "ALPHA"
    mappings = {
        "BRAPI": {"B3": ("", "BRL"), "BVMF": ("", "BRL"), "XBSP": ("", "BRL")},
        "ALPHA": {
            "NASDAQ": ("", "USD"),
            "XNAS": ("", "USD"),
            "NYSE": ("", "USD"),
            "XNYS": ("", "USD"),
            "NYSE ARCA": ("", "USD"),
            "ARCX": ("", "USD"),
            "XETRA": (".DEX", "EUR"),
            "XETR": (".DEX", "EUR"),
        },
    }
    if provider == "SYNTHETIC":
        return provider, Instrument(override or asset.symbol, asset.currency, exchange)
    allowed = {"STOCK", "ETF", "FII", "BDR", "REIT"} if provider == "BRAPI" else {"STOCK", "ETF"}
    if getattr(asset, "asset_type", "STOCK") not in allowed:
        raise ProviderError("UNSUPPORTED_ASSET")
    mapping = mappings.get(provider, {}).get(exchange)
    if not mapping:
        raise ProviderError("UNSUPPORTED_EXCHANGE")
    suffix, currency = mapping
    if asset.currency != currency:
        raise ProviderError("CURRENCY_MISMATCH")
    symbol = override or asset.symbol + suffix
    if not re.fullmatch(r"[A-Z0-9.^_-]{1,40}", symbol):
        raise ProviderError("INVALID_SYMBOL")
    return provider, Instrument(symbol, currency, exchange)


class Brapi:
    id = "BRAPI"
    capabilities = Capabilities(
        batch=True,
        asset_types=("STOCK", "ETF", "FII", "BDR", "REIT"),
        exchanges=("XBSP", "B3", "BVMF"),
    )
    public = {"PETR4", "MGLU3", "VALE3", "ITUB4"}

    def __init__(self, transport, token="", raw_history=False, batch_size=1):
        self.transport, self.token = transport, token
        self.raw_history, self.batch_size = raw_history, batch_size

    def request(self, endpoint, instruments, **params):
        if not self.token and any(i.symbol not in self.public for i in instruments):
            raise ProviderError("MISSING_KEY")
        data = self.transport.get(
            self.id,
            "https://brapi.dev/api/v2/stocks/" + endpoint,
            {"symbols": ",".join(i.symbol for i in instruments), **params},
            {"Authorization": "Bearer " + self.token} if self.token else {},
        )
        try:
            result = {}
            requested = {i.symbol for i in instruments}
            for row in data["results"]:
                if (
                    row["requestedSymbol"] not in requested
                    or row["symbol"] != row["requestedSymbol"]
                    or row.get("changed")
                ):
                    raise ProviderError("IDENTITY_MISMATCH")
                if row["symbol"] in result:
                    raise ProviderError("MALFORMED_PAYLOAD")
                result[row["symbol"]] = row["data"]
                if not isinstance(row["data"], dict):
                    raise ProviderError("MALFORMED_PAYLOAD")
            return result
        except (KeyError, TypeError):
            raise ProviderError("MALFORMED_PAYLOAD") from None

    def latest(self, instruments):
        result = []
        for offset in range(0, len(instruments), self.batch_size):
            batch = instruments[offset : offset + self.batch_size]
            data = self.request("quote", batch)
            for instrument in batch:
                if instrument.symbol not in data:
                    continue
                row = data[instrument.symbol]
                try:
                    if row["currency"] != instrument.currency:
                        raise ProviderError("CURRENCY_MISMATCH")
                    observed_at = datetime.fromisoformat(
                        row["regularMarketTime"].replace("Z", "+00:00")
                    )
                    day = observed_at.date()
                    result.append(
                        quote(
                            instrument.symbol,
                            row["currency"],
                            day,
                            row["regularMarketPrice"],
                            "LATEST",
                            observed_at,
                        )
                    )
                except (KeyError, ValueError, TypeError, AttributeError):
                    raise ProviderError("MALFORMED_PAYLOAD") from None
        return result

    def metadata(self, instrument):
        rows = self.request("quote", [instrument])
        row = rows.get(instrument.symbol)
        if not row:
            raise ProviderError("INVALID_SYMBOL")
        if row.get("currency") != instrument.currency:
            raise ProviderError("CURRENCY_MISMATCH")
        return {
            "symbol": instrument.symbol,
            "currency": row["currency"],
            "name": row.get("shortName"),
        }

    def history(self, instrument, start, end):
        data = self.request(
            "historical",
            [instrument],
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            interval="1d",
            sortOrder="asc",
            includeRaw="true" if self.raw_history else "false",
        )
        try:
            rows = data[instrument.symbol]["historicalDataPrice"]
            result = []
            for row in rows:
                day = datetime.fromtimestamp(int(row["date"]), UTC).date()
                raw = row.get("rawClose")
                point = quote(
                    instrument.symbol,
                    instrument.currency,
                    day,
                    raw if raw is not None else row["close"],
                    "RAW_CLOSE" if raw is not None else "ADJUSTED",
                )
                if start <= day <= end:
                    result.append(point)
            return result
        except (KeyError, TypeError, ValueError, OverflowError):
            raise ProviderError("MALFORMED_PAYLOAD") from None


class AlphaVantage:
    id = "ALPHA"
    capabilities = Capabilities(exchanges=("NASDAQ", "NYSE", "NYSE ARCA", "XETRA"))

    def __init__(self, transport, token="", full_history=False):
        self.transport, self.token, self.full_history = transport, token, full_history

    def request(self, function, **params):
        if not self.token:
            raise ProviderError("MISSING_KEY")
        data = self.transport.get(
            self.id,
            "https://www.alphavantage.co/query",
            {"function": function, "apikey": self.token, **params},
        )
        if not isinstance(data, dict):
            raise ProviderError("MALFORMED_PAYLOAD")
        if "Note" in data or "Information" in data:
            text = str(data.get("Note", data.get("Information", ""))).lower()
            if "invalid" in text and ("apikey" in text or "api key" in text):
                raise ProviderError("AUTHENTICATION")
            raise ProviderError("PLAN_REQUIRED" if "premium" in text else "RATE_LIMIT", 86400)
        if "Error Message" in data:
            raise ProviderError("INVALID_SYMBOL")
        return data

    def metadata(self, instrument):
        data = self.request("SYMBOL_SEARCH", keywords=instrument.symbol)
        if not isinstance(data.get("bestMatches"), list) or any(
            not isinstance(r, dict) for r in data["bestMatches"]
        ):
            raise ProviderError("MALFORMED_PAYLOAD")
        matches = [
            r for r in data.get("bestMatches", []) if r.get("1. symbol") == instrument.symbol
        ]
        if len(matches) != 1:
            raise ProviderError("IDENTITY_MISMATCH")
        row = matches[0]
        if row.get("8. currency") != instrument.currency:
            raise ProviderError("CURRENCY_MISMATCH")
        region = "Germany" if instrument.exchange in {"XETRA", "XETR"} else "United States"
        if row.get("4. region") != region:
            raise ProviderError("IDENTITY_MISMATCH")
        return {
            "symbol": instrument.symbol,
            "currency": instrument.currency,
            "name": row.get("2. name"),
        }

    def history(self, instrument, start, end):
        self.metadata(instrument)
        data = self.request(
            "TIME_SERIES_DAILY",
            symbol=instrument.symbol,
            outputsize="full" if self.full_history else "compact",
        )
        try:
            if data["Meta Data"]["2. Symbol"] != instrument.symbol:
                raise ProviderError("IDENTITY_MISMATCH")
            return sorted(
                [
                    quote(instrument.symbol, instrument.currency, day, row["4. close"])
                    for day, row in data["Time Series (Daily)"].items()
                    if start.isoformat() <= day <= end.isoformat()
                ],
                key=lambda q: q.day,
            )
        except (KeyError, TypeError, AttributeError):
            raise ProviderError("MALFORMED_PAYLOAD") from None

    def latest(self, instruments):
        return [
            rows[-1]
            for instrument in instruments
            if (rows := self.history(instrument, date(1900, 1, 1), date.today()))
        ]


class Frankfurter:
    id = "ECB"
    capabilities = Capabilities(
        latest=False, history=False, metadata=False, fx=True, asset_types=()
    )

    def __init__(self, transport):
        self.transport = transport

    def rates(self, start, end):
        data = self.transport.get(
            self.id,
            "https://api.frankfurter.dev/v2/providers/ecb/rates",
            {
                "base": "EUR",
                "quotes": "BRL,USD,JPY",
                "from": start.isoformat(),
                "to": end.isoformat(),
            },
        )
        try:
            result = []
            seen = {}
            for row in data:
                if row["base"] != "EUR" or row["quote"] not in {"BRL", "USD", "JPY"}:
                    raise ProviderError("CURRENCY_MISMATCH")
                day = date.fromisoformat(row["date"])
                if not start <= day <= min(end, date.today()):
                    raise ProviderError("INVALID_DATE")
                rate = decimal(row["rate"], 18)
                key = day, row["quote"]
                if key in seen and seen[key] != rate:
                    raise ProviderError("MALFORMED_PAYLOAD")
                if key not in seen:
                    result.append((day, row["quote"], rate))
                    seen[key] = rate
            return result
        except (KeyError, TypeError, ValueError):
            raise ProviderError("MALFORMED_PAYLOAD") from None
