"""Saved zero-return plans and auditable goal lifecycle; never financial postings."""

from decimal import Decimal, localcontext
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import inspect, select

from app.goal_models import GoalEntryEpoch, GoalInvestmentFunding, GoalLifecycle, GoalPlan

RELEASES = {"ARCHIVED", "DELETED"}


def available(session):
    """Read legacy backup projections during migration without mutating old schemas."""
    key = "goal_planning_schema"
    if key not in session.info:
        session.info[key] = inspect(session.connection()).has_table("goal_lifecycle")
    return session.info[key]


def events(session, goal_id):
    if not available(session):
        return []
    return list(
        session.scalars(
            select(GoalLifecycle)
            .where(GoalLifecycle.goal_id == goal_id)
            .order_by(GoalLifecycle.sequence)
        )
    )


def lifecycle(session, goal, day, book=None):
    rows = book.lifecycle.get(goal.id, []) if book else events(session, goal.id)
    effective = [row for row in rows if row.effective_date <= day]
    if effective:
        return effective[-1].status
    if goal.archived_date and goal.archived_date <= day:
        return "ARCHIVED"
    return "ACTIVE" if rows else goal.status


def epoch(session, goal_id, day, book=None):
    rows = book.lifecycle.get(goal_id, []) if book else events(session, goal_id)
    return sum(row.status in RELEASES and row.effective_date <= day for row in rows)


def entry_epoch(session, entry, book=None):
    if book:
        return book.entry_epochs.get(entry.id, 0)
    row = session.get(GoalEntryEpoch, entry.id) if available(session) else None
    return row.funding_epoch if row else 0


def deleted(session, goal):
    rows = events(session, goal.id)
    return bool(rows and rows[-1].status == "DELETED")


def require_editable(session, goal):
    if deleted(session, goal):
        raise HTTPException(410, "Deleted goal retains its history and cannot be edited")


def plan(session, goal):
    row = (
        session.scalar(select(GoalPlan).where(GoalPlan.goal_id == goal.id))
        if available(session)
        else None
    )
    return dict(
        goal_type=row.goal_type if row else "custom_save_up",
        monthly=row.monthly if row else Decimal(0),
        expected_return=Decimal(0),
    )


def save_plan(session, goal, goal_type=None, monthly=None):
    require_editable(session, goal)
    row = session.scalar(select(GoalPlan).where(GoalPlan.goal_id == goal.id))
    if row is None:
        row = GoalPlan(goal_id=goal.id, goal_type="custom_save_up", monthly=Decimal(0))
        session.add(row)
    if goal_type is not None:
        row.goal_type = goal_type
    if monthly is not None:
        row.monthly = monthly
    session.flush()
    return row


def transition(session, goal, status, effective_date):
    from app import wealth

    require_editable(session, goal)
    wealth.valid_day(effective_date)
    previous = events(session, goal.id)
    if effective_date < goal.start_date or (
        previous and effective_date < previous[-1].effective_date
    ):
        raise HTTPException(409, "Lifecycle dates cannot rewrite earlier transitions")
    if status in RELEASES:
        # Releasing in the past must not erase allocations/contributions recorded
        # later in the active interval. Corrections retain explicit history.
        from app.wealth_models import GoalEntry

        if session.scalar(
            select(GoalEntry.id)
            .where(
                GoalEntry.goal_id == goal.id,
                GoalEntry.voided_at.is_(None),
                GoalEntry.effective_date > effective_date,
            )
            .limit(1)
        ) or any(
            row.goal_id == goal.id and row.effective_date > effective_date
            for row in wealth.investment_goal_funding(session)
        ):
            raise HTTPException(409, "Release date cannot precede recorded goal funding")
    if goal.status == status and status != "DELETED":
        return goal
    row = GoalLifecycle(
        goal_id=goal.id,
        sequence=previous[-1].sequence + 1 if previous else 1,
        effective_date=effective_date,
        status=status,
    )
    session.add(row)
    goal.status = "ARCHIVED" if status == "DELETED" else status
    # Preserve the last release date; dated events, not this legacy field,
    # govern restored reservations. An archive never silently reclaims money.
    if status in RELEASES:
        goal.archived_date = effective_date
    session.flush()
    with localcontext() as context:
        context.prec = 60
        wealth.validate_progress(session, goal, from_day=effective_date)
    return goal


def preview(session, goal, day, target, deadline, monthly):
    from app import wealth

    require_editable(session, goal)
    if deadline and deadline < goal.start_date:
        raise HTTPException(422, "Deadline precedes goal start")
    view = SimpleNamespace(
        **{column.name: getattr(goal, column.name) for column in goal.__table__.columns}
    )
    view.target, view.deadline = target, deadline
    result = wealth.goal_detail(session, view, day, monthly)
    result["goal"] = goal
    result["scenario"] = dict(
        target=target, deadline=deadline, monthly=monthly, expected_return=Decimal(0)
    )
    return result


def all_new_funding(session):
    return list(session.scalars(select(GoalInvestmentFunding))) if available(session) else []
