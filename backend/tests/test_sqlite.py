from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app import ledger, schemas
from app.database import make_engine
from app.models import Category, Transaction, Transfer


def create_account(session, name="Synthetic checking"):
    return ledger.create_account(
        session,
        schemas.AccountCreate(
            name=name, type="CHECKING", currency="BRL", opening_date=date(2026, 10, 6)
        ),
    )


def test_sqlite_configuration_and_persistence_across_engine_restart(db_engine):
    with db_engine.connect() as connection:
        assert connection.scalar(text("PRAGMA foreign_keys")) == 1
        assert connection.scalar(text("PRAGMA journal_mode")) == "wal"
        assert connection.scalar(text("PRAGMA busy_timeout")) == 5000
        assert connection.scalar(text("PRAGMA synchronous")) == 2
    with Session(db_engine) as session, session.begin():
        account = create_account(session)
        account_id = account.id
        ledger.create_transaction(
            session,
            schemas.TransactionCreate(
                account_id=account.id,
                currency="BRL",
                transaction_type="INCOME",
                amount="999999999999999999.123456",
                transaction_date=date(2026, 10, 6),
                description="Synthetic maximum precision",
            ),
        )
    url = db_engine.url
    db_engine.dispose()
    reopened = make_engine(url)
    try:
        with Session(reopened) as session:
            assert ledger.balances(session)[account_id] == Decimal("999999999999999999.123456")
            row = session.execute(text("SELECT amount, typeof(amount) FROM transactions")).one()
            assert row == ("999999999999999999123456", "text")
            assert session.scalar(select(Transaction)).created_at.tzinfo is not None
    finally:
        reopened.dispose()


def test_direct_category_foreign_key_is_enforced(db_engine):
    with Session(db_engine) as session, session.begin():
        account = create_account(session)
        account_id = account.id
    with Session(db_engine) as session, pytest.raises(IntegrityError):
        session.add(
            Transaction(
                account_id=account_id,
                currency="BRL",
                transaction_type="EXPENSE",
                direction="OUT",
                amount=Decimal("1"),
                transaction_date=date.today(),
                description="Synthetic",
                category_id=uuid4(),
            )
        )
        session.commit()


@pytest.mark.parametrize("bad_value", ["0", "000000000000000000000000", "1.5", "-100", "x" * 24])
def test_database_rejects_noncanonical_money(db_engine, bad_value):
    with Session(db_engine) as session, session.begin():
        account = create_account(session)
        row = ledger.create_transaction(
            session,
            schemas.TransactionCreate(
                account_id=account.id,
                currency="BRL",
                transaction_type="INCOME",
                amount="1",
                transaction_date=date.today(),
                description="Synthetic",
            ),
        )
        record_id = row.id.hex
    with db_engine.begin() as connection, pytest.raises(IntegrityError):
        connection.execute(
            text("UPDATE transactions SET amount=:amount WHERE id=:id"),
            {"amount": bad_value, "id": record_id},
        )


def test_missing_or_mismatched_transfer_side_cannot_commit(db_engine):
    with Session(db_engine) as session, session.begin():
        source, destination = create_account(session), create_account(session, "Synthetic savings")
        source_id, destination_id = source.id, destination.id
    for mismatch in [False, True]:
        with Session(db_engine) as session:
            parent = Transfer(
                source_account_id=source_id,
                destination_account_id=destination_id,
                amount=Decimal("5"),
                currency="BRL",
                transaction_date=date.today(),
            )
            session.add(parent)
            session.flush()
            side = Transaction(
                id=parent.source_entry_id,
                account_id=source_id,
                transfer_id=parent.id,
                transaction_type="TRANSFER",
                direction="OUT",
                amount=Decimal("6" if mismatch else "5"),
                currency="BRL",
                transaction_date=parent.transaction_date,
                description=parent.description,
            )
            session.add(side)
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            assert not session.scalar(select(Transfer.id))
            assert not session.scalar(select(Transaction.id))


def test_opening_uniqueness_and_immutable_history(db_engine):
    with Session(db_engine) as session, session.begin():
        account = create_account(session)
        account_id = account.id
        session.add(
            Transaction(
                account_id=account_id,
                currency="BRL",
                amount=Decimal("1"),
                direction="IN",
                transaction_type="OPENING_BALANCE",
                transaction_date=date.today(),
                description="Synthetic opening",
            )
        )
    with Session(db_engine) as session, pytest.raises(IntegrityError):
        session.add(
            Transaction(
                account_id=account_id,
                currency="BRL",
                amount=Decimal("2"),
                direction="IN",
                transaction_type="OPENING_BALANCE",
                transaction_date=date.today(),
                description="Duplicate opening",
            )
        )
        session.commit()
    with db_engine.begin() as connection, pytest.raises(IntegrityError):
        connection.execute(delete(Transaction))


def test_writer_contention_is_bounded_and_recovers(db_engine):
    contender = make_engine(db_engine.url, busy_timeout_ms=50)
    try:
        with db_engine.connect().execution_options(sqlite_write=True) as first:
            first.begin()
            with contender.connect().execution_options(sqlite_write=True) as second:
                with pytest.raises(OperationalError, match="locked"):
                    second.begin()
            first.rollback()
        with contender.begin() as connection:
            connection.execute(
                Category.__table__.insert().values(id=uuid4(), name="Synthetic retry")
            )
    finally:
        contender.dispose()
