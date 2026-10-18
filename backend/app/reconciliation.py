"""Explicit, local reconciliation. All writes share the caller's atomic unit of work."""

from datetime import UTC, date, datetime
from decimal import Decimal, localcontext
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select

from app import ingestion_matching, ledger, rules, schemas
from app.ingestion_schemas import Candidate
from app.models import FinancialAccount, ImportBatch, RefundLink, SourceRecord, Transaction
from app.reconciliation_models import (
    Clearing,
    ReconciliationAudit,
    SourceDisposition,
    Statement,
    StatementEntry,
)


def audit(session, action, details, request_id=None, payload=None):
    row = ReconciliationAudit(
        request_id=request_id or uuid4(),
        payload_digest=rules.digest(payload or details),
        action=action,
        details=details,
    )
    session.add(row)
    session.flush()
    return row


def replay(session, data, target=None):
    row = session.scalar(
        select(ReconciliationAudit).where(ReconciliationAudit.request_id == data.request_id)
    )
    if row and row.payload_digest != rules.digest(data.model_dump(mode="json")):
        raise HTTPException(409, "Request identity was already used for a different action")
    if row and target and row.details.get(target[0]) != str(target[1]):
        raise HTTPException(409, "Request identity belongs to another record")
    return row


def locks(session, transaction_id):
    return list(
        session.scalars(
            select(Statement)
            .join(StatementEntry)
            .where(
                StatementEntry.transaction_id == transaction_id,
                Statement.status == "COMPLETED",
                StatementEntry.revision == Statement.revision,
            )
        )
    )


def assert_unlocked(session, transaction_id):
    if locks(session, transaction_id):
        raise HTTPException(409, "Reopen the completed statement before changing this transaction")


def disposition(session, source_id):
    return session.scalar(select(SourceDisposition).where(SourceDisposition.source_id == source_id))


def sources(session, transaction_id):
    result = []
    for source in session.scalars(
        select(SourceRecord)
        .where(SourceRecord.transaction_id == transaction_id)
        .order_by(SourceRecord.created_at, SourceRecord.id)
    ):
        state = disposition(session, source.id)
        result.append(
            {
                "id": str(source.id),
                "source_type": source.source_type,
                "batch_id": str(source.import_batch_id),
                "raw": source.raw_data,
                "candidate": source.normalized_data,
                "status": source.status,
                "detached": bool(state and state.detached),
            }
        )
    return result


def states(session, ids):
    result = {
        id: {
            "clearing_status": "UNCLEARED",
            "clearing_source_id": None,
            "bank_date": None,
            "statement_ids": [],
            "source_count": 0,
        }
        for id in ids
    }
    if not result:
        return result
    for clear in session.scalars(select(Clearing).where(Clearing.transaction_id.in_(result))):
        result[clear.transaction_id].update(
            clearing_status="CLEARED" if clear.cleared else "UNCLEARED",
            clearing_source_id=str(clear.source_id) if clear.source_id else None,
            bank_date=clear.bank_date.isoformat() if clear.bank_date else None,
        )
    for transaction_id, statement_id in session.execute(
        select(StatementEntry.transaction_id, Statement.id)
        .join(Statement)
        .where(
            StatementEntry.transaction_id.in_(result),
            Statement.status == "COMPLETED",
            StatementEntry.revision == Statement.revision,
        )
    ):
        result[transaction_id]["clearing_status"] = "RECONCILED"
        result[transaction_id]["statement_ids"].append(str(statement_id))
    for transaction_id in session.scalars(
        select(SourceRecord.transaction_id)
        .outerjoin(SourceDisposition, SourceDisposition.source_id == SourceRecord.id)
        .where(
            SourceRecord.transaction_id.in_(result),
            or_(SourceDisposition.detached.is_(None), SourceDisposition.detached.is_(False)),
        )
    ):
        result[transaction_id]["source_count"] += 1
    return result


def state(session, transaction_id):
    return states(session, [transaction_id])[transaction_id]


def clear_transaction(session, transaction_id, data):
    if replay(session, data, ("transaction_id", transaction_id)):
        return state(session, transaction_id)
    row = ledger.require(session, Transaction, transaction_id)
    if row.deleted_at:
        raise HTTPException(409, "Deleted transactions cannot be cleared")
    assert_unlocked(session, row.id)
    bank_date = data.bank_date or row.transaction_date
    if data.source_id:
        source = ledger.require(session, SourceRecord, data.source_id)
        sd = disposition(session, source.id)
        if source.transaction_id != row.id or (sd and sd.detached):
            raise HTTPException(422, "Clearing evidence must be linked to this transaction")
        if source.source_type == "GMAIL":
            raise HTTPException(422, "A notification alone is not posted bank evidence")
        if source.validation_errors or not ingestion_matching.compatible(
            row, Candidate.model_validate(source.normalized_data), row.account_id
        ):
            raise HTTPException(409, "Clearing evidence conflicts with the current posting")
        bank_date = date.fromisoformat(source.normalized_data["transaction_date"])
    before = state(session, row.id)
    affected_date = min(
        bank_date if data.cleared else date.max,
        date.fromisoformat(before["bank_date"] or row.transaction_date.isoformat())
        if before["clearing_status"] == "CLEARED"
        else date.max,
    )
    if session.scalar(
        select(Statement.id).where(
            Statement.account_id == row.account_id,
            Statement.status == "COMPLETED",
            Statement.cutoff >= max(row.transaction_date, affected_date),
        )
    ):
        raise HTTPException(409, "Reopen the affected statement before changing earlier clearing")
    clear = session.scalar(select(Clearing).where(Clearing.transaction_id == row.id))
    if clear is None:
        clear = Clearing(transaction_id=row.id)
        session.add(clear)
    clear.cleared = data.cleared
    clear.bank_date = bank_date if data.cleared else None
    clear.source_id = data.source_id if data.cleared else None
    session.flush()
    after = state(session, row.id)
    audit(
        session,
        "CLEARING_CHANGED",
        {"transaction_id": str(row.id), "before": before, "after": after},
        data.request_id,
        data.model_dump(mode="json"),
    )
    return after


def invalidate_clearing(session, transaction_id):
    """A financial correction requires fresh bank verification, unlike metadata edits."""
    from sqlalchemy import inspect

    if not inspect(session.connection()).has_table("transaction_clearing"):
        return  # Offline fixtures can still construct pre-reconciliation migration states.
    assert_unlocked(session, transaction_id)
    clear = session.scalar(select(Clearing).where(Clearing.transaction_id == transaction_id))
    if clear and clear.cleared:
        before = state(session, transaction_id)
        clear.cleared, clear.source_id, clear.bank_date = False, None, None
        audit(
            session,
            "CLEARING_INVALIDATED",
            {
                "transaction_id": str(transaction_id),
                "before": before,
                "reason": "Ledger financial correction requires fresh verification",
            },
        )


def match_details(session, transaction_id, candidate):
    row = ledger.require(session, Transaction, UUID(str(transaction_id)))
    days = abs((row.transaction_date - candidate.transaction_date).days)
    same_payee = bool(candidate.payee_id and row.payee_id == candidate.payee_id)
    words = set(rules.normalize(candidate.description).split())
    other = set(rules.normalize(row.description).split())
    similar = bool(words and other and len(words & other) * 2 >= max(len(words), len(other)))
    return {
        **schemas.TransactionOutput.model_validate(row).model_dump(mode="json"),
        "classification": "CONFLICT"
        if row.amount != candidate.amount
        else "HIGH_CONFIDENCE_MATCH"
        if same_payee or similar
        else "POSSIBLE_MATCH",
        "evidence": [
            "Same account",
            "Same currency",
            "Exact amount" if row.amount == candidate.amount else "Conflicting amount",
            "Same direction",
            f"Dates {days} day(s) apart",
        ]
        + (["Same normalized payee"] if same_payee else [])
        + (["Overlapping description words"] if similar else []),
    }


def candidate_view(session, source):
    batch = ledger.require(session, ImportBatch, source.import_batch_id)
    sd = disposition(session, source.id)
    matches, reason, classification = [], "Invalid or unsupported source fields", "CONFLICT"
    if (
        source.normalized_data
        and not source.validation_errors
        and source.source_type in {"CSV", "OFX", "GMAIL"}
    ):
        candidate = Candidate.model_validate(source.normalized_data)
        status, ids, reason = ingestion_matching.duplicates(
            session, source, candidate, batch.account_id
        )
        classification = {
            "EXACT_DUPLICATE": "EXACT_SOURCE_DUPLICATE",
            "INVALID": "CONFLICT",
            "NEW": "NO_MATCH",
            "POSSIBLE_DUPLICATE": "POSSIBLE_MATCH",
            "CONFLICT": "CONFLICT",
        }[status]
        matches = [
            match_details(session, id, candidate)
            for id in ids
            if not sd or id not in sd.rejected_ids
        ]
        if classification == "POSSIBLE_MATCH" and len(matches) == 1:
            classification = matches[0]["classification"]
    data = {
        "id": str(source.id),
        "batch_id": str(batch.id),
        "batch_status": batch.status,
        "account_id": str(batch.account_id),
        "source_type": source.source_type,
        "candidate": source.normalized_data,
        "classification": classification,
        "matches": matches,
        "reason": reason,
        "transaction_id": str(source.transaction_id) if source.transaction_id else None,
        "detached": bool(sd and sd.detached),
        "dismissed": bool(sd and sd.dismissed),
    }
    data["token"] = rules.digest(data)
    return data


def change_source(session, source_id, data):
    if replay(session, data, ("source_id", source_id)):
        return candidate_view(session, ledger.require(session, SourceRecord, source_id))
    source = ledger.require(session, SourceRecord, source_id)
    before = candidate_view(session, source)
    affected_sources = []
    if before["token"] != data.token:
        raise HTTPException(409, "Source preview changed; review it again")
    sd = disposition(session, source.id)
    if sd is None:
        sd = SourceDisposition(
            source_id=source.id, detached=False, dismissed=False, rejected_ids=[]
        )
        session.add(sd)
    if data.action in {"DISMISS", "REOPEN", "REJECT"}:
        sd.dismissed = data.action == "DISMISS"
        if before["batch_status"] == "DRAFT":
            if data.action == "DISMISS":
                source.decision = {**source.decision, "action": "SKIP"}
            elif data.action == "REOPEN":
                source.decision = {
                    k: v
                    for k, v in source.decision.items()
                    if k not in {"action", "transaction_id"}
                }
        if data.action == "REJECT":
            if before["classification"] == "EXACT_SOURCE_DUPLICATE" or str(
                data.transaction_id
            ) not in {m["id"] for m in before["matches"]}:
                raise HTTPException(
                    422, "Choose a proposed match; confirmed links must be unlinked instead"
                )
            sd.rejected_ids = sorted(set(sd.rejected_ids + [str(data.transaction_id)]))
        if data.action == "REOPEN":
            sd.rejected_ids = []
    else:
        if source.source_type not in {"CSV", "OFX", "GMAIL"} or source.validation_errors:
            raise HTTPException(422, "Only valid ordinary ingestion sources can be linked")
        if data.action == "UNLINK" and (not source.transaction_id or sd.detached):
            raise HTTPException(409, "This source has no active link")
        if data.action == "LINK" and not data.transaction_id:
            raise HTTPException(422, "Choose the target transaction")
        if source.transaction_id:
            assert_unlocked(session, source.transaction_id)
        if before["batch_status"] != "COMPLETED":
            raise HTTPException(
                409, "Confirm draft sources through the existing import review first"
            )
        # All observations of one reliable identity move together. Claims remain reserved
        # when detached, preventing a retry from turning a correction into a new posting.
        group = list(
            session.scalars(
                select(SourceRecord).where(
                    or_(
                        SourceRecord.id == source.id,
                        SourceRecord.source_fingerprint == source.source_fingerprint,
                        SourceRecord.external_fingerprint == source.external_fingerprint
                        if source.external_fingerprint
                        else False,
                    )
                )
            )
        )
        target = None
        if data.action == "LINK":
            target = ledger.require(session, Transaction, data.transaction_id)
            candidate = Candidate.model_validate(source.normalized_data)
            if not ingestion_matching.compatible(target, candidate, UUID(before["account_id"])):
                raise HTTPException(
                    422,
                    "Target must match account, currency, amount, direction and date window",
                )
            assert_unlocked(session, target.id)
        elif data.action != "UNLINK":
            raise HTTPException(422, "Unsupported source action")
        for member in group:
            prior_disposition = disposition(session, member.id)
            affected_sources.append(
                {
                    "source_id": str(member.id),
                    "previous_transaction_id": str(member.transaction_id)
                    if member.transaction_id
                    else None,
                    "previous_detached": bool(prior_disposition and prior_disposition.detached),
                }
            )
            if target:
                member_batch = ledger.require(session, ImportBatch, member.import_batch_id)
                if (
                    member.validation_errors
                    or not member.normalized_data
                    or not ingestion_matching.compatible(
                        target,
                        Candidate.model_validate(member.normalized_data),
                        member_batch.account_id,
                    )
                ):
                    raise HTTPException(
                        409, "Related source observations conflict; resolve them first"
                    )
            if member.transaction_id:
                assert_unlocked(session, member.transaction_id)
                for clear in session.scalars(
                    select(Clearing).where(Clearing.source_id == member.id)
                ):
                    audit(
                        session,
                        "CLEARING_INVALIDATED",
                        {
                            "transaction_id": str(member.transaction_id),
                            "before": state(session, member.transaction_id),
                            "reason": "Supporting bank source was detached or reassigned",
                        },
                    )
                    clear.cleared, clear.source_id, clear.bank_date = False, None, None
            member_state = disposition(session, member.id)
            if member_state is None:
                member_state = SourceDisposition(
                    source_id=member.id, dismissed=False, rejected_ids=[]
                )
                session.add(member_state)
            member_state.detached = target is None
            if target:
                member.transaction_id = target.id
                member.status = "LINKED"
                if (
                    member.id == source.id
                    and member.external_fingerprint
                    and not session.scalar(
                        select(SourceRecord.id).where(
                            SourceRecord.external_claim == member.external_fingerprint
                        )
                    )
                ):
                    member.external_claim = member.external_fingerprint
                member.file_claim = member.file_claim or (
                    member.source_fingerprint
                    if member.id == source.id
                    and not session.scalar(
                        select(SourceRecord.id).where(
                            SourceRecord.file_claim == member.source_fingerprint
                        )
                    )
                    else None
                )
    session.flush()
    after = candidate_view(session, source)
    audit(
        session,
        f"SOURCE_{data.action}",
        {
            "source_id": str(source.id),
            "before": before,
            "after": after,
            "affected_sources": affected_sources,
            "reason": data.reason,
        },
        data.request_id,
        data.model_dump(mode="json"),
    )
    return after


def statement_view(session, statement):
    account = ledger.require(session, FinancialAccount, statement.account_id)
    rows = list(
        session.scalars(
            select(Transaction)
            .where(
                Transaction.account_id == account.id,
                Transaction.transaction_date <= statement.cutoff,
                Transaction.deleted_at.is_(None),
            )
            .order_by(Transaction.transaction_date, Transaction.id)
        )
    )
    cleared_ids = set()
    settlement_after_cutoff = []
    for clearing, source in session.execute(
        select(Clearing, SourceRecord)
        .outerjoin(SourceRecord, Clearing.source_id == SourceRecord.id)
        .where(Clearing.cleared, Clearing.transaction_id.in_([r.id for r in rows]))
    ):
        source_date = (
            clearing.bank_date.isoformat()
            if clearing.bank_date
            else (source.normalized_data.get("transaction_date") if source else None)
        )
        if source_date and source_date > statement.cutoff.isoformat():
            settlement_after_cutoff.append(str(clearing.transaction_id))
        else:
            cleared_ids.add(clearing.transaction_id)
    # Opening history is included only after explicit clearing, just like every bank line.
    selected = [r.id for r in rows if r.id in cleared_ids]
    with localcontext() as ctx:
        ctx.prec = 60
        balance = ledger.balances(session, cutoff=statement.cutoff, transaction_ids=selected).get(
            account.id, Decimal(0)
        )
        target = statement.balance_magnitude * (-1 if statement.balance_negative else 1)
        difference = target - balance
    row_states = states(session, [r.id for r in rows])
    pending = []
    for source in session.scalars(
        select(SourceRecord)
        .join(ImportBatch)
        .where(
            ImportBatch.account_id == account.id,
            ImportBatch.status == "DRAFT",
            SourceRecord.source_type.in_(["OFX", "CSV", "GMAIL"]),
        )
    ):
        sd = disposition(session, source.id)
        if source.decision.get("action") == "SKIP" or (sd and sd.dismissed):
            continue
        source_date = source.normalized_data.get("transaction_date")
        if source_date and source_date > statement.cutoff.isoformat():
            continue
        view = candidate_view(session, source)
        if view["classification"] == "EXACT_SOURCE_DUPLICATE":
            continue
        if source.source_type != "GMAIL" or view["classification"] == "CONFLICT":
            pending.append(str(source.id))
    result = {
        "id": str(statement.id),
        "account_id": str(account.id),
        "currency": account.currency,
        "cutoff": statement.cutoff.isoformat(),
        "statement_balance": format(target, ".6f"),
        "cleared_balance": format(balance, ".6f"),
        "difference": format(difference, ".6f"),
        "status": statement.status,
        "revision": statement.revision,
        "notes": statement.notes,
        "completed_at": statement.completed_at.isoformat() if statement.completed_at else None,
        "previous_result": statement.result,
        "pending_source_ids": pending,
        "settlement_after_cutoff_ids": settlement_after_cutoff,
        "transactions": [
            {
                **schemas.TransactionOutput.model_validate(r).model_dump(mode="json"),
                **row_states[r.id],
            }
            for r in rows
        ],
    }
    result["token"] = rules.digest(result)
    return result


def create_statement(session, data):
    prior = replay(session, data)
    if prior:
        return statement_view(
            session, ledger.require(session, Statement, UUID(prior.details["statement_id"]))
        )
    account = ledger.require(session, FinancialAccount, data.account_id)
    if account.type == "INVESTMENT":
        raise HTTPException(
            422, "Brokerage activity reconciliation requires a separate activity workflow"
        )
    statement = Statement(
        account_id=account.id,
        cutoff=data.cutoff,
        balance_magnitude=abs(data.ending_balance),
        balance_negative=data.ending_balance < 0,
        notes=data.notes,
    )
    session.add(statement)
    session.flush()
    audit(
        session,
        "STATEMENT_CREATED",
        {"statement_id": str(statement.id)},
        data.request_id,
        data.model_dump(mode="json"),
    )
    return statement_view(session, statement)


def transition_statement(session, statement, data):
    if replay(session, data, ("statement_id", statement.id)):
        return statement_view(session, statement)
    shown = statement_view(session, statement)
    if data.token != shown["token"]:
        raise HTTPException(409, "Statement changed; refresh before continuing")
    if data.action == "COMPLETE":
        if ledger.require(session, FinancialAccount, statement.account_id).type == "INVESTMENT":
            raise HTTPException(422, "Brokerage statements require a separate activity workflow")
        if statement.status == "COMPLETED":
            raise HTTPException(409, "Statement is already complete")
        if Decimal(shown["difference"]) != 0:
            raise HTTPException(
                409, "Exact cleared balance must equal the statement ending balance"
            )
        if shown["pending_source_ids"]:
            raise HTTPException(409, "Resolve or dismiss pending statement sources first")
        later = session.scalar(
            select(Statement.id).where(
                Statement.account_id == statement.account_id,
                Statement.status == "COMPLETED",
                Statement.cutoff >= statement.cutoff,
            )
        )
        if later:
            raise HTTPException(409, "Reopen the existing same-date or later statement first")
        for row in shown["transactions"]:
            if (
                row["clearing_status"] != "UNCLEARED"
                and row["id"] not in shown["settlement_after_cutoff_ids"]
            ):
                session.add(
                    StatementEntry(
                        statement_id=statement.id,
                        transaction_id=UUID(row["id"]),
                        revision=statement.revision,
                    )
                )
        statement.status, statement.completed_at = "COMPLETED", datetime.now(UTC)
        statement.result = {
            "cleared_balance": shown["cleared_balance"],
            "difference": shown["difference"],
            "included_ids": [
                r["id"]
                for r in shown["transactions"]
                if r["clearing_status"] != "UNCLEARED"
                and r["id"] not in shown["settlement_after_cutoff_ids"]
            ],
        }
    else:
        affected = list(
            session.scalars(
                select(Statement).where(
                    Statement.account_id == statement.account_id,
                    Statement.cutoff >= statement.cutoff,
                    Statement.status == "COMPLETED",
                )
            )
        )
        if not affected:
            raise HTTPException(409, "No completed statements to reopen")
        for affected_statement in affected:
            audit(
                session,
                "STATEMENT_INVALIDATED",
                {
                    "statement_id": str(affected_statement.id),
                    "previous_result": affected_statement.result,
                    "reason": data.reason,
                },
            )
            affected_statement.status = "REOPENED"
            affected_statement.revision += 1
    session.flush()
    after = statement_view(session, statement)
    audit(
        session,
        f"STATEMENT_{data.action}",
        {"statement_id": str(statement.id), "before": shown, "after": after, "reason": data.reason},
        data.request_id,
        data.model_dump(mode="json"),
    )
    return after


def merge_preview(session, survivor_id, duplicate_id):
    survivor = ledger.require(session, Transaction, survivor_id)
    duplicate = ledger.require(session, Transaction, duplicate_id)
    blockers = []
    for row in (survivor, duplicate):
        if row.deleted_at or row.transaction_type not in {"INCOME", "EXPENSE"}:
            blockers.append("Only live ordinary transactions can be merged")
        if locks(session, row.id):
            blockers.append("Reopen completed statements first")
        if ingestion_matching.linked_completion(session, row.id):
            blockers.append("Unlink the scheduled completion through its dedicated workflow first")
        if session.scalar(
            select(RefundLink.id).where(
                or_(RefundLink.purchase_id == row.id, RefundLink.refund_id == row.id)
            )
        ):
            blockers.append(
                "Refund-linked transactions require their dedicated correction workflow"
            )
    if survivor.id == duplicate.id or any(
        getattr(survivor, k) != getattr(duplicate, k)
        for k in ("account_id", "currency", "amount", "direction", "transaction_type")
    ):
        blockers.append(
            "Choose distinct transactions with identical account, currency, amount and type"
        )
    if (
        abs((survivor.transaction_date - duplicate.transaction_date).days)
        > ingestion_matching.get_settings().reconciliation_match_days
    ):
        blockers.append("Dates fall outside the configured matching window")
    result = {
        "survivor": schemas.TransactionOutput.model_validate(survivor).model_dump(mode="json"),
        "duplicate": schemas.TransactionOutput.model_validate(duplicate).model_dump(mode="json"),
        "survivor_sources": sources(session, survivor.id),
        "duplicate_sources": sources(session, duplicate.id),
        "blockers": sorted(set(blockers)),
        "balance_change": str(
            -duplicate.amount if duplicate.direction == "IN" else duplicate.amount
        ),
    }
    result["token"] = rules.digest(result)
    return result


def merge(session, data):
    previous = replay(session, data)
    if previous:
        return previous.details
    shown = merge_preview(session, data.survivor_id, data.duplicate_id)
    if shown["token"] != data.token or shown["blockers"]:
        raise HTTPException(409, "Merge preview is stale or contains protected financial links")
    for source in session.scalars(
        select(SourceRecord).where(SourceRecord.transaction_id == data.duplicate_id)
    ):
        source.transaction_id = data.survivor_id
    ledger.delete_transaction(session, data.duplicate_id)
    audit(session, "LEDGER_MERGED", shown, data.request_id, data.model_dump(mode="json"))
    return shown
