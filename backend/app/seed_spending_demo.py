"""Opt-in Phase 4 extension, created atomically with an empty synthetic workspace."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app import budget_schemas, budgets, ledger, schemas, spending
from app.database import get_engine
from app.models import BudgetGroup, BudgetTarget, DemoFixture, FinancialAccount, Record, Transaction
from app.seed_demo import VERSION, seed_demo


def seed_spending_demo(session):
    # Keep the prior demo contract intact. Never extend/reset an already edited workspace.
    if not seed_demo(session):
        return False
    if session.scalar(select(BudgetTarget.id).limit(1)) or session.scalar(
        select(BudgetGroup.id).limit(1)
    ):
        raise ValueError("Spending demo requires an empty budget workspace")
    from app.models import Category

    categories = {c.name: c.id for c in session.scalars(select(Category))}
    accounts = {a.name: a for a in session.scalars(select(FinancialAccount))}
    sequence = 0

    def stable(session, _context, _instances):
        nonlocal sequence
        for record in session.new:
            if isinstance(record, Record):
                sequence += 1
                record.id = record.id or uuid5(NAMESPACE_URL, f"finance-tracker/phase4/{sequence}")
                record.created_at = record.updated_at = datetime(2026, 9, 30, tzinfo=UTC)

    event.listen(session, "before_flush", stable)
    try:
        groups = {}
        for index, name in enumerate(["Essentials", "Lifestyle", "Health & protection"]):
            group = BudgetGroup(name=name, sort_order=index)
            session.add(group)
            session.flush()
            groups[name] = group.id
        specifications = [
            ("Housing", "1800", "Essentials", False),
            ("Groceries", "1000", "Essentials", True),
            ("Transportation", "500", "Essentials", False),
            ("Utilities", "300", "Essentials", False),
            ("Restaurants", "200", "Lifestyle", True),
            ("Entertainment", "100", "Lifestyle", False),
            ("Shopping", "200", "Lifestyle", False),
            ("Subscriptions", "70", "Lifestyle", False),
            ("Health", "150", "Health & protection", False),
            ("Insurance", "250", "Health & protection", False),
        ]
        for index, (name, amount, group, rollover) in enumerate(specifications):
            data = budget_schemas.TargetInput(
                category_id=categories[name],
                currency="BRL",
                month="2025-04",
                amount=amount,
                group_id=groups[group],
                sort_order=index,
                rollover_enabled=rollover,
            )
            budgets.save_target(session, data)
            if name == "Shopping":
                budgets.save_target(
                    session,
                    data.model_copy(
                        update={"month": "2026-08", "scope": "month", "amount": Decimal("400")}
                    ),
                )
        purchase = session.scalar(
            select(Transaction).where(
                Transaction.transaction_type == "EXPENSE",
                Transaction.category_id == categories["Shopping"],
                Transaction.transaction_date == date(2026, 9, 19),
            )
        )
        spending.create_refund(
            session,
            budget_schemas.RefundInput(
                purchase_id=purchase.id,
                account_id=accounts["Credit Card"].id,
                amount="45.75",
                transaction_date=date(2026, 9, 28),
                description="Synthetic / partial online-store refund",
            ),
        )
        ledger.create_transaction(
            session,
            schemas.TransactionCreate(
                account_id=accounts["Cash"].id,
                currency="BRL",
                transaction_type="EXPENSE",
                amount="27.50",
                transaction_date=date(2026, 9, 29),
                description="Synthetic / uncategorized kiosk purchase",
            ),
        )
        fixture = session.get(DemoFixture, VERSION)
        fixture.payload = {**fixture.payload, "spending_demo": "phase4-v1"}
        session.flush()
        return True
    finally:
        event.remove(session, "before_flush", stable)


if __name__ == "__main__":
    with Session(get_engine()) as session, session.begin():
        created = seed_spending_demo(session)
    print(
        "Synthetic spending demo created."
        if created
        else "Existing workspace preserved; no changes."
    )
