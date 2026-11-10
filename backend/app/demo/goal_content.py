"""Owned unified demo goal examples; no cash, price, income or asset postings."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import goal_workspace, wealth
from app.goal_models import GoalPlan
from app.models import DemoFixture
from app.wealth_models import Goal

MARKER = "goals_ui_content"
CONTENT_VERSION = 1
STAMP = datetime(2026, 9, 30, tzinfo=UTC)


def identity(key):
    return uuid5(NAMESPACE_URL, "finance-tracker/unified-goals-1/" + key)


def extend(session):
    from app.demo.unified import VERSION
    from app.wealth_routes import GoalEntryInput

    fixture = session.get(DemoFixture, VERSION)
    if fixture is None:
        raise ValueError("Goal examples require an owned unified demo")
    if fixture.payload.get(MARKER) == CONTENT_VERSION:
        return False
    existing = {goal.name: goal for goal in session.scalars(select(Goal))}
    settings = {
        "Emergency reserve": ("custom_save_up", "100"),
        "Vacation": ("custom_save_up", "400"),
        "Vehicle upgrade": ("car", "200"),
        "Design course": ("education", "0"),
        "Home studio": ("home", "0"),
    }
    created = []
    for name, (kind, monthly) in settings.items():
        goal = existing.get(name)
        if goal and session.scalar(select(GoalPlan).where(GoalPlan.goal_id == goal.id)) is None:
            row = goal_workspace.save_plan(session, goal, kind, Decimal(monthly))
            row.id = identity("plan/" + name)
            created.append(row)
    definitions = [
        (
            "Wedding celebration",
            "wedding",
            "20000",
            "1200",
            "2027-09-30",
            [
                ("2025-11-01", "1000", "IN"),
                ("2026-02-01", "2000", "IN"),
                ("2026-05-01", "2500", "IN"),
                ("2026-07-01", "700", "OUT"),
            ],
        ),
        (
            "Photography workshop",
            "education",
            "1200",
            "0",
            "2026-05-31",
            [("2026-01-15", "300", "IN"), ("2026-02-15", "400", "IN"), ("2026-03-15", "600", "IN")],
        ),
    ]
    for name, kind, target, monthly, deadline, entries in definitions:
        if session.get(Goal, identity("goal/" + name)) or name in existing:
            continue
        goal = Goal(
            id=identity("goal/" + name),
            name=name,
            currency="BRL",
            mode="MANUAL",
            target=Decimal(target),
            start_date=date.fromisoformat(entries[0][0]),
            deadline=date.fromisoformat(deadline),
            status="ACTIVE",
            notes="Fictional planning progress; not an additional asset or bank transaction.",
        )
        session.add(goal)
        session.flush()
        created.append(goal)
        for index, (day, amount, direction) in enumerate(entries):
            row = wealth.add_goal_entry(
                session,
                goal,
                GoalEntryInput(
                    amount=amount,
                    effective_date=day,
                    direction=direction,
                    notes="Fictional recorded goal progress",
                ),
            )
            row.id = identity(f"entry/{name}/{index}")
            created.append(row)
        if kind == "education":
            wealth.void_record(
                row, "Corrected fictional progress from 600 to 500; original retained"
            )
            replacement = wealth.add_goal_entry(
                session,
                goal,
                GoalEntryInput(
                    amount="500", effective_date="2026-03-15", notes="Fictional correction"
                ),
            )
            replacement.id = identity("correction/" + name)
            created.append(replacement)
            goal_workspace.transition(session, goal, "ARCHIVED", date(2026, 5, 31))
            event = goal_workspace.events(session, goal.id)[-1]
            event.id = identity("archive/" + name)
            created.append(event)
        row = goal_workspace.save_plan(session, goal, kind, Decimal(monthly))
        row.id = identity("plan/" + name)
        created.append(row)
    for row in created:
        row.created_at = row.updated_at = STAMP
    fixture.payload = {
        **fixture.payload,
        MARKER: CONTENT_VERSION,
        "goals_extension": {
            "new_goal_ids": [str(row.id) for row in created if isinstance(row, Goal)],
            "financial_cash_change": "0",
        },
    }
    session.flush()
    return True
