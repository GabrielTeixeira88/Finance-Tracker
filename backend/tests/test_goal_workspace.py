from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.goal_models import GoalLifecycle, GoalPlan
from app.wealth_models import Goal, GoalAccountFunding, GoalEntry
from tests.test_wealth import account, post


def create(api, name="Course", mode="MANUAL", **extra):
    return post(
        api,
        "/goals",
        dict(
            name=name,
            mode=mode,
            currency="BRL",
            target="1000",
            start_date="2025-01-01",
            deadline="2027-12-31",
            **extra,
        ),
    )


def detail(api, goal, day="2025-03-01"):
    response = api.get(f"/api/goals/{goal['id']}?as_of={day}")
    assert response.status_code == 200, response.text
    return response.json()


def status(api, goal, value, day):
    response = api.post(
        f"/api/goals/{goal['id']}/status", json=dict(status=value, effective_date=day)
    )
    assert response.status_code == 200, response.text


def test_saved_plan_exact_preview_and_atomic_save_leave_financial_records_unchanged(api, db_engine):
    goal = create(api, monthly="12.123456", goal_type="education")
    assert detail(api, goal)["plan"]["monthly"] == "12.123456"
    post(api, f"/goals/{goal['id']}/entries", dict(amount="100", effective_date="2025-01-10"))
    before = api.get("/api/accounts").json()
    data = dict(
        target="9007199254740993.123456",
        deadline="2027-12-31",
        monthly="500.123456",
        goal_type="education",
    )
    preview = api.post(f"/api/goals/{goal['id']}/preview?as_of=2025-03-01", json=data)
    assert preview.status_code == 200, preview.text
    assert preview.json()["scenario"]["target"] == data["target"]
    assert detail(api, goal)["goal"]["target"] == "1000.000000"
    assert detail(api, goal)["plan"]["monthly"] == "12.123456"
    invalid = api.put(f"/api/goals/{goal['id']}/plan", json={**data, "deadline": "2024-01-01"})
    assert invalid.status_code == 422
    assert detail(api, goal)["goal"]["target"] == "1000.000000"
    assert api.put(f"/api/goals/{goal['id']}/plan", json=data).status_code == 200
    assert detail(api, goal)["plan"]["monthly"] == "500.123456"
    assert api.get("/api/accounts").json() == before
    with Session(db_engine) as db:
        assert len(list(db.scalars(select(GoalPlan)))) == 1
        assert len(list(db.scalars(select(GoalEntry)))) == 1


def test_archive_restore_preserves_history_and_requires_explicit_new_allocation(api):
    cash = account(api, amount="1000")
    original = create(api, mode="ACCOUNT")
    post(
        api,
        f"/goals/{original['id']}/entries",
        dict(account_id=cash["id"], amount="800", effective_date="2025-01-02"),
    )
    status(api, original, "ARCHIVED", "2025-01-10")
    other = create(api, name="Other", mode="ACCOUNT")
    post(
        api,
        f"/goals/{other['id']}/entries",
        dict(account_id=cash["id"], amount="900", effective_date="2025-01-11"),
    )
    status(api, original, "ACTIVE", "2025-01-20")
    assert (
        api.post(
            f"/api/goals/{original['id']}/entries",
            json=dict(account_id=cash["id"], amount="10", effective_date="2025-01-15"),
        ).status_code
        == 409
    )
    assert detail(api, original, "2025-01-09")["saved"] == "800.000000"
    assert detail(api, original, "2025-01-15")["saved"] == "0.000000"
    assert detail(api, original)["saved"] == "0.000000"
    response = api.put(
        f"/api/goals/{original['id']}/funding",
        json=dict(
            effective_date="2025-01-20", allocations=[dict(account_id=cash["id"], amount="200")]
        ),
    )
    assert response.status_code == 409
    assert detail(api, original)["saved"] == "0.000000"
    response = api.put(
        f"/api/goals/{original['id']}/funding",
        json=dict(
            effective_date="2025-01-20", allocations=[dict(account_id=cash["id"], amount="100")]
        ),
    )
    assert response.status_code == 200, response.text
    assert detail(api, original)["saved"] == "100.000000"
    assert detail(api, original, "2025-01-09")["saved"] == "800.000000"


def test_soft_deletion_retains_history_and_does_not_delete_ledger_or_allow_mutation(api, db_engine):
    cash = account(api, amount="1000")
    goal = create(api)
    entry = post(
        api, f"/goals/{goal['id']}/entries", dict(amount="100", effective_date="2025-01-02")
    )
    before = api.get("/api/accounts").json()
    response = api.request(
        "DELETE", f"/api/goals/{goal['id']}", json={"effective_date": "2025-02-01"}
    )
    assert response.status_code == 200, response.text
    assert not api.get("/api/goals").json()
    assert detail(api, goal)["deleted"] is True
    assert (
        api.post(f"/api/goal-entries/{entry['id']}/void", json={"reason": "Test"}).status_code
        == 410
    )
    assert api.get("/api/accounts").json() == before
    assert cash["balance"] == "1000.000000"
    with Session(db_engine) as db:
        assert db.get(Goal, UUID(goal["id"])) is not None
        assert len(list(db.scalars(select(GoalEntry)))) == 1
        assert list(db.scalars(select(GoalLifecycle)))[0].status == "DELETED"


def test_whole_investment_reservation_can_be_explicitly_reused_after_release(api, db_engine):
    cash = account(api, name="Reserve account", kind="INVESTMENT", amount="1000")
    first = create(api, mode="ACCOUNT")
    request = dict(effective_date="2025-01-02", investment_account_id=cash["id"])
    assert api.put(f"/api/goals/{first['id']}/funding", json=request).status_code == 200
    assert detail(api, first)["saved"] == "1000.000000"
    status(api, first, "ARCHIVED", "2025-01-10")
    status(api, first, "ACTIVE", "2025-01-20")
    assert detail(api, first)["saved"] == "0.000000"
    second = create(api, name="Second reserve", mode="ACCOUNT")
    response = api.put(
        f"/api/goals/{second['id']}/funding", json={**request, "effective_date": "2025-01-11"}
    )
    assert response.status_code == 200, response.text
    assert detail(api, second)["saved"] == "1000.000000"
    assert (
        api.put(
            f"/api/goals/{first['id']}/funding", json={**request, "effective_date": "2025-01-20"}
        ).status_code
        == 409
    )
    assert detail(api, first, "2025-01-09")["saved"] == "1000.000000"
    with Session(db_engine) as db:
        assert len(list(db.scalars(select(GoalAccountFunding)))) == 1


def test_preview_validation_and_exact_milestones_do_not_invent_returns(api):
    goal = create(api, monthly="100")
    post(api, f"/goals/{goal['id']}/entries", dict(amount="250", effective_date="2025-01-10"))
    report = detail(api, goal, "2025-01-31")
    assert report["milestone_details"][0]["amount"] == "250.000000"
    assert report["milestone_details"][0]["first_observed_date"] == "2025-01-10"
    assert report["milestone_details"][1]["estimated_date"] == "2025-04-30"
    assert report["plan"]["expected_return"] == "0.000000"
    for field in ("monthly", "target"):
        payload = dict(target="1000", deadline="2027-12-31", monthly="100", goal_type="education")
        payload[field] = "-1"
        assert api.post(f"/api/goals/{goal['id']}/preview", json=payload).status_code == 422


def test_restored_cash_goal_can_explicitly_choose_a_new_investment_source(api):
    cash = account(api, kind="INVESTMENT", amount="500")
    goal = create(api, mode="ACCOUNT")
    status(api, goal, "ARCHIVED", "2025-01-10")
    status(api, goal, "ACTIVE", "2025-01-20")
    response = api.put(
        f"/api/goals/{goal['id']}/funding",
        json=dict(investment_account_id=cash["id"], effective_date="2025-01-20"),
    )
    assert response.status_code == 200, response.text
    assert detail(api, goal)["saved"] == "500.000000"
    assert detail(api, goal, "2025-01-19")["saved"] == "0.000000"


def test_funding_edit_is_atomic_and_failed_correction_preserves_original_entry(api):
    cash = account(api, amount="1000")
    other = account(api, name="Second", amount="10")
    goal = create(api, mode="ACCOUNT")
    entry = post(
        api,
        f"/goals/{goal['id']}/entries",
        dict(account_id=cash["id"], amount="100", effective_date="2025-01-02"),
    )
    before = api.get("/api/accounts").json()
    response = api.put(
        f"/api/goals/{goal['id']}/funding",
        json=dict(
            effective_date="2025-01-02",
            allocations=[
                dict(account_id=cash["id"], amount="200"),
                dict(account_id=other["id"], amount="20"),
            ],
        ),
    )
    assert response.status_code == 409
    report = detail(api, goal)
    assert report["saved"] == "100.000000"
    assert len(report["entries"]) == 1
    assert report["entries"][0]["id"] == entry["id"]
    assert report["entries"][0]["voided_at"] is None
    assert api.get("/api/accounts").json() == before


def test_lifecycle_cannot_retroactively_erase_funding_or_move_start_past_history(api):
    goal = create(api)
    post(api, f"/goals/{goal['id']}/entries", dict(amount="100", effective_date="2025-02-01"))
    response = api.post(
        f"/api/goals/{goal['id']}/status", json=dict(status="ARCHIVED", effective_date="2025-01-10")
    )
    assert response.status_code == 409
    assert detail(api, goal)["goal"]["status"] == "ACTIVE"
    status(api, goal, "ARCHIVED", "2025-02-02")
    status(api, goal, "ACTIVE", "2025-02-03")
    response = api.patch(
        f"/api/goals/{goal['id']}",
        json={
            **{
                k: v
                for k, v in goal.items()
                if k in ["name", "mode", "currency", "target", "deadline", "notes"]
            },
            "start_date": "2025-02-04",
        },
    )
    assert response.status_code == 409


def test_same_day_release_restore_and_explicit_reallocation_has_one_current_reservation(api):
    cash = account(api, amount="1000")
    goal = create(api, mode="ACCOUNT")
    payload = dict(
        effective_date="2025-01-02", allocations=[dict(account_id=cash["id"], amount="600")]
    )
    assert api.put(f"/api/goals/{goal['id']}/funding", json=payload).status_code == 200
    status(api, goal, "ARCHIVED", "2025-01-02")
    status(api, goal, "ACTIVE", "2025-01-02")
    assert detail(api, goal)["saved"] == "0.000000"
    payload["allocations"][0]["amount"] = "400"
    assert api.put(f"/api/goals/{goal['id']}/funding", json=payload).status_code == 200
    assert detail(api, goal)["saved"] == "400.000000"


def test_goal_plan_foreign_key_is_enforced(db_engine):
    from uuid import uuid4

    import pytest
    from sqlalchemy.exc import IntegrityError

    with Session(db_engine) as db, pytest.raises(IntegrityError):
        db.add(GoalPlan(goal_id=uuid4(), monthly=Decimal("10"), goal_type="education"))
        db.commit()
