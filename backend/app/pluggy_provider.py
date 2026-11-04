"""Pluggy-only bounded transport. No ORM, financial posting or payload logging."""

import json
import time
from contextlib import contextmanager
from decimal import Decimal
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

BASE = "https://api.pluggy.ai"


class PluggyError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def identifier(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise PluggyError("INVALID_RESOURCE_ID") from None


def exact_json(value):
    if isinstance(value, Decimal):
        if not value.is_finite() or value.adjusted() > 60 or value.as_tuple().exponent < -30:
            raise PluggyError("INVALID_PROVIDER_RESPONSE")
        return format(value, "f")
    if type(value) is int:
        return str(value)
    if isinstance(value, float):
        raise PluggyError("INEXACT_PROVIDER_NUMBER")
    if isinstance(value, dict):
        return {str(k): exact_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [exact_json(v) for v in value]
    return value


class PluggyTransport:
    def request(self, method, path, *, token=None, body=None, query=None):
        if not path.startswith("/") or "?" in path or "#" in path or ".." in path:
            raise PluggyError("INVALID_PROVIDER_PATH")
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if token:
            headers["X-API-KEY"] = token
        data = json.dumps(body).encode() if body is not None else None
        url = BASE + path + ("?" + urlencode(query, doseq=True) if query else "")
        try:
            with build_opener(NoRedirect()).open(
                Request(url, data=data, headers=headers, method=method), timeout=15
            ) as response:
                raw = response.read(8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024:
                raise PluggyError("PROVIDER_RESPONSE_TOO_LARGE")
            result = (
                json.loads(
                    raw,
                    parse_float=Decimal,
                    parse_int=Decimal,
                    parse_constant=lambda _: (_ for _ in ()).throw(ValueError()),
                )
                if raw
                else {}
            )
            if not isinstance(result, dict):
                raise ValueError()
            return exact_json(result)
        except HTTPError as error:
            code = {
                401: "PLUGGY_UNAUTHORIZED",
                403: "PRODUCT_NOT_AUTHORIZED",
                404: "PROVIDER_RESOURCE_NOT_FOUND",
                429: "PLUGGY_RATE_LIMITED",
            }.get(error.code, "PLUGGY_REQUEST_FAILED")
            error.close()
            raise PluggyError(code) from None
        except (URLError, TimeoutError, OSError):
            raise PluggyError("PLUGGY_UNREACHABLE") from None
        except (ValueError, TypeError, UnicodeError):
            raise PluggyError("INVALID_PROVIDER_RESPONSE") from None


class PluggyProvider:
    def __init__(self, transport=None):
        self.transport = transport or PluggyTransport()
        self.key = None
        self.expires = 0
        self.lock = Lock()
        self.remaining = None
        self.deadline = None

    @contextmanager
    def operation_budget(self):
        self.remaining, self.deadline = 256, time.monotonic() + 180
        try:
            yield
        finally:
            self.remaining, self.deadline = None, None

    def clear(self):
        self.key, self.expires = None, 0

    def request(self, credentials, method, path, **kwargs):
        if self.remaining is not None:
            if self.remaining <= 0 or time.monotonic() > self.deadline:
                raise PluggyError("SYNC_LIMIT_EXCEEDED")
            self.remaining -= 1
        with self.lock:
            if not self.key or self.expires <= time.monotonic():
                result = self.transport.request(
                    "POST",
                    "/auth",
                    body={
                        "clientId": credentials["client_id"],
                        "clientSecret": credentials["client_secret"],
                    },
                )
                key = result.get("apiKey")
                if not isinstance(key, str) or not key:
                    raise PluggyError("INVALID_PROVIDER_RESPONSE")
                self.key, self.expires = key, time.monotonic() + 6900
            token = self.key
        try:
            return self.transport.request(method, path, token=token, **kwargs)
        except PluggyError as error:
            if error.code == "PLUGGY_UNAUTHORIZED":
                self.clear()
            raise

    def pages(self, credentials, path, query=None, *, cursor=False):
        query, result, seen = dict(query or {}), [], set()
        for page in range(1, 41):
            pageable = path not in {"/accounts", "/consents"}
            if not cursor and pageable:
                query["page"] = page
                query["pageSize"] = 500
            data = self.request(credentials, "GET", path, query=query)
            rows = data.get("results")
            if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
                raise PluggyError("INVALID_PROVIDER_RESPONSE")
            result.extend(rows)
            if len(result) > 20000:
                raise PluggyError("SYNC_LIMIT_EXCEEDED")
            if cursor:
                if "next" not in data:
                    raise PluggyError("INVALID_PROVIDER_PAGINATION")
                next_page = data.get("next")
                if next_page is None:
                    return result
                if not isinstance(next_page, str) or len(next_page) > 4096 or next_page in seen:
                    raise PluggyError("INVALID_PROVIDER_PAGINATION")
                seen.add(next_page)
                parts = urlsplit(next_page)
                try:
                    values = parse_qs(parts.query, strict_parsing=True)
                except ValueError:
                    raise PluggyError("INVALID_PROVIDER_PAGINATION") from None
                allowed = (
                    {"accountId", "after", "dateFrom", "dateTo", "createdAtFrom"}
                    if path == "/v2/transactions"
                    else {"after", "clientUserId", "connectorId"}
                )
                if (
                    parts.scheme
                    or parts.netloc
                    or parts.path
                    or parts.fragment
                    or set(values) - allowed
                    or any(len(v) != 1 for v in values.values())
                    or (
                        path == "/v2/transactions"
                        and values.get("accountId", [None])[0] != query.get("accountId")
                    )
                    or not values.get("after")
                ):
                    raise PluggyError("INVALID_PROVIDER_PAGINATION")
                query["after"] = values["after"][0]
            else:
                try:
                    total_pages = int(data.get("totalPages", 1))
                except (ValueError, TypeError):
                    raise PluggyError("INVALID_PROVIDER_PAGINATION") from None
                if total_pages < 1 or (not pageable and total_pages > 1):
                    raise PluggyError("INVALID_PROVIDER_PAGINATION")
                if page >= total_pages:
                    return result
        raise PluggyError("SYNC_LIMIT_EXCEEDED")
