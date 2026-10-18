from datetime import UTC, date, datetime
from decimal import Decimal, localcontext
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import schemas
from app.models import Category, FinancialAccount, Payee, Transaction, Transfer


def require(session: Session, model, record_id: UUID):
    record = session.get(model, record_id)
    if record is None:
        raise HTTPException(404, "Record not found")
    return record


def posting_account(session: Session, account_id: UUID) -> FinancialAccount:
    account = session.scalar(
        select(FinancialAccount).where(FinancialAccount.id == account_id).with_for_update()
    )
    if account is None:
        raise HTTPException(404, "Account not found")
    if not account.active:
        raise HTTPException(409, "This account is inactive")
    return account


def balances(session: Session, *, cutoff=None, transaction_ids=None) -> dict[UUID, Decimal]:
    with localcontext() as context:
        context.prec = 60
        # SQLite SUM/NUMERIC can introduce floating point; aggregate exact decoded Decimals.
        totals = {}
        query = select(Transaction.account_id, Transaction.direction, Transaction.amount).where(
            Transaction.deleted_at.is_(None)
        )
        if cutoff is not None:
            query = query.where(Transaction.transaction_date <= cutoff)
        if transaction_ids is not None:
            query = query.where(Transaction.id.in_(transaction_ids))
        rows = session.execute(query)
        for account_id, direction, amount in rows:
            totals[account_id] = totals.get(account_id, Decimal("0")) + (
                amount if direction == "IN" else -amount
            )
        from app.investments import cash_entries

        for entry in cash_entries(session):
            if cutoff is not None and entry.transaction_date > cutoff:
                continue
            totals[entry.account_id] = totals.get(entry.account_id, Decimal("0")) + (
                entry.amount if entry.direction == "IN" else -entry.amount
            )
        return totals


def accounts(session: Session) -> list[schemas.AccountOutput]:
    amounts = balances(session)
    return [
        schemas.AccountOutput(
            **{
                key: getattr(account, key)
                for key in (
                    "id",
                    "name",
                    "type",
                    "currency",
                    "institution",
                    "active",
                    "created_at",
                    "updated_at",
                )
            },
            balance=amounts.get(account.id, Decimal("0")),
        )
        for account in session.scalars(
            select(FinancialAccount).order_by(FinancialAccount.name, FinancialAccount.id)
        )
    ]


def create_account(session: Session, data: schemas.AccountCreate) -> FinancialAccount:
    account = FinancialAccount(
        **data.model_dump(exclude={"opening_balance", "opening_direction", "opening_date"})
    )
    session.add(account)
    session.flush()
    if data.opening_balance:
        session.add(
            Transaction(
                account_id=account.id,
                currency=account.currency,
                transaction_type="OPENING_BALANCE",
                direction=data.opening_direction,
                amount=data.opening_balance,
                transaction_date=data.opening_date,
                description="Opening balance",
            )
        )
    session.flush()
    return account


def check_category(session: Session, category_id: UUID | None) -> None:
    if category_id is not None:
        require(session, Category, category_id)


def create_transaction(
    session: Session, data: schemas.TransactionCreate, *, inferred_metadata: dict | None = None
) -> Transaction:
    account = posting_account(session, data.account_id)
    if data.currency != account.currency:
        raise HTTPException(422, "Transaction currency must match the account")
    check_category(session, data.category_id)
    if data.payee_id is not None:
        require(session, Payee, data.payee_id)
    values = data.model_dump()
    # Ingestion defaults are not manual corrections or learning evidence.
    for key, value in (inferred_metadata or {}).items():
        if key not in {"payee_id", "review_status"}:
            raise ValueError("Inference may supply only payee/review defaults")
        if key not in data.model_fields_set:
            values[key] = value
    if values["payee_id"] is not None:
        require(session, Payee, values["payee_id"])
    transaction = Transaction(
        **values,
        direction="IN" if data.transaction_type == "INCOME" else "OUT",
        manual_fields=sorted(data.model_fields_set & {"payee_id", "category_id", "review_status"}),
    )
    session.add(transaction)
    session.flush()
    from app.rules import apply_new

    apply_new(session, transaction)
    session.flush()
    session.expire(transaction, ["payee"])
    return transaction


def editable_transaction(session: Session, record_id: UUID) -> Transaction:
    transaction = require(session, Transaction, record_id)
    if transaction.deleted_at is not None:
        raise HTTPException(409, "This transaction has already been deleted")
    if transaction.transaction_type not in {"INCOME", "EXPENSE"}:
        raise HTTPException(409, "Transfers and opening balances are immutable in Phase 1")
    return transaction


def update_transaction(session: Session, record_id: UUID, data: schemas.TransactionInput):
    transaction = editable_transaction(session, record_id)
    if any(
        getattr(transaction, key) != getattr(data, key)
        for key in ("amount", "transaction_date", "transaction_type")
    ):
        from app.reconciliation import invalidate_clearing

        invalidate_clearing(session, transaction.id)
    check_category(session, data.category_id)
    if data.payee_id is not None:
        require(session, Payee, data.payee_id)
    # Legacy PUT clients do not erase metadata introduced after their API version.
    excluded = {"payee_id", "review_status"} - data.model_fields_set
    from app.payee_learning import manual_change, refresh_suggestions
    from app.rules import FIELDS

    before = {field: getattr(transaction, field) for field in FIELDS}
    for key, value in data.model_dump(exclude=excluded).items():
        setattr(transaction, key, value)
    transaction.direction = "IN" if data.transaction_type == "INCOME" else "OUT"
    manual_change(
        session,
        transaction,
        before,
        {
            field
            for field in data.model_fields_set & FIELDS
            if before[field] != getattr(transaction, field)
        },
    )
    session.flush()
    refresh_suggestions(session)
    session.expire(transaction, ["payee"])
    return transaction


def delete_transaction(session: Session, record_id: UUID):
    transaction = editable_transaction(session, record_id)
    from app.reconciliation import invalidate_clearing

    invalidate_clearing(session, transaction.id)
    transaction.deleted_at = datetime.now(UTC)
    session.flush()
    from app.payee_learning import refresh_suggestions

    refresh_suggestions(session)


def create_transfer(session: Session, data: schemas.TransferCreate) -> Transfer:
    if data.source_account_id == data.destination_account_id:
        raise HTTPException(422, "Choose two different accounts")
    # SQLite acquires its writer reservation before any reads in the API unit of work.
    locked = {
        key: posting_account(session, key)
        for key in sorted([data.source_account_id, data.destination_account_id])
    }
    if any(account.currency != data.currency for account in locked.values()):
        raise HTTPException(422, "Cross-currency transfers are not supported")
    transfer = Transfer(**data.model_dump())
    session.add(transfer)
    session.flush()
    for account_id, direction, entry_id in [
        (data.source_account_id, "OUT", transfer.source_entry_id),
        (data.destination_account_id, "IN", transfer.destination_entry_id),
    ]:
        session.add(
            Transaction(
                id=entry_id,
                account_id=account_id,
                direction=direction,
                transfer_id=transfer.id,
                transaction_type="TRANSFER",
                amount=data.amount,
                currency=data.currency,
                transaction_date=data.transaction_date,
                description=data.description,
            )
        )
        session.flush()
    return transfer


def transaction_query(
    account_id=None,
    transaction_type=None,
    category_id=None,
    date_from=None,
    date_to=None,
    payee_id=None,
    review_status=None,
    search=None,
    amount_min=None,
    amount_max=None,
    sort="date_desc",
    currency=None,
    spending_only=False,
    uncategorized=False,
    no_payee=False,
):
    query = select(Transaction).where(Transaction.deleted_at.is_(None))
    for column, value in [
        (Transaction.account_id, account_id),
        (Transaction.transaction_type, transaction_type),
        (Transaction.category_id, category_id if not spending_only else None),
        (Transaction.payee_id, payee_id if not spending_only else None),
        (Transaction.currency, currency),
        (Transaction.review_status, review_status),
    ]:
        if value is not None:
            query = query.where(column == value)
    if spending_only:
        from app.spending import report_query

        report = report_query(date_from or date.min, date.max, currency).subquery()
        subset = select(report.c.id).where(
            or_(report.c.transaction_type == "EXPENSE", report.c.refund_link_id.is_not(None))
        )
        if category_id:
            subset = subset.where(report.c.category_id == category_id)
        if uncategorized:
            subset = subset.where(report.c.category_id.is_(None))
        if payee_id:
            subset = subset.where(report.c.payee_id == payee_id)
        if no_payee:
            subset = subset.where(report.c.payee_id.is_(None))
        query = query.where(Transaction.id.in_(subset))
    else:
        if uncategorized:
            query = query.where(Transaction.category_id.is_(None))
        if no_payee:
            query = query.where(Transaction.payee_id.is_(None))
    if date_from:
        query = query.where(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.where(Transaction.transaction_date <= date_to)
    if search and search.strip():
        query = query.outerjoin(Payee).where(
            or_(
                Transaction.description.icontains(search.strip(), autoescape=True),
                Transaction.merchant.icontains(search.strip(), autoescape=True),
                Payee.normalized_name.contains(
                    " ".join(search.split()).casefold(), autoescape=True
                ),
            )
        )
    if amount_min is not None:
        query = query.where(Transaction.amount >= amount_min)
    if amount_max is not None:
        query = query.where(Transaction.amount <= amount_max)
    # ExactMoney's fixed-width nonnegative encoding preserves numeric ordering.
    return query.order_by(
        Transaction.transaction_date.asc()
        if sort == "date_asc"
        else Transaction.transaction_date.desc(),
        Transaction.created_at.desc(),
        Transaction.id,
    )


def dashboard(session: Session, month: str) -> schemas.DashboardOutput:
    try:
        start = date.fromisoformat(month + "-01")
        end = date(start.year + (start.month == 12), start.month % 12 + 1, 1)
    except ValueError as error:
        raise HTTPException(422, "Invalid month; use YYYY-MM") from error
    account_list = accounts(session)
    totals = {
        a.currency: schemas.CurrencySummary(
            currency=a.currency,
            total_balance=Decimal("0"),
            income=Decimal("0"),
            expenses=Decimal("0"),
        )
        for a in account_list
    }
    for account in account_list:
        totals[account.currency].total_balance += account.balance
    from app.spending import annotate_refunds, calculate

    for currency, values in calculate(session, start, end).items():
        totals[currency].income = values["income"]
        totals[currency].expenses = values["expenses"]
    return schemas.DashboardOutput(
        month=month,
        totals=sorted(totals.values(), key=lambda t: t.currency),
        accounts=account_list,
        recent_transactions=annotate_refunds(
            session, list(session.scalars(transaction_query().limit(10)))
        ),
    )
