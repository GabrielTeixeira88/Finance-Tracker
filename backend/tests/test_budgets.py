from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_ingestion import FIXTURES, account, confirm, decide, upload

from app.models import BudgetMonthOverride
from app.spending import pace


def category(api, name="Synthetic Groceries"):
    return api.post("/api/categories", json={"name": name}).json()["id"]


def entry(api, aid, cat, amount="200", day="2026-09-10", kind="EXPENSE"):
    response = api.post(
        "/api/transactions",
        json={
            "account_id": aid,
            "currency": "BRL",
            "transaction_type": kind,
            "amount": amount,
            "transaction_date": day,
            "description": "Synthetic purchase",
            "category_id": cat,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def target(api, cat, **changes):
    data = {"category_id": cat, "currency": "BRL", "month": "2026-09", "amount": "500", **changes}
    response = api.post("/api/budgets/targets", json=data)
    assert response.status_code == 201, response.text
    return response.json()


def report(api, month="2026-09", currency="BRL", as_of="2026-12-31"):
    response = api.get(
        "/api/budgets/monthly", params={"month": month, "currency": currency, "as_of": as_of}
    )
    assert response.status_code == 200, response.text
    return response.json()


def row(data, cat):
    return next(r for r in data["categories"] if r["category_id"] == cat)


@pytest.mark.parametrize(
    "spent,state,remaining",
    [
        ("200", "On track", "300"),
        ("450", "Approaching target", "50"),
        ("500", "Approaching target", "0"),
        ("550", "Over target", "-50"),
    ],
)
def test_budget_states_and_exact_amounts(api, spent, state, remaining):
    aid, cat = account(api), category(api)
    target(api, cat)
    entry(api, aid, cat, spent)
    result = row(report(api), cat)
    assert result["status"] == state
    assert Decimal(result["remaining"]) == Decimal(remaining)
    assert Decimal(result["spent"]) == Decimal(spent)


def test_versions_overrides_history_and_disable(api):
    cat = category(api)
    tid = target(api, cat)["target_id"]
    target(api, cat, month="2026-10", amount="600")
    target(api, cat, month="2026-12", scope="month", amount="900")
    for month, expected in [
        ("2026-09", "500"),
        ("2026-10", "600"),
        ("2026-12", "900"),
        ("2027-01", "600"),
    ]:
        assert Decimal(row(report(api, month), cat)["target"]) == Decimal(expected)
    assert api.delete(f"/api/budgets/targets/{tid}", params={"month": "2027-02"}).status_code == 204
    assert row(report(api, "2027-02"), cat)["status"] == "No target"
    assert row(report(api, "2026-09"), cat)["active"]
    assert (
        api.delete(f"/api/budgets/targets/{tid}/override", params={"month": "2026-12"}).status_code
        == 204
    )
    assert Decimal(row(report(api, "2026-12"), cat)["target"]) == 600


@pytest.mark.parametrize("spent,carry", [("400", "100"), ("550", "-50")])
def test_positive_negative_and_disabled_rollover(api, spent, carry):
    aid, cat = account(api), category(api)
    target(api, cat, rollover_enabled=True)
    entry(api, aid, cat, spent)
    october = row(report(api, "2026-10"), cat)
    assert Decimal(october["carryover"]) == Decimal(carry)
    assert Decimal(october["available"]) == 500 + Decimal(carry)
    target(api, cat, month="2026-11", rollover_enabled=False)
    assert Decimal(row(report(api, "2026-11"), cat)["carryover"]) == 0
    target(api, cat, month="2026-12", rollover_enabled=True)
    assert Decimal(row(report(api, "2026-12"), cat)["carryover"]) == 0


def test_long_rollover_chain_and_override(api):
    aid, cat = account(api), category(api)
    target(api, cat, month="2025-01", amount="100.123456", rollover_enabled=True)
    entry(api, aid, cat, "50.123456", "2025-01-01")
    target(api, cat, month="2025-02", amount="200", scope="month", rollover_enabled=True)
    result = row(report(api, "2026-01"), cat)
    assert Decimal(result["carryover"]) == Decimal("50") + 200 + 10 * Decimal("100.123456")


def test_groups_copy_idempotence_and_override_confirmation(api, db_engine):
    aid, cat = account(api), category(api)
    group = api.post("/api/budgets/groups", json={"name": "Essentials", "sort_order": 2}).json()
    tid = target(api, cat, group_id=group["id"])["target_id"]
    entry(api, aid, cat)
    data = report(api)
    summary = next(g for g in data["groups"] if g["id"] == group["id"])
    assert Decimal(summary["target"]) == 500 and Decimal(summary["spent"]) == 200
    assert (
        api.put(
            f"/api/budgets/groups/{group['id']}", json={"name": "Basics", "sort_order": 1}
        ).status_code
        == 200
    )
    target(api, cat, month="2026-10", scope="month", amount="999")
    payload = {"month": "2026-10", "currency": "BRL"}
    assert api.post("/api/budgets/copy-month", json=payload).status_code == 409
    assert (
        api.post("/api/budgets/copy-month", json={**payload, "replace_existing": True}).json()[
            "copied"
        ]
        == 1
    )
    assert api.post("/api/budgets/copy-month", json=payload).json()["copied"] == 0
    with Session(db_engine) as session:
        assert (
            len(
                list(
                    session.scalars(
                        select(BudgetMonthOverride).where(
                            BudgetMonthOverride.target_id == UUID(tid)
                        )
                    )
                )
            )
            == 1
        )
    assert Decimal(report(api, "2026-10")["summary"]["expenses"]) == 0
    assert api.delete(f"/api/budgets/groups/{group['id']}").status_code == 409


def test_unbudgeted_uncategorized_zero_target_and_drilldown(api):
    aid, cat = account(api), category(api)
    target(api, cat, amount="0")
    entry(api, aid, cat, "5")
    entry(api, aid, None, "10")
    result = report(api)
    assert Decimal(result["summary"]["expenses"]) == 15
    assert Decimal(result["summary"]["unbudgeted_spending"]) == 10
    assert row(result, cat)["percent"] is None
    assert row(result, cat)["status"] == "Over target"
    assert Decimal(row(result, None)["spent"]) == 10
    response = api.get("/api/transactions?spending_only=true&uncategorized=true&currency=BRL")
    assert len(response.json()) == 1
    assert response.headers["X-Total-Count"] == "1"


def test_credit_card_refund_cashflow_and_financial_guards(api):
    checking = account(api)
    card = api.post(
        "/api/accounts", json={"name": "Synthetic card", "type": "CREDIT_CARD", "currency": "BRL"}
    ).json()["id"]
    cat = category(api)
    purchase = entry(api, card, cat)
    entry(api, checking, None, "1000", kind="INCOME")
    assert (
        api.post(
            "/api/transfers",
            json={
                "source_account_id": checking,
                "destination_account_id": card,
                "amount": "200",
                "currency": "BRL",
                "transaction_date": "2026-09-10",
            },
        ).status_code
        == 201
    )
    assert Decimal(report(api)["summary"]["expenses"]) == 200
    response = api.post(
        "/api/spending/refunds",
        json={
            "purchase_id": purchase["id"],
            "account_id": card,
            "amount": "50",
            "transaction_date": "2026-09-11",
        },
    )
    assert response.status_code == 201, response.text
    result = report(api)["summary"]
    assert Decimal(result["expenses"]) == 150
    assert Decimal(result["income"]) == 1000
    assert Decimal(result["net_flow"]) == 850
    assert Decimal(api.get("/api/dashboard?month=2026-09").json()["totals"][0]["expenses"]) == 150
    assert (
        Decimal(api.get("/api/history?period=1M&end=2026-09-30").json()["series"][0]["expenses"])
        == 150
    )
    assert api.delete(f"/api/transactions/{purchase['id']}").status_code == 409
    assert (
        api.post(
            "/api/spending/refunds",
            json={
                "purchase_id": purchase["id"],
                "account_id": card,
                "amount": "151",
                "transaction_date": "2026-09-12",
            },
        ).status_code
        == 422
    )
    assert len(api.get("/api/transactions").json()) == 5
    assert api.get(f"/api/accounts/{card}").json()["balance"] == "50.000000"


def test_import_rules_duplicates_links_and_metadata_update(api):
    aid, cat, other = account(api), category(api), category(api, "Synthetic other")
    target(api, cat, month="2026-10")
    api.post(
        "/api/rules",
        json={
            "name": "Synthetic Uber",
            "conditions": [{"field": "description", "operator": "contains", "value": "UBER"}],
            "match_mode": "ALL",
            "actions": {"category_id": cat},
        },
    )
    content = "date,description,amount\n2026-10-01,UBER *TRIP,-32.50\n"
    first = confirm(api, upload(api, aid, content))
    confirm(api, upload(api, aid, content))
    txn = first["rows"][0]["transaction_id"]
    other_source = upload(api, aid, content.replace("UBER *TRIP", "Synthetic other export"))
    confirm(api, decide(api, other_source, 0, action="LINK", transaction_id=txn))
    assert Decimal(row(report(api, "2026-10"), cat)["spent"]) == Decimal("32.50")
    assert (
        api.patch(
            "/api/transactions/bulk",
            json={"transaction_ids": [txn], "changes": {"category_id": other}},
        ).status_code
        == 200
    )
    assert Decimal(row(report(api, "2026-10"), cat)["spent"]) == 0
    assert Decimal(row(report(api, "2026-10"), other)["spent"]) == Decimal("32.50")
    assert api.delete(f"/api/transactions/{txn}").status_code == 204
    assert Decimal(report(api, "2026-10")["summary"]["expenses"]) == 0


def test_year_boundary_currency_and_future_actuals(api):
    aid, cat = account(api), category(api)
    entry(api, aid, cat, "10", "2025-12-31")
    entry(api, aid, cat, "20", "2026-01-01")
    result = report(api, "2026-01")
    assert Decimal(result["summary"]["previous"]) == 10
    assert Decimal(result["summary"]["expenses"]) == 20
    usd = api.post(
        "/api/accounts", json={"name": "Synthetic USD", "type": "CASH", "currency": "USD"}
    ).json()["id"]
    api.post(
        "/api/transactions",
        json={
            "account_id": usd,
            "currency": "USD",
            "transaction_type": "EXPENSE",
            "amount": "900",
            "transaction_date": "2026-01-01",
            "description": "Synthetic USD",
        },
    )
    result = report(api, "2026-01")
    assert result["other_currencies"] == ["USD"]
    assert Decimal(result["summary"]["expenses"]) == 20
    future = report(api, "2026-01", as_of="2025-12-01")
    assert future["pace"]["status"] == "future"
    assert Decimal(future["summary"]["expenses"]) == 0
    assert future["pace"]["projection"] is None


def test_projection_is_explicit_current_month_only():
    current = pace(date(2026, 10, 1), date(2026, 10, 10), Decimal("2000"))
    assert current["projection"] == "6200.000000"
    assert current["elapsed_days"] == 10
    assert (
        pace(date(2026, 9, 1), date(2026, 10, 10), Decimal("2000"))["elapsed_percent"] == "100.00"
    )
    assert pace(date(2026, 10, 1), date(2026, 10, 2), Decimal("2000"))["projection"] is None


@pytest.mark.parametrize("amount", ["-1", "0.1234567", "NaN", 10.5])
def test_invalid_target_money(api, amount):
    assert (
        api.post(
            "/api/budgets/targets",
            json={
                "category_id": category(api),
                "currency": "BRL",
                "month": "2026-09",
                "amount": amount,
            },
        ).status_code
        == 422
    )


def test_edits_move_exact_spending_between_months_and_categories(api):
    aid, cat, other = account(api), category(api), category(api, "Synthetic Health")
    original = entry(api, aid, cat, "200.123456")
    response = api.put(
        f"/api/transactions/{original['id']}",
        json={
            "transaction_type": "EXPENSE",
            "amount": "250.000001",
            "transaction_date": "2026-10-01",
            "description": "Synthetic corrected purchase",
            "category_id": other,
        },
    )
    assert response.status_code == 200, response.text
    assert Decimal(report(api)["summary"]["expenses"]) == 0
    assert Decimal(row(report(api, "2026-10"), other)["spent"]) == Decimal("250.000001")
    assert api.delete(f"/api/transactions/{original['id']}").status_code == 204
    assert Decimal(report(api, "2026-10")["summary"]["expenses"]) == 0


def test_unposted_schedule_opening_and_target_do_not_spend(api):
    from test_automation import schedule
    from test_ledger import account as ledger_account

    acct = ledger_account(api, opening="5000")
    schedule(api, acct)
    target(api, category(api), amount="999999")
    result = report(api, "2026-10")
    assert Decimal(result["summary"]["expenses"]) == 0
    assert Decimal(result["summary"]["income"]) == 0
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "5000.000000"


def test_refund_link_is_idempotent_preserves_balance_and_follows_purchase_category(api):
    aid, cat, other = account(api), category(api), category(api, "Synthetic other")
    purchase = entry(api, aid, cat, "100", "2026-08-31")
    credit = entry(api, aid, None, "60", "2026-09-01", "INCOME")
    before = api.get(f"/api/accounts/{aid}").json()["balance"]
    data = {"purchase_id": purchase["id"], "refund_id": credit["id"]}
    link = api.post("/api/spending/refunds/link", json=data)
    assert link.status_code == 201, link.text
    assert api.post("/api/spending/refunds/link", json=data).json()["id"] == link.json()["id"]
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == before
    assert Decimal(report(api)["summary"]["income"]) == 0
    assert Decimal(row(report(api), cat)["spent"]) == -60
    assert Decimal(report(api, "2026-08")["summary"]["expenses"]) == 100
    assert (
        api.patch(f"/api/transactions/{purchase['id']}", json={"category_id": other}).status_code
        == 200
    )
    result = report(api)
    assert Decimal(row(result, other)["spent"]) == -60
    listed = api.get(
        "/api/transactions", params={"spending_only": True, "category_id": other}
    ).json()
    assert {t["id"] for t in listed} == {purchase["id"], credit["id"]}
    refund = next(t for t in listed if t["id"] == credit["id"])
    assert refund["refund_purchase_id"] == purchase["id"]
    assert refund["category_id"] is None and refund["spending_category_id"] == other
    assert api.delete(f"/api/spending/refunds/{link.json()['id']}").status_code == 204
    assert Decimal(report(api)["summary"]["income"]) == 60
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == before


def test_refunds_reject_wrong_kind_date_currency_and_over_refund(api):
    aid, cat = account(api), category(api)
    purchase = entry(api, aid, cat, "100")
    early = entry(api, aid, cat, "20", "2026-09-01", "INCOME")
    assert (
        api.post(
            "/api/spending/refunds/link",
            json={"purchase_id": purchase["id"], "refund_id": early["id"]},
        ).status_code
        == 422
    )
    assert (
        api.post(
            "/api/spending/refunds/link",
            json={"purchase_id": purchase["id"], "refund_id": purchase["id"]},
        ).status_code
        == 422
    )
    usd = api.post(
        "/api/accounts", json={"name": "Synthetic USD", "type": "CASH", "currency": "USD"}
    ).json()["id"]
    assert (
        api.post(
            "/api/spending/refunds",
            json={
                "purchase_id": purchase["id"],
                "account_id": usd,
                "amount": "20",
                "transaction_date": "2026-09-12",
            },
        ).status_code
        == 422
    )
    for amount, code in [("60", 201), ("41", 422), ("40", 201), ("0.000001", 422)]:
        assert (
            api.post(
                "/api/spending/refunds",
                json={
                    "purchase_id": purchase["id"],
                    "account_id": aid,
                    "amount": amount,
                    "transaction_date": "2026-09-12",
                },
            ).status_code
            == code
        )
    assert Decimal(report(api)["summary"]["expenses"]) == 0


def test_distant_future_has_no_actuals_and_zero_baseline_has_no_percentage(api):
    aid, cat = account(api), category(api)
    entry(api, aid, cat, "20", "2030-01-01")
    result = report(api, "2030-01", as_of="2026-09-01")
    assert result == report(api, "2030-01", as_of="2026-09-01")
    assert Decimal(result["summary"]["expenses"]) == 0
    assert all(Decimal(t["expenses"]) == 0 for t in result["trend"])
    assert result["summary"]["change_percent"] is None


def test_budget_foreign_keys_and_uniqueness(db_engine, api):
    from uuid import uuid4

    from sqlalchemy.exc import IntegrityError

    from app.models import BudgetTarget, BudgetVersion

    cat = category(api)
    tid = UUID(target(api, cat)["target_id"])
    for record in [
        BudgetTarget(category_id=uuid4(), currency="BRL"),
        BudgetTarget(category_id=UUID(cat), currency="BRL"),
        BudgetVersion(target_id=tid, month=date(2026, 9, 1), amount=Decimal("5")),
    ]:
        with Session(db_engine) as session, pytest.raises(IntegrityError):
            session.add(record)
            session.commit()


def test_final_audit_target_group_and_cashflow_examples(api):
    aid = account(api)
    groceries = category(api)
    transport = category(api, "Synthetic Transport")
    utilities = category(api, "Synthetic Utilities")
    group = api.post("/api/budgets/groups", json={"name": "Essentials"}).json()
    for cat in (groceries, transport, utilities):
        target(api, cat, month="2026-10", amount="1000", group_id=group["id"])
    for amount in ("200", "150", "250"):
        entry(api, aid, groceries, amount, "2026-10-01")
    entry(api, aid, transport, "200", "2026-10-01")
    entry(api, aid, utilities, "300", "2026-10-01")
    october = report(api, "2026-10")
    grocery = row(october, groceries)
    assert [Decimal(grocery[key]) for key in ("target", "spent", "remaining", "percent")] == [
        1000,
        600,
        400,
        60,
    ]
    assert Decimal(next(g for g in october["groups"] if g["id"] == group["id"])["spent"]) == 1100
    assert Decimal(october["summary"]["expenses"]) == 1100
    target(api, groceries, month="2026-11", amount="1200")
    assert Decimal(row(report(api, "2026-10"), groceries)["target"]) == 1000
    assert Decimal(row(report(api, "2026-11"), groceries)["target"]) == 1200
    entry(api, aid, None, "4630", "2026-10-02")
    entry(api, aid, None, "8500", "2026-10-02", "INCOME")
    summary = report(api, "2026-10")["summary"]
    assert [Decimal(summary[key]) for key in ("income", "expenses", "net_flow")] == [
        8500,
        5730,
        2770,
    ]


def test_csv_ofx_rules_payees_and_repeat_imports_feed_spending_once(api):
    aid, cat = account(api), category(api, "Synthetic Transportation")
    payee = api.post("/api/payees", json={"name": "Synthetic Uber"}).json()["id"]
    target(api, cat, month="2026-10")
    assert (
        api.post(
            "/api/rules",
            json={
                "name": "Synthetic Uber audit",
                "match_mode": "ALL",
                "conditions": [{"field": "description", "operator": "contains", "value": "UBER"}],
                "actions": {"category_id": cat, "payee_id": payee},
            },
        ).status_code
        == 201
    )
    csv = "date,description,amount\n2026-10-02,UBER *TRIP,-20\n"
    ofx = (FIXTURES / "bank-sgml.ofx").read_bytes().replace(b"SYNTHETIC SHOP", b"UBER BV")
    for content, filename in ((csv, "synthetic.csv"), (ofx, "synthetic.ofx")):
        confirm(api, upload(api, aid, content, filename=filename))
        confirm(api, upload(api, aid, content, filename=filename))
    rows = api.get("/api/transactions").json()
    assert len(rows) == 2
    assert all(t["category_id"] == cat and t["payee_id"] == payee for t in rows)
    assert Decimal(row(report(api, "2026-10"), cat)["spent"]) == Decimal("52.50")


@pytest.mark.parametrize(
    "day,spent,elapsed,projection",
    [
        (date(2024, 2, 1), "20", 1, None),
        (date(2024, 2, 29), "290", 29, "290.000000"),
        (date(2024, 2, 15), "0", 15, None),
        (date(2024, 3, 1), "290", 29, None),
        (date(2024, 1, 31), "0", 0, None),
    ],
)
def test_pace_leap_year_boundaries_and_zero(day, spent, elapsed, projection):
    result = pace(date(2024, 2, 1), day, Decimal(spent))
    assert result["days_in_month"] == 29
    assert result["elapsed_days"] == elapsed
    assert result["projection"] == projection


def test_maximum_as_of_date_does_not_overflow(api):
    aid, cat = account(api), category(api)
    entry(api, aid, cat)
    assert Decimal(report(api, as_of="9999-12-31")["summary"]["expenses"]) == 200
