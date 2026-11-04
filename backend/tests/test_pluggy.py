"""All provider responses and credentials here are deliberately fictional."""

from contextlib import nullcontext
from copy import deepcopy
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import ingestion, ledger
from app.config import Settings
from app.ingestion_schemas import Confirm
from app.main import app
from app.models import ImportBatch, Transaction
from app.pluggy_models import PluggyItem, PluggyObservation, PluggyResource
from app.pluggy_provider import PluggyError, PluggyProvider, PluggyTransport, exact_json
from app.pluggy_routes import get_service
from app.pluggy_service import PluggyService, bank_candidate, map_resource, stage_bank


def uid(n):
    return str(UUID(int=n))


ITEM, BANK, CARD, INVESTMENT = [uid(n) for n in range(1, 5)]


class Vault:
    def __init__(self):
        self.value = {"client_id": "FAKE_CLIENT", "client_secret": "FAKE_SECRET"}

    def get(self):
        return self.value

    def save(self, value):
        self.value = value

    def delete(self):
        self.value = None


class Provider:
    def operation_budget(self):
        return nullcontext()

    def __init__(self, engine):
        self.engine, self.fail, self.calls = engine, None, []
        self.accounts = [
            {
                "id": BANK,
                "itemId": ITEM,
                "name": "Synthetic bank",
                "number": "FAKE/001",
                "type": "BANK",
                "currencyCode": "BRL",
                "balance": "99999.00",
            },
            {
                "id": CARD,
                "itemId": ITEM,
                "name": "Synthetic card",
                "number": "FAKE/002",
                "type": "CREDIT",
                "currencyCode": "BRL",
                "balance": "75.00",
            },
        ]
        self.rows = [
            {
                "id": uid(10),
                "accountId": BANK,
                "currencyCode": "BRL",
                "amount": "-25.123456",
                "type": "DEBIT",
                "date": "2026-10-01T00:00:00Z",
                "description": "Fictional shop",
                "descriptionRaw": "SYNTHETIC SHOP",
                "status": "POSTED",
                "providerId": "SYNTHETIC-ID-1",
            },
            {
                "id": uid(11),
                "accountId": CARD,
                "currencyCode": "BRL",
                "amount": "75.00",
                "type": "DEBIT",
                "date": "2026-10-01T00:00:00Z",
                "description": "Synthetic card purchase",
                "status": "POSTED",
            },
        ]

    def clear(self):
        pass

    def request(self, credentials, method, path, **kwargs):
        self.calls.append((method, path))
        # This write lock must be obtainable: network never runs under a SQLite writer.
        with Session(self.engine) as session:
            session.connection(execution_options={"sqlite_write": True})
            session.rollback()
        if self.fail:
            raise PluggyError(self.fail)
        if path == "/connect_token":
            return {"accessToken": "FAKE_SCOPED_TOKEN"}
        if path.startswith("/items/"):
            return {"id": ITEM, "connector": {"name": "Synthetic institution"}, "status": "UPDATED"}
        if path == "/identity":
            return {"id": uid(21), "itemId": ITEM, "fullName": "Synthetic Person"}
        raise AssertionError(path)

    def pages(self, credentials, path, query=None, **kwargs):
        if self.fail:
            raise PluggyError(self.fail)
        if path == "/v2/items":
            return [
                {"id": ITEM, "connector": {"name": "Synthetic institution"}, "status": "UPDATED"}
            ]
        if path == "/accounts":
            return deepcopy(self.accounts)
        if path == "/v2/transactions":
            return deepcopy([v for v in self.rows if v["accountId"] == query["accountId"]])
        if path == "/investments":
            return [
                {
                    "id": INVESTMENT,
                    "itemId": ITEM,
                    "name": "Synthetic position",
                    "currencyCode": "BRL",
                    "type": "EQUITY",
                    "quantity": "2",
                    "balance": "20.00",
                }
            ]
        if path == f"/investments/{INVESTMENT}/transactions":
            return [
                {
                    "id": uid(22),
                    "type": "BUY",
                    "amount": "20",
                    "quantity": "2",
                    "value": "10",
                    "date": "2026-10-01T00:00:00Z",
                    "expenses": {"brokerageFee": "0"},
                }
            ]
        if path == "/bills":
            return [{"id": uid(23), "totalAmount": "75", "totalAmountCurrencyCode": "BRL"}]
        if path == "/consents":
            return [{"id": uid(24), "itemId": ITEM, "expiresAt": "2027-10-01T00:00:00Z"}]
        if path == "/loans":
            return [{"id": uid(25), "itemId": ITEM, "amount": "123"}]
        raise AssertionError(path)


@pytest.fixture
def integration(db_engine):
    return PluggyService(db_engine, Settings(), provider=Provider(db_engine), vault=Vault())


@pytest.fixture
def pluggy_api(api, integration):
    app.dependency_overrides[get_service] = lambda: integration
    api.headers.update({"Host": "127.0.0.1:8000", "X-Finance-Pluggy": "1"})
    return api


def setup_bank(api, integration):
    account = api.post(
        "/api/accounts",
        json={
            "name": "Synthetic local bank",
            "type": "CHECKING",
            "currency": "BRL",
            "opening_balance": "500",
            "opening_date": "2026-10-01",
        },
    ).json()["id"]
    iid = integration.adopt(ITEM)
    integration.sync(UUID(iid))
    with Session(integration.engine) as db:
        remote = db.scalar(
            select(PluggyResource).where(
                PluggyResource.kind == "ACCOUNT", PluggyResource.external_id == BANK
            )
        )
        map_resource(db, remote, UUID(account))
        db.commit()
        rid = remote.id
    return UUID(iid), UUID(account), rid


def test_sync_all_products_is_exact_idempotent_and_never_posts(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    with Session(integration.engine) as db:
        assert ledger.balances(db)[aid] == Decimal("500")
        before = db.scalar(select(func.count()).select_from(PluggyObservation))
        assert before == 10
        assert db.scalar(select(func.count()).select_from(Transaction)) == 1
    integration.sync(iid)
    with Session(integration.engine) as db:
        assert db.scalar(select(func.count()).select_from(PluggyObservation)) == before
        assert ledger.balances(db)[aid] == Decimal("500")
        assert db.get(PluggyResource, rid).data["balance"] == "99999.00"


def test_bank_review_confirm_and_repeat_do_not_duplicate_money(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    with Session(integration.engine) as db:
        batch = stage_bank(db, db.get(PluggyResource, rid), "2026-10-01", "2026-10-02")
        preview = ingestion.preview(db, batch)
        assert preview["rows"][0]["candidate"]["amount"] == "25.123456"
        ingestion.confirm(
            db, batch, Confirm(preview_token=preview["preview_token"], account_confirmed=True)
        )
        db.commit()
    with Session(integration.engine) as db:
        assert ledger.balances(db)[aid] == Decimal("474.876544")
        batch = stage_bank(db, db.get(PluggyResource, rid), "2026-10-01", "2026-10-02")
        shown = ingestion.preview(db, batch)
        assert shown["rows"][0]["status"] == "EXACT_DUPLICATE"
        ingestion.confirm(
            db, batch, Confirm(preview_token=shown["preview_token"], account_confirmed=True)
        )
        db.commit()
        assert ledger.balances(db)[aid] == Decimal("474.876544")


def test_changed_provider_evidence_invalidates_old_review_and_retains_audit(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    with Session(integration.engine) as db:
        batch = stage_bank(db, db.get(PluggyResource, rid), "2026-10-01", "2026-10-02")
        bid = batch.id
        token = ingestion.preview(db, batch)["preview_token"]
        db.commit()
    integration.provider.rows[0]["amount"] = "-30.123456"
    integration.sync(iid)
    with Session(integration.engine) as db:
        batch = db.get(ImportBatch, bid)
        assert not ingestion.preview(db, batch)["ready"]
        with pytest.raises(HTTPException):
            ingestion.confirm(db, batch, Confirm(preview_token=token, account_confirmed=True))
        assert ledger.balances(db)[aid] == Decimal("500")
        row = db.scalar(
            select(PluggyResource).where(
                PluggyResource.kind == "TRANSACTION", PluggyResource.external_id == uid(10)
            )
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(PluggyObservation)
                .where(PluggyObservation.resource_id == row.id)
            )
            == 2
        )


def test_failure_preserves_cached_data_and_does_not_commit_partial_sync(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    integration.provider.fail = "PLUGGY_RATE_LIMITED"
    with pytest.raises(PluggyError):
        integration.sync(iid)
    with Session(integration.engine) as db:
        assert db.get(PluggyResource, rid).data["balance"] == "99999.00"
        assert db.get(PluggyItem, iid).error == "PLUGGY_RATE_LIMITED"
        assert ledger.balances(db)[aid] == Decimal("500")


@pytest.mark.parametrize(
    "card,amount,kind,expected",
    [
        (False, "-1.123456", "DEBIT", "EXPENSE"),
        (False, "2", "CREDIT", "INCOME"),
        (True, "3", "DEBIT", "EXPENSE"),
        (True, "-4", "CREDIT", "INCOME"),
    ],
)
def test_credit_card_direction_is_not_bank_sign(card, amount, kind, expected):
    raw = {
        "date": "2026-10-01",
        "currencyCode": "BRL",
        "amount": amount,
        "type": kind,
        "description": "Synthetic purchase",
    }
    candidate, link_only = bank_candidate(
        raw, {"type": "CREDIT" if card else "BANK"}, SimpleNamespace(currency="BRL")
    )
    assert candidate["transaction_type"] == expected
    assert Decimal(candidate["amount"]) == abs(Decimal(amount))
    assert link_only == (card and kind == "CREDIT")


@pytest.mark.parametrize("amount", ["0", "NaN", "Infinity", "-1"])
def test_invalid_or_conflicting_amounts_cannot_be_normalized(amount):
    with pytest.raises((ValueError, ArithmeticError)):
        bank_candidate(
            {
                "date": "2026-10-01",
                "currencyCode": "BRL",
                "amount": amount,
                "type": "CREDIT",
                "description": "Synthetic",
            },
            {"type": "BANK"},
            SimpleNamespace(currency="BRL"),
        )


def test_pending_and_card_payments_cannot_post_as_ordinary_cash_flow(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    integration.provider.rows[0]["status"] = "PENDING"
    integration.sync(iid)
    with Session(integration.engine) as db:
        batch = stage_bank(db, db.get(PluggyResource, rid), "2026-10-01", "2026-10-02")
        assert not ingestion.preview(db, batch)["ready"]
        assert ledger.balances(db)[aid] == Decimal("500")


def test_mapping_foreign_keys_currency_and_remapping_are_guarded(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    other = api.post(
        "/api/accounts", json={"name": "Synthetic other", "type": "CHECKING", "currency": "BRL"}
    ).json()["id"]
    with Session(integration.engine) as db:
        with pytest.raises(HTTPException):
            map_resource(db, db.get(PluggyResource, rid), UUID(other))
        with pytest.raises(HTTPException):
            map_resource(db, db.get(PluggyResource, rid), UUID(uid(999)))


def test_local_security_credential_redaction_and_scoped_token(pluggy_api, integration):
    api = pluggy_api
    assert api.get("/api/pluggy/items", headers={"X-Finance-Pluggy": ""}).status_code == 403
    assert (
        api.get("/api/pluggy/items", headers={"Origin": "https://evil.invalid"}).status_code == 403
    )
    invalid = api.put("/api/pluggy/credentials", json={"client_secret": "FAKE_NEVER_ECHO"})
    assert invalid.status_code == 422 and "FAKE_NEVER_ECHO" not in invalid.text
    saved = api.put(
        "/api/pluggy/credentials",
        json={
            "client_id": "FAKE_CLIENT",
            "client_secret": "FAKE_SECRET",
            "acknowledge_external_processing": True,
        },
    )
    assert saved.status_code == 200 and "FAKE_SECRET" not in saved.text
    assert "FAKE_SECRET" not in api.get("/api/pluggy/status").text
    assert api.post("/api/pluggy/connect-token", json={}).json() == {
        "access_token": "FAKE_SCOPED_TOKEN"
    }
    assert not any("payments" in path for _, path in integration.provider.calls)


def test_disconnect_and_revoke_preserve_financial_history(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    integration.revoke(iid)
    integration.forget()
    with Session(integration.engine) as db:
        assert db.get(PluggyItem, iid).status == "REVOKED"
        assert db.get(PluggyResource, rid) is not None
        assert ledger.balances(db)[aid] == Decimal("500")
    with pytest.raises(PluggyError):
        integration.secret()


class Transport:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        return self.responses.pop(0)


def test_auth_is_cached_and_cursor_stays_scoped():
    transport = Transport(
        [
            {"apiKey": "FAKE_API_KEY"},
            {"results": [{"id": uid(1)}], "next": "?accountId=" + BANK + "&after=opaque%2Bcursor"},
            {"results": [{"id": uid(2)}], "next": None},
        ]
    )
    provider = PluggyProvider(transport)
    rows = provider.pages(
        {"client_id": "FAKE", "client_secret": "FAKE"},
        "/v2/transactions",
        {"accountId": BANK},
        cursor=True,
    )
    assert len(rows) == 2
    assert [c[1] for c in transport.calls].count("/auth") == 1
    assert transport.calls[-1][2]["query"]["after"] == "opaque+cursor"


@pytest.mark.parametrize(
    "next_page",
    [
        "https://evil.invalid/?after=x",
        "?accountId=" + CARD + "&after=x",
        "?accountId=" + BANK + "&after=x&token=secret",
    ],
)
def test_untrusted_pagination_never_changes_scope_or_host(next_page):
    provider = PluggyProvider(Transport([{"apiKey": "FAKE"}, {"results": [], "next": next_page}]))
    with pytest.raises(PluggyError):
        provider.pages(
            {"client_id": "FAKE", "client_secret": "FAKE"},
            "/v2/transactions",
            {"accountId": BANK},
            cursor=True,
        )


def test_transport_parses_decimal_and_large_integer_money_without_float(monkeypatch):
    class Response(BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.close()

    class Opener:
        def open(self, *args, **kwargs):
            return Response(b'{"amount":0.123456,"balance":9007199254740993}')

    monkeypatch.setattr("app.pluggy_provider.build_opener", lambda *_: Opener())
    data = PluggyTransport().request("GET", "/accounts", token="FAKE")
    assert data == {"amount": "0.123456", "balance": "9007199254740993"}
    with pytest.raises(PluggyError):
        exact_json({"amount": 0.1})


def test_investment_review_has_one_cash_posting_and_repeated_identity_is_safe(
    pluggy_api, integration
):
    from app import investment_imports
    from app.models import InvestmentActivity, InvestmentSourceLink
    from app.pluggy_routes import ReviewedActivity
    from app.pluggy_service import stage_investment

    api = pluggy_api
    iid = UUID(integration.adopt(ITEM))
    integration.sync(iid)
    account = api.post(
        "/api/accounts",
        json={
            "name": "Synthetic investment cash",
            "type": "INVESTMENT",
            "currency": "BRL",
            "opening_balance": "100",
            "opening_date": "2026-01-01",
        },
    ).json()["id"]
    asset = api.post(
        "/api/investments/assets",
        json={
            "name": "Synthetic security",
            "symbol": "FAKEONLY11",
            "asset_type": "ETF",
            "exchange": "SYNTHETIC",
            "currency": "BRL",
        },
    ).json()["id"]
    with Session(integration.engine) as db:
        resource = db.scalar(select(PluggyResource).where(PluggyResource.kind == "INVESTMENT"))
        transaction = db.scalar(
            select(PluggyResource).where(PluggyResource.kind == "INVESTMENT_TRANSACTION")
        )
        map_resource(db, resource, UUID(account), UUID(asset))
        batch = stage_investment(
            db, resource, [ReviewedActivity(resource_id=transaction.id, fees="0", taxes="0")]
        )
        shown = investment_imports.preview(db, batch)
        assert shown["ready"]
        investment_imports.confirm(
            db, batch, Confirm(preview_token=shown["preview_token"], account_confirmed=True)
        )
        db.commit()
        assert ledger.balances(db)[UUID(account)] == Decimal("80")
        assert db.scalar(select(func.count()).select_from(InvestmentActivity)) == 1
        assert db.scalar(select(func.count()).select_from(Transaction)) == 1  # opening only
        repeated = stage_investment(
            db, resource, [ReviewedActivity(resource_id=transaction.id, fees="0", taxes="0")]
        )
        again = investment_imports.preview(db, repeated)
        assert again["rows"][0]["status"] == "EXACT_DUPLICATE"
        investment_imports.confirm(
            db, repeated, Confirm(preview_token=again["preview_token"], account_confirmed=True)
        )
        db.commit()
        assert ledger.balances(db)[UUID(account)] == Decimal("80")
        assert db.scalar(select(func.count()).select_from(InvestmentSourceLink)) == 2


def test_card_payment_cannot_be_overridden_as_new_income(pluggy_api, integration):
    api = pluggy_api
    account = api.post(
        "/api/accounts",
        json={"name": "Synthetic credit card", "type": "CREDIT_CARD", "currency": "BRL"},
    ).json()["id"]
    iid = UUID(integration.adopt(ITEM))
    integration.provider.rows[1].update(amount="-75", type="CREDIT")
    integration.sync(iid)
    with Session(integration.engine) as db:
        resource = db.scalar(
            select(PluggyResource).where(
                PluggyResource.kind == "ACCOUNT", PluggyResource.external_id == CARD
            )
        )
        map_resource(db, resource, UUID(account))
        batch = stage_bank(db, resource, "2026-10-01", "2026-10-02")
        row = ingestion.source_rows(db, batch)[0]
        row.decision = {"action": "NEW", "acknowledge_classification": True}
        assert not ingestion.preview(db, batch)["ready"]
        assert ledger.balances(db).get(UUID(account), Decimal(0)) == 0


def test_partial_sync_failure_rolls_back_all_products(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    original = integration.provider.pages

    def pages(credentials, path, *args, **kwargs):
        if path == "/loans":
            raise PluggyError("PLUGGY_REQUEST_FAILED")
        return original(credentials, path, *args, **kwargs)

    integration.provider.accounts[0]["balance"] = "123456"
    integration.provider.pages = pages
    with pytest.raises(PluggyError):
        integration.sync(iid)
    with Session(integration.engine) as db:
        assert db.get(PluggyResource, rid).data["balance"] == "99999.00"


def test_discovery_cursor_and_unavailable_product_are_explicit():
    transport = Transport(
        [
            {"apiKey": "FAKE"},
            {"results": [{"id": ITEM}], "next": "?after=page2"},
            {"results": [{"id": uid(100)}], "next": None},
        ]
    )
    result = PluggyProvider(transport).pages(
        {"client_id": "FAKE", "client_secret": "FAKE"}, "/v2/items", cursor=True
    )
    assert len(result) == 2
    assert transport.calls[-1][2]["query"]["after"] == "page2"


def test_sync_budget_stops_requests_and_resets_after_failure():
    transport = Transport([{"apiKey": "FAKE"}, {}])
    provider = PluggyProvider(transport)
    with pytest.raises(PluggyError, match="SYNC_LIMIT_EXCEEDED"):
        with provider.operation_budget():
            provider.request({"client_id": "FAKE", "client_secret": "FAKE"}, "GET", "/accounts")
            provider.remaining = 0
            provider.request({}, "GET", "/accounts")
    assert len(transport.calls) == 2
    assert provider.remaining is None and provider.deadline is None


def test_nonpaginated_products_do_not_send_unsupported_parameters():
    transport = Transport([{"apiKey": "FAKE"}, {"results": []}])
    PluggyProvider(transport).pages(
        {"client_id": "FAKE", "client_secret": "FAKE"}, "/accounts", {"itemId": ITEM}
    )
    assert transport.calls[-1][2]["query"] == {"itemId": ITEM}


def test_conflicting_provider_identity_cannot_partially_publish(api, integration):
    iid, aid, rid = setup_bank(api, integration)
    conflicting = deepcopy(integration.provider.rows[0])
    conflicting["amount"] = "-900"
    integration.provider.rows.append(conflicting)
    with pytest.raises(PluggyError, match="CONFLICTING_PROVIDER_IDENTITY"):
        integration.sync(iid)
    with Session(integration.engine) as db:
        assert ledger.balances(db)[aid] == Decimal("500")
        assert db.scalar(select(func.count()).select_from(PluggyObservation)) == 10


def test_observation_history_is_immutable(api, integration):
    from sqlalchemy import delete, update
    from sqlalchemy.exc import IntegrityError

    setup_bank(api, integration)
    for operation in (
        update(PluggyObservation).values(digest="forbidden"),
        delete(PluggyObservation),
    ):
        with Session(integration.engine) as db, pytest.raises(IntegrityError):
            db.execute(operation)


def test_vault_failure_is_closed_and_sanitized(integration):
    from app.gmail_provider import GmailError

    def unavailable():
        raise GmailError("FAKE_SENSITIVE_BACKEND_DETAIL")

    integration.vault.get = unavailable
    with pytest.raises(PluggyError, match="SECURE_CREDENTIAL_STORE_UNAVAILABLE") as error:
        integration.secret()
    assert "FAKE_SENSITIVE" not in str(error.value)
    assert integration.provider.calls == []


def test_confirmed_bank_evidence_is_available_for_explicit_reconciliation(api, integration):
    from uuid import uuid4

    iid, aid, rid = setup_bank(api, integration)
    with Session(integration.engine) as db:
        batch = stage_bank(db, db.get(PluggyResource, rid), "2026-10-01", "2026-10-02")
        shown = ingestion.preview(db, batch)
        result = ingestion.confirm(
            db, batch, Confirm(preview_token=shown["preview_token"], account_confirmed=True)
        )
        db.commit()
        # The result is a fresh preview of the confirmed source, not a second posting.
        source_id = str(ingestion.source_rows(db, batch)[0].id)
    candidates = api.get("/api/reconciliation/candidates").json()
    assert any(row["id"] == source_id for row in candidates)
    transaction = next(
        row for row in api.get("/api/transactions").json() if row["transaction_type"] == "EXPENSE"
    )
    response = api.post(
        f"/api/transactions/{transaction['id']}/clearing",
        json={"request_id": str(uuid4()), "cleared": True, "source_id": source_id},
    )
    assert response.status_code == 200, response.text
    assert result is not None
