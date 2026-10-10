"""Opt-in fictional rule/schedule examples, called only inside the empty-demo seed."""

from datetime import date

from sqlalchemy import select

from app import rules, schedules, schemas
from app.automation_schemas import RuleInput, ScheduleInput
from app.models import Transaction
from app.transaction_metadata import update_metadata


def seed_automation(session, accounts, categories, payees):
    for name, text, payee, category in [
        ("Synthetic transport", "uber", "Uber", "Transportation"),
        ("Synthetic streaming", "netflix.com", "Netflix", "Subscriptions"),
        ("Synthetic groceries", "supermercado condor", "Condor", "Groceries"),
        ("Synthetic shopping review", "amazon marketplace", "Amazon", "Shopping"),
    ]:
        rules.save_rule(
            session,
            RuleInput(
                name=name,
                priority=100,
                conditions=[{"field": "description", "operator": "contains", "value": text}],
                actions={
                    "payee_id": str(payees[payee]),
                    "category_id": str(categories[category]),
                    "review_status": "NEEDS_REVIEW",
                },
            ),
        )

    # Three distinct, explicit synthetic corrections exercise the actual learning heuristic.
    music = list(
        session.scalars(
            select(Transaction)
            .where(Transaction.description == "Synthetic / Music")
            .order_by(Transaction.transaction_date)
            .limit(3)
        )
    )
    for row in music:
        update_metadata(
            session,
            [row.id],
            schemas.TransactionMetadata(
                payee_id=payees["Netflix"],
                category_id=categories["Subscriptions"],
            ),
            source="DEMO_USER",
        )
        row.updated_at = row.created_at
    session.flush()

    examples = [
        (
            "Synthetic salary",
            "Salary",
            "Checking",
            "9000",
            "INCOME",
            "MONTHLY",
            "2026-09-02",
            "Salary",
            "Fictional Employer",
        ),
        (
            "Synthetic rent",
            "Rent",
            "Checking",
            "1800",
            "EXPENSE",
            "MONTHLY",
            "2026-09-05",
            "Housing",
            None,
        ),
        (
            "Synthetic streaming",
            "NETFLIX.COM",
            "Credit Card",
            "39.90",
            "EXPENSE",
            "MONTHLY",
            "2026-09-14",
            "Subscriptions",
            "Netflix",
        ),
        (
            "Synthetic weekly groceries",
            "Market",
            "Checking",
            "220",
            "EXPENSE",
            "WEEKLY",
            "2026-10-02",
            "Groceries",
            "Condor",
        ),
        (
            "Synthetic annual insurance",
            "Insurance",
            "Checking",
            "2520",
            "EXPENSE",
            "YEARLY",
            "2026-10-25",
            "Insurance",
            None,
        ),
        (
            "Synthetic one-time travel",
            "Weekend trip",
            "Credit Card",
            "1450",
            "EXPENSE",
            "ONCE",
            "2026-10-18",
            "Travel",
            None,
        ),
    ]
    for name, description, account, amount, kind, frequency, start, category, payee in examples:
        record = schedules.save_schedule(
            session,
            ScheduleInput(
                name=name,
                description="Synthetic / " + description,
                account_id=accounts[account].id,
                currency="BRL",
                amount=amount,
                transaction_type=kind,
                frequency=frequency,
                start_date=start,
                category_id=categories[category],
                payee_id=payees[payee] if payee else None,
                amount_is_approximate=frequency == "WEEKLY",
                amount_tolerance="30" if frequency == "WEEKLY" else "0",
            ),
        )
        if description in {"Salary", "NETFLIX.COM"}:
            due = date.fromisoformat(start)
            candidate = schedules.candidates(session, record, due)["candidates"][0]
            schedules.confirm_match(session, record, due, candidate.id)
