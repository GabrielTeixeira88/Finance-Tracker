"""Entirely synthetic Gmail fixtures; Google and OS storage are replaced in tests."""

import base64
import copy
import json
import time
from datetime import UTC, date, datetime, timedelta
from urllib.parse import parse_qs, urlencode, urlsplit

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_ingestion import account, confirm, decide, upload

from app.config import Settings
from app.gmail_models import GmailConnection, GmailMessageClaim, GmailSyncRun
from app.gmail_parsers import MAX_TEXT, normalize_message, parse_message
from app.gmail_provider import SCOPE, GmailError
from app.gmail_routes import Configuration, get_service
from app.gmail_scheduler import tick
from app.gmail_service import GmailService, connection, write
from app.main import app
from app.models import SourceRecord

HEADERS = {"Host": "127.0.0.1:8000", "X-Finance-Gmail": "1", "Origin": "http://127.0.0.1:5173"}
BODY = """SYNTHETIC BANK DEMO v1
Date: 01/10/2026
Amount: 85,00
Currency: BRL
Kind: DEBIT_PURCHASE
Description: Fictional grocery purchase
Merchant: Synthetic Grocer
"""


def message(id="m1", body=BODY, sender="notifications@synthetic-bank.example", html=False):
    return {
        "id": id,
        "threadId": "fictional-thread",
        "internalDate": "1790856000000",
        "labelIds": ["Label_demo"],
        "payload": {
            "mimeType": "text/html" if html else "text/plain",
            "headers": [
                {"name": "From", "value": sender},
                {"name": "Subject", "value": "[SYNTHETIC BANK] Transaction v1"},
            ],
            "body": {"data": base64.urlsafe_b64encode(body.encode()).decode()},
        },
    }


class Vault:
    def __init__(self):
        self.value = {
            "access_token": "synthetic-access",
            "refresh_token": "synthetic-refresh",
            "expires_at": int(time.time()) + 3600,
        }

    def backend(self):
        return self

    def get(self):
        return copy.deepcopy(self.value)

    def save(self, value):
        self.value = copy.deepcopy(value)

    def delete(self):
        self.value = None


class Google:
    def __init__(self):
        self.messages = {"m1": message()}
        self.calls, self.token_calls = [], []
        self.expired = False
        self.failure = None
        self.revoked = False
        self.pages = False

    def tokens(self, form):
        self.token_calls.append(form)
        if self.failure:
            raise GmailError(self.failure)
        return {
            "access_token": "synthetic-new-access",
            "refresh_token": "synthetic-rotated",
            "expires_in": 3600,
            "scope": SCOPE,
        }

    def revoke(self, token):
        self.revoked = True
        if self.failure:
            raise GmailError(self.failure)

    def get(self, path, token, **query):
        self.calls.append((path, query))
        if self.failure:
            raise GmailError(self.failure)
        if path == "profile":
            return {"emailAddress": "synthetic@example.invalid", "historyId": "100"}
        if path == "labels":
            return {"labels": [{"id": "Label_demo", "name": "Synthetic bank"}]}
        if path == "messages":
            ids = list(self.messages)
            if self.pages and "pageToken" not in query:
                return {"messages": [{"id": ids[0]}], "nextPageToken": "page2"}
            return {
                "messages": [{"id": id} for id in ids[1:] if self.pages]
                if self.pages
                else [{"id": id} for id in ids]
            }
        if path == "history":
            if self.expired:
                raise GmailError("NOT_FOUND")
            return {
                "historyId": "200",
                "history": [{"labelsAdded": [{"message": {"id": id}} for id in self.messages]}],
            }
        if path.startswith("messages/"):
            if path[9:] not in self.messages:
                raise GmailError("NOT_FOUND")
            return copy.deepcopy(self.messages[path[9:]])
        raise AssertionError(path)


@pytest.fixture
def gmail(api, db_engine):
    aid = account(api)
    service = GmailService(
        db_engine,
        Settings(google_oauth_client_id="synthetic-client", _env_file=None),
        Google(),
        Vault(),
    )
    with write(db_engine) as session:
        row = connection(session)
        row.mailbox, row.status = "synthetic@example.invalid", "CONNECTED"
    service.configure(
        Configuration(
            label_id="Label_demo", account_id=aid, start=date(2026, 10, 1), end=date(2026, 10, 2)
        )
    )
    app.dependency_overrides[get_service] = lambda: service
    yield service, aid
    service.oauth_stop.set()
    service.stop.set()
    app.dependency_overrides.pop(get_service, None)


def sync(service):
    rid = service.claim()
    service.sync(rid)
    with Session(service.engine) as session:
        run = session.get(GmailSyncRun, rid)
        return run.status, run.error


def queue(api):
    result = api.get("/api/gmail/queue", headers=HEADERS)
    assert result.status_code == 200, result.text
    return result.json()


@pytest.mark.parametrize(
    "kind,expected",
    [
        ("DEBIT_PURCHASE", "EXPENSE"),
        ("CREDIT_PURCHASE", "EXPENSE"),
        ("PIX_IN", "INCOME"),
        ("PIX_OUT", "EXPENSE"),
        ("INCOME", "INCOME"),
        ("REFUND", "INCOME"),
        ("TRANSFER_OUT", "EXPENSE"),
        ("CARD_PAYMENT", "EXPENSE"),
    ],
)
def test_synthetic_parser_exact_types(kind, expected):
    candidate, metadata, errors = parse_message(
        normalize_message(
            message(body=BODY.replace("DEBIT_PURCHASE", kind).replace("85,00", "1.234,56"))
        )
    )
    assert not errors
    assert candidate["amount"] == "1234.56" and candidate["transaction_date"] == "2026-10-01"
    assert candidate["transaction_type"] == expected
    assert metadata["parser"] == "synthetic-bank"


@pytest.mark.parametrize(
    "body",
    [
        BODY.replace("85,00", "0,00"),
        BODY.replace("85,00", "-1,00"),
        BODY.replace("Date: 01/10/2026\n", ""),
        BODY.replace("DEBIT_PURCHASE", "CANCELLATION"),
        BODY.replace("DEBIT_PURCHASE", "UNKNOWN"),
        BODY + "Unexpected: template change\n",
    ],
)
def test_malformed_templates_never_create_candidates(body):
    candidate, _, errors = parse_message(normalize_message(message(body=body)))
    assert not candidate and errors


def test_mime_html_spoofing_and_limits():
    text = '<script>Amount: 1,00</script><img src="https://tracker.invalid/x">' + "".join(
        f"<div>{line}</div>" for line in BODY.splitlines()
    )
    normalized = normalize_message(message(body=text, html=True))
    assert "tracker.invalid" not in normalized.text and "1,00" not in normalized.text
    assert not parse_message(normalized)[2]
    spoof = message(sender='"notifications@synthetic-bank.example" <attacker@example.invalid>')
    assert parse_message(normalize_message(spoof))[2] == ["UNSUPPORTED_NOTIFICATION_FORMAT"]
    multipart = message()
    part = multipart["payload"]
    multipart["payload"] = {
        "mimeType": "multipart/alternative",
        "headers": part["headers"],
        "parts": [part],
    }
    assert normalize_message(multipart).text == BODY
    with pytest.raises(GmailError, match="MIME_LIMIT"):
        normalize_message(message(body="x" * (MAX_TEXT + 1)))
    usd = parse_message(normalize_message(message(body=BODY.replace("BRL", "USD"))))[0]
    assert usd["currency"] == "USD"


def test_candidate_review_post_repeat_and_cross_source(api, gmail, db_engine):
    service, aid = gmail
    before = api.get(f"/api/accounts/{aid}").json()["balance"]
    assert sync(service) == ("COMPLETED", None)
    batch = queue(api)[0]
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == before
    posted = confirm(api, batch)
    confirm(api, batch)
    assert sync(service) == ("COMPLETED", None)
    assert len(api.get("/api/transactions").json()) == 1
    csv = upload(api, aid, "date,description,amount\n2026-10-01,Other grocery description,-85\n")
    assert csv["rows"][0]["status"] == "POSSIBLE_DUPLICATE"
    csv = decide(api, csv, 0, action="LINK", transaction_id=posted["rows"][0]["transaction_id"])
    confirm(api, csv)
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "-85.000000"
    with Session(db_engine) as session:
        sources = list(session.scalars(select(SourceRecord)))
        assert len(sources) == 2 and sources[0].transaction_id == sources[1].transaction_id
        assert BODY not in json.dumps(sources[0].raw_data)
        assert session.scalar(select(GmailMessageClaim)) is not None


def test_pagination_cursor_crash_retry_and_restart(gmail, api, db_engine, monkeypatch):
    service, _ = gmail
    service.provider.pages = True
    service.provider.messages["m2"] = message("m2", BODY.replace("85,00", "86,00"))
    original = service.fetch_message

    def fail(rid, config, token, mid):
        if mid == "m2":
            raise GmailError("GOOGLE_UNREACHABLE")
        return original(rid, config, token, mid)

    monkeypatch.setattr(service, "fetch_message", fail)
    assert sync(service) == ("FAILED", "GOOGLE_UNREACHABLE")
    with Session(db_engine) as session:
        assert session.get(GmailConnection, 1).history_id is None
    assert len(queue(api)) == 1
    restarted = GmailService(db_engine, service.settings, service.provider, service.vault)
    assert sync(restarted) == ("COMPLETED", None)
    assert len(queue(api)) == 2
    with Session(db_engine) as session:
        assert session.get(GmailConnection, 1).history_id == "100"
    assert any(q.get("pageToken") == "page2" for _, q in service.provider.calls)


def test_expired_cursor_bounded_recovery_and_current_label(gmail, api, db_engine):
    service, _ = gmail
    assert sync(service)[0] == "COMPLETED"
    service.provider.expired = True
    service.provider.messages["removed"] = message("removed")
    service.provider.messages["removed"]["labelIds"] = []
    assert sync(service)[0] == "COMPLETED"
    assert len(queue(api)) == 1
    with Session(db_engine) as session:
        assert "BOUNDED_RECOVERY" in list(session.scalars(select(GmailSyncRun.mode)))
    assert not any(
        path == "messages/removed" and query.get("format") == "full"
        for path, query in service.provider.calls
    )


def test_concurrent_cancel_and_stale_lease(gmail, api, db_engine):
    service, _ = gmail
    rid = service.claim()
    with pytest.raises(GmailError, match="SYNC_IN_PROGRESS"):
        service.claim()
    assert api.post("/api/gmail/cancel", json={}, headers=HEADERS).status_code == 200
    service.sync(rid)
    with Session(db_engine) as session:
        assert session.get(GmailSyncRun, rid).error == "SYNC_CANCELLED"
    stale = service.claim()
    with write(db_engine) as session:
        session.get(GmailConnection, 1).lease_until = datetime.now(UTC) - timedelta(seconds=1)
    fresh = service.claim()
    with Session(db_engine) as session:
        assert session.get(GmailSyncRun, stale).status == "INTERRUPTED"
    service.sync(fresh)


def test_auth_refresh_rotation_revocation_disconnect(gmail, api):
    service, _ = gmail
    service.vault.value["expires_at"] = 0
    assert service.token() == "synthetic-new-access"
    assert service.vault.value["refresh_token"] == "synthetic-rotated"
    service.vault.value["expires_at"] = 0
    service.provider.failure = "RECONNECT_REQUIRED"
    assert sync(service) == ("FAILED", "RECONNECT_REQUIRED")
    assert api.get("/api/gmail", headers=HEADERS).json()["paused"]
    service.provider.failure = None
    service.disconnect()
    assert service.vault.value is None and service.provider.revoked
    assert "synthetic-access" not in api.get("/api/gmail", headers=HEADERS).text


def test_oauth_pkce_state_and_one_use(gmail):
    service, _ = gmail
    authorization = service.begin_oauth()["authorization_url"]
    params = parse_qs(urlsplit(authorization).query)
    assert params["scope"] == [SCOPE] and params["code_challenge_method"] == ["S256"]
    host = urlsplit(params["redirect_uri"][0]).netloc
    with pytest.raises(GmailError):
        service.complete_oauth("/?state=bad&code=synthetic", host)
    path = "/?" + urlencode({"state": params["state"][0], "code": "synthetic-code"})
    with pytest.raises(GmailError):
        service.complete_oauth(path, "attacker.invalid")
    assert service.complete_oauth(path, host)
    assert len(service.provider.token_calls[0]["code_verifier"]) >= 43
    with pytest.raises(GmailError):
        service.complete_oauth(path, host)


@pytest.mark.parametrize("mode", ["expired", "denied", "invalid_grant"])
def test_oauth_failures(gmail, mode):
    service, _ = gmail
    params = parse_qs(urlsplit(service.begin_oauth()["authorization_url"]).query)
    if mode == "expired":
        service.oauth["expires"] = 0
    if mode == "invalid_grant":
        service.provider.failure = "RECONNECT_REQUIRED"
    path = "/?" + urlencode(
        {"state": params["state"][0], "error" if mode == "denied" else "code": "synthetic"}
    )
    with pytest.raises(GmailError):
        service.complete_oauth(path, urlsplit(params["redirect_uri"][0]).netloc)


def test_local_security_configuration_and_polling(api, gmail, monkeypatch):
    service, _ = gmail
    assert api.get("/api/gmail").status_code == 403
    assert (
        api.post(
            "/api/gmail/connect", json={}, headers={**HEADERS, "Origin": "https://attacker.invalid"}
        ).status_code
        == 403
    )
    assert api.get("/api/gmail", headers={**HEADERS, "Host": "attacker.invalid"}).status_code == 403
    calls = []
    monkeypatch.setattr(service, "start_sync", lambda: calls.append(True))
    tick(service)
    assert not calls
    api.post("/api/gmail/polling", json={"paused": False}, headers=HEADERS)
    tick(service)
    assert calls == [True]


def test_special_notifications_cannot_post_as_expense(api, gmail):
    service, _ = gmail
    service.provider.messages["m1"] = message(body=BODY.replace("DEBIT_PURCHASE", "TRANSFER_OUT"))
    sync(service)
    batch = queue(api)[0]
    batch = decide(api, batch, 0, action="NEW", acknowledge_classification=True)
    confirm(api, batch, 422)
    batch = decide(api, batch, 0, action="SKIP")
    confirm(api, batch)
    assert api.get("/api/transactions").json() == []


def test_bulk_atomicity_and_metadata_edits(api, gmail):
    service, aid = gmail
    service.provider.messages["m2"] = message("m2", BODY.replace("85,00", "86,00"))
    sync(service)
    batches = queue(api)
    bad = api.post(
        "/api/gmail/approve",
        headers=HEADERS,
        json={
            "items": [
                {"batch_id": b["id"], "preview_token": b["preview_token"] if i == 0 else "0" * 64}
                for i, b in enumerate(batches)
            ]
        },
    )
    assert bad.status_code == 409 and api.get("/api/transactions").json() == []
    b = batches[0]
    candidate = {k: v for k, v in b["rows"][0]["candidate"].items() if k != "payee_name"}
    candidate["description"] = "Explicit corrected description"
    edited = api.put(
        "/api/gmail/candidates/" + b["id"],
        headers=HEADERS,
        json={"account_id": aid, "candidate": candidate},
    )
    assert edited.status_code == 200, edited.text
    assert "Fictional grocery purchase" in edited.json()["rows"][0]["raw"]["original_candidate"]
    confirm(api, edited.json())
    assert api.get("/api/transactions").json()[0]["description"] == "Explicit corrected description"


def test_empty_allowlist_unsupported_and_invalid_label(api, gmail):
    service, aid = gmail
    service.provider.messages = {}
    assert sync(service) == ("COMPLETED", None)
    assert queue(api) == []
    with pytest.raises(GmailError, match="INVALID_LABEL"):
        service.configure(
            Configuration(
                label_id="missing", account_id=aid, start=date(2026, 10, 1), end=date(2026, 10, 2)
            )
        )
    service.provider.messages["m1"] = message(sender="unknown@example.invalid")
    assert sync(service)[0] == "COMPLETED"
    batch = queue(api)[0]
    assert not batch["ready"] and batch["rows"][0]["errors"] == ["UNSUPPORTED_NOTIFICATION_FORMAT"]
    confirm(api, decide(api, batch, 0, action="SKIP"))
    assert api.get("/api/transactions").json() == []


def test_expired_access_token_refreshes_once(gmail, monkeypatch):
    service, _ = gmail
    original = service.provider.get

    def get(path, token, **query):
        if token == "synthetic-access":
            raise GmailError("RECONNECT_REQUIRED")
        return original(path, token, **query)

    monkeypatch.setattr(service.provider, "get", get)
    assert sync(service)[0] == "COMPLETED"
    assert len(service.provider.token_calls) == 1


def test_populated_v07_migration_preserves_all_records(tmp_path):
    from alembic import command
    from test_analytics_migration_demo import config_for
    from test_budget_migration_demo import snapshot

    from app.database import make_engine
    from app.seed_analytics_demo import seed_analytics_demo

    config = config_for(tmp_path / "synthetic-v07.db")
    command.upgrade(config, "sqlite_0009")
    engine = make_engine(config.attributes["database_url"])
    with Session(engine) as session, session.begin():
        seed_analytics_demo(session)
    before = snapshot(engine)
    engine.dispose()
    command.upgrade(config, "head")
    command.check(config)
    after = snapshot(engine)
    assert all(after[table] == rows for table, rows in before.items())
    assert after["gmail_connections"] == []
    engine.dispose()


def test_rules_payees_manual_override_schedule_and_budget(api, gmail):
    from test_budgets import category, report, row, target

    service, aid = gmail
    cat = category(api)
    target(api, cat, month="2026-10")
    payee = api.post("/api/payees", json={"name": "Synthetic Grocer"}).json()["id"]
    rule = {
        "name": "Synthetic groceries",
        "enabled": True,
        "priority": 10,
        "match_mode": "ALL",
        "conditions": [{"field": "description", "operator": "contains", "value": "grocery"}],
        "actions": {"payee_id": payee, "category_id": cat},
    }
    assert api.post("/api/rules", json=rule).status_code == 201
    schedule = api.post(
        "/api/schedules",
        json={
            "name": "Synthetic grocery expectation",
            "description": "grocery",
            "account_id": aid,
            "currency": "BRL",
            "transaction_type": "EXPENSE",
            "amount": "85",
            "frequency": "MONTHLY",
            "start_date": "2026-10-01",
            "payee_id": payee,
        },
    ).json()
    assert sync(service)[0] == "COMPLETED"
    batch = queue(api)[0]
    assert batch["rows"][0]["candidate"]["payee_id"] == payee
    assert batch["rows"][0]["schedules"][0]["schedule_id"] == schedule["id"]
    assert row(report(api, month="2026-10"), cat)["spent"] == "0"
    batch = decide(
        api,
        batch,
        0,
        action="NEW",
        payee_id=payee,
        category_id=cat,
        acknowledge_classification=True,
        schedule_id=schedule["id"],
        due_date="2026-10-01",
    )
    confirm(api, batch)
    tx = api.get("/api/transactions").json()[0]
    assert tx["payee_id"] == payee and tx["category_id"] == cat
    assert "payee_id" in tx["manual_fields"]
    assert row(report(api, month="2026-10"), cat)["spent"] == "85.000000"


def test_required_financial_scenario_unchanged_by_sync(api, gmail):
    from decimal import Decimal

    from test_ledger import account as ledger_account
    from test_ledger import entry, transfer

    checking = ledger_account(api, "Checking", "5000")
    savings = ledger_account(api, "Savings", "2000", type="SAVINGS")
    assert entry(api, checking).status_code == 201
    assert entry(api, checking, "INCOME", "1000").status_code == 201
    assert transfer(api, checking, savings).status_code == 201
    service, _ = gmail
    service.configure(
        Configuration(
            label_id="Label_demo",
            account_id=checking["id"],
            start=date(2026, 10, 1),
            end=date(2026, 10, 2),
        )
    )
    assert sync(service)[0] == "COMPLETED"
    assert Decimal(api.get("/api/accounts/" + checking["id"]).json()["balance"]) == Decimal("5300")
    assert Decimal(api.get("/api/accounts/" + savings["id"]).json()["balance"]) == Decimal("2500")
    totals = api.get("/api/dashboard?month=2026-10").json()["totals"][0]
    assert Decimal(totals["income"]) == Decimal("1000")
    assert Decimal(totals["expenses"]) == Decimal("200")


def test_crash_before_checkpoint_replays_without_new_source(gmail, api, monkeypatch):
    service, _ = gmail
    discover = service.discover

    def crash(*args):
        discover(*args)
        raise GmailError("SYNTHETIC_CRASH_BEFORE_CHECKPOINT")

    monkeypatch.setattr(service, "discover", crash)
    assert sync(service)[0] == "FAILED"
    batch_id = queue(api)[0]["id"]
    monkeypatch.setattr(service, "discover", discover)
    assert sync(service)[0] == "COMPLETED"
    assert [b["id"] for b in queue(api)] == [batch_id]


def test_successful_bulk_approval_and_repeat(api, gmail):
    service, _ = gmail
    service.provider.messages["m2"] = message("m2", BODY.replace("85,00", "86,00"))
    sync(service)
    payload = {
        "items": [{"batch_id": b["id"], "preview_token": b["preview_token"]} for b in queue(api)]
    }
    for _ in range(2):
        result = api.post("/api/gmail/approve", json=payload, headers=HEADERS)
        assert result.status_code == 200, result.text
    assert len(api.get("/api/transactions").json()) == 2


@pytest.mark.parametrize("days", [7, 30, 90])
def test_release_backfill_windows_and_sender_filter(api, gmail, days):
    service, aid = gmail
    end = date.today()
    service.configure(
        Configuration(
            label_id="Label_demo",
            account_id=aid,
            start=end - timedelta(days=days),
            end=end,
            senders=["other@synthetic-bank.example"],
        )
    )
    assert sync(service) == ("COMPLETED", None)
    assert queue(api) == []
    query = next(q for path, q in service.provider.calls if path == "messages")
    assert query["labelIds"] == "Label_demo" and "after:" in query["q"]
    assert api.get("/api/transactions").json() == []


def test_release_discovery_limit_preserves_checkpoint(gmail, monkeypatch, db_engine):
    service, _ = gmail
    original = service.provider.get

    def endless(path, token, **query):
        if path == "messages":
            return {"messages": [], "nextPageToken": "synthetic-more"}
        return original(path, token, **query)

    monkeypatch.setattr(service.provider, "get", endless)
    assert sync(service) == ("FAILED", "SYNC_LIMIT_NARROW_BACKFILL")
    with Session(db_engine) as session:
        assert session.get(GmailConnection, 1).history_id is None


def test_release_concurrent_approval_posts_once(api, gmail):
    from concurrent.futures import ThreadPoolExecutor

    service, _ = gmail
    sync(service)
    batch = queue(api)[0]
    payload = {"items": [{"batch_id": batch["id"], "preview_token": batch["preview_token"]}]}

    def approve(_):
        return api.post("/api/gmail/approve", json=payload, headers=HEADERS)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(approve, range(2)))
    assert [r.status_code for r in results] == [200, 200]
    assert len(api.get("/api/transactions").json()) == 1


def test_release_poll_interval_and_disconnect(gmail, monkeypatch, db_engine):
    service, _ = gmail
    calls = []
    monkeypatch.setattr(service, "start_sync", lambda: calls.append(True))
    with write(db_engine) as session:
        row = connection(session)
        row.paused = False
        row.last_attempt = datetime.now(UTC)
    tick(service)
    assert not calls
    with write(db_engine) as session:
        connection(session).last_attempt = datetime.now(UTC) - timedelta(minutes=6)
    tick(service)
    assert calls == [True]
    service.disconnect()
    tick(service)
    assert calls == [True]
