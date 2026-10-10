from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session
from test_ledger import account, entry, transfer
from test_transaction_intelligence import payee

from app.models import RuleApplication, ScheduleCompletion, Transaction
from app.payee_learning import safe_pattern
from app.schedules import dates


def rule(api, **changes):
    data = {
        "name": "Synthetic classification",
        "conditions": [{"field": "description", "operator": "contains", "value": "synthetic"}],
        "actions": {"review_status": "NEEDS_REVIEW"},
        **changes,
    }
    response = api.post("/api/rules", json=data)
    assert response.status_code == 201, response.text
    return response.json()


def schedule(api, acct, **changes):
    response = api.post(
        "/api/schedules",
        json={
            "name": "Synthetic rent",
            "description": "Synthetic rent",
            "transaction_type": "EXPENSE",
            "account_id": acct["id"],
            "currency": "BRL",
            "amount": "200",
            "frequency": "MONTHLY",
            "start_date": "2026-10-04",
            **changes,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def preview(api, saved):
    response = api.post(f"/api/rules/{saved['id']}/preview")
    assert response.status_code == 200, response.text
    return response.json()


def apply(api, saved, data):
    return api.post(
        f"/api/rules/{saved['id']}/apply", json={"preview_token": data["preview_token"]}
    )


def test_rules_manual_priority_preview_idempotence_and_balances(api):
    acct = account(api, opening="5000")
    first = entry(api, acct).json()
    manual = entry(api, acct, review_status="REVIEWED").json()
    saved = rule(api, priority=10)
    rule(api, priority=20, actions={"review_status": "REVIEWED"})
    before = api.get(f"/api/accounts/{acct['id']}").json()["balance"]
    dry = preview(api, saved)
    assert dry["match_count"] == 2 and dry["change_count"] == 1
    assert api.get(f"/api/transactions/{first['id']}").json()["review_status"] == "REVIEWED"
    assert apply(api, saved, dry).json()["applied"] == 1
    assert api.get(f"/api/transactions/{manual['id']}").json()["review_status"] == "REVIEWED"
    assert apply(api, saved, preview(api, saved)).json()["applied"] == 0
    assert len(api.get(f"/api/transactions/{first['id']}/automation").json()) == 1
    created = entry(api, acct, amount="0.000001").json()
    assert created["review_status"] == "NEEDS_REVIEW"
    assert created["rule_assignments"]["review_status"]["rule_id"] == saved["id"]
    assert Decimal(api.get(f"/api/accounts/{acct['id']}").json()["balance"]) == Decimal(
        before
    ) - Decimal("0.000001")
    api.patch(f"/api/transactions/{first['id']}", json={"review_status": "REVIEWED"})
    assert preview(api, saved)["change_count"] == 0
    api.patch(f"/api/transactions/{first['id']}", json={"unlock_fields": ["review_status"]})
    assert preview(api, saved)["change_count"] == 1


@pytest.mark.parametrize(
    "field,operator,value,matches",
    [
        ("description", "contains", "  SYNTHETIC ", True),
        ("description", "not_contains", "unknown", True),
        ("description", "equals", "Synthetic test", True),
        ("description", "starts_with", "syn", True),
        ("description", "equals", "synthetic", False),
        ("amount", "equals", "200.000001", True),
        ("amount", "greater_than", "200", True),
        ("amount", "less_than", "200.000002", True),
        ("currency", "equals", "USD", False),
        ("transaction_type", "equals", "EXPENSE", True),
    ],
)
def test_rule_allowlisted_conditions_exact_money(api, field, operator, value, matches):
    acct = account(api)
    saved = rule(api, conditions=[{"field": field, "operator": operator, "value": value}])
    row = entry(api, acct, amount="200.000001").json()
    assert (row["review_status"] == "NEEDS_REVIEW") is matches
    assert preview(api, saved)["change_count"] == 0


def test_rules_any_all_disabled_stale_and_invalid(api):
    acct = account(api)
    entry(api, acct)
    conditions = [
        {"field": "currency", "operator": "equals", "value": "USD"},
        {"field": "account_id", "operator": "equals", "value": acct["id"]},
    ]
    saved = rule(api, conditions=conditions)
    assert preview(api, saved)["match_count"] == 0
    assert api.patch(f"/api/rules/{saved['id']}", json={"match_mode": "ANY"}).status_code == 200
    old = preview(api, saved)
    entry(api, acct)
    assert apply(api, saved, old).status_code == 409
    api.patch(f"/api/rules/{saved['id']}", json={"enabled": False})
    assert entry(api, acct).json()["review_status"] == "REVIEWED"
    assert apply(api, saved, preview(api, saved)).status_code == 409
    for changes in (
        {"actions": {"amount": "1"}},
        {"conditions": []},
        {"conditions": [{"field": "description", "operator": "regex", "value": ".*"}]},
    ):
        assert api.patch(f"/api/rules/{saved['id']}", json=changes).status_code == 422
    assert api.delete(f"/api/rules/{saved['id']}").status_code == 204


def test_rules_transfers_openings_and_application_rollback(api, db_engine):
    acct, other = account(api, opening="5000"), account(api, "Savings", "2000")
    saved = rule(api)
    moved = transfer(api, acct, other).json()
    assert preview(api, saved)["match_count"] == 0
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "4500.000000"

    def fail(_mapper, _connection, _target):
        raise RuntimeError("Synthetic audit failure")

    event.listen(RuleApplication, "before_insert", fail)
    try:
        with pytest.raises(RuntimeError, match="Synthetic audit"):
            entry(api, acct)
    finally:
        event.remove(RuleApplication, "before_insert", fail)
    with Session(db_engine) as session:
        assert not list(
            session.scalars(select(Transaction).where(Transaction.transaction_type == "EXPENSE"))
        )
    assert moved


def test_learning_distinct_consistent_corrections_accept_and_dismiss(api):
    acct = account(api)
    p = payee(api, "Fictional Metro")
    category = api.post("/api/categories", json={"name": "Transport"}).json()
    rows = [entry(api, acct, description=f"FICTIONAL METRO {i}").json() for i in range(4)]
    updates = {"payee_id": p["id"], "category_id": category["id"]}
    for _ in range(4):
        api.patch(f"/api/transactions/{rows[0]['id']}", json=updates)
    assert api.get("/api/rule-suggestions").json() == []
    for row in rows[1:3]:
        assert api.patch(f"/api/transactions/{row['id']}", json=updates).status_code == 200
    suggestion = api.get("/api/rule-suggestions").json()[0]
    assert suggestion["support_count"] == 3 and suggestion["status"] == "PENDING"
    assert api.get("/api/rules").json() == []
    accepted = api.post(f"/api/rule-suggestions/{suggestion['id']}/accept", json={})
    assert accepted.status_code == 200, accepted.text
    assert entry(api, acct, description="FICTIONAL METRO 99").json()["payee_id"] == p["id"]
    assert api.post(f"/api/rule-suggestions/{suggestion['id']}/accept", json={}).status_code == 409

    for i in range(3):
        row = entry(api, acct, description=f"Fictional bakery {i}").json()
        api.patch(f"/api/transactions/{row['id']}", json=updates)
    second = next(s for s in api.get("/api/rule-suggestions").json() if s["status"] == "PENDING")
    assert api.post(f"/api/rule-suggestions/{second['id']}/dismiss").status_code == 200
    api.patch(f"/api/transactions/{rows[3]['id']}", json=updates)
    assert (
        next(s for s in api.get("/api/rule-suggestions").json() if s["id"] == second["id"])[
            "status"
        ]
        == "DISMISSED"
    )


@pytest.mark.parametrize(
    "frequency,anchor,end,expected",
    [
        ("ONCE", "2026-01-31", "2026-04-30", ["2026-01-31"]),
        (
            "MONTHLY",
            "2026-01-31",
            "2026-04-30",
            ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
        ),
        (
            "YEARLY",
            "2024-02-29",
            "2028-03-01",
            ["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"],
        ),
        ("WEEKLY", "2026-01-01", "2026-01-16", ["2026-01-01", "2026-01-08", "2026-01-15"]),
        ("BIWEEKLY", "2026-01-01", "2026-01-31", ["2026-01-01", "2026-01-15", "2026-01-29"]),
    ],
)
def test_anchored_recurrence(frequency, anchor, end, expected):
    start = date.fromisoformat(anchor)
    row = SimpleNamespace(start_date=start, end_date=None, enabled=True, frequency=frequency)
    assert [d.isoformat() for d in dates(row, start, date.fromisoformat(end))] == expected
    row.enabled = False
    assert list(dates(row, start, date.max)) == []


def test_schedule_projection_explicit_post_duplicate_and_financial_guard(api):
    acct = account(api, opening="5000")
    saved = schedule(api, acct)
    path = f"/api/schedules/{saved['id']}/occurrences/2026-10-04"
    pending = api.get(
        "/api/schedules/upcoming?date_from=2026-10-01&date_to=2026-10-31&as_of=2026-10-09"
    ).json()
    assert pending["occurrences"][0]["status"] == "OVERDUE"
    assert pending["totals"][0]["expenses"] == "200.000000"
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "5000.000000"
    posted = api.post(
        path + "/post", json={"amount": "200.000001", "transaction_date": "2026-10-04"}
    )
    assert posted.status_code == 201, posted.text
    row = posted.json()
    assert (
        api.post(
            path + "/post", json={"amount": "200", "transaction_date": "2026-10-04"}
        ).status_code
        == 409
    )
    assert api.delete(f"/api/transactions/{row['id']}").status_code == 409
    assert (
        api.patch(
            f"/api/transactions/{row['id']}", json={"review_status": "NEEDS_REVIEW"}
        ).status_code
        == 200
    )
    assert (
        api.patch(f"/api/schedules/{saved['id']}", json={"frequency": "WEEKLY"}).status_code == 409
    )
    assert api.delete(f"/api/schedules/{saved['id']}").status_code == 409
    assert api.patch(f"/api/schedules/{saved['id']}", json={"enabled": False}).status_code == 200
    done = api.get("/api/schedules/upcoming?date_from=2026-10-01&date_to=2026-10-31").json()
    assert done["occurrences"][0]["status"] == "COMPLETED" and done["totals"] == []
    assert api.delete(path + "/match").status_code == 204
    assert api.delete(f"/api/transactions/{row['id']}").status_code == 204
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "5000.000000"


def test_schedule_approximate_candidates_ambiguous_matching_and_rollback(api, db_engine):
    acct = account(api)
    saved = schedule(api, acct, amount_is_approximate=True, amount_tolerance="2")
    path = f"/api/schedules/{saved['id']}/occurrences/2026-10-04"
    first = entry(api, acct, description="Synthetic rent", amount="199").json()
    second = entry(api, acct, description="Synthetic rent", amount="201").json()
    entry(api, acct, description="Different payee", amount="200")
    entry(api, acct, description="Synthetic rent", amount="203")
    candidates = api.get(path + "/candidates").json()
    assert candidates["ambiguous"] and {r["id"] for r in candidates["candidates"]} == {
        first["id"],
        second["id"],
    }
    assert api.post(path + "/match", json={"transaction_id": first["id"]}).status_code == 200
    assert api.post(path + "/match", json={"transaction_id": second["id"]}).status_code == 409
    other = schedule(api, acct, name="Second")
    assert (
        api.post(
            f"/api/schedules/{other['id']}/occurrences/2026-10-04/match",
            json={"transaction_id": first["id"]},
        ).status_code
        == 409
    )
    before = api.get(f"/api/accounts/{acct['id']}").json()["balance"]

    def fail(_mapper, _connection, _target):
        raise RuntimeError("Synthetic completion failure")

    event.listen(ScheduleCompletion, "before_insert", fail)
    try:
        with pytest.raises(RuntimeError, match="Synthetic completion"):
            api.post(
                f"/api/schedules/{other['id']}/occurrences/2026-10-04/post",
                json={"amount": "200", "transaction_date": "2026-10-04"},
            )
    finally:
        event.remove(ScheduleCompletion, "before_insert", fail)
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == before
    with Session(db_engine) as session:
        assert session.get(Transaction, UUID(first["id"])) is not None


@pytest.mark.parametrize("description", ["PAYMENT 123", "CARD PURCHASE 987", "123456", "POS", ""])
def test_learning_rejects_generic_patterns(description):
    assert safe_pattern(description) is None


def test_learning_conflicts_stale_evidence_and_equivalent_rule(api):
    acct = account(api)
    p, other = payee(api, "Fictional bakery"), payee(api, "Different bakery")
    category = api.post("/api/categories", json={"name": "Food"}).json()
    rows = [entry(api, acct, description=f"FICTIONAL BAKERY {i}").json() for i in range(3)]
    for row in rows:
        api.patch(
            f"/api/transactions/{row['id']}",
            json={"payee_id": p["id"], "category_id": category["id"]},
        )
    suggestion = api.get("/api/rule-suggestions").json()[0]
    api.patch(f"/api/transactions/{rows[-1]['id']}", json={"payee_id": other["id"]})
    assert api.get("/api/rule-suggestions").json()[0]["status"] == "STALE"
    assert api.post(f"/api/rule-suggestions/{suggestion['id']}/accept", json={}).status_code == 409
    api.patch(f"/api/transactions/{rows[-1]['id']}", json={"payee_id": p["id"]})
    assert len(api.get("/api/rule-suggestions").json()) == 1
    assert api.get("/api/rule-suggestions").json()[0]["status"] == "PENDING"
    api.patch(f"/api/transactions/{rows[-1]['id']}", json={"description": "Unrelated description"})
    assert api.get("/api/rule-suggestions").json()[0]["status"] == "STALE"
    api.patch(f"/api/transactions/{rows[-1]['id']}", json={"description": "FICTIONAL BAKERY 2"})
    rule(api, conditions=suggestion["conditions"], actions=suggestion["actions"])
    assert api.get("/api/rule-suggestions").json()[0]["status"] == "STALE"


def test_automatic_rules_never_teach_and_explicit_null_remains_protected(api, db_engine):
    acct = account(api)
    p = payee(api)
    c = api.post("/api/categories", json={"name": "Transport"}).json()
    saved = rule(api, actions={"payee_id": p["id"], "category_id": c["id"]})
    for i in range(4):
        assert entry(api, acct, description=f"Synthetic metro {i}").json()["payee_id"] == p["id"]
    assert api.get("/api/rule-suggestions").json() == []
    row = entry(api, acct, payee_id=None, category_id=None).json()
    assert row["payee_id"] is None and row["category_id"] is None
    assert apply(api, saved, preview(api, saved)).json()["applied"] == 0
    assert api.delete(f"/api/categories/{c['id']}").status_code == 409


def test_schedule_validation_expiry_currency_separation_and_unique_match(api):
    acct = account(api)
    usd = account(api, "USD", currency="USD")
    first = schedule(api, acct, frequency="ONCE", amount="10.123456")
    schedule(api, usd, currency="USD", amount="7.123456", frequency="ONCE")
    schedule(api, acct, enabled=False)
    expired = schedule(api, acct, start_date="2026-09-04", end_date="2026-09-30")
    assert expired["next_due_date"] == "2026-09-04"
    projection = api.get(
        "/api/schedules/upcoming?date_from=2026-10-01&date_to=2026-10-31&as_of=2026-10-04"
    ).json()
    assert len(projection["occurrences"]) == 2
    assert [t["expenses"] for t in projection["totals"]] == ["10.123456", "7.123456"]
    for updates in (
        {"amount": "0"},
        {"amount": "-1"},
        {"currency": "USD"},
        {"amount_tolerance": "1"},
        {"end_date": "2025-01-01"},
    ):
        assert api.patch(f"/api/schedules/{first['id']}", json=updates).status_code == 422
    row = entry(api, acct, amount="10.123456", description="Synthetic rent").json()
    other = schedule(api, acct, amount="10.123456", frequency="ONCE")
    path = f"/api/schedules/{first['id']}/occurrences/2026-10-04"
    assert api.post(path + "/match", json={"transaction_id": row["id"]}).status_code == 200
    second_path = f"/api/schedules/{other['id']}/occurrences/2026-10-04"
    assert api.get(second_path + "/candidates").json()["candidates"] == []
    assert api.post(second_path + "/match", json={"transaction_id": row["id"]}).status_code == 409
