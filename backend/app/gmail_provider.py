"""Bounded Google-only transport. Never expose provider errors, URLs or payloads."""

import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
API = "https://gmail.googleapis.com/gmail/v1/users/me/"


class GmailError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class GoogleTransport:
    def request(self, url, *, token=None, form=None):
        # URLs are built exclusively by this module; no source-provided URLs are followed.
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = urlencode(form).encode() if form is not None else None
        if data is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        for attempt in range(3):
            delay = 2**attempt
            try:
                with build_opener(NoRedirect()).open(
                    Request(url, data=data, headers=headers), timeout=15
                ) as response:
                    raw = response.read(2 * 1024 * 1024 + 1)
                if len(raw) > 2 * 1024 * 1024:
                    raise GmailError("MESSAGE_TOO_LARGE")
                result = json.loads(raw) if raw else {}
                if not isinstance(result, dict):
                    raise GmailError("INVALID_GOOGLE_RESPONSE")
                return result
            except HTTPError as error:
                status = error.code
                try:
                    body = json.loads(error.read(8192))
                except (ValueError, OSError):
                    body = {}
                info = body.get("error", {}) if isinstance(body, dict) else {}
                if info == "invalid_grant" or status == 401:
                    raise GmailError("RECONNECT_REQUIRED") from None
                if status == 404:
                    raise GmailError("NOT_FOUND") from None
                reasons = info.get("errors", []) if isinstance(info, dict) else []
                retry = (
                    status == 429
                    or status >= 500
                    or any(
                        r.get("reason") in {"rateLimitExceeded", "userRateLimitExceeded"}
                        for r in reasons
                    )
                )
                if not retry:
                    raise GmailError("GOOGLE_PERMISSION_OR_CONFIGURATION_ERROR") from None
                if attempt == 2:
                    raise GmailError("GOOGLE_RATE_OR_SERVICE_LIMIT") from None
                retry_after = error.headers.get("Retry-After", "") if error.headers else ""
                if retry_after.isdigit():
                    delay = min(10, max(delay, int(retry_after)))
            except (URLError, TimeoutError, OSError):
                if attempt == 2:
                    raise GmailError("GOOGLE_UNREACHABLE") from None
            except (ValueError, TypeError):
                raise GmailError("INVALID_GOOGLE_RESPONSE") from None
            time.sleep(delay)
        raise GmailError("GOOGLE_UNREACHABLE")


class GmailProvider:
    def __init__(self, transport=None):
        self.transport = transport or GoogleTransport()

    def tokens(self, form):
        return self.transport.request("https://oauth2.googleapis.com/token", form=form)

    def revoke(self, token):
        self.transport.request("https://oauth2.googleapis.com/revoke", form={"token": token})

    def get(self, path, token, **query):
        # Callers only use fixed resource paths or validated opaque message IDs.
        return self.transport.request(API + path + "?" + urlencode(query), token=token)
