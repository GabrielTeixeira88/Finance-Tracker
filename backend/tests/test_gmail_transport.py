import io
import json
from urllib.error import HTTPError, URLError

import pytest

from app.gmail_credentials import CredentialVault
from app.gmail_provider import GmailError, GoogleTransport


@pytest.mark.parametrize(
    "status,reason,expected,retries",
    [
        (401, {}, "RECONNECT_REQUIRED", 1),
        (400, "invalid_grant", "RECONNECT_REQUIRED", 1),
        (403, {}, "GOOGLE_PERMISSION_OR_CONFIGURATION_ERROR", 1),
        (404, {}, "NOT_FOUND", 1),
        (429, {}, "GOOGLE_RATE_OR_SERVICE_LIMIT", 3),
        (503, {}, "GOOGLE_RATE_OR_SERVICE_LIMIT", 3),
        (403, {"errors": [{"reason": "userRateLimitExceeded"}]}, "GOOGLE_RATE_OR_SERVICE_LIMIT", 3),
    ],
)
def test_http_failures_bounded_and_redacted(monkeypatch, caplog, status, reason, expected, retries):
    calls, sleeps = [], []

    class Opener:
        def open(self, request, timeout):
            calls.append(request)
            assert timeout == 15
            raise HTTPError(
                "https://synthetic.invalid/private",
                status,
                "private payload",
                {"Retry-After": "500"},
                io.BytesIO(json.dumps({"error": reason}).encode()),
            )

    monkeypatch.setattr("app.gmail_provider.build_opener", lambda *args: Opener())
    monkeypatch.setattr("app.gmail_provider.time.sleep", sleeps.append)
    with pytest.raises(GmailError, match=expected) as error:
        GoogleTransport().request("https://synthetic.invalid", token="synthetic-token")
    assert str(error.value) == expected and len(calls) == retries
    assert all(s <= 10 for s in sleeps)
    assert not caplog.text


def test_transport_network_outage_and_size(monkeypatch):
    class Opener:
        def open(self, *args, **kwargs):
            raise URLError("private provider detail")

    monkeypatch.setattr("app.gmail_provider.build_opener", lambda *args: Opener())
    monkeypatch.setattr("app.gmail_provider.time.sleep", lambda _: None)
    with pytest.raises(GmailError, match="GOOGLE_UNREACHABLE"):
        GoogleTransport().request("https://synthetic.invalid")
    monkeypatch.setattr(
        Opener, "open", lambda *args, **kwargs: io.BytesIO(b"x" * (2 * 1024 * 1024 + 1))
    )
    with pytest.raises(GmailError, match="MESSAGE_TOO_LARGE"):
        GoogleTransport().request("https://synthetic.invalid")
    monkeypatch.setattr(Opener, "open", lambda *args, **kwargs: io.BytesIO(b"[]"))
    with pytest.raises(GmailError, match="INVALID_GOOGLE_RESPONSE"):
        GoogleTransport().request("https://synthetic.invalid")


def test_credentials_fail_closed_without_os_store(monkeypatch, tmp_path):
    monkeypatch.setattr("app.gmail_credentials.keyring.get_keyring", lambda: object())
    vault = CredentialVault(tmp_path / "synthetic.db")
    for action in (vault.get, vault.delete, lambda: vault.save({"refresh_token": "synthetic"})):
        with pytest.raises(GmailError, match="SECURE_CREDENTIAL_STORE_UNAVAILABLE"):
            action()
    assert list(tmp_path.iterdir()) == []
