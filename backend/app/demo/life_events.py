"""Fictional event narratives associate existing purchases, never new postings."""

from datetime import date

from sqlalchemy import select

from app import life_events
from app.models import Category, Transaction


def seed_life_events(session):
    examples = [
        (
            "Fictional coastal holiday",
            "TRAVEL",
            "2026-05-01",
            "2026-05-31",
            ["Travel", "Restaurants", "Transportation"],
            "4000",
            "blue",
            "plane",
        ),
        (
            "Fictional home refresh",
            "HOME",
            "2026-07-01",
            "2026-07-31",
            ["Shopping", "Housing"],
            "3500",
            "purple",
            "home",
        ),
        (
            "Fictional music weekend",
            "FESTIVAL",
            "2026-08-01",
            "2026-08-31",
            ["Entertainment", "Restaurants"],
            "1200",
            "amber",
            "music",
        ),
        (
            "Fictional autumn course",
            "EDUCATION",
            "2026-09-01",
            "2026-09-30",
            ["Education", "Transportation"],
            "1500",
            "green",
            "book",
        ),
    ]
    for name, kind, start, end, names, budget, color, icon in examples:
        event = life_events.save(
            session,
            life_events.EventInput(
                name=name,
                event_type=kind,
                start_date=start,
                end_date=end,
                currency="BRL",
                planned_budget=budget,
                color=color,
                icon=icon,
                description="Synthetic demonstration; costs come from linked ledger purchases.",
            ),
        )
        ids = list(
            session.scalars(
                select(Transaction.id)
                .join(Category)
                .where(
                    Transaction.transaction_type == "EXPENSE",
                    Transaction.deleted_at.is_(None),
                    Transaction.transaction_date >= date.fromisoformat(start),
                    Transaction.transaction_date <= date.fromisoformat(end),
                    Category.name.in_(names),
                )
                .order_by(Transaction.transaction_date, Transaction.id)
            )
        )
        if ids:
            life_events.link(session, event, ids)
