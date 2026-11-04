"""Explicit opt-in retrieval, atomic local evidence and reviewed ledger ingestion."""

import hashlib
import json
import re
from contextlib import contextmanager
from datetime import UTC, date, datetime
from decimal import Decimal
from threading import Lock
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger, rules
from app.gmail_credentials import CredentialVault
from app.gmail_provider import GmailError
from app.ingestion_schemas import Candidate
from app.models import Asset, ImportBatch, SourceRecord
from app.pluggy_models import PluggyItem, PluggyObservation, PluggyResource
from app.pluggy_provider import PluggyError, PluggyProvider, exact_json, identifier


@contextmanager
def write(engine):
    with Session(engine) as session:
        session.connection(execution_options={"sqlite_write": True})
        with session.begin_nested():
            yield session
        session.commit()


def digest(data):
    return hashlib.sha256(
        json.dumps(exact_json(data), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def sanitize(data):
    if isinstance(data, dict):
        return {
            k: sanitize(v)
            for k, v in data.items()
            if not re.search(r"secret|token|password|credential|authorization|parameters", k, re.I)
        }
    if isinstance(data, list):
        return [sanitize(v) for v in data]
    return data


def stale_error(session, source):
    if source.source_type not in {"PLUGGY", "PLUGGY_INVESTMENT"}:
        return None
    try:
        resource_id = UUID(source.raw_data.get("resource_id", ""))
    except (ValueError, TypeError, AttributeError):
        return "Invalid provider source identity; stage a fresh review"
    row = session.get(PluggyResource, resource_id)
    return (
        "Provider evidence changed; stage a fresh review or explicitly skip this observation"
        if not row or row.digest != source.raw_data.get("resource_digest")
        else None
    )


class PluggyService:
    def __init__(self, engine, settings, provider=None, vault=None):
        self.engine, self.provider = engine, provider or PluggyProvider()
        self.vault = vault or CredentialVault(settings.resolved_database_path)
        if vault is None:
            self.vault.service = self.vault.service.replace(".Gmail.", ".Pluggy.")
        self.lock = Lock()

    def secret(self):
        try:
            saved = self.vault.get()
        except GmailError:
            raise PluggyError("SECURE_CREDENTIAL_STORE_UNAVAILABLE") from None
        if not isinstance(saved, dict) or any(
            not isinstance(saved.get(key), str) or not saved[key]
            for key in ("client_id", "client_secret")
        ):
            raise PluggyError("PLUGGY_NOT_CONFIGURED")
        return saved

    def configure(self, client_id, client_secret):
        with self.control():
            try:
                self.vault.save({"client_id": client_id, "client_secret": client_secret})
            except GmailError:
                raise PluggyError("SECURE_CREDENTIAL_STORE_UNAVAILABLE") from None
            self.provider.clear()

    def forget(self):
        with self.control():
            try:
                self.vault.delete()
            except GmailError:
                raise PluggyError("SECURE_CREDENTIAL_STORE_UNAVAILABLE") from None
            self.provider.clear()
            with write(self.engine) as session:
                for item in session.scalars(select(PluggyItem)):
                    item.paused = True

    @contextmanager
    def control(self):
        if not self.lock.acquire(blocking=False):
            raise PluggyError("PLUGGY_OPERATION_IN_PROGRESS")
        try:
            yield
        finally:
            self.lock.release()

    def discover(self):
        with self.control():
            return [
                self.item_info(v)
                for v in self.provider.pages(self.secret(), "/v2/items", cursor=True)
            ]

    @staticmethod
    def item_info(data):
        connector = data.get("connector") or {}
        return {
            "external_id": identifier(data.get("id")),
            "name": str(connector.get("name") or "Pluggy connection")[:200],
            "connector_id": str(connector["id"])[:80] if connector.get("id") is not None else None,
            "status": str(data.get("status") or "UNKNOWN")[:40],
        }

    def adopt(self, external_id):
        with self.control():
            external_id = identifier(external_id)
            remote = self.provider.request(self.secret(), "GET", "/items/" + external_id)
            info = self.item_info(remote)
            if info["external_id"] != external_id:
                raise PluggyError("INVALID_PROVIDER_RESPONSE")
            with write(self.engine) as session:
                item = session.scalar(
                    select(PluggyItem).where(PluggyItem.external_id == external_id)
                )
                if item is None:
                    item = PluggyItem(**info)
                    session.add(item)
                else:
                    item.name, item.status = info["name"], info["status"]
                    item.connector_id = info["connector_id"]
                session.flush()
                return str(item.id)

    def connect_token(self, item_id=None):
        with self.control():
            body = {"options": {"avoidDuplicates": True}}
            if item_id:
                with Session(self.engine) as session:
                    item = ledger.require(session, PluggyItem, item_id)
                    body["itemId"] = item.external_id
            response = self.provider.request(self.secret(), "POST", "/connect_token", body=body)
            token = response.get("accessToken")
            if not isinstance(token, str) or not token:
                raise PluggyError("INVALID_PROVIDER_RESPONSE")
            return {"access_token": token}

    def update(self, item_id):
        with self.control():
            with Session(self.engine) as session:
                item = ledger.require(session, PluggyItem, item_id)
                external = item.external_id
            self.provider.request(self.secret(), "PATCH", "/items/" + external, body={})
        return {"requested": True}

    def revoke(self, item_id):
        with self.control():
            with Session(self.engine) as session:
                external = ledger.require(session, PluggyItem, item_id).external_id
            self.provider.request(self.secret(), "DELETE", "/items/" + external)
            with write(self.engine) as session:
                item = ledger.require(session, PluggyItem, item_id)
                item.status, item.paused = "REVOKED", True
        return {"revoked": True, "local_history_preserved": True}

    def sync(self, item_id):
        with self.control(), self.provider.operation_budget():
            with Session(self.engine) as session:
                item = ledger.require(session, PluggyItem, item_id)
                if item.paused or item.status == "REVOKED":
                    raise PluggyError("CONNECTION_PAUSED")
                external = item.external_id
            credentials = self.secret()
            try:
                remote = self.provider.request(credentials, "GET", "/items/" + external)
                info = self.item_info(remote)
                if info["external_id"] != external:
                    raise PluggyError("INVALID_PROVIDER_RESPONSE")
                observations, warnings = [], []

                def collect(kind, path, query, parent=None, cursor=False):
                    try:
                        rows = self.provider.pages(credentials, path, query, cursor=cursor)
                    except PluggyError as error:
                        if error.code not in {
                            "PRODUCT_NOT_AUTHORIZED",
                            "PROVIDER_RESOURCE_NOT_FOUND",
                        }:
                            raise
                        warnings.append({"product": kind, "code": error.code})
                        return []
                    for raw in rows:
                        if raw.get("itemId") not in {None, external}:
                            raise PluggyError("PROVIDER_SCOPE_MISMATCH")
                        value = sanitize(exact_json(raw))
                        if parent:
                            key, parent_id = parent
                            if value.get(key) not in {None, parent_id}:
                                raise PluggyError("PROVIDER_SCOPE_MISMATCH")
                            value[key] = parent_id
                        observations.append((kind, value))
                    if len(observations) > 20000:
                        raise PluggyError("SYNC_LIMIT_EXCEEDED")
                    return rows

                accounts = collect("ACCOUNT", "/accounts", {"itemId": external})
                if len(accounts) > 50:
                    raise PluggyError("SYNC_LIMIT_EXCEEDED")
                for account in accounts:
                    aid = identifier(account.get("id"))
                    collect(
                        "TRANSACTION",
                        "/v2/transactions",
                        {"accountId": aid},
                        ("accountId", aid),
                        True,
                    )
                    if account.get("type") == "CREDIT":
                        collect("BILL", "/bills", {"accountId": aid}, ("accountId", aid))
                holdings = collect("INVESTMENT", "/investments", {"itemId": external})
                if len(holdings) > 200:
                    raise PluggyError("SYNC_LIMIT_EXCEEDED")
                for holding in holdings:
                    hid = identifier(holding.get("id"))
                    collect(
                        "INVESTMENT_TRANSACTION",
                        "/investments/" + hid + "/transactions",
                        {},
                        ("investmentId", hid),
                    )
                collect("CONSENT", "/consents", {"itemId": external})
                collect("LOAN", "/loans", {"itemId": external})
                try:
                    identity = self.provider.request(
                        credentials, "GET", "/identity", query={"itemId": external}
                    )
                    if identity.get("id"):
                        observations.append(("IDENTITY", sanitize(exact_json(identity))))
                except PluggyError as error:
                    if error.code not in {"PRODUCT_NOT_AUTHORIZED", "PROVIDER_RESOURCE_NOT_FOUND"}:
                        raise
                    warnings.append({"product": "IDENTITY", "code": error.code})
                unique = {}
                for kind, data in observations:
                    identity = (kind, identifier(data.get("id")))
                    if identity in unique and digest(unique[identity]) != digest(data):
                        raise PluggyError("CONFLICTING_PROVIDER_IDENTITY")
                    unique[identity] = data
                with write(self.engine) as session:
                    item = ledger.require(session, PluggyItem, item_id)
                    if item.connector_id and info["connector_id"] != item.connector_id:
                        raise PluggyError("PROVIDER_SCOPE_MISMATCH")
                    for (kind, eid), data in unique.items():
                        row = session.scalar(
                            select(PluggyResource).where(
                                PluggyResource.item_id == item.id,
                                PluggyResource.kind == kind,
                                PluggyResource.external_id == eid,
                            )
                        )
                        hashed = digest(data)
                        if row is None:
                            row = PluggyResource(
                                item_id=item.id,
                                kind=kind,
                                external_id=eid,
                                digest=hashed,
                                data=data,
                            )
                            session.add(row)
                            session.flush()
                        else:
                            row.data, row.digest = data, hashed
                        previous = session.scalar(
                            select(PluggyObservation).where(
                                PluggyObservation.resource_id == row.id,
                                PluggyObservation.digest == hashed,
                            )
                        )
                        if previous is None:
                            session.add(
                                PluggyObservation(resource_id=row.id, digest=hashed, data=data)
                            )
                    item.status, item.name = info["status"], info["name"]
                    item.connector_id = info["connector_id"]
                    item.last_sync, item.error, item.warnings = datetime.now(UTC), None, warnings
                return {"received": len(observations), "warnings": warnings}
            except PluggyError as error:
                with write(self.engine) as session:
                    ledger.require(session, PluggyItem, item_id).error = error.code
                raise


def map_resource(session, resource, account_id, asset_id=None):
    account = ledger.posting_account(session, account_id)
    if resource.kind not in {"ACCOUNT", "INVESTMENT"}:
        raise HTTPException(422, "Only accounts and investments can be mapped")
    if resource.data.get("currencyCode") != account.currency:
        raise HTTPException(422, "Mapping currencies must match")
    if resource.kind == "ACCOUNT":
        expected = "CREDIT_CARD" if resource.data.get("type") == "CREDIT" else None
        if (
            (expected and account.type != expected)
            or (not expected and account.type not in {"CHECKING", "SAVINGS", "CASH"})
            or asset_id
        ):
            raise HTTPException(422, "Choose a matching bank/credit-card account")
    else:
        asset = ledger.require(session, Asset, asset_id) if asset_id else None
        if account.type != "INVESTMENT" or not asset or asset.currency != account.currency:
            raise HTTPException(422, "Choose a same-currency investment account and asset")
    if resource.account_id and (resource.account_id != account.id or resource.asset_id != asset_id):
        raise HTTPException(409, "Existing source mapping is immutable; preserve source identity")
    resource.account_id, resource.asset_id = account.id, asset_id


def bank_candidate(raw, remote_account, account):
    currency = raw.get("currencyCode")
    value = raw.get("amount")
    if currency != account.currency and raw.get("amountInAccountCurrency") is not None:
        value, currency = raw["amountInAccountCurrency"], account.currency
    amount = Decimal(str(value))
    if not amount.is_finite() or amount == 0:
        raise ValueError("Invalid amount")
    kind = raw.get("type")
    if kind not in {"DEBIT", "CREDIT"}:
        raise ValueError("Unknown transaction direction")
    expense = kind == "DEBIT"
    expected_positive = expense if remote_account.get("type") == "CREDIT" else not expense
    if (amount > 0) != expected_positive:
        raise ValueError("Provider sign/type conflict")
    if currency != account.currency:
        raise ValueError("Candidate/account currency mismatch")
    description = raw.get("descriptionRaw") or raw.get("description")
    uncertain = bool(
        re.search(
            r"transfer|pix|payment|pagamento|fatura|estorno|refund|resgate|invest|aplica",
            str(raw.get("category", "")) + " " + str(description),
            re.I,
        )
    )
    link_only = (remote_account.get("type") == "CREDIT" and not expense) or bool(
        re.search(r"transfer|investment|credit card payment", str(raw.get("category", "")), re.I)
    )
    candidate = Candidate(
        transaction_date=date.fromisoformat(str(raw.get("date"))[:10]),
        description=description,
        amount=abs(amount),
        currency=currency,
        transaction_type="EXPENSE" if expense else "INCOME",
        ambiguity="Verify transfer/payment/refund/investment classification"
        if uncertain or link_only
        else None,
    )
    return candidate.model_dump(mode="json"), link_only


def stage_bank(session, resource, start, end):
    if resource.kind != "ACCOUNT" or not resource.account_id:
        raise HTTPException(422, "Map the provider account first")
    account = ledger.posting_account(session, resource.account_id)
    rows = list(
        session.scalars(
            select(PluggyResource).where(
                PluggyResource.item_id == resource.item_id, PluggyResource.kind == "TRANSACTION"
            )
        )
    )
    rows = [
        r
        for r in rows
        if r.data.get("accountId") == resource.external_id
        and start <= str(r.data.get("date", ""))[:10] <= end
    ]
    if len(rows) > 2000:
        raise HTTPException(422, "Choose a smaller review period (maximum 2000 rows)")
    rows.sort(key=lambda r: (r.data.get("date", ""), r.external_id))
    batch = ImportBatch(
        source_type="PLUGGY",
        filename="Pluggy bank review",
        account_id=account.id,
        file_hash=digest([(str(r.id), r.digest) for r in rows]),
        configuration={},
        source_context={
            "namespace": "pluggy",
            "warnings": [
                "Provider balances are observations, not opening balances. "
                "Pending rows cannot post."
            ],
        },
        counts={"total": len(rows)},
    )
    session.add(batch)
    session.flush()
    for index, row in enumerate(rows, 1):
        errors, candidate, link_only = [], {}, False
        try:
            candidate, link_only = bank_candidate(row.data, resource.data, account)
            if row.data.get("status") != "POSTED":
                errors.append("Pending/future rows are evidence only; wait for POSTED")
        except (ValueError, TypeError, ArithmeticError):
            errors.append("Unsupported or incomplete financial fields; review provider evidence")
        item = ledger.require(session, PluggyItem, resource.item_id)
        provider_id = row.data.get("providerId")
        stable = (
            ["provider", item.connector_id, resource.data.get("number"), provider_id]
            if provider_id and resource.data.get("number") and item.connector_id
            else ["item", item.external_id, resource.external_id, row.external_id]
        )
        session.add(
            SourceRecord(
                import_batch_id=batch.id,
                row_number=index,
                source_type="PLUGGY",
                external_id=row.external_id,
                source_fingerprint=rules.digest(["pluggy", str(row.id), row.digest]),
                external_fingerprint=rules.digest(["pluggy", str(account.id), *stable]),
                raw_data={
                    "resource_id": str(row.id),
                    "resource_digest": row.digest,
                    "id": row.external_id,
                    "description": str(
                        row.data.get("descriptionRaw") or row.data.get("description") or ""
                    ),
                    "provider_json": json.dumps(row.data),
                    "link_only": "yes" if link_only else "no",
                },
                normalized_data=candidate,
                validation_errors=errors,
            )
        )
    session.flush()
    return batch


def stage_investment(session, resource, reviewed):
    from uuid import NAMESPACE_URL, uuid5

    from app.investment_imports import Mapping
    from app.investment_schemas import ActivityInput

    if resource.kind != "INVESTMENT" or not resource.account_id or not resource.asset_id:
        raise HTTPException(422, "Map an investment account and asset first")
    account = ledger.posting_account(session, resource.account_id)
    asset = ledger.require(session, Asset, resource.asset_id)
    if len({str(v.resource_id) for v in reviewed}) != len(reviewed):
        raise HTTPException(422, "Select each activity once")
    batch = ImportBatch(
        source_type="PLUGGY_INVESTMENT",
        filename="Pluggy investment review",
        account_id=account.id,
        file_hash=rules.digest([str(resource.id), [v.model_dump(mode="json") for v in reviewed]]),
        configuration=Mapping(columns={"date": 0, "type": 1, "currency": 2}).model_dump(),
        source_context={
            "namespace": "pluggy-investment",
            "warnings": [
                "Provider holdings are not opening positions. "
                "Activity posting has one cash movement."
            ],
        },
        counts={"total": len(reviewed)},
    )
    session.add(batch)
    session.flush()
    for index, choice in enumerate(reviewed, 1):
        row = ledger.require(session, PluggyResource, choice.resource_id)
        if (
            row.item_id != resource.item_id
            or row.kind != "INVESTMENT_TRANSACTION"
            or row.data.get("investmentId") != resource.external_id
        ):
            raise HTTPException(422, "Activity belongs to a different investment")
        raw = row.data
        values = {
            "request_id": str(uuid5(NAMESPACE_URL, "pluggy-investment/" + str(row.id))),
            "account_id": str(account.id),
            "asset_id": str(asset.id),
            "currency": account.currency,
            "activity_type": raw.get("type"),
            "activity_date": str(raw.get("tradeDate") or raw.get("date") or "")[:10],
            "fees": str(choice.fees),
            "taxes": str(choice.taxes),
            "notes": str(raw.get("description") or "Pluggy investment activity")[:500],
        }
        if raw.get("type") in {"BUY", "SELL"}:
            values.update(
                quantity=str(raw.get("quantity")),
                unit_price=str(raw.get("value")),
                gross_amount=str(raw.get("amount")),
            )
        else:
            values["gross_amount"] = str(raw.get("amount"))
        errors = []
        if raw.get("currencyCode") not in {None, account.currency}:
            errors.append("Provider activity currency differs from the mapping")
        try:
            candidate = ActivityInput.model_validate(values)
            if (
                raw.get("netAmount") is not None
                and abs(Decimal(str(raw["netAmount"]))) != candidate.cash_amount
            ):
                errors.append(
                    "Provider net amount differs from reviewed charges; do not post guessed cash"
                )
        except (ValueError, ArithmeticError):
            errors.append(
                "Unsupported activity fields; keep as provider evidence "
                "or enter a reviewed activity manually"
            )
        session.add(
            SourceRecord(
                import_batch_id=batch.id,
                row_number=index,
                source_type="PLUGGY_INVESTMENT",
                external_id=row.external_id,
                source_fingerprint=rules.digest(["pluggy-investment", str(row.id), row.digest]),
                external_fingerprint=rules.digest(
                    [
                        "pluggy-investment",
                        str(account.id),
                        str(resource.item_id),
                        resource.external_id,
                        row.external_id,
                    ]
                ),
                raw_data={
                    "resource_id": str(row.id),
                    "resource_digest": row.digest,
                    "provider_json": json.dumps(raw),
                    "activity": values,
                },
                normalized_data={},
                validation_errors=errors,
            )
        )
    session.flush()
    return batch
