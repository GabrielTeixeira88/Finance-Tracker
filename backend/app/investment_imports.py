"""Brokerage adapter using the shared local ingestion envelope and source history."""

import hashlib
from datetime import UTC, datetime
from typing import Literal
from uuid import NAMESPACE_URL, UUID, uuid5

from fastapi import HTTPException
from pydantic import Field, ValidationError, model_validator
from sqlalchemy import or_, select

from app import ingestion, investments, ledger, rules
from app.ingestion_parsers import amount, csv_rows, decode_upload
from app.ingestion_schemas import MAX_BYTES
from app.investment_schemas import ActivityInput
from app.models import Asset, ImportBatch, InvestmentActivity, InvestmentSourceLink, SourceRecord
from app.schemas import Input, Name


class Mapping(Input):
    kind: Literal["BROKERAGE"] = "BROKERAGE"
    delimiter: Literal[",", ";"] = ","
    encoding: Literal["utf-8-sig", "cp1252"] = "utf-8-sig"
    has_header: bool = True
    date_format: Literal["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"] = "%Y-%m-%d"
    decimal_separator: Literal[".", ","] = "."
    thousands_separator: Literal["", ".", ","] = ""
    source_namespace: str = Field(default="", max_length=120)
    columns: dict[str, int] = Field(max_length=13)

    @model_validator(mode="after")
    def valid(self):
        allowed = {
            "date",
            "type",
            "symbol",
            "exchange",
            "quantity",
            "unit_price",
            "gross_amount",
            "fees",
            "taxes",
            "currency",
            "external_id",
            "notes",
        }
        if not {"date", "type", "currency"} <= self.columns.keys() or set(self.columns) - allowed:
            raise ValueError("Map date, type, currency and supported activity fields")
        if any(type(v) is not int or not 0 <= v < 100 for v in self.columns.values()) or len(
            set(self.columns.values())
        ) != len(self.columns):
            raise ValueError("Map distinct column indexes from 0 to 99")
        if self.decimal_separator == self.thousands_separator:
            raise ValueError("Decimal and thousands separators must differ")
        return self


class Upload(Input):
    filename: str = Field(min_length=1, max_length=200)
    content_base64: str = Field(max_length=((MAX_BYTES + 2) // 3) * 4)
    source_type: Literal["CSV"] = "CSV"
    account_id: UUID
    configuration: Mapping


class Profile(Input):
    name: Name
    configuration: Mapping
    default_account_id: UUID | None = None


class Decision(Input):
    action: Literal["NEW", "SKIP"]


def require_batch(session, id):
    batch = ledger.require(session, ImportBatch, id)
    if batch.source_type != "BROKERAGE_CSV":
        raise HTTPException(422, "Choose a brokerage import")
    return batch


def create_batch(session, data):
    account = ledger.posting_account(session, data.account_id)
    if account.type != "INVESTMENT":
        raise HTTPException(422, "Brokerage imports require an investment account")
    filename, content = decode_upload(data)
    _, rows = csv_rows(content, data.configuration)
    batch = ImportBatch(
        source_type="BROKERAGE_CSV",
        filename=filename,
        account_id=account.id,
        file_hash=hashlib.sha256(content).hexdigest(),
        configuration=data.configuration.model_dump(),
        source_context={"namespace": data.configuration.source_namespace},
        counts={"total": len(rows)},
    )
    session.add(batch)
    session.flush()
    for index, cells in enumerate(rows, 1):
        raw = {
            key: cells[column].strip() if column < len(cells) else ""
            for key, column in data.configuration.columns.items()
        }
        external = raw.get("external_id") or None
        session.add(
            SourceRecord(
                import_batch_id=batch.id,
                row_number=index,
                source_type=batch.source_type,
                external_id=external[:255] if external else None,
                source_fingerprint=rules.digest(
                    ["investment", str(account.id), batch.file_hash, index]
                ),
                external_fingerprint=rules.digest(
                    ["investment", str(account.id), data.configuration.source_namespace, external]
                )
                if external and data.configuration.source_namespace
                else None,
                raw_data=raw,
                normalized_data={},
                validation_errors=[],
            )
        )
    session.flush()
    return batch


def candidate(session, batch, source):
    raw, config = source.raw_data, Mapping.model_validate(batch.configuration)
    security = None
    if raw.get("symbol"):
        security = session.scalar(
            select(Asset).where(
                Asset.symbol == raw["symbol"].upper(),
                Asset.exchange == raw.get("exchange", "").upper(),
                Asset.currency == raw["currency"],
            )
        )
        if not security:
            raise ValueError(
                "Missing asset: create the exact symbol/exchange/currency before refreshing"
            )
    values = {
        field: str(amount(raw[field], config.decimal_separator, config.thousands_separator))
        for field in ("quantity", "unit_price", "gross_amount", "fees", "taxes")
        if raw.get(field)
    }
    return ActivityInput(
        request_id=uuid5(NAMESPACE_URL, "investment-import/" + str(source.id)),
        account_id=batch.account_id,
        asset_id=security.id if security else None,
        activity_date=datetime.strptime(raw["date"], config.date_format).date(),
        activity_type=raw["type"].upper(),
        currency=raw["currency"],
        notes=raw.get("notes", ""),
        **values,
    )


def signature(row):
    return tuple(
        getattr(row, f)
        for f in (
            "account_id",
            "asset_id",
            "activity_date",
            "activity_type",
            "quantity",
            "unit_price",
            "gross_amount",
            "fees",
            "taxes",
            "currency",
        )
    )


def preview(session, batch):
    sources = ingestion.source_rows(session, batch)
    if batch.status == "COMPLETED":
        links = {
            link.source_id: link.activity_id
            for link in session.scalars(
                select(InvestmentSourceLink).where(
                    InvestmentSourceLink.source_id.in_([s.id for s in sources])
                )
            )
        }
        return investments.wire(
            {
                **ingestion.batch_info(batch),
                "ready": False,
                "preview_token": None,
                "rows": [
                    {
                        "id": s.id,
                        "row_number": s.row_number,
                        "status": s.status,
                        "candidate": s.normalized_data or None,
                        "errors": s.validation_errors,
                        "activity_id": links.get(s.id),
                        "decision": s.decision,
                    }
                    for s in sources
                ],
            }
        )
    result, ready, seen, external_seen = [], True, set(), set()
    existing = investments.activities(session, batch.account_id, include_voided=True)
    simulation = session.begin_nested()
    try:
        for source in sources:
            item = {
                "id": str(source.id),
                "row_number": source.row_number,
                "decision": source.decision,
                "status": "NEW",
                "errors": [],
                "candidate": None,
            }
            try:
                data = candidate(session, batch, source)
                item["candidate"] = data.model_dump(mode="json")
                item["candidate"]["cash_amount"] = str(data.cash_amount)
                item["candidate"]["symbol"] = source.raw_data.get("symbol", "")
                claims = [InvestmentSourceLink.file_claim == source.source_fingerprint]
                if source.external_fingerprint:
                    claims.append(
                        InvestmentSourceLink.external_claim == source.external_fingerprint
                    )
                link = session.scalar(select(InvestmentSourceLink).where(or_(*claims)))
                if link:
                    prior = ledger.require(session, InvestmentActivity, link.activity_id)
                    if signature(prior) != signature(data):
                        raise ValueError(
                            "Source identity conflicts with the previously posted activity"
                        )
                    item.update(status="EXACT_DUPLICATE", activity_id=str(prior.id))
                elif source.external_fingerprint and source.external_fingerprint in external_seen:
                    raise ValueError(
                        "Repeated external ID inside file; explicitly skip the extra row"
                    )
                else:
                    if signature(data) in seen or any(
                        signature(p) == signature(data) for p in existing
                    ):
                        item["status"] = "POSSIBLE_DUPLICATE"
                    if source.decision.get("action") != "SKIP":
                        savepoint = session.begin_nested()
                        try:
                            investments.post(session, data)
                            savepoint.commit()
                        except Exception:
                            savepoint.rollback()
                            raise
                seen.add(signature(data))
                if source.external_fingerprint:
                    external_seen.add(source.external_fingerprint)
            except (ValueError, ValidationError, HTTPException) as error:
                item.update(
                    status="INVALID",
                    errors=[
                        error.detail
                        if isinstance(error, HTTPException)
                        else str(error).split("\n")[0]
                    ],
                )
            if source.decision.get("action") != "SKIP" and (
                item["status"] == "INVALID"
                or (
                    item["status"] == "POSSIBLE_DUPLICATE"
                    and source.decision.get("action") != "NEW"
                )
            ):
                ready = False
            result.append(item)
    finally:
        simulation.rollback()
    # Revalidate after any intervening activity/void; never post a stale preview.
    token = rules.digest(
        {
            "rows": result,
            "activities": [[str(r.id), str(r.voided_at)] for r in existing],
            "cash": str(ledger.balances(session).get(batch.account_id, 0)),
        }
    )
    return investments.wire(
        {**ingestion.batch_info(batch), "rows": result, "ready": ready, "preview_token": token}
    )


def confirm(session, batch, data):
    if batch.status == "COMPLETED":
        return preview(session, batch)
    shown = preview(session, batch)
    if not data.account_confirmed or not shown["ready"]:
        raise HTTPException(
            422, "Confirm the account and resolve all invalid/possible duplicate rows"
        )
    if shown["preview_token"] != data.preview_token:
        raise HTTPException(409, "Preview changed; refresh before confirming")
    counts = {"total": len(shown["rows"]), "imported": 0, "duplicate": 0, "skipped": 0}
    for source, item in zip(ingestion.source_rows(session, batch), shown["rows"], strict=True):
        source.normalized_data = item["candidate"] or {}
        source.validation_errors = item["errors"]
        if source.decision.get("action") == "SKIP":
            source.status = "SKIPPED"
            counts["skipped"] += 1
            continue
        if item["status"] == "EXACT_DUPLICATE":
            activity_id = UUID(item["activity_id"])
            source.status = "DUPLICATE"
            counts["duplicate"] += 1
            session.add(InvestmentSourceLink(source_id=source.id, activity_id=activity_id))
        else:
            row = investments.post(session, candidate(session, batch, source))
            source.status = "IMPORTED"
            counts["imported"] += 1
            session.add(
                InvestmentSourceLink(
                    source_id=source.id,
                    activity_id=row.id,
                    file_claim=source.source_fingerprint,
                    external_claim=source.external_fingerprint,
                )
            )
        session.flush()
    batch.status, batch.completed_at, batch.counts = "COMPLETED", datetime.now(UTC), counts
    session.flush()
    return preview(session, batch)
