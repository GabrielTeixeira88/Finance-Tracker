"""Explicit, local, synthetic demo. Never runs automatically at startup."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import ledger, schemas
from app.database import get_engine
from app.models import Category, FinancialAccount, Transaction, Transfer

CATEGORIES = [
    "Salary",
    "Groceries",
    "Restaurants",
    "Transportation",
    "Entertainment",
    "Shopping",
    "Health",
    "Housing",
    "Subscriptions",
    "Education",
    "Travel",
    "Other",
]


def seed_categories(session: Session):
    existing = {name.lower() for name in session.scalars(select(Category.name))}
    for name in CATEGORIES:
        if name.lower() not in existing:
            session.add(Category(name=name))
    session.flush()


def seed_demo(session: Session):
    if any(
        session.scalar(select(func.count()).select_from(model))
        for model in [FinancialAccount, Transaction, Transfer]
    ):
        raise ValueError("Demo requires an empty financial database; existing data was not changed")
    seed_categories(session)
    today = date.today()
    categories = {c.name: c.id for c in session.scalars(select(Category))}
    created = {}
    for name, kind, opening in [
        ("Checking", "CHECKING", "5000"),
        ("Savings", "SAVINGS", "2000"),
        ("Cash", "CASH", "300"),
        ("Investment Account", "INVESTMENT", "0"),
    ]:
        created[name] = ledger.create_account(
            session,
            schemas.AccountCreate(
                name=name,
                type=kind,
                currency="BRL",
                institution="SYNTHETIC DEMO",
                opening_balance=opening,
                opening_date=today,
            ),
        )
    for kind, amount, description, category in [
        ("INCOME", "1000", "Demo salary", "Salary"),
        ("EXPENSE", "200", "Demo groceries", "Groceries"),
        ("EXPENSE", "35", "Demo Uber", "Transportation"),
    ]:
        ledger.create_transaction(
            session,
            schemas.TransactionCreate(
                account_id=created["Checking"].id,
                currency="BRL",
                transaction_type=kind,
                amount=amount,
                transaction_date=today,
                description=description,
                category_id=categories[category],
            ),
        )
    ledger.create_transfer(
        session,
        schemas.TransferCreate(
            source_account_id=created["Checking"].id,
            destination_account_id=created["Savings"].id,
            currency="BRL",
            amount="500",
            transaction_date=today,
            description="Synthetic demo transfer",
        ),
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Create fake accounts and activity; requires empty financial tables",
    )
    args = parser.parse_args()
    with Session(get_engine()) as session, session.begin():
        seed_demo(session) if args.demo else seed_categories(session)
    print("Synthetic demo created." if args.demo else "Example categories created.")
