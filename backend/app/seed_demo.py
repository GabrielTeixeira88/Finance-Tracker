"""Fixed fictional April 2025–September 2026 workspace. Never resets existing data."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app import ledger, schemas
from app.database import get_engine
from app.models import (
    Category,
    DemoFixture,
    FinancialAccount,
    Payee,
    Record,
    RuleApplication,
    RuleSuggestion,
    Schedule,
    ScheduleCompletion,
    Transaction,
    TransactionCorrection,
    TransactionRule,
    Transfer,
)
from app.seed import CATEGORIES

VERSION = "phase2b-synthetic-v3"
START = date(2025, 4, 1)
END = date(2026, 9, 30)


def seed_demo(session: Session) -> bool:
    """Caller owns the transaction. Repeat runs are no-ops, including after user edits."""
    session.connection(execution_options={"sqlite_write": True})
    if any(
        session.get(DemoFixture, version)
        for version in (VERSION, "phase2a-synthetic-v2", "phase16-synthetic-v1")
    ):
        return False
    if any(
        session.scalar(select(model).limit(1)) is not None
        for model in (
            FinancialAccount,
            Category,
            Payee,
            Transaction,
            Transfer,
            DemoFixture,
            TransactionRule,
            RuleSuggestion,
            Schedule,
            TransactionCorrection,
            RuleApplication,
            ScheduleCompletion,
        )
    ):
        raise ValueError(
            "Historical demo requires an empty database. Existing data was not changed."
        )

    sequence = 0

    def stable_records(session, _context, _instances):
        nonlocal sequence
        for record in session.new:
            if isinstance(record, Record):
                sequence += 1
                identity = f"finance-tracker/{VERSION}/{sequence}"
                record.id = record.id or uuid5(NAMESPACE_URL, identity)
                record.created_at = record.updated_at = datetime(
                    2025, 3, 31, tzinfo=UTC
                ) + timedelta(seconds=sequence)
                if isinstance(record, Transfer):
                    record.source_entry_id = uuid5(NAMESPACE_URL, identity + "/out")
                    record.destination_entry_id = uuid5(NAMESPACE_URL, identity + "/in")

    event.listen(session, "before_flush", stable_records)
    try:
        categories = {}
        for name in [*CATEGORIES, "Fuel", "Utilities", "Insurance"]:
            category = Category(name=name)
            session.add(category)
            session.flush()
            categories[name] = category.id
        payees = {}
        for name in ("Uber", "Netflix", "Amazon", "Condor", "Fictional Employer"):
            payee = Payee(name=name)
            session.add(payee)
            session.flush()
            payees[name] = payee.id
        accounts = {}
        for name, kind, opening, direction in [
            ("Checking", "CHECKING", "12000", "IN"),
            ("Savings", "SAVINGS", "18000", "IN"),
            ("Cash", "CASH", "500", "IN"),
            ("Credit Card", "CREDIT_CARD", "1200", "OUT"),
            ("Investment Account", "INVESTMENT", "6000", "IN"),
        ]:
            accounts[name] = ledger.create_account(
                session,
                schemas.AccountCreate(
                    name=name,
                    type=kind,
                    currency="BRL",
                    institution="SYNTHETIC DEMO / Fictional Bank",
                    opening_balance=opening,
                    opening_direction=direction,
                    opening_date=START - timedelta(days=1),
                ),
            )

        previous_card = Decimal("1200")
        for index in range(18):
            year, month = divmod(2025 * 12 + 3 + index, 12)
            month += 1

            def entry(
                day,
                category,
                description,
                amount,
                account="Checking",
                kind="EXPENSE",
                year=year,
                month=month,
                index=index,
            ):
                normalized = {
                    "Metro": ("Uber", "UBER *TRIP"),
                    "Bus": ("Uber", "Uber BV"),
                    "Streaming": ("Netflix", "NETFLIX.COM"),
                    "Online store": ("Amazon", "AMAZON MARKETPLACE"),
                    "Market": ("Condor", "SUPERMERCADO CONDOR"),
                    "Salary": ("Fictional Employer", "Salary"),
                }.get(description)
                return ledger.create_transaction(
                    session,
                    schemas.TransactionCreate(
                        account_id=accounts[account].id,
                        currency="BRL",
                        transaction_type=kind,
                        amount=amount,
                        transaction_date=date(year, month, day),
                        description="Synthetic / " + (normalized[1] if normalized else description),
                        merchant="Fictional " + description,
                        category_id=categories[category],
                        payee_id=payees[normalized[0]] if normalized else None,
                        review_status="NEEDS_REVIEW" if (index + day) % 5 == 0 else "REVIEWED",
                    ),
                )

            def transfer(day, destination, amount, description, year=year, month=month):
                ledger.create_transfer(
                    session,
                    schemas.TransferCreate(
                        source_account_id=accounts["Checking"].id,
                        destination_account_id=accounts[destination].id,
                        currency="BRL",
                        amount=amount,
                        transaction_date=date(year, month, day),
                        description="Synthetic / " + description,
                    ),
                )

            entry(2, "Salary", "Salary", str(8500 + (index // 6) * 250), kind="INCOME")
            if index % 3 == 2:
                entry(16, "Other", "Freelance project", "650", kind="INCOME")
            transfer(3, "Credit Card", previous_card, "Card payment")
            transfer(4, "Savings", "1000", "Savings contribution")
            transfer(4, "Investment Account", "750", "Investment cash contribution")
            transfer(5, "Cash", "100", "Cash withdrawal")
            card_spending = Decimal("0")
            # Variable cents and purchase dates are deterministic, not random or clock dependent.
            purchases = [
                (5, "Housing", "Rent", "1800", "Checking"),
                (6, "Groceries", "Market", "218.42", "Checking"),
                (13, "Groceries", "Market", "193.65", "Checking"),
                (20, "Groceries", "Market", "241.18", "Checking"),
                (27, "Groceries", "Market", "176.90", "Checking"),
                (8, "Restaurants", "Bistro", "112.50", "Credit Card"),
                (22, "Restaurants", "Cafe", "86.40", "Credit Card"),
                (9, "Transportation", "Metro", "35", "Cash"),
                (24, "Transportation", "Bus", "28", "Cash"),
                (10, "Fuel", "Fuel station", "260", "Credit Card"),
                (11, "Health", "Gym", "120", "Checking"),
                (12, "Subscriptions", "Music", "24.90", "Credit Card"),
                (14, "Subscriptions", "Streaming", "39.90", "Credit Card"),
                (17, "Entertainment", "Cinema", "79", "Credit Card"),
                (19, "Shopping", "Online store", "185.75", "Credit Card"),
                (21, "Utilities", "Electricity", "148.60", "Checking"),
                (23, "Utilities", "Internet", "99.90", "Checking"),
                (25, "Insurance", "Insurance", "210", "Checking"),
            ]
            for day, category, description, base, account in purchases:
                amount = Decimal(base)
                if category in {"Groceries", "Restaurants", "Shopping", "Fuel", "Utilities"}:
                    amount += Decimal((index * 137 + day * 17) % 3500) / Decimal("100")
                entry(day, category, description, amount, account)
                if account == "Credit Card":
                    card_spending += amount
            if index in {5, 11, 17}:
                entry(26, "Travel", "Weekend trip", "1450", "Credit Card")
                card_spending += Decimal("1450")
            previous_card = card_spending

        from app.seed_automation import seed_automation

        seed_automation(session, accounts, categories, payees)

        # Illustrations are stored separately: never interpreted as ledger holdings or budgets.
        payload = {
            "currency": "BRL",
            "budgets": [
                {"category_id": str(categories[name]), "name": name, "target": target}
                for name, target in [
                    ("Housing", "1800"),
                    ("Groceries", "1000"),
                    ("Transportation", "150"),
                    ("Restaurants", "300"),
                    ("Entertainment", "200"),
                    ("Shopping", "350"),
                ]
            ],
            "holdings": [
                {"symbol": symbol, "name": name, "value": value}
                for symbol, name, value in [
                    ("WRLD11", "Fictional global allocation", "12600"),
                    ("IVVB11", "Fictional US allocation", "8400"),
                    ("BOVA11", "Fictional Brazil allocation", "5600"),
                    ("Cash", "Illustrative cash allocation", "1400"),
                ]
            ],
            "performance": [
                {
                    "date": date(2025 + (3 + i) // 12, (3 + i) % 12 + 1, 28).isoformat(),
                    "balance": str(Decimal("18000") + Decimal(i * 600 + (i % 4) * 350)),
                }
                for i in range(18)
            ],
            "activity": [
                {
                    "date": "2026-09-18",
                    "description": "Illustrative WRLD11 purchase",
                    "amount": "700",
                },
                {
                    "date": "2026-09-04",
                    "description": "Illustrative cash contribution",
                    "amount": "750",
                },
            ],
        }
        session.add(DemoFixture(id=VERSION, start_date=START, end_date=END, payload=payload))
        session.flush()
        return True
    finally:
        event.remove(session, "before_flush", stable_records)


if __name__ == "__main__":
    with Session(get_engine()) as session, session.begin():
        created = seed_demo(session)
    print(
        "Historical synthetic demo created." if created else "Demo already seeded; no changes made."
    )
