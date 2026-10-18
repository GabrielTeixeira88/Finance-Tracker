"""Non-posting edits. The caller owns one atomic unit of work."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ledger import require
from app.models import Category, Payee, Transaction
from app.schemas import TransactionMetadata


def update_metadata(
    session: Session, ids: list[UUID], changes: TransactionMetadata, source="USER"
) -> list[Transaction]:
    values = changes.model_dump(exclude_unset=True)
    unlock = values.pop("unlock_fields", [])
    for field, model in (("category_id", Category), ("payee_id", Payee)):
        if values.get(field) is not None:
            require(session, model, values[field])
    selected = set(ids)
    rows = {
        row.id: row
        for row in session.scalars(select(Transaction).where(Transaction.id.in_(selected)))
    }
    if len(rows) != len(selected):
        raise HTTPException(404, "One or more transactions were not found")
    transfers = set()
    for row in rows.values():
        if row.deleted_at is not None:
            raise HTTPException(409, "Deleted transactions cannot be updated")
        if row.transaction_type not in {"INCOME", "EXPENSE"}:
            if set(values) - {"review_status"} or unlock:
                raise HTTPException(409, "Transfers and opening balances allow review changes only")
            if row.transfer_id:
                transfers.add(row.transfer_id)
    if transfers:
        for side in session.scalars(
            select(Transaction).where(Transaction.transfer_id.in_(transfers))
        ):
            rows[side.id] = side
    now = datetime.now(UTC)
    for row in rows.values():
        from app.payee_learning import manual_change
        from app.rules import FIELDS

        if "transaction_date" in values and values["transaction_date"] != row.transaction_date:
            from app.reconciliation import invalidate_clearing

            invalidate_clearing(session, row.id)
        before = {field: getattr(row, field) for field in FIELDS}
        row.manual_fields = sorted(set(row.manual_fields or []) - set(unlock))
        for field, value in values.items():
            setattr(row, field, value)
        manual_change(session, row, before, values, source)
        row.updated_at = now
    session.flush()
    from app.payee_learning import refresh_suggestions

    refresh_suggestions(session)
    # Refresh selected payee relationships in batches rather than one lookup per edited row.
    return list(
        session.scalars(
            select(Transaction)
            .where(Transaction.id.in_(rows))
            .order_by(Transaction.id)
            .execution_options(populate_existing=True)
        )
    )
