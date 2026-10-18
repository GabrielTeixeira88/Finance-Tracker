from collections.abc import Iterator
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app import history as history_service
from app import ledger, schemas, transaction_metadata
from app.database import get_session
from app.models import Category, DemoFixture, FinancialAccount, Payee, Transaction, Transfer

router = APIRouter(prefix="/api")


def unit_of_work(
    request: Request, session: Annotated[Session, Depends(get_session)]
) -> Iterator[Session]:
    try:
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            session.connection(execution_options={"sqlite_write": True})
        yield session
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            409, "Operation conflicts with existing records or ledger integrity"
        ) from error
    except OperationalError as error:
        session.rollback()
        if getattr(error.orig, "sqlite_errorcode", None) in {5, 6}:
            raise HTTPException(
                503, "Local database is busy; retry shortly", headers={"Retry-After": "1"}
            ) from error
        raise
    except Exception:
        session.rollback()
        raise


# Commit before returning a successful response (including deferred constraints).
DB = Annotated[Session, Depends(unit_of_work, scope="function")]


@router.get("/accounts", response_model=list[schemas.AccountOutput])
def list_accounts(db: DB):
    return ledger.accounts(db)


@router.get("/accounts/{record_id}", response_model=schemas.AccountOutput)
def get_account(record_id: UUID, db: DB):
    ledger.require(db, FinancialAccount, record_id)
    return next(a for a in ledger.accounts(db) if a.id == record_id)


@router.post("/accounts", response_model=schemas.AccountOutput, status_code=201)
def create_account(data: schemas.AccountCreate, db: DB):
    account = ledger.create_account(db, data)
    return get_account(account.id, db)


@router.put("/accounts/{record_id}", response_model=schemas.AccountOutput)
def update_account(record_id: UUID, data: schemas.AccountUpdate, db: DB):
    account = db.scalar(
        select(FinancialAccount).where(FinancialAccount.id == record_id).with_for_update()
    )
    if account is None:
        raise HTTPException(404, "Account not found")
    for key, value in data.model_dump().items():
        setattr(account, key, value)
    db.flush()
    return get_account(record_id, db)


@router.delete("/accounts/{record_id}", status_code=204)
def deactivate_account(record_id: UUID, db: DB):
    account = ledger.require(db, FinancialAccount, record_id)
    account.active = False
    db.flush()
    return Response(status_code=204)


@router.get("/categories", response_model=list[schemas.CategoryOutput])
def list_categories(db: DB):
    return list(db.scalars(select(Category).order_by(Category.name)))


@router.post("/categories", response_model=schemas.CategoryOutput, status_code=201)
def create_category(data: schemas.CategoryInput, db: DB):
    category = Category(**data.model_dump())
    db.add(category)
    db.flush()
    return category


@router.put("/categories/{record_id}", response_model=schemas.CategoryOutput)
def update_category(record_id: UUID, data: schemas.CategoryInput, db: DB):
    category = ledger.require(db, Category, record_id)
    category.name = data.name
    db.flush()
    return category


@router.delete("/categories/{record_id}", status_code=204)
def delete_category(record_id: UUID, db: DB):
    category = ledger.require(db, Category, record_id)
    if db.scalar(select(Transaction.id).where(Transaction.category_id == record_id).limit(1)):
        raise HTTPException(409, "Category is referenced by transaction history")
    from app.models import RuleSuggestion, TransactionRule

    for rule in db.scalars(select(TransactionRule)):
        if rule.actions.get("category_id") == str(record_id) or any(
            c["field"] == "category_id" and c["value"] == str(record_id) for c in rule.conditions
        ):
            raise HTTPException(409, "Category is referenced by a rule")
    for suggestion in db.scalars(select(RuleSuggestion).where(RuleSuggestion.status == "PENDING")):
        if suggestion.actions.get("category_id") == str(record_id):
            raise HTTPException(409, "Category is referenced by a pending suggestion")
    db.delete(category)
    db.flush()
    return Response(status_code=204)


@router.get("/payees", response_model=list[schemas.PayeeOutput])
def list_payees(
    db: DB,
    search: str = Query("", max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = select(Payee)
    if search.strip():
        query = query.where(
            Payee.normalized_name.contains(" ".join(search.split()).casefold(), autoescape=True)
        )
    return list(
        db.scalars(query.order_by(Payee.normalized_name, Payee.id).limit(limit).offset(offset))
    )


@router.post("/payees", response_model=schemas.PayeeOutput, status_code=201)
def create_payee(data: schemas.PayeeInput, db: DB):
    payee = Payee(name=data.name)
    db.add(payee)
    db.flush()
    return payee


@router.patch("/payees/{record_id}", response_model=schemas.PayeeOutput)
def rename_payee(record_id: UUID, data: schemas.PayeeInput, db: DB):
    payee = ledger.require(db, Payee, record_id)
    payee.name = data.name
    db.flush()
    return payee


@router.get("/transactions", response_model=list[schemas.TransactionOutput])
def list_transactions(
    db: DB,
    response: Response,
    account_id: UUID | None = None,
    transaction_type: schemas.TransactionType | None = None,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    payee_id: UUID | None = None,
    review_status: schemas.ReviewStatus | None = None,
    search: str | None = Query(None, max_length=500),
    amount_min: schemas.OpeningMoney | None = None,
    amount_max: schemas.OpeningMoney | None = None,
    sort: Literal["date_desc", "date_asc"] = "date_desc",
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    currency: schemas.Currency | None = None,
    spending_only: bool = False,
    uncategorized: bool = False,
    no_payee: bool = False,
    clearing_status: Literal["UNCLEARED", "CLEARED", "RECONCILED"] | None = None,
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Start date must not follow end date")
    if amount_min is not None and amount_max is not None and amount_min > amount_max:
        raise HTTPException(422, "Minimum amount must not exceed maximum amount")
    query = ledger.transaction_query(
        account_id,
        transaction_type,
        category_id,
        date_from,
        date_to,
        payee_id,
        review_status,
        search,
        amount_min,
        amount_max,
        sort,
        currency=currency,
        spending_only=spending_only,
        uncategorized=uncategorized,
        no_payee=no_payee,
    )
    from app import reconciliation
    from app.reconciliation_models import Clearing, Statement, StatementEntry

    if clearing_status:
        locked = (
            select(StatementEntry.transaction_id)
            .join(Statement)
            .where(Statement.status == "COMPLETED", StatementEntry.revision == Statement.revision)
        )
        cleared = select(Clearing.transaction_id).where(Clearing.cleared)
        query = query.where(
            Transaction.id.in_(locked)
            if clearing_status == "RECONCILED"
            else (Transaction.id.in_(cleared) & Transaction.id.not_in(locked))
            if clearing_status == "CLEARED"
            else Transaction.id.not_in(cleared)
        )
    response.headers["X-Total-Count"] = str(
        db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    )
    from app.spending import annotate_refunds

    rows = annotate_refunds(db, list(db.scalars(query.limit(limit).offset(offset))))
    row_states = reconciliation.states(db, [row.id for row in rows])
    for row in rows:
        for key, value in row_states[row.id].items():
            setattr(row, key, value)
    return rows


@router.patch("/transactions/bulk", response_model=list[schemas.TransactionOutput])
def bulk_metadata(data: schemas.BulkMetadata, db: DB):
    return transaction_metadata.update_metadata(db, data.transaction_ids, data.changes)


@router.patch("/transactions/{record_id}", response_model=schemas.TransactionOutput)
def patch_transaction(record_id: UUID, data: schemas.TransactionPatch, db: DB):
    transaction_metadata.update_metadata(db, [record_id], data)
    return ledger.require(db, Transaction, record_id)


@router.get("/transactions/{record_id}", response_model=schemas.TransactionOutput)
def get_transaction(record_id: UUID, db: DB):
    from app import reconciliation
    from app.spending import annotate_refunds

    row = annotate_refunds(db, [ledger.require(db, Transaction, record_id)])[0]
    for key, value in reconciliation.state(db, record_id).items():
        setattr(row, key, value)
    return row


@router.post("/transactions", response_model=schemas.TransactionOutput, status_code=201)
def create_transaction(data: schemas.TransactionCreate, db: DB):
    return ledger.create_transaction(db, data)


@router.put("/transactions/{record_id}", response_model=schemas.TransactionOutput)
def update_transaction(record_id: UUID, data: schemas.TransactionInput, db: DB):
    return ledger.update_transaction(db, record_id, data)


@router.delete("/transactions/{record_id}", status_code=204)
def delete_transaction(record_id: UUID, db: DB):
    ledger.delete_transaction(db, record_id)
    return Response(status_code=204)


@router.post("/transfers", response_model=schemas.TransferOutput, status_code=201)
def create_transfer(data: schemas.TransferCreate, db: DB):
    return ledger.create_transfer(db, data)


@router.get("/transfers/{record_id}", response_model=schemas.TransferOutput)
def get_transfer(record_id: UUID, db: DB):
    return ledger.require(db, Transfer, record_id)


@router.get("/dashboard", response_model=schemas.DashboardOutput)
def dashboard(db: DB, month: str = Query(pattern=r"^\d{4}-\d{2}$")):
    return ledger.dashboard(db, month)


@router.get("/history", response_model=history_service.History)
def history(db: DB, end: date, period: history_service.Period = "1Y"):
    return history_service.history(db, period, end)


@router.get("/demo")
def demo(db: DB):
    fixture = db.scalar(select(DemoFixture).order_by(DemoFixture.id).limit(1))
    if fixture is None:
        return {"enabled": False}
    return {
        "enabled": True,
        "version": fixture.id,
        "start_date": fixture.start_date,
        "end_date": fixture.end_date,
        "preview": fixture.payload,
    }
