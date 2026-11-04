from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.goal_trajectory import schedule_pace, trajectory


def calculate(saved="500", monthly="100", **changes):
    goal = SimpleNamespace(
        **(
            dict(
                start_date=date(2026, 1, 1),
                deadline=date(2026, 12, 31),
                target=Decimal("1000"),
                status="ACTIVE",
            )
            | changes
        )
    )
    return trajectory(
        goal,
        date(2026, 9, 30),
        Decimal(saved),
        [],
        [{"date": date(2026, 9, 1), "value": Decimal("450")}],
        Decimal(monthly),
    )


@pytest.mark.parametrize(
    "monthly,status,end",
    [("200", "ON_TRACK", "1100"), ("150", "AT_RISK", "950"), ("0", "OFF_TRACK", "500")],
)
def test_projection_exact_month_ends_excludes_already_observed_day(monthly, status, end):
    result = calculate(monthly=monthly)
    assert result["status"] == status
    assert result["projected_end"] == Decimal(end)
    current = next(p for p in result["points"] if p["date"] == date(2026, 9, 30))
    assert current["actual"] == current["projected"] == Decimal("500")
    assert result["points"][-1]["required"] == Decimal("1000")
    assert result["points"][-1]["actual"] is None


def test_no_deadline_paused_overfunded_and_missing_coverage():
    assert calculate(deadline=None)["status"] == "NO_DEADLINE"
    assert calculate(status="PAUSED")["projected_end"] is None
    assert calculate(saved="1001")["status"] == "COMPLETED"
    assert calculate(deadline=date(2026, 9, 1))["status"] == "OFF_TRACK"
    goal = SimpleNamespace(
        start_date=date(2026, 1, 1),
        deadline=date(2026, 12, 31),
        target=Decimal("1000"),
        status="ACTIVE",
    )
    result = trajectory(goal, date(2026, 9, 30), Decimal(0), ["missing account"], [], Decimal(200))
    assert result["status"] == "UNAVAILABLE" and result["projected_end"] is None


@pytest.mark.parametrize(
    "saved,status",
    [("500", "ON_TRACK"), ("450", "AT_RISK"), ("449.999999", "OFF_TRACK"), ("1001", "ACHIEVED")],
)
def test_actual_schedule_pace_is_exact_and_independent_of_scenario(saved, status):
    goal = SimpleNamespace(
        start_date=date(2026, 1, 1),
        deadline=date(2026, 1, 11),
        target=Decimal("1000"),
        status="ACTIVE",
    )
    result = schedule_pace(goal, date(2026, 1, 6), Decimal(saved), [])
    assert result["status"] == status
    if status != "ACHIEVED":
        assert result["required_to_date"] == Decimal("500")


def test_schedule_pace_lifecycle_coverage_and_calendar_boundaries():
    goal = SimpleNamespace(
        start_date=date(2026, 1, 1),
        deadline=date(2026, 1, 11),
        target=Decimal("1000"),
        status="ACTIVE",
    )
    assert schedule_pace(goal, date(2026, 1, 1), Decimal(0), [])["status"] == "NOT_STARTED"
    assert schedule_pace(goal, goal.deadline, Decimal("999.999999"), [])["status"] == "OFF_TRACK"
    assert schedule_pace(goal, date(2026, 1, 12), Decimal("1000"), [])["status"] == "ACHIEVED"
    assert (
        schedule_pace(goal, goal.deadline, Decimal(0), ["Missing savings"])["status"]
        == "UNAVAILABLE"
    )
    goal.status = "PAUSED"
    assert schedule_pace(goal, goal.deadline, Decimal(0), [])["status"] == "PAUSED"
    goal.status = "ARCHIVED"
    assert schedule_pace(goal, goal.deadline, Decimal(0), [])["status"] == "ARCHIVED"
    goal.status, goal.deadline = "ACTIVE", None
    assert schedule_pace(goal, date(2026, 1, 6), Decimal(0), [])["status"] == "NO_DEADLINE"
