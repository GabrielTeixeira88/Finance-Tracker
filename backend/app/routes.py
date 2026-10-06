from collections.abc import Iterator
from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import ledger, schemas
from app.database import get_session
from app.models import Category, FinancialAccount, Transaction, Transfer

router = APIRouter(prefix="/api")


def unit_of_work(session: Annotated[Session, Depends(get_session)]) -> Iterator[Session]:
    try:
        yield session
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            409, "Operation conflicts with existing records or ledger integrity"
        ) from error
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
    db.delete(category)
    db.flush()
    return Response(status_code=204)


@router.get("/transactions", response_model=list[schemas.TransactionOutput])
def list_transactions(
    db: DB,
    account_id: UUID | None = None,
    transaction_type: schemas.TransactionType | None = None,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Start date must not follow end date")
    return list(
        db.scalars(
            ledger.transaction_query(account_id, transaction_type, category_id, date_from, date_to)
            .limit(limit)
            .offset(offset)
        )
    )


@router.get("/transactions/{record_id}", response_model=schemas.TransactionOutput)
def get_transaction(record_id: UUID, db: DB):
    return ledger.require(db, Transaction, record_id)


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
