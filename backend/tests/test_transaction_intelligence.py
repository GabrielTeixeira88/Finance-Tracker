from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import URL, event, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_ledger import account, entry, transfer

from app.database import make_engine
from app.models import Payee, Transaction


def payee(api, name="Uber"):
    response = api.post("/api/payees", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def test_payee_normalization_search_rename_and_uniqueness(api):
    first = payee(api, "  Uber  \t BV  ")
    assert first["name"] == "Uber BV"
    assert api.post("/api/payees", json={"name": "uBER bv"}).status_code == 409
    distinct = payee(api, "Uber B.V.")
    assert distinct["id"] != first["id"]
    payee(api, "Straße")
    assert api.post("/api/payees", json={"name": "STRASSE"}).status_code == 409
    assert len(api.get("/api/payees?search=STRASSE").json()) == 1
    assert api.post("/api/payees", json={"name": " \t "}).status_code == 422
    renamed = api.patch(f"/api/payees/{first['id']}", json={"name": "Uber"})
    assert renamed.json()["name"] == "Uber"
    assert api.patch(f"/api/payees/{distinct['id']}", json={"name": " uber "}).status_code == 409
    assert api.get("/api/payees?search=ber&limit=1&offset=1").json()[0]["id"] == distinct["id"]


def test_metadata_patch_preserves_money_and_raw_description(api):
    acct = account(api, opening="5000")
    p = payee(api)
    c = api.post("/api/categories", json={"name": "Transportation"}).json()
    row = entry(api, acct, amount="0.123456", description="UBER *TRIP HELP.UBER.COM").json()
    before = api.get(f"/api/accounts/{acct['id']}").json()["balance"]
    patched = api.patch(
        f"/api/transactions/{row['id']}",
        json={
            "payee_id": p["id"],
            "category_id": c["id"],
            "review_status": "NEEDS_REVIEW",
        },
    ).json()
    assert patched["payee"]["name"] == "Uber"
    assert patched["description"] == row["description"]
    assert patched["amount"] == "0.123456"
    assert patched["review_status"] == "NEEDS_REVIEW"
    api.patch(f"/api/payees/{p['id']}", json={"name": "Uber renamed"})
    assert api.get(f"/api/transactions/{row['id']}").json()["payee"]["name"] == "Uber renamed"
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == before
    changed = api.patch(
        f"/api/transactions/{row['id']}",
        json={
            "description": "Corrected manually",
            "transaction_date": "2026-10-01",
            "review_status": "REVIEWED",
            "payee_id": None,
            "category_id": None,
        },
    ).json()
    assert changed["payee"] is None and changed["category_id"] is None
    assert changed["transaction_date"] == "2026-10-01"
    for payload in (
        {},
        {"review_status": None},
        {"description": None},
        {"review_status": "RECONCILED"},
        {"amount": "1"},
        {"account_id": acct["id"]},
    ):
        assert api.patch(f"/api/transactions/{row['id']}", json=payload).status_code == 422
    assert (
        api.patch(f"/api/transactions/{row['id']}", json={"payee_id": str(uuid4())}).status_code
        == 404
    )
    assert entry(api, acct, payee_id=str(uuid4())).status_code == 404


def test_legacy_put_preserves_new_metadata(api):
    acct = account(api)
    p = payee(api)
    row = entry(api, acct, payee_id=p["id"], review_status="NEEDS_REVIEW").json()
    body = {
        key: row[key] for key in ("transaction_type", "amount", "transaction_date", "description")
    }
    response = api.put(f"/api/transactions/{row['id']}", json=body)
    assert response.status_code == 200
    assert response.json()["payee_id"] == p["id"]
    assert response.json()["review_status"] == "NEEDS_REVIEW"


def test_bulk_changes_are_atomic_and_nonfinancial(api, db_engine):
    acct = account(api, opening="5000")
    rows = [entry(api, acct, amount=str(i + 1)).json() for i in range(3)]
    ids = [row["id"] for row in rows]
    p = payee(api)
    category = api.post("/api/categories", json={"name": "Synthetic travel"}).json()
    before = api.get("/api/accounts").json()
    changes = {"review_status": "NEEDS_REVIEW", "category_id": category["id"], "payee_id": p["id"]}
    updated = api.patch("/api/transactions/bulk", json={"transaction_ids": ids, "changes": changes})
    assert updated.status_code == 200
    assert all(all(row[key] == value for key, value in changes.items()) for row in updated.json())
    assert api.get("/api/accounts").json() == before
    missing = api.patch(
        "/api/transactions/bulk",
        json={
            "transaction_ids": [*ids, str(uuid4())],
            "changes": {"review_status": "REVIEWED"},
        },
    )
    assert missing.status_code == 404
    assert all(
        api.get(f"/api/transactions/{i}").json()["review_status"] == "NEEDS_REVIEW" for i in ids
    )

    def fail_update(mapper, connection, row):
        if str(row.id) == ids[1]:
            raise IntegrityError("synthetic failure", {}, Exception("test"))

    event.listen(Transaction, "after_update", fail_update)
    try:
        response = api.patch(
            "/api/transactions/bulk",
            json={"transaction_ids": ids, "changes": {"review_status": "REVIEWED"}},
        )
        assert response.status_code == 409
    finally:
        event.remove(Transaction, "after_update", fail_update)
    assert all(
        api.get(f"/api/transactions/{i}").json()["review_status"] == "NEEDS_REVIEW" for i in ids
    )
    assert (
        api.patch(
            "/api/transactions/bulk", json={"transaction_ids": ids, "changes": {"amount": "5"}}
        ).status_code
        == 422
    )
    assert (
        api.patch(
            "/api/transactions/bulk", json={"transaction_ids": [], "changes": changes}
        ).status_code
        == 422
    )
    api.delete(f"/api/transactions/{ids[0]}")
    assert (
        api.patch(
            "/api/transactions/bulk", json={"transaction_ids": ids, "changes": changes}
        ).status_code
        == 409
    )


def test_transfer_review_updates_pair_without_changing_postings(api, db_engine):
    source, destination = account(api, opening="5000"), account(api, "Savings", "2000")
    expense = entry(api, source).json()
    entry(api, source, "INCOME", "1000")
    parent = transfer(api, source, destination).json()
    parent = api.get(f"/api/transfers/{parent['id']}").json()
    sides = api.get("/api/transactions?transaction_type=TRANSFER").json()
    before = api.get("/api/dashboard?month=2026-10").json()["totals"]
    response = api.patch(
        f"/api/transactions/{sides[0]['id']}", json={"review_status": "NEEDS_REVIEW"}
    )
    assert response.status_code == 200
    assert all(
        row["review_status"] == "NEEDS_REVIEW"
        for row in api.get("/api/transactions?transaction_type=TRANSFER").json()
    )
    p = payee(api)
    rejected = api.patch(
        "/api/transactions/bulk",
        json={"transaction_ids": [expense["id"], sides[0]["id"]], "changes": {"payee_id": p["id"]}},
    )
    assert rejected.status_code == 409
    assert api.get(f"/api/transactions/{expense['id']}").json()["payee_id"] is None
    assert (
        api.patch(
            f"/api/transactions/{sides[0]['id']}", json={"description": "Changed"}
        ).status_code
        == 409
    )
    reviewed = api.patch(
        "/api/transactions/bulk",
        json={"transaction_ids": [sides[0]["id"]], "changes": {"review_status": "REVIEWED"}},
    )
    assert len(reviewed.json()) == 2
    assert api.get(f"/api/transfers/{parent['id']}").json() == parent
    assert api.get("/api/dashboard?month=2026-10").json()["totals"] == before
    assert {a["name"]: Decimal(a["balance"]) for a in api.get("/api/accounts").json()} == {
        "Checking": Decimal("5300"),
        "Savings": Decimal("2500"),
    }
    opening = api.get("/api/transactions?transaction_type=OPENING_BALANCE").json()[0]
    assert (
        api.patch(
            f"/api/transactions/{opening['id']}", json={"review_status": "NEEDS_REVIEW"}
        ).status_code
        == 200
    )
    assert (
        api.patch(f"/api/transactions/{opening['id']}", json={"category_id": None}).status_code
        == 409
    )
    with db_engine.begin() as conn, pytest.raises(IntegrityError):
        conn.execute(
            text("UPDATE transactions SET description='corrupt' WHERE id=:id"),
            {"id": UUID(sides[0]["id"]).hex},
        )


def test_combined_filters_exact_amount_search_and_stable_pagination(api):
    acct = account(api)
    p = payee(api, "Synthetic Uber")
    cat = api.post("/api/categories", json={"name": "Transportation"}).json()
    for description, amount, day in [
        ("UBER *TRIP", "9007199254740993.123456", "2026-10-01"),
        ("Uber BV", "9007199254740993.123455", "2026-10-01"),
        ("100% literal_", "1", "2026-10-02"),
    ]:
        assert (
            entry(
                api,
                acct,
                amount=amount,
                description=description,
                transaction_date=day,
                payee_id=p["id"],
                category_id=cat["id"],
                review_status="NEEDS_REVIEW",
            ).status_code
            == 201
        )
    filters = {
        "account_id": acct["id"],
        "transaction_type": "EXPENSE",
        "category_id": cat["id"],
        "payee_id": p["id"],
        "review_status": "NEEDS_REVIEW",
        "date_from": "2026-10-01",
        "date_to": "2026-10-01",
        "search": "synthetic uber",
        "amount_min": "9007199254740993.123456",
        "amount_max": "9007199254740993.123456",
    }
    result = api.get("/api/transactions", params=filters)
    assert result.status_code == 200, result.text
    assert result.headers["X-Total-Count"] == "1"
    assert result.json()[0]["description"] == "UBER *TRIP"
    assert (
        api.get("/api/transactions", params={**filters, "review_status": "REVIEWED"}).json() == []
    )
    assert len(api.get("/api/transactions?search=%25").json()) == 1
    assert len(api.get("/api/transactions?search=_").json()) == 1
    assert len(api.get("/api/transactions?search=trip").json()) == 1
    rows = api.get("/api/transactions").json()
    paged = [
        api.get("/api/transactions", params={"limit": 1, "offset": i}).json()[0] for i in range(3)
    ]
    assert [r["id"] for r in rows] == [r["id"] for r in paged]
    assert rows[0]["transaction_date"] == "2026-10-02"
    assert api.get("/api/transactions?sort=date_asc").json()[0]["transaction_date"] == "2026-10-01"
    assert api.get("/api/transactions?offset=3").json() == []
    for query in [
        "amount_min=2&amount_max=1",
        "amount_min=-1",
        "amount_min=NaN",
        "amount_max=0.0000001",
        "sort=unknown",
        "limit=201",
        "offset=-1",
    ]:
        assert api.get(f"/api/transactions?{query}").status_code == 422


def test_database_payee_foreign_key_and_review_constraint(api, db_engine):
    acct = account(api)
    row = entry(api, acct).json()
    with db_engine.begin() as conn, pytest.raises(IntegrityError):
        conn.execute(
            text("UPDATE transactions SET payee_id=:payee WHERE id=:id"),
            {"payee": uuid4().hex, "id": UUID(row["id"]).hex},
        )
    with db_engine.begin() as conn, pytest.raises(IntegrityError):
        conn.execute(
            text("UPDATE transactions SET review_status='CLEARED' WHERE id=:id"),
            {"id": UUID(row["id"]).hex},
        )
    p = payee(api)
    api.patch(f"/api/transactions/{row['id']}", json={"payee_id": p["id"]})
    with Session(db_engine) as session, pytest.raises(IntegrityError):
        session.delete(session.get(Payee, UUID(p["id"])))
        session.commit()


def test_linked_review_failure_rolls_back_both_sides(api, db_engine):
    source, target = account(api), account(api, "Savings")
    transfer(api, source, target)
    sides = api.get("/api/transactions?transaction_type=TRANSFER").json()

    def fail_after_update(mapper, connection, row):
        if row.transaction_type == "TRANSFER" and row.direction == "IN":
            raise IntegrityError("synthetic review failure", {}, Exception("test"))

    event.listen(Transaction, "after_update", fail_after_update)
    try:
        assert (
            api.patch(
                f"/api/transactions/{sides[0]['id']}", json={"review_status": "NEEDS_REVIEW"}
            ).status_code
            == 409
        )
    finally:
        event.remove(Transaction, "after_update", fail_after_update)
    assert api.get("/api/transactions?transaction_type=TRANSFER").json() == sides


def test_migration_preserves_existing_phase1_ledger(tmp_path):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "existing-phase1.db"))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0002")
    engine = make_engine(url)
    source, target, opening, expense, parent, outgoing, incoming = [uuid4().hex for _ in range(7)]
    with engine.begin() as conn:
        for record_id in (source, target):
            conn.execute(
                text(
                    "INSERT INTO financial_accounts (id,name,type,currency) "
                    "VALUES (:id,'Synthetic','CHECKING','BRL')"
                ),
                {"id": record_id},
            )
        for record_id, kind, direction in (
            (opening, "OPENING_BALANCE", "IN"),
            (expense, "EXPENSE", "OUT"),
        ):
            conn.execute(
                text(
                    "INSERT INTO transactions (id,account_id,transaction_type,direction,amount,"
                    "currency,transaction_date,description) VALUES (:id,:account,:kind,:direction,"
                    "'000000000000000010123456','BRL','2026-10-01','Synthetic original')"
                ),
                {"id": record_id, "account": source, "kind": kind, "direction": direction},
            )
        conn.execute(
            text(
                "INSERT INTO transfers (id,source_account_id,destination_account_id,"
                "source_entry_id,"
                "destination_entry_id,amount,currency,transaction_date,description) VALUES "
                "(:id,:source,:target,:out,:in,'000000000000000001000000','BRL','2026-10-01',"
                "'Synthetic transfer')"
            ),
            {"id": parent, "source": source, "target": target, "out": outgoing, "in": incoming},
        )
        for record_id, account_id, direction in (
            (outgoing, source, "OUT"),
            (incoming, target, "IN"),
        ):
            conn.execute(
                text(
                    "INSERT INTO transactions (id,account_id,transaction_type,direction,amount,"
                    "currency,transaction_date,description,transfer_id) VALUES "
                    "(:id,:account,'TRANSFER',:direction,'000000000000000001000000','BRL',"
                    "'2026-10-01','Synthetic transfer',:parent)"
                ),
                {"id": record_id, "account": account_id, "direction": direction, "parent": parent},
            )
        before = [
            dict(row)
            for row in conn.execute(text("SELECT * FROM transactions ORDER BY id")).mappings()
        ]
    command.upgrade(config, "head")
    command.check(config)
    with engine.connect() as conn:
        after = [
            dict(row)
            for row in conn.execute(text("SELECT * FROM transactions ORDER BY id")).mappings()
        ]
        assert all(
            row.pop("payee_id") is None and row.pop("review_status") == "REVIEWED" for row in after
        )
        for row in after:
            import json

            protected = json.loads(row.pop("manual_fields"))
            assert protected == (
                ["payee_id", "category_id", "review_status"]
                if row["transaction_type"] in {"INCOME", "EXPENSE"}
                else []
            )
            assert json.loads(row.pop("rule_assignments")) == {}
        assert after == before
        assert list(conn.execute(text("PRAGMA foreign_key_check"))) == []
    with Session(engine) as session:
        assert session.scalar(
            select(Transaction).where(Transaction.id == UUID(expense))
        ).transaction_date == date(2026, 10, 1)
    engine.dispose()
