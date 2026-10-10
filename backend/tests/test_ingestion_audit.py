"""Phase 3 final audit: real migrated SQLite, synthetic events only."""

from uuid import UUID

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_ingestion import CONFIG, FIXTURES, account, confirm, decide, upload

from app import ledger
from app.models import SourceRecord


@pytest.mark.parametrize("identifiers", [False, True])
def test_reordered_and_overlapping_exports(api, identifiers):
    aid = account(api)
    config = CONFIG
    if identifiers:
        config = {
            **CONFIG,
            "source_namespace": "synthetic-bank",
            "columns": {**CONFIG["columns"], "external_id": 3},
        }
    header = "date,description,amount,id\n"
    rows = [
        "2026-10-01,Synthetic first,-10,synthetic-1\n",
        "2026-10-02,Synthetic second,-20,synthetic-2\n",
        "2026-10-03,Synthetic third,-30,synthetic-3\n",
    ]
    confirm(api, upload(api, aid, header + rows[0] + rows[1], config))
    for contents, new_count in [(rows[1] + rows[0], 0), (rows[1] + rows[2], 1)]:
        batch = upload(api, aid, header + contents, config)
        expected = "EXACT_DUPLICATE" if identifiers else "POSSIBLE_DUPLICATE"
        assert batch["rows"][0]["status"] == expected
        if not identifiers:
            assert not batch["ready"]
            confirm(api, batch, 422)
            for index, row in enumerate(batch["rows"]):
                if row["status"] == "POSSIBLE_DUPLICATE":
                    batch = decide(
                        api, batch, index, action="LINK", transaction_id=row["matches"][0]["id"]
                    )
        assert confirm(api, batch)["counts"]["imported"] == new_count
    assert len(api.get("/api/transactions").json()) == 3
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "-60.000000"


def test_decimal_representation_does_not_bypass_duplicate_review(api):
    aid = account(api)
    batch = upload(
        api,
        aid,
        "date,description,amount\n2026-10-01,Synthetic coffee,-5\n"
        "2026-10-01,Synthetic coffee,-5.00\n",
    )
    assert [row["status"] for row in batch["rows"]] == ["NEW", "POSSIBLE_DUPLICATE"]
    confirm(api, batch, 422)
    batch = decide(api, batch, 1, action="NEW")
    assert confirm(api, batch)["counts"]["imported"] == 2
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "-10.000000"


def test_exact_source_identity_compares_decimal_value(api):
    aid = account(api)
    config = {
        **CONFIG,
        "source_namespace": "synthetic-bank",
        "columns": {**CONFIG["columns"], "external_id": 3},
    }
    text = "date,description,amount,id\n2026-10-01,Synthetic,-32.50,synthetic-1\n"
    confirm(api, upload(api, aid, text, config))
    batch = upload(api, aid, text.replace("32.50", "32.500000"), config)
    assert batch["rows"][0]["status"] == "EXACT_DUPLICATE"
    assert confirm(api, batch)["counts"]["duplicate"] == 1
    assert len(api.get("/api/transactions").json()) == 1


def test_csv_and_ofx_share_one_posting_with_two_sources(api, db_engine):
    aid = account(api)
    csv = confirm(api, upload(api, aid))
    txn_id = csv["rows"][0]["transaction_id"]
    ofx = upload(api, aid, (FIXTURES / "bank-xml.ofx").read_bytes(), filename="synthetic.ofx")
    assert ofx["rows"][0]["status"] == "POSSIBLE_DUPLICATE"
    confirm(api, ofx, 422)
    ofx = decide(api, ofx, 0, action="LINK", transaction_id=txn_id)
    assert confirm(api, ofx)["counts"]["linked"] == 1
    with Session(db_engine) as session:
        sources = list(session.scalars(select(SourceRecord)))
        assert len(sources) == 2
        assert {s.source_type for s in sources} == {"CSV", "OFX"}
        assert {s.transaction_id for s in sources} == {UUID(txn_id)}
        assert all(s.file_claim for s in sources)
    assert len(api.get("/api/transactions").json()) == 1
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "-32.500000"


def test_uber_rule_variants_preview_manual_choice_and_repeat(api):
    aid = account(api)
    uber = api.post("/api/payees", json={"name": "Uber"}).json()["id"]
    manual = api.post("/api/payees", json={"name": "Synthetic manual payee"}).json()["id"]
    category = api.post("/api/categories", json={"name": "Transportation"}).json()["id"]
    rule = {
        "name": "Synthetic Uber rule",
        "enabled": True,
        "priority": 10,
        "match_mode": "ALL",
        "conditions": [{"field": "description", "operator": "contains", "value": "UBER"}],
        "actions": {"payee_id": uber, "category_id": category},
    }
    assert api.post("/api/rules", json=rule).status_code == 201
    assert (
        api.post(
            "/api/rules",
            json={
                **rule,
                "name": "Disabled conflict",
                "enabled": False,
                "priority": 1,
                "actions": {"payee_id": manual},
            },
        ).status_code
        == 201
    )
    descriptions = ["UBER *TRIP 7291", "UBER BV 8392", "UBER *TRIP 9182"]
    content = "date,description,amount\n" + "".join(
        f"2026-10-0{i + 1},{description},-32.50\n" for i, description in enumerate(descriptions)
    )
    batch = upload(api, aid, content)
    assert api.get("/api/transactions").json() == []
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "0"
    for row in batch["rows"]:
        assert row["candidate"]["payee_id"] == uber
        assert row["candidate"]["category_id"] == category
        assert row["candidate"]["amount"] == "32.50"
        assert row["rules"]
    batch = decide(api, batch, 2, action="NEW", payee_id=manual)
    confirm(api, batch)
    posted = sorted(api.get("/api/transactions").json(), key=lambda t: t["transaction_date"])
    assert [t["description"] for t in posted] == descriptions
    assert [t["payee_id"] for t in posted] == [uber, uber, manual]
    assert all(t["amount"] == "32.500000" and t["account_id"] == aid for t in posted)
    repeated = upload(api, aid, content)
    assert confirm(api, repeated)["counts"]["duplicate"] == 3
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "-97.500000"
    unrelated = upload(api, aid, "date,description,amount\n2026-10-04,Synthetic taxi,-10\n")
    assert unrelated["rows"][0]["candidate"]["payee_id"] is None


def test_failed_confirmation_retries_same_batch_without_partial_claims(api, db_engine, monkeypatch):
    aid = account(api)
    batch = upload(api, aid, "date,description,amount\n2026-10-01,First,-1\n2026-10-02,Second,-2\n")
    original = ledger.create_transaction
    calls = 0

    def interrupted(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise HTTPException(409, "Synthetic interruption")
        return original(*args, **kwargs)

    monkeypatch.setattr(ledger, "create_transaction", interrupted)
    confirm(api, batch, 409)
    with Session(db_engine) as session:
        assert all(
            s.file_claim is None and s.transaction_id is None
            for s in session.scalars(select(SourceRecord))
        )
    monkeypatch.setattr(ledger, "create_transaction", original)
    assert confirm(api, batch)["counts"]["imported"] == 2
    confirm(api, batch)
    assert len(api.get("/api/transactions").json()) == 2
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "-3.000000"
