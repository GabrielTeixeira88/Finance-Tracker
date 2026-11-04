"""Deterministic BRL household history alongside the sourced investment replay.

These fictional purchases and plans use production services. They never change
market observations, investment applications, or investment return calculations.
"""

from datetime import date
from decimal import Decimal

from app import budget_schemas, budgets, ledger, schemas, wealth
from app.investment_schemas import settled
from app.models import Category, Payee
from app.wealth_models import Goal, GoalEntry

GOALS = (
    ("Vacation", "12000", "6000", "ACTIVE"),
    ("Vehicle upgrade", "40000", "1000", "ACTIVE"),
    ("Design course", "3000", "3000", "COMPLETED"),
    ("Home studio", "15000", "2000", "PAUSED"),
)


def seed_household(session, checking, start):
    savings = ledger.create_account(
        session,
        schemas.AccountCreate(
            name="Savings",
            type="SAVINGS",
            currency="BRL",
            institution="Fictional household savings",
            opening_balance="0",
        ),
    )
    categories = {}
    targets = {
        "Housing": "1800",
        "Groceries": "900",
        "Restaurants": "350",
        "Transportation": "200",
        "Fuel": "250",
        "Health": "200",
        "Subscriptions": "100",
        "Shopping": "350",
        "Entertainment": "200",
        "Utilities": "350",
        "Insurance": "250",
        "Education": "150",
        "Travel": "300",
        "Other": "100",
    }
    for name in ["Salary", *targets]:
        row = Category(name=name)
        session.add(row)
        session.flush()
        categories[name] = row.id
    payees = {}
    for name in [
        "Horizonte Design Studio",
        "Mercado do Bairro",
        "Cafe Central",
        "Metro Mobilidade",
        "Stream Plus",
    ]:
        row = Payee(name=name)
        session.add(row)
        session.flush()
        payees[name] = row.id
    income, expenses = Decimal(0), Decimal(0)
    count = 0
    for index in range(24):
        year, month = divmod(start.year * 12 + start.month - 1 + index, 12)
        month += 1

        def entry(
            day,
            category,
            description,
            amount,
            payee=None,
            kind="EXPENSE",
            *,
            year=year,
            month=month,
            index=index,
        ):
            nonlocal income, expenses, count
            amount = Decimal(amount)
            ledger.create_transaction(
                session,
                schemas.TransactionCreate(
                    account_id=checking.id,
                    currency="BRL",
                    transaction_type=kind,
                    amount=amount,
                    transaction_date=date(year, month, day),
                    description=description,
                    merchant=payee if kind == "EXPENSE" else None,
                    payee_id=payees.get(payee),
                    category_id=categories[category],
                    review_status="NEEDS_REVIEW" if index == 23 and day > 20 else "REVIEWED",
                ),
            )
            if kind == "INCOME":
                income += amount
            else:
                expenses += amount
            count += 1

        entry(
            2,
            "Salary",
            "Monthly salary",
            str(8500 + (index // 8) * 650),
            "Horizonte Design Studio",
            "INCOME",
        )
        if index % 3 == 1:
            entry(16, "Other", "Design project", "675.50", kind="INCOME")
        ledger.create_transfer(
            session,
            schemas.TransferCreate(
                source_account_id=checking.id,
                destination_account_id=savings.id,
                currency="BRL",
                amount="750",
                transaction_date=date(year, month, 3),
                description="Monthly savings contribution",
            ),
        )
        entry(5, "Housing", "Rent", "1800")
        for n, day in enumerate([6, 10, 14, 18, 22, 27]):
            amount = Decimal("105.35") + Decimal((index * 19 + n * 31) % 3500) / 100
            entry(day, "Groceries", "Groceries", amount, "Mercado do Bairro")
        for day in [8, 15, 23]:
            entry(day, "Restaurants", "Lunch and coffee", "87.40", "Cafe Central")
        for day in [7, 12, 20, 26]:
            entry(day, "Transportation", "Ride fare", "32.50", "Metro Mobilidade")
        for day, category, description, amount in [
            (9, "Health", "Gym membership", "129.90"),
            (11, "Subscriptions", "Streaming subscription", "39.90"),
            (13, "Fuel", "Fuel station", "185.75"),
            (17, "Shopping", "Household shopping", str(Decimal("175.90") + index % 5 * 17)),
            (19, "Entertainment", "Cinema and leisure", "89.90"),
            (21, "Utilities", "Electricity and water", str(Decimal("180.50") + index % 4 * 12)),
            (24, "Utilities", "Internet", "109.90"),
            (25, "Insurance", "Insurance premium", "210"),
            (28, "Education", "Books", "65.90"),
        ]:
            entry(
                day,
                category,
                description,
                amount,
                "Stream Plus" if category == "Subscriptions" else None,
            )
        if index in {7, 19}:
            entry(26, "Travel", "Holiday accommodation", "2400")
    for category, amount in targets.items():
        budgets.save_target(
            session,
            budget_schemas.TargetInput(
                category_id=categories[category],
                currency="BRL",
                month=start.strftime("%Y-%m"),
                amount=amount,
                rollover_enabled=False,
            ),
        )
    return savings, {
        "income": format(income, "f"),
        "expenses": format(expenses, "f"),
        "transactions": count,
        "monthly_savings": "750",
        "months": 24,
    }


def seed_goals(session, savings, start):
    for name, target, saved, status in GOALS:
        goal = Goal(
            name=name,
            currency="BRL",
            mode="ACCOUNT",
            target=Decimal(target),
            start_date=start,
            deadline=date(2027, 12, 31),
            status=status,
            notes="Fictional plan sharing existing savings; no additional financial asset.",
        )
        session.add(goal)
        session.flush()
        for month in range(4, 10):
            session.add(
                GoalEntry(
                    goal_id=goal.id,
                    account_id=savings.id,
                    effective_date=date(2026, month, 1),
                    direction="IN",
                    amount=settled(Decimal(saved) * (month - 3) / 6),
                    notes="Dated reservation of existing savings",
                )
            )
        session.flush()
        wealth.validate_progress(session, goal)
