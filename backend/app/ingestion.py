"""Durable review and atomic posting. No parser writes directly to the ledger."""

import hashlib
from datetime import UTC, date, datetime
from decimal import Decimal, localcontext
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select

from app import ledger, rules, schedules, schemas
from app.ingestion_matching import duplicates, linked_completion, schedule_matches
from app.ingestion_parsers import decode_upload, parse_csv, parse_ofx
from app.ingestion_schemas import Candidate
from app.models import (
    Category,
    FinancialAccount,
    ImportBatch,
    Payee,
    Schedule,
    SourceRecord,
    Transaction,
)


def create_batch(session, data):
    account = ledger.posting_account(session, data.account_id)
    filename, content = decode_upload(data)
    if data.source_type == "CSV" and data.configuration is None:
        raise HTTPException(422, "Choose an explicit CSV mapping and date/amount conventions")
    parsed, context = (
        parse_csv(content, data.configuration, account.currency)
        if data.source_type == "CSV"
        else parse_ofx(content, account.currency)
    )
    if data.source_type == "OFX":
        if context["card"] != (account.type == "CREDIT_CARD"):
            context["warnings"].append(
                "Statement account type differs from the selected local account"
            )
        if (
            account.institution
            and context["institution"]
            and rules.normalize(account.institution) != rules.normalize(context["institution"])
        ):
            context["warnings"].append(
                "Statement institution differs from the selected local institution"
            )
    batch = ImportBatch(
        source_type=data.source_type,
        filename=filename,
        file_hash=hashlib.sha256(content).hexdigest(),
        account_id=account.id,
        configuration=data.configuration.model_dump() if data.configuration else {},
        source_context=context,
        counts={"total": len(parsed)},
    )
    session.add(batch)
    session.flush()
    for index, (raw, normalized, errors) in enumerate(parsed, 1):
        external = raw.get("external_id") or None
        session.add(
            SourceRecord(
                import_batch_id=batch.id,
                row_number=index,
                source_type=data.source_type,
                external_id=external[:255] if external else None,
                source_fingerprint=rules.digest([str(account.id), batch.file_hash, index]),
                external_fingerprint=rules.digest(
                    [str(account.id), data.source_type, context["namespace"], external]
                )
                if external and context["namespace"]
                else None,
                raw_data=raw,
                normalized_data=normalized,
                validation_errors=errors,
            )
        )
    session.flush()
    return batch


def source_rows(session, batch):
    return list(
        session.scalars(
            select(SourceRecord)
            .where(SourceRecord.import_batch_id == batch.id)
            .order_by(SourceRecord.row_number)
        )
    )


def batch_info(batch):
    return {
        "id": str(batch.id),
        "filename": batch.filename,
        "source_type": batch.source_type,
        "account_id": str(batch.account_id),
        "status": batch.status,
        "created_at": batch.created_at,
        "completed_at": batch.completed_at,
        "counts": batch.counts,
        "source_context": batch.source_context,
    }


def candidate_row(session, source, account_id, active_rules, payees):
    candidate = Candidate.model_validate(source.normalized_data)
    exact = next(
        (
            p
            for p in payees
            if p.normalized_name
            == rules.normalize(source.raw_data.get("name") or candidate.description)
        ),
        None,
    )
    inferred = {"review_status": "NEEDS_REVIEW", "payee_id": exact.id if exact else None}
    metadata = {key: value for key, value in source.decision.items() if key in rules.FIELDS}
    values = {**candidate.model_dump(exclude={"ambiguity"}), **inferred, **metadata}
    for field in ("payee_id", "category_id"):
        if values[field]:
            values[field] = UUID(str(values[field]))
            ledger.require(session, Payee if field == "payee_id" else Category, values[field])
    row = Transaction(
        **values,
        account_id=account_id,
        deleted_at=None,
        manual_fields=list(metadata),
        rule_assignments={},
    )
    evaluation = rules.evaluate(row, active_rules, {str(p.id): p.name for p in payees})
    for action in evaluation["proposed"]:
        setattr(
            row,
            action["field"],
            UUID(action["after"]) if action["field"].endswith("_id") else action["after"],
        )
    return candidate, row, evaluation, inferred


def preview(session, batch):
    sources = source_rows(session, batch)
    if batch.status == "COMPLETED":
        return {
            **batch_info(batch),
            "rows": [
                {
                    "id": str(s.id),
                    "row_number": s.row_number,
                    "raw": s.raw_data,
                    "candidate": (
                        {**s.normalized_data, **s.decision.get("posted_metadata", {})}
                        if s.normalized_data
                        else None
                    ),
                    "status": s.status,
                    "errors": s.validation_errors,
                    "transaction_id": str(s.transaction_id) if s.transaction_id else None,
                    "decision": s.decision,
                    "matches": [],
                    "schedules": [],
                    "rules": s.decision.get("applied_rules", []),
                    "reason": "Committed outcome",
                }
                for s in sources
            ],
            "preview_token": None,
            "ready": True,
            "incoming": "0",
            "outgoing": "0",
        }
    account = ledger.require(session, FinancialAccount, batch.account_id)
    active, payees = rules.active_rules(session), list(session.scalars(select(Payee)))
    result, identities, contents = [], {}, {}
    counts = {
        key: 0
        for key in (
            "NEW",
            "EXACT_DUPLICATE",
            "POSSIBLE_DUPLICATE",
            "INVALID",
            "ready",
            "skipped",
            "linked",
        )
    }
    incoming, outgoing = Decimal(0), Decimal(0)
    counts["total"] = len(sources)
    ready = account.active
    for source in sources:
        metadata_errors = []
        for field, model in (("category_id", Category), ("payee_id", Payee)):
            value = source.decision.get(field)
            if value and session.get(model, UUID(value)) is None:
                metadata_errors.append(
                    "Selected metadata no longer exists; change it or skip this row"
                )
        item = {
            "id": str(source.id),
            "row_number": source.row_number,
            "raw": source.raw_data,
            "candidate": None,
            "status": "INVALID",
            "errors": source.validation_errors + metadata_errors,
            "decision": source.decision,
            "matches": [],
            "schedules": [],
            "rules": [],
            "reason": "Invalid source fields",
        }
        if not item["errors"]:
            candidate, row, evaluation, _ = candidate_row(
                session, source, account.id, active, payees
            )
            status, matches, reason = duplicates(session, source, candidate, account.id)
            key = source.external_fingerprint
            content_key = rules.digest(
                [
                    candidate.transaction_date,
                    format(candidate.amount, ".6f"),
                    candidate.currency,
                    candidate.transaction_type,
                    rules.normalize(candidate.description),
                ]
            )
            if key and key in identities:
                original = identities[key]
                status = "EXACT_DUPLICATE" if original == source.normalized_data else "INVALID"
                matches = []
                reason = (
                    "Repeated external identifier within this file"
                    if status == "EXACT_DUPLICATE"
                    else "Conflicting values for one external identifier"
                )
            elif status == "NEW" and content_key in contents:
                status, reason = (
                    "POSSIBLE_DUPLICATE",
                    "An earlier row has the same content; confirm if these are separate purchases",
                )
            if key:
                identities[key] = source.normalized_data
            contents[content_key] = source.id
            item.update(
                status=status,
                matches=[
                    {
                        "id": id,
                        "description": ledger.require(session, Transaction, UUID(id)).description,
                    }
                    for id in matches
                ],
                reason=reason,
                candidate={
                    **candidate.model_dump(mode="json"),
                    **{f: rules.string_value(getattr(row, f)) for f in rules.FIELDS},
                    "payee_name": next((p.name for p in payees if p.id == row.payee_id), None),
                },
                rules=evaluation["proposed"],
                schedules=schedule_matches(session, row),
            )
        counts[item["status"]] += 1
        action = source.decision.get("action")
        if action == "SKIP":
            counts["skipped"] += 1
        elif item["status"] in {"INVALID", "EXACT_DUPLICATE"}:
            # Exact duplicates are safe automatic no-ops; invalid rows require explicit exclusion.
            if item["status"] == "INVALID" or action in {"NEW", "LINK"}:
                ready = False
        elif action == "LINK":
            if source.decision.get("transaction_id") not in {m["id"] for m in item["matches"]}:
                ready = False
            else:
                counts["linked"] += 1
        elif action == "NEW" or (
            action is None
            and item["status"] == "NEW"
            and not item["candidate"]["ambiguity"]
            and not item["schedules"]
        ):
            uncertain = item["candidate"]["ambiguity"] or item["schedules"]
            if uncertain and not source.decision.get("acknowledge_classification"):
                ready = False
            else:
                counts["ready"] += 1
                with localcontext() as ctx:
                    ctx.prec = 60
                    if item["candidate"]["transaction_type"] == "INCOME":
                        incoming += Decimal(item["candidate"]["amount"])
                    else:
                        outgoing += Decimal(item["candidate"]["amount"])
        else:
            ready = False
        result.append(item)
    payload = {
        **batch_info(batch),
        "rows": result,
        "counts": counts,
        "ready": ready,
        "incoming": str(incoming),
        "outgoing": str(outgoing),
    }
    payload["preview_token"] = rules.digest(
        {"rows": result, "active": account.active, "rules": [rules.rule_data(r) for r in active]}
    )
    return payload


def decide(session, batch, source_id, decision):
    if batch.status != "DRAFT":
        raise HTTPException(409, "Completed imports cannot be reprocessed")
    source = ledger.require(session, SourceRecord, source_id)
    if source.import_batch_id != batch.id:
        raise HTTPException(404, "Source row is not in this batch")
    for field, model in (("payee_id", Payee), ("category_id", Category)):
        if getattr(decision, field):
            ledger.require(session, model, getattr(decision, field))
    source.decision = decision.model_dump(mode="json", exclude_unset=True)
    session.flush()


def confirm(session, batch, data):
    if batch.status == "COMPLETED":
        return preview(session, batch)
    if not data.account_confirmed:
        raise HTTPException(422, "Confirm the selected target account")
    shown = preview(session, batch)
    if shown["preview_token"] != data.preview_token:
        raise HTTPException(
            409, "Import preview changed. Review the refreshed preview before confirming"
        )
    if not shown["ready"]:
        raise HTTPException(
            422, "Resolve uncertain rows and explicitly skip invalid rows before confirming"
        )
    ledger.posting_account(session, batch.account_id)
    counts = {key: 0 for key in ("total", "imported", "linked", "duplicate", "skipped", "error")}
    active, payees = rules.active_rules(session), list(session.scalars(select(Payee)))
    for source, item in zip(source_rows(session, batch), shown["rows"], strict=True):
        counts["total"] += 1
        action = source.decision.get("action")
        if action == "SKIP":
            source.status = "INVALID" if item["status"] == "INVALID" else "SKIPPED"
            source.validation_errors = item["errors"]
            counts["error" if source.status == "INVALID" else "skipped"] += 1
            continue
        candidate, row, evaluation, inferred = candidate_row(
            session, source, batch.account_id, active, payees
        )
        status, matches, _ = duplicates(session, source, candidate, batch.account_id)
        if status == "EXACT_DUPLICATE":
            source.transaction_id = UUID(matches[0])
            source.status = "DUPLICATE"
            if not session.scalar(
                select(SourceRecord.id).where(SourceRecord.file_claim == source.source_fingerprint)
            ):
                source.file_claim = source.source_fingerprint
            counts["duplicate"] += 1
            session.flush()
            continue
        if item["status"] == "EXACT_DUPLICATE":
            # Earlier identical row was deliberately skipped: this duplicate is still skipped.
            source.status = "SKIPPED"
            counts["skipped"] += 1
            continue
        if status == "INVALID":
            raise HTTPException(409, "Source identity conflicts; review again")
        if action == "LINK":
            target = UUID(source.decision["transaction_id"])
            if str(target) not in matches:
                raise HTTPException(409, "Existing transaction is no longer compatible")
            transaction = ledger.require(session, Transaction, target)
            source.status = "LINKED"
            counts["linked"] += 1
        else:
            fields = candidate.model_dump(
                exclude={"ambiguity", "payee_id", "category_id", "review_status"}
            )
            fields.update(
                {key: value for key, value in source.decision.items() if key in rules.FIELDS}
            )
            transaction = ledger.create_transaction(
                session,
                schemas.TransactionCreate(account_id=batch.account_id, **fields),
                inferred_metadata=inferred,
            )
            source.status = "IMPORTED"
            counts["imported"] += 1
        source.transaction_id = transaction.id
        source.decision = {
            **source.decision,
            "posted_metadata": {
                **{f: rules.string_value(getattr(transaction, f)) for f in rules.FIELDS},
                "payee_name": next((p.name for p in payees if p.id == transaction.payee_id), None),
            },
            "applied_rules": evaluation["proposed"] if source.status == "IMPORTED" else [],
        }
        source.file_claim = source.source_fingerprint
        source.external_claim = source.external_fingerprint
        if source.decision.get("schedule_id"):
            schedule = ledger.require(session, Schedule, UUID(source.decision["schedule_id"]))
            due = date.fromisoformat(source.decision["due_date"])
            completion = linked_completion(session, transaction.id)
            if (
                not completion
                or completion.schedule_id != schedule.id
                or completion.due_date != due
            ):
                schedules.confirm_match(session, schedule, due, transaction.id)
        session.flush()
    batch.status, batch.completed_at, batch.counts = "COMPLETED", datetime.now(UTC), counts
    session.flush()
    return preview(session, batch)
