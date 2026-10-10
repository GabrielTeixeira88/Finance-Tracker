import base64
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SourceRecord, Transaction

FIXTURES = Path(__file__).parent / "fixtures" / "synthetic"
CONFIG = {
    "date_format": "%Y-%m-%d",
    "decimal_separator": ".",
    "columns": {"date": 0, "description": 1, "amount": 2},
}


def account(api, name="Synthetic checking"):
    response = api.post("/api/accounts", json={"name": name, "type": "CHECKING", "currency": "BRL"})
    assert response.status_code == 201
    return response.json()["id"]


def upload(
    api,
    aid,
    content="date,description,amount\n2026-10-01,Fictional shop,-32.50\n",
    config=None,
    filename="synthetic.csv",
):
    raw = content.encode() if isinstance(content, str) else content
    response = api.post(
        "/api/imports",
        json={
            "filename": filename,
            "source_type": "OFX" if filename.endswith("ofx") else "CSV",
            "account_id": aid,
            "content_base64": base64.b64encode(raw).decode(),
            "configuration": config or CONFIG,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def confirm(api, batch, expected=200):
    response = api.post(
        f"/api/imports/{batch['id']}/confirm",
        json={"preview_token": batch["preview_token"] or "0" * 64, "account_confirmed": True},
    )
    assert response.status_code == expected, response.text
    return response.json()


def decide(api, batch, index, **data):
    response = api.patch(f"/api/imports/{batch['id']}/rows/{batch['rows'][index]['id']}", json=data)
    assert response.status_code == 200, response.text
    return response.json()


def test_preview_confirm_repeat_and_provenance(api, db_engine):
    aid = account(api)
    batch = upload(api, aid)
    assert batch["ready"] and batch["outgoing"] == "32.50"
    assert api.get("/api/transactions").json() == []
    result = confirm(api, batch)
    assert result["counts"]["imported"] == 1
    confirm(api, batch)
    repeated = upload(api, aid)
    assert repeated["rows"][0]["status"] == "EXACT_DUPLICATE"
    assert confirm(api, repeated)["counts"]["duplicate"] == 1
    rows = api.get("/api/transactions").json()
    assert len(rows) == 1 and rows[0]["review_status"] == "NEEDS_REVIEW"
    assert api.get(f"/api/accounts/{aid}").json()["balance"] == "-32.500000"
    with Session(db_engine) as session:
        sources = list(session.scalars(select(SourceRecord)))
        assert len(sources) == 2 and sources[0].transaction_id == sources[1].transaction_id


def test_possible_duplicates_require_explicit_decision_and_can_link(api):
    aid = account(api)
    original = confirm(api, upload(api, aid))["rows"][0]["transaction_id"]
    new = upload(api, aid, "date,description,amount\n2026-10-01,Other source shop,-32.50\n")
    assert new["rows"][0]["status"] == "POSSIBLE_DUPLICATE" and not new["ready"]
    confirm(api, new, 422)
    new = decide(api, new, 0, action="LINK", transaction_id=original)
    assert confirm(api, new)["counts"]["linked"] == 1
    assert len(api.get("/api/transactions").json()) == 1


def test_legitimate_same_day_twins_and_invalid_rows(api):
    batch = upload(
        api,
        account(api),
        "date,description,amount\n2026-10-01,Fictional coffee,-5\n"
        "2026-10-01,Fictional coffee,-5\n2026-02-31,Invalid,-4\n",
    )
    assert [r["status"] for r in batch["rows"]] == ["NEW", "POSSIBLE_DUPLICATE", "INVALID"]
    batch = decide(api, batch, 1, action="NEW")
    batch = decide(api, batch, 2, action="SKIP")
    result = confirm(api, batch)
    assert result["counts"]["imported"] == 2 and result["counts"]["error"] == 1


@pytest.mark.parametrize(
    "text,config,amount",
    [
        (
            "date;description;amount\n01/10/2026;Fictional store;R$ 1.250,90\n",
            {
                **CONFIG,
                "delimiter": ";",
                "date_format": "%d/%m/%Y",
                "decimal_separator": ",",
                "thousands_separator": ".",
            },
            "1250.90",
        ),
        (
            'date,description,amount\n10/01/2026,"Fictional, store","-1,250.90"\n',
            {**CONFIG, "date_format": "%m/%d/%Y", "thousands_separator": ","},
            "1250.90",
        ),
        (
            "2026-10-01;Fictional;12,45\n",
            {
                **CONFIG,
                "delimiter": ";",
                "has_header": False,
                "decimal_separator": ",",
                "amount_mode": "reversed",
            },
            "12.45",
        ),
        (
            "date,description,debit,credit\n2026-10-01,Fictional,10.123456,\n",
            {
                **CONFIG,
                "amount_mode": "debit_credit",
                "columns": {"date": 0, "description": 1, "debit": 2, "credit": 3},
            },
            "10.123456",
        ),
        (
            "date,description,amount,type\n2026-10-01,Fictional,10,D\n",
            {**CONFIG, "amount_mode": "type", "columns": {**CONFIG["columns"], "type": 3}},
            "10",
        ),
    ],
)
def test_csv_variants(api, text, config, amount):
    batch = upload(api, account(api), text, config)
    assert batch["rows"][0]["candidate"]["amount"] == amount
    assert batch["ready"]
    confirm(api, batch)


@pytest.mark.parametrize(
    "filename,config",
    [
        (
            "br-bom.csv",
            {**CONFIG, "delimiter": ";", "date_format": "%d/%m/%Y", "decimal_separator": ","},
        ),
        ("legacy.csv", {**CONFIG, "encoding": "cp1252"}),
    ],
)
def test_encodings(api, filename, config):
    batch = upload(api, account(api), (FIXTURES / filename).read_bytes(), config)
    assert batch["rows"][0]["candidate"]["description"] == "Fictional Café"


@pytest.mark.parametrize(
    "value", ["0", "NaN", "1e2", "1.234,50", "0.1234567", "1000000000000000000"]
)
def test_invalid_money_preserved(api, value):
    batch = upload(api, account(api), f'date,description,amount\n2026-10-01,Fictional,"{value}"\n')
    assert batch["rows"][0]["status"] == "INVALID"
    confirm(api, batch, 422)


def test_transfer_like_rows_need_ack_and_can_link_transfer(api):
    aid, other = account(api), account(api, "Synthetic savings")
    api.post(
        "/api/transfers",
        json={
            "source_account_id": aid,
            "destination_account_id": other,
            "amount": "500",
            "currency": "BRL",
            "transaction_date": "2026-10-01",
            "description": "Fictional transfer",
        },
    ).json()
    batch = upload(api, aid, "date,description,amount\n2026-10-01,Transfer payment,-500\n")
    assert batch["rows"][0]["candidate"]["ambiguity"] and not batch["ready"]
    batch = decide(
        api,
        batch,
        0,
        action="LINK",
        transaction_id=api.get(f"/api/transactions?account_id={aid}").json()[0]["id"],
    )
    confirm(api, batch)
    totals = api.get("/api/dashboard?month=2026-10").json()["totals"][0]
    assert totals["income"] == totals["expenses"] == "0"


@pytest.mark.parametrize("filename", ["bank-sgml.ofx", "bank-xml.ofx"])
def test_ofx_identity_and_account_scope(api, filename):
    aid = account(api)
    raw = (FIXTURES / filename).read_bytes()
    first = upload(api, aid, raw, filename=filename)
    assert first["rows"][0]["candidate"]["amount"] == "32.50"
    assert first["source_context"]["account_hint"].endswith("0001")
    assert "SYNTHETIC-0001" not in str(first["source_context"])
    confirm(api, first)
    repeat = upload(
        api, aid, raw.replace(b"SYNTHETIC SHOP", b"SYNTHETIC UPDATED"), filename=filename
    )
    assert repeat["rows"][0]["status"] == "EXACT_DUPLICATE"
    confirm(api, repeat)
    different = upload(api, account(api, "Other synthetic"), raw, filename=filename)
    assert different["rows"][0]["status"] == "NEW"
    confirm(api, different)


def test_rule_preview_manual_override_and_schedule(api):
    aid = account(api)
    payee = api.post("/api/payees", json={"name": "Fictional Netflix"}).json()["id"]
    cat = api.post("/api/categories", json={"name": "Synthetic subscriptions"}).json()["id"]
    rule = {
        "name": "Synthetic rule",
        "enabled": True,
        "priority": 10,
        "match_mode": "ALL",
        "conditions": [{"field": "description", "operator": "contains", "value": "NETFLIX"}],
        "actions": {"payee_id": payee, "category_id": cat},
    }
    assert api.post("/api/rules", json=rule).status_code == 201
    schedule = api.post(
        "/api/schedules",
        json={
            "name": "Synthetic Netflix",
            "description": "Netflix",
            "account_id": aid,
            "currency": "BRL",
            "transaction_type": "EXPENSE",
            "amount": "55",
            "frequency": "MONTHLY",
            "start_date": "2026-10-07",
            "payee_id": payee,
        },
    ).json()
    batch = upload(api, aid, "date,description,amount\n2026-10-07,NETFLIX.COM,-55\n")
    assert batch["rows"][0]["candidate"]["payee_id"] == payee
    assert batch["rows"][0]["schedules"][0]["schedule_id"] == schedule["id"]
    assert api.get("/api/transactions").json() == []
    batch = decide(
        api,
        batch,
        0,
        action="NEW",
        category_id=None,
        acknowledge_classification=True,
        schedule_id=schedule["id"],
        due_date="2026-10-07",
    )
    confirm(api, batch)
    row = api.get("/api/transactions").json()[0]
    assert row["category_id"] is None and row["payee_id"] == payee
    assert "category_id" in row["manual_fields"] and "payee_id" not in row["manual_fields"]


def test_stale_preview_and_atomic_rollback(api, db_engine, monkeypatch):
    aid = account(api)
    batch = upload(api, aid, "date,description,amount\n2026-10-01,First,-1\n2026-10-02,Second,-2\n")
    from app import ledger

    real_create = ledger.create_transaction
    calls = 0

    def failing(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            from fastapi import HTTPException

            raise HTTPException(409, "Synthetic failure")
        return real_create(*args, **kwargs)

    monkeypatch.setattr(ledger, "create_transaction", failing)
    confirm(api, batch, 409)
    with Session(db_engine) as session:
        assert list(session.scalars(select(Transaction))) == []
        assert all(s.transaction_id is None for s in session.scalars(select(SourceRecord)))
    monkeypatch.setattr(ledger, "create_transaction", real_create)
    changed = decide(api, batch, 0, action="SKIP")
    confirm(api, batch, 409)
    assert confirm(api, changed)["counts"]["imported"] == 1


def test_profiles_and_input_validation(api):
    aid = account(api)
    profile = api.post(
        "/api/imports/profiles",
        json={"name": "Synthetic", "configuration": CONFIG, "default_account_id": aid},
    )
    assert profile.status_code == 201
    pid = profile.json()["id"]
    assert (
        api.put(
            f"/api/imports/profiles/{pid}", json={"name": "Renamed", "configuration": CONFIG}
        ).status_code
        == 200
    )
    assert api.get("/api/imports/profiles").json()[0]["name"] == "Renamed"
    assert api.delete(f"/api/imports/profiles/{pid}").status_code == 204
    invalid = {**CONFIG, "columns": {"date": 0, "description": 0, "amount": 2}}
    assert (
        api.post(
            "/api/imports/profiles", json={"name": "Invalid", "configuration": invalid}
        ).status_code
        == 422
    )
    response = api.post(
        "/api/imports",
        json={
            "account_id": aid,
            "filename": "fake.ofx",
            "source_type": "OFX",
            "content_base64": base64.b64encode(b"not OFX").decode(),
        },
    )
    assert response.status_code == 422


def test_external_identity_conflict_and_fks(api, db_engine):
    aid = account(api)
    config = {
        **CONFIG,
        "source_namespace": "fictional-bank",
        "columns": {**CONFIG["columns"], "external_id": 3},
    }
    first = upload(api, aid, "date,description,amount,id\n2026-10-01,Fictional,-2,id-1\n", config)
    confirm(api, first)
    changed = upload(api, aid, "date,description,amount,id\n2026-10-01,Fictional,-3,id-1\n", config)
    assert changed["rows"][0]["status"] == "INVALID"
    confirm(api, changed, 422)
    with Session(db_engine) as session:
        source = session.get(SourceRecord, UUID(first["rows"][0]["id"]))
        assert source.external_claim is not None
