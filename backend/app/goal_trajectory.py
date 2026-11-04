"""Read-only savings trajectory. No returns, withdrawals or ledger mutations."""

import calendar
from datetime import date
from decimal import Decimal, localcontext


def schedule_pace(goal, as_of, saved, warnings):
    """Actual savings versus the existing straight-line required trajectory, not a forecast."""
    with localcontext() as ctx:
        ctx.prec = 60
        expected = None
        if goal.status in {"PAUSED", "ARCHIVED"}:
            status = goal.status
        elif warnings:
            status = "UNAVAILABLE"
        elif saved >= goal.target:
            status = "ACHIEVED"
        elif goal.deadline is None:
            status = "NO_DEADLINE"
        elif as_of <= goal.start_date:
            status = "NOT_STARTED"
        else:
            duration = (goal.deadline - goal.start_date).days
            elapsed = max(0, min(duration, (as_of - goal.start_date).days))
            expected = goal.target * Decimal(elapsed) / duration if duration > 0 else goal.target
            status = (
                "OFF_TRACK"
                if as_of >= goal.deadline
                else "ON_TRACK"
                if saved >= expected
                else "AT_RISK"
                if saved >= expected * Decimal("0.9")
                else "OFF_TRACK"
            )
        return dict(
            status=status,
            required_to_date=expected.quantize(Decimal("0.000001"))
            if expected is not None
            else None,
            basis="Actual savings versus straight-line required-to-date savings; not a forecast",
        )


def trajectory(goal, as_of, saved, warnings, history, monthly):
    with localcontext() as ctx:
        ctx.prec = 60
        end = goal.deadline
        available = not warnings and end is not None and goal.start_date <= as_of
        if end and (end - as_of).days > 18300:
            available = False
        dates = {r["date"] for r in history} | {as_of}
        contributions = []
        if available and end >= as_of:
            year, month = as_of.year, as_of.month
            while date(year, month, 1) <= end:
                payment = date(year, month, calendar.monthrange(year, month)[1])
                if as_of < payment <= end:
                    contributions.append(payment)
                    dates.add(payment)
                year, offset = divmod(year * 12 + month, 12)
                month = offset + 1
            dates.add(end)
        projected_end = saved + monthly * len(contributions) if available else None
        status = (
            "PAUSED"
            if goal.status == "PAUSED"
            else "ARCHIVED"
            if goal.status == "ARCHIVED"
            else "UNAVAILABLE"
            if warnings
            else "COMPLETED"
            if saved >= goal.target
            else "NO_DEADLINE"
            if end is None
            else "UNAVAILABLE"
            if not available
            else "OFF_TRACK"
            if end < as_of
            else "ON_TRACK"
            if projected_end >= goal.target
            else "AT_RISK"
            if projected_end >= goal.target * Decimal("0.9")
            else "OFF_TRACK"
        )
        if goal.status in {"PAUSED", "ARCHIVED"}:
            projected_end = None
        actual = {r["date"]: r["value"] for r in history}
        actual[as_of] = None if warnings else saved
        duration = (end - goal.start_date).days if end else 0
        points = []
        for day in sorted(dates):
            expected = (
                goal.target
                * Decimal(max(0, min(duration, (day - goal.start_date).days)))
                / duration
                if duration > 0
                else goal.target
                if end and day >= end
                else None
            )
            points.append(
                dict(
                    date=day,
                    actual=actual.get(day),
                    required=expected,
                    projected=(saved + monthly * sum(d <= day for d in contributions))
                    if projected_end is not None and day >= as_of
                    else None,
                )
            )
        return dict(
            status=status,
            monthly=monthly,
            projected_end=projected_end,
            shortfall=max(Decimal(0), goal.target - projected_end)
            if projected_end is not None
            else None,
            points=points,
        )
