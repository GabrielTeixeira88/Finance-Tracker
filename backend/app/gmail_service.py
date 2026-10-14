"""Local OAuth, bounded sync and operational state; posting remains in ingestion."""

import base64
import hashlib
import json
import re
import secrets
import time
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Event, Lock, Thread
from urllib.parse import parse_qs, urlencode, urlsplit
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger, rules
from app.gmail_credentials import CredentialVault
from app.gmail_models import GmailConnection, GmailMessageClaim, GmailSyncRun
from app.gmail_parsers import normalize_message, parse_message
from app.gmail_provider import SCOPE, GmailError, GmailProvider
from app.models import ImportBatch, SourceRecord


@contextmanager
def write(engine):
    with Session(engine) as session:
        session.connection(execution_options={"sqlite_write": True})
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def connection(session):
    row = session.get(GmailConnection, 1)
    if row is None:
        row = GmailConnection(id=1)
        session.add(row)
        session.flush()
    return row


def busy(row):
    return row.active_run and row.lease_until and row.lease_until > datetime.now(UTC)


class GmailService:
    def __init__(self, engine, settings, provider=None, vault=None):
        self.engine, self.settings = engine, settings
        self.provider = provider or GmailProvider()
        self.vault = vault or CredentialVault(settings.resolved_database_path)
        self.lock = Lock()
        self.oauth = None
        self.oauth_stop = Event()
        self.stop = Event()

    def error(self, code):
        with write(self.engine) as session:
            row = connection(session)
            row.error = code
            if code == "RECONNECT_REQUIRED":
                row.status, row.paused = "RECONNECT_REQUIRED", True

    @contextmanager
    def control(self):
        if not self.lock.acquire(blocking=False):
            raise GmailError("GMAIL_OPERATION_IN_PROGRESS")
        try:
            yield
        finally:
            self.lock.release()

    def token(self):
        saved = self.vault.get()
        if not saved:
            raise GmailError("RECONNECT_REQUIRED")
        if saved.get("expires_at", 0) <= int(time.time()) + 60:
            form = {
                "client_id": self.settings.google_oauth_client_id,
                "refresh_token": saved["refresh_token"],
                "grant_type": "refresh_token",
            }
            secret = self.settings.google_oauth_client_secret.get_secret_value()
            if secret:
                form["client_secret"] = secret
            tokens = self.provider.tokens(form)
            saved = self.validate_tokens(tokens, saved)
            self.vault.save(saved)
        return saved["access_token"]

    def google_get(self, path, token, **query):
        saved = self.vault.get()
        if saved and saved.get("access_token") != token:
            token = self.token()
        try:
            return self.provider.get(path, token, **query)
        except GmailError as error:
            if error.code != "RECONNECT_REQUIRED":
                raise
            saved = self.vault.get()
            if not saved:
                raise
            saved["expires_at"] = 0
            self.vault.save(saved)
            # Retry once with a refreshed token. Invalid refresh authorization stops sync.
            return self.provider.get(path, self.token(), **query)

    @staticmethod
    def validate_tokens(tokens, previous=None):
        previous = previous or {}
        if SCOPE not in tokens.get("scope", SCOPE).split():
            raise GmailError("READONLY_SCOPE_REQUIRED")
        refresh = tokens.get("refresh_token") or previous.get("refresh_token")
        access = tokens.get("access_token")
        if not isinstance(access, str) or not isinstance(refresh, str) or not access or not refresh:
            raise GmailError("RECONNECT_REQUIRED")
        try:
            expiry = int(tokens["expires_in"])
            if not 0 < expiry <= 86400:
                raise ValueError
        except (ValueError, KeyError, TypeError):
            raise GmailError("INVALID_GOOGLE_RESPONSE") from None
        return {
            "access_token": access,
            "refresh_token": refresh,
            "expires_at": int(time.time()) + expiry,
        }

    def begin_oauth(self):
        with self.control():
            if not self.settings.google_oauth_client_id:
                raise GmailError("OAUTH_CLIENT_NOT_CONFIGURED")
            self.vault.backend()  # Fail before authorization if protected storage is unavailable.
            with write(self.engine) as session:
                if busy(connection(session)):
                    raise GmailError("SYNC_IN_PROGRESS")
            if self.oauth:
                raise GmailError("AUTHORIZATION_ALREADY_PENDING")
            service = self

            class Callback(BaseHTTPRequestHandler):
                def log_message(self, *args):
                    pass  # Authorization codes/state must never reach HTTP access logs.

                def do_GET(self):
                    valid = False
                    try:
                        valid = service.complete_oauth(self.path, self.headers.get("Host", ""))
                    except GmailError as error:
                        service.error(error.code)
                    self.send_response(200 if valid else 400)
                    self.send_header("Content-Type", "text/plain; charset=utf-8")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Referrer-Policy", "no-referrer")
                    self.send_header("Content-Security-Policy", "default-src 'none'")
                    self.end_headers()
                    self.wfile.write(b"Return to Finance Tracker to check Gmail connection status.")

            class PrivateServer(HTTPServer):
                def get_request(self):
                    request, address = super().get_request()
                    request.settimeout(5)
                    return request, address

                def handle_error(self, request, client_address):
                    service.error("LOCAL_AUTHORIZATION_FAILED")

            server = PrivateServer(("127.0.0.1", 0), Callback)
            server.timeout = 1
            state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
            redirect = f"http://127.0.0.1:{server.server_port}/"
            self.oauth = {
                "state": state,
                "verifier": verifier,
                "redirect": redirect,
                "expires": time.monotonic() + 180,
            }
            self.oauth_stop.clear()
            pending = self.oauth

            def listen():
                try:
                    while self.oauth is pending and not self.oauth_stop.is_set():
                        if time.monotonic() > pending["expires"]:
                            self.oauth = None
                            break
                        server.handle_request()
                finally:
                    server.server_close()

            Thread(target=listen, name="gmail-oauth-loopback", daemon=True).start()
            challenge = (
                base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
                .rstrip(b"=")
                .decode()
            )
            return {
                "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?"
                + urlencode(
                    {
                        "client_id": self.settings.google_oauth_client_id,
                        "redirect_uri": redirect,
                        "response_type": "code",
                        "scope": SCOPE,
                        "state": state,
                        "code_challenge": challenge,
                        "code_challenge_method": "S256",
                        "access_type": "offline",
                        "prompt": "consent",
                    }
                )
            }

    def complete_oauth(self, path, host):
        with self.lock:
            pending = self.oauth
            if not pending or len(path) > 8192 or time.monotonic() > pending["expires"]:
                raise GmailError("INVALID_OR_EXPIRED_OAUTH_STATE")
            parsed = urlsplit(path)
            query = parse_qs(parsed.query)
            if (
                parsed.path != "/"
                or parsed.scheme
                or parsed.netloc
                or host != urlsplit(pending["redirect"]).netloc
                or len(query.get("state", [])) != 1
                or not secrets.compare_digest(query["state"][0], pending["state"])
            ):
                raise GmailError("INVALID_OR_EXPIRED_OAUTH_STATE")
            self.oauth = None  # One-use state, including denied/failed authorization.
            if "error" in query or len(query.get("code", [])) != 1:
                raise GmailError("AUTHORIZATION_DENIED")
            form = {
                "client_id": self.settings.google_oauth_client_id,
                "code": query["code"][0],
                "code_verifier": pending["verifier"],
                "redirect_uri": pending["redirect"],
                "grant_type": "authorization_code",
            }
            secret = self.settings.google_oauth_client_secret.get_secret_value()
            if secret:
                form["client_secret"] = secret
            saved = self.validate_tokens(self.provider.tokens(form))
            profile = self.provider.get("profile", saved["access_token"])
            mailbox = profile.get("emailAddress", "").strip().lower()
            if not mailbox or len(mailbox) > 254 or "@" not in mailbox:
                raise GmailError("INVALID_GOOGLE_RESPONSE")
            with Session(self.engine) as session:
                current = session.get(GmailConnection, 1)
                if current and current.mailbox and current.mailbox != mailbox:
                    raise GmailError("RECONNECT_SAME_MAILBOX")
            self.vault.save(saved)
            with write(self.engine) as session:
                row = connection(session)
                row.mailbox, row.status, row.error = mailbox, "CONNECTED", None
            return True

    def labels(self):
        with self.control():
            return self.google_get("labels", self.token()).get("labels", [])

    def configure(self, data):
        with self.control():
            with Session(self.engine) as session:
                row = session.get(GmailConnection, 1)
                if row and busy(row):
                    raise GmailError("SYNC_IN_PROGRESS")
            labels = self.google_get("labels", self.token()).get("labels", [])
            if data.label_id not in {item["id"] for item in labels}:
                raise GmailError("INVALID_LABEL")
            with write(self.engine) as session:
                ledger.posting_account(session, data.account_id)
                row = connection(session)
                if busy(row):
                    raise GmailError("SYNC_IN_PROGRESS")
                if (row.label_id, row.account_id, row.senders) != (
                    data.label_id,
                    data.account_id,
                    data.senders,
                ) or (row.backfill_start, row.backfill_end) != (data.start, data.end):
                    row.history_id = None
                row.label_id, row.account_id, row.senders = (
                    data.label_id,
                    data.account_id,
                    data.senders,
                )
                row.polling_minutes, row.paused = data.polling_minutes, data.paused
                row.backfill_start, row.backfill_end = data.start, data.end

    def disconnect(self):
        with self.control():
            with write(self.engine) as session:
                row = connection(session)
                if busy(row):
                    raise GmailError("SYNC_IN_PROGRESS")
                row.paused, row.status = True, "DISCONNECTED"
            self.oauth = None
            self.oauth_stop.set()
            error = None
            saved = self.vault.get()
            try:
                if saved:
                    self.provider.revoke(saved["refresh_token"])
            except GmailError:
                error = "REVOCATION_FAILED_REVOKE_IN_GOOGLE_ACCOUNT"
            finally:
                self.vault.delete()
            self.error(error)

    def claim(self):
        with write(self.engine) as session:
            row = connection(session)
            if row.status != "CONNECTED":
                raise GmailError("RECONNECT_REQUIRED")
            if not row.label_id or not row.account_id or not row.backfill_start:
                raise GmailError("CONFIGURE_LABEL_ACCOUNT_AND_DATES")
            if busy(row):
                raise GmailError("SYNC_IN_PROGRESS")
            if row.active_run:
                old = session.get(GmailSyncRun, UUID(row.active_run))
                if old:
                    old.status, old.error, old.completed_at = (
                        "INTERRUPTED",
                        "RETRY_SAFE",
                        datetime.now(UTC),
                    )
            ledger.posting_account(session, row.account_id)
            run = GmailSyncRun(mode="INCREMENTAL" if row.history_id else "BACKFILL")
            session.add(run)
            session.flush()
            row.active_run = str(run.id)
            row.last_attempt = datetime.now(UTC)
            row.lease_until = row.last_attempt + timedelta(minutes=2)
            row.error = None
            return run.id

    def heartbeat(self, run_id):
        with write(self.engine) as session:
            row = connection(session)
            run = session.get(GmailSyncRun, run_id)
            if row.active_run != str(run_id) or run.cancel_requested or self.stop.is_set():
                raise GmailError("SYNC_CANCELLED")
            row.lease_until = datetime.now(UTC) + timedelta(minutes=2)

    def start_sync(self):
        if self.oauth:
            raise GmailError("AUTHORIZATION_ALREADY_PENDING")
        run_id = self.claim()
        Thread(target=self.sync, args=(run_id,), name="gmail-sync", daemon=True).start()
        return str(run_id)

    def sync(self, run_id):
        error, checkpoint = None, None
        try:
            with self.lock:
                with Session(self.engine) as session:
                    row = session.get(GmailConnection, 1)
                    config = {
                        k: getattr(row, k)
                        for k in (
                            "mailbox",
                            "label_id",
                            "account_id",
                            "senders",
                            "backfill_start",
                            "backfill_end",
                            "history_id",
                        )
                    }
                token = self.token()
                cursor = config["history_id"]
                if cursor:
                    try:
                        checkpoint = self.discover(run_id, config, token, cursor)
                    except GmailError as failure:
                        if failure.code != "HISTORY_EXPIRED":
                            raise
                        with write(self.engine) as session:
                            session.get(GmailSyncRun, run_id).mode = "BOUNDED_RECOVERY"
                        # Bounded recovery never claims complete mailbox history.
                        config["backfill_start"] = max(
                            config["backfill_start"], date.today() - timedelta(days=90)
                        )
                        config["backfill_end"] = date.today()
                if checkpoint is None:
                    checkpoint = self.discover(run_id, config, token, None)
        except GmailError as failure:
            error = failure.code
        except Exception:
            error = (
                "LOCAL_SYNC_FAILED"  # Never serialize/log exceptions containing financial payloads.
            )
        with write(self.engine) as session:
            row, run = connection(session), session.get(GmailSyncRun, run_id)
            if row.active_run != str(run_id):
                return
            if run.cancel_requested or self.stop.is_set():
                error = "SYNC_CANCELLED"
            run.status = "FAILED" if error else "COMPLETED"
            run.error, run.completed_at = error, datetime.now(UTC)
            row.active_run, row.lease_until, row.error = None, None, error
            if not error:
                row.history_id, row.last_success = checkpoint, datetime.now(UTC)
            elif error == "RECONNECT_REQUIRED":
                row.status, row.paused = "RECONNECT_REQUIRED", True

    def discover(self, run_id, config, token, cursor):
        # Snapshot BEFORE backfill; next history sync replays arrivals during discovery.
        checkpoint = cursor or self.google_get("profile", token).get("historyId")
        page, seen = None, set()
        for _ in range(20):
            self.heartbeat(run_id)
            query = {"maxResults": 100}
            if page:
                query["pageToken"] = page
            if cursor:
                query["startHistoryId"] = cursor
                try:
                    response = self.google_get("history", token, **query)
                except GmailError as error:
                    if error.code == "NOT_FOUND":
                        raise GmailError("HISTORY_EXPIRED") from None
                    raise
                ids = []
                for event in response.get("history", []):
                    for kind in ("messagesAdded", "labelsAdded", "labelsRemoved"):
                        ids.extend(item["message"]["id"] for item in event.get(kind, []))
            else:
                begin = datetime.combine(config["backfill_start"], datetime.min.time(), UTC)
                end = datetime.combine(
                    config["backfill_end"] + timedelta(days=1), datetime.min.time(), UTC
                )
                query.update(
                    labelIds=config["label_id"],
                    q=f"after:{int(begin.timestamp())} before:{int(end.timestamp())}",
                )
                response = self.google_get("messages", token, **query)
                ids = [item["id"] for item in response.get("messages", [])]
            for message_id in ids:
                if message_id in seen:
                    continue
                seen.add(message_id)
                if len(seen) > 1000:
                    raise GmailError("SYNC_LIMIT_NARROW_BACKFILL")
                self.heartbeat(run_id)
                self.fetch_message(run_id, config, token, message_id)
            page = response.get("nextPageToken")
            if not page:
                checkpoint = response.get("historyId") if cursor else checkpoint
                if not checkpoint or not re.fullmatch(r"\d{1,100}", str(checkpoint)):
                    raise GmailError("INVALID_HISTORY_CURSOR")
                return str(checkpoint)
        raise GmailError("SYNC_LIMIT_NARROW_BACKFILL")

    def fetch_message(self, run_id, config, token, message_id):
        if not isinstance(message_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", message_id):
            raise GmailError("INVALID_MESSAGE_ID")
        identity = rules.digest(["GMAIL", config["mailbox"], message_id])
        with write(self.engine) as session:
            if session.scalar(
                select(GmailMessageClaim.source_id).where(GmailMessageClaim.identity == identity)
            ):
                session.get(GmailSyncRun, run_id).duplicates += 1
                return
        try:
            # History is mailbox-wide. Check labels without fetching unrelated bodies.
            envelope = self.google_get("messages/" + message_id, token, format="minimal")
            if config["label_id"] not in envelope.get("labelIds", []):
                return
            self.heartbeat(run_id)
            data = self.google_get("messages/" + message_id, token, format="full")
        except GmailError as error:
            if error.code == "NOT_FOUND":
                return  # Deleted message; no ledger effects or fabricated source.
            raise
        if config["label_id"] not in data.get("labelIds", []):
            return
        if data.get("id") != message_id:
            raise GmailError("INVALID_GOOGLE_RESPONSE")
        metadata = {"gmail_message_id": message_id}
        try:
            message = normalize_message(data)
            if config["senders"] and message.sender not in config["senders"]:
                return
            normalized, parser, errors = parse_message(message)
            metadata.update(
                parser,
                original_candidate=json.dumps(normalized),
                original_ambiguity=normalized.get("ambiguity") or "",
                sender=message.sender,
                subject=message.subject,
                received_at=message.received_at,
                date_header=message.date_header,
                thread_id=message.thread_id,
                parsed_at=datetime.now(UTC).isoformat(),
            )
        except GmailError as error:
            normalized, errors = {}, [error.code]
        with write(self.engine) as session:
            row = connection(session)
            if row.active_run != str(run_id):
                raise GmailError("SYNC_CANCELLED")
            if session.scalar(
                select(GmailMessageClaim.source_id).where(GmailMessageClaim.identity == identity)
            ):
                return
            batch = ImportBatch(
                source_type="GMAIL",
                filename="Gmail notification",
                file_hash=identity,
                account_id=config["account_id"],
                configuration={},
                source_context={
                    "warnings": ["Synthetic parser only; verify every candidate."],
                    "connection": "1",
                },
                counts={"total": 1},
            )
            session.add(batch)
            session.flush()
            source = SourceRecord(
                import_batch_id=batch.id,
                row_number=1,
                source_type="GMAIL",
                external_id=message_id,
                source_fingerprint=identity,
                external_fingerprint=identity,
                raw_data=metadata,
                normalized_data=normalized,
                validation_errors=errors,
            )
            session.add(source)
            session.flush()
            session.add(GmailMessageClaim(identity=identity, source_id=source.id))
            session.get(GmailSyncRun, run_id).processed += 1
