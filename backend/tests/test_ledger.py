from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import event, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Transaction, Transfer
from app.seed import seed_demo

DAY = "2026-10-04"


def account(api, name="Checking", opening="0", **kwargs):
    response = api.post(
        "/api/accounts",
        json={
            "name": name,
            "type": "CHECKING",
            "currency": "BRL",
            "opening_balance": opening,
            "opening_date": DAY,
            **kwargs,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def entry(api, acct, kind="EXPENSE", amount="200", **kwargs):
    return api.post(
        "/api/transactions",
        json={
            "account_id": acct["id"],
            "currency": acct["currency"],
            "transaction_type": kind,
            "amount": amount,
            "transaction_date": DAY,
            "description": "Synthetic test",
            **kwargs,
        },
    )


def transfer(api, source, target, **kwargs):
    return api.post(
        "/api/transfers",
        json={
            "source_account_id": source["id"],
            "destination_account_id": target["id"],
            "currency": source["currency"],
            "amount": "500",
            "transaction_date": DAY,
            **kwargs,
        },
    )


def test_required_financial_scenario_and_reconstruction(api, db_engine):
    checking = account(api, opening="5000")
    savings = account(api, "Savings", "2000", type="SAVINGS")
    assert entry(api, checking).status_code == 201
    assert entry(api, checking, "INCOME", "1000").status_code == 201
    moved = transfer(api, checking, savings)
    assert moved.status_code == 201, moved.text
    assert Decimal(api.get(f"/api/accounts/{checking['id']}").json()["balance"]) == Decimal("5300")
    assert Decimal(api.get(f"/api/accounts/{savings['id']}").json()["balance"]) == Decimal("2500")
    summary = api.get("/api/dashboard?month=2026-10").json()["totals"][0]
    assert Decimal(summary["income"]) == Decimal("1000")
    assert Decimal(summary["expenses"]) == Decimal("200")
    assert Decimal(summary["total_balance"]) == Decimal("7800")
    with Session(db_engine) as fresh:
        rows = list(fresh.scalars(select(Transaction)))
        reconstructed = {}
        for row in rows:
            reconstructed[row.account_id] = reconstructed.get(row.account_id, Decimal("0")) + (
                row.amount if row.direction == "IN" else -row.amount
            )
        assert reconstructed[UUID(checking["id"])] == Decimal("5300")
        sides = [r for r in rows if r.transfer_id == UUID(moved.json()["id"])]
        assert len(sides) == 2
        assert {r.direction for r in sides} == {"IN", "OUT"}


def test_transfer_atomicity_when_second_side_fails(api, db_engine):
    source, target = account(api), account(api, "Savings")

    def fail_destination(mapper, connection, target_row):
        if target_row.transaction_type == "TRANSFER" and target_row.direction == "IN":
            raise IntegrityError("synthetic second-side failure", {}, Exception("test"))

    event.listen(Transaction, "before_insert", fail_destination)
    try:
        assert transfer(api, source, target).status_code == 409
    finally:
        event.remove(Transaction, "before_insert", fail_destination)
    with Session(db_engine) as session:
        assert session.scalar(select(func.count()).select_from(Transfer)) == 0
        assert session.scalar(select(func.count()).select_from(Transaction)) == 0


def test_transfer_rejections(api):
    source = account(api)
    foreign = account(api, "USD account", currency="USD")
    assert transfer(api, source, source).status_code == 422
    assert transfer(api, source, foreign).status_code == 422
    target = account(api, "Inactive")
    assert api.delete(f"/api/accounts/{target['id']}").status_code == 204
    assert transfer(api, source, target).status_code == 409


@pytest.mark.parametrize(
    "amount", ["0", "-1", "NaN", "Infinity", "0.0000001", "1000000000000000000", 1.1, 1]
)
def test_invalid_money_rejected(api, amount):
    source, target = account(api), account(api, "Savings")
    assert entry(api, source, amount=amount).status_code == 422
    assert transfer(api, source, target, amount=amount).status_code == 422


def test_opening_balance_is_history_not_income_and_supports_liabilities(api):
    card = account(api, "Card", "100", type="CREDIT_CARD", opening_direction="OUT")
    assert Decimal(card["balance"]) == Decimal("-100")
    zero = account(api, "Zero")
    assert api.get("/api/transactions", params={"account_id": zero["id"]}).json() == []
    opening = api.get("/api/transactions", params={"account_id": card["id"]}).json()[0]
    assert opening["transaction_type"] == "OPENING_BALANCE"
    assert api.delete(f"/api/transactions/{opening['id']}").status_code == 409
    totals = api.get("/api/dashboard?month=2026-10").json()["totals"][0]
    assert Decimal(totals["income"]) == Decimal(totals["expenses"]) == 0


def test_category_integrity_and_safe_soft_delete(api, db_engine):
    acct = account(api, opening="1000")
    category = api.post("/api/categories", json={"name": "Groceries"}).json()
    assert api.post("/api/categories", json={"name": " groceries "}).status_code == 409
    assert entry(api, acct, category_id=str(uuid4())).status_code == 404
    row = entry(api, acct, category_id=category["id"]).json()
    assert api.delete(f"/api/categories/{category['id']}").status_code == 409
    assert api.delete(f"/api/transactions/{row['id']}").status_code == 204
    assert api.get(f"/api/transactions/{row['id']}").json()["deleted_at"] is not None
    assert api.delete(f"/api/categories/{category['id']}").status_code == 409
    assert Decimal(api.get(f"/api/accounts/{acct['id']}").json()["balance"]) == Decimal("1000")
    with db_engine.begin() as conn, pytest.raises(IntegrityError):
        conn.execute(text("DELETE FROM categories WHERE id=:id"), {"id": category["id"]})


def test_filters_updates_dates_and_currencies(api):
    acct = account(api)
    category = api.post("/api/categories", json={"name": "Salary"}).json()
    row = entry(api, acct, "INCOME", "0.123456", category_id=category["id"]).json()
    updated = api.put(
        f"/api/transactions/{row['id']}",
        json={
            "transaction_type": "INCOME",
            "amount": "10.123456",
            "transaction_date": "2026-09-30",
            "description": "Updated",
            "merchant": "Fake merchant",
            "category_id": category["id"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["amount"] == "10.123456"
    filters = {
        "account_id": acct["id"],
        "category_id": category["id"],
        "transaction_type": "INCOME",
        "date_from": "2026-09-01",
        "date_to": "2026-09-30",
    }
    assert len(api.get("/api/transactions", params=filters).json()) == 1
    assert (
        api.get("/api/transactions", params={**filters, "transaction_type": "EXPENSE"}).json() == []
    )
    assert api.get("/api/transactions?date_from=2026-10-02&date_to=2026-10-01").status_code == 422
    assert api.get("/api/dashboard?month=2026-13").status_code == 422
    assert Decimal(api.get("/api/dashboard?month=2026-10").json()["totals"][0]["income"]) == 0
    assert entry(api, acct, currency="USD").status_code == 422
    account(api, "Dollars", "9", currency="USD")
    assert {t["currency"] for t in api.get("/api/dashboard?month=2026-10").json()["totals"]} == {
        "BRL",
        "USD",
    }


def test_database_rejects_partial_transfer_and_invalid_amount(api, db_engine):
    source, target = account(api), account(api, "Savings")
    with Session(db_engine) as session:
        session.add(
            Transfer(
                source_account_id=UUID(source["id"]),
                destination_account_id=UUID(target["id"]),
                amount=Decimal("1"),
                currency="BRL",
                transaction_date=date.fromisoformat(DAY),
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
        session.add(
            Transaction(
                account_id=UUID(source["id"]),
                transaction_type="INCOME",
                direction="IN",
                amount=Decimal("0"),
                currency="BRL",
                transaction_date=date.fromisoformat(DAY),
                description="Invalid",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_transfer_sides_cannot_be_edited_or_deleted(api, db_engine):
    source, target = account(api), account(api, "Savings")
    assert transfer(api, source, target).status_code == 201
    side = api.get("/api/transactions?transaction_type=TRANSFER").json()[0]
    assert api.delete(f"/api/transactions/{side['id']}").status_code == 409
    with db_engine.begin() as conn, pytest.raises(IntegrityError):
        conn.execute(text("UPDATE transactions SET amount=2 WHERE id=:id"), {"id": side["id"]})


def test_account_edit_deactivate_reactivate_and_category_management(api):
    acct = account(api)
    body = {"name": "Renamed", "type": "SAVINGS", "institution": "Fake bank", "active": False}
    assert api.put(f"/api/accounts/{acct['id']}", json=body).status_code == 200
    assert entry(api, acct).status_code == 409
    assert (
        api.put(f"/api/accounts/{acct['id']}", json={**body, "currency": "USD"}).status_code == 422
    )
    assert api.put(f"/api/accounts/{acct['id']}", json={**body, "active": True}).status_code == 200
    cat = api.post("/api/categories", json={"name": "Temporary"}).json()
    assert api.put(f"/api/categories/{cat['id']}", json={"name": "Renamed"}).status_code == 200
    assert api.delete(f"/api/categories/{cat['id']}").status_code == 204


def test_synthetic_demo_is_explicit_and_refuses_to_duplicate(db_engine):
    with Session(db_engine) as session, session.begin():
        seed_demo(session)
    with Session(db_engine) as session, pytest.raises(ValueError):
        seed_demo(session)


def test_demo_balances_are_bounded_and_reports_exclude_transfers(db_engine):
    from app import ledger

    with Session(db_engine) as session, session.begin():
        seed_demo(session)
    with Session(db_engine) as session:
        summary = ledger.dashboard(session, date.today().strftime("%Y-%m"))
        assert {a.name: a.balance for a in summary.accounts} == {
            "Checking": Decimal("5265"),
            "Savings": Decimal("2500"),
            "Cash": Decimal("300"),
            "Investment Account": Decimal("0"),
        }
        assert summary.totals[0].total_balance == Decimal("8065")
        assert summary.totals[0].income == Decimal("1000")
        assert summary.totals[0].expenses == Decimal("235")
        assert session.scalar(select(func.count()).select_from(Transfer)) == 1
