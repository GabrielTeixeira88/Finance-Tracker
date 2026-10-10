import base64
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_ingestion import CONFIG, FIXTURES, account, confirm, decide, upload

from app.models import SourceRecord


@pytest.mark.parametrize(
    "content,source,filename",
    [
        (b'date,description,amount\n2026-10-01,"unfinished,-2\n', "CSV", "synthetic.csv"),
        (b"<notofx/>", "OFX", "synthetic.ofx"),
        (b"<!DOCTYPE OFX><!ENTITY x 'bad'>", "OFX", "synthetic.ofx"),
        (b"binary\x00content", "CSV", "synthetic.csv"),
        (b"date,description,amount", "CSV", "synthetic.exe"),
        (b"a" * (2 * 1024 * 1024 + 1), "CSV", "synthetic.csv"),
    ],
    ids=["unclosed-quote", "malformed-ofx", "entities", "binary", "extension", "oversize"],
)
def test_rejected_files_do_not_persist(api, content, source, filename):
    response = api.post(
        "/api/imports",
        json={
            "account_id": account(api),
            "filename": filename,
            "source_type": source,
            "configuration": CONFIG,
            "content_base64": base64.b64encode(content).decode(),
        },
    )
    assert response.status_code in {413, 422}
    assert api.get("/api/imports").json() == []


def test_multi_account_ofx_and_malformed_xml_rejected(api):
    raw = (FIXTURES / "bank-xml.ofx").read_bytes()
    aid = account(api)
    for content in [
        raw.replace(b"</STMTTRNRS>", b"</STMTTRNRS><STMTTRNRS><STMTRS/></STMTTRNRS>"),
        raw.replace(b"</NAME>", b""),
    ]:
        response = api.post(
            "/api/imports",
            json={
                "account_id": aid,
                "filename": "synthetic.ofx",
                "source_type": "OFX",
                "content_base64": base64.b64encode(content).decode(),
            },
        )
        assert response.status_code == 422


def test_repeated_fitid_inside_file_and_currency_validation(api):
    raw = (FIXTURES / "bank-xml.ofx").read_bytes()
    entry = raw[raw.index(b"<STMTTRN>") : raw.index(b"</STMTTRN>") + len(b"</STMTTRN>")]
    batch = upload(
        api,
        account(api),
        raw.replace(b"</BANKTRANLIST>", entry + b"</BANKTRANLIST>"),
        filename="synthetic.ofx",
    )
    assert [r["status"] for r in batch["rows"]] == ["NEW", "EXACT_DUPLICATE"]
    result = confirm(api, batch)
    assert result["counts"]["imported"] == result["counts"]["duplicate"] == 1
    mismatch = upload(
        api,
        account(api, "Other"),
        raw.replace(b"<CURDEF>BRL", b"<CURDEF>USD"),
        filename="synthetic.ofx",
    )
    assert mismatch["rows"][0]["status"] == "INVALID"


def test_uniqueness_foreign_keys_and_deleted_transaction_reimport(api, db_engine):
    batch = confirm(api, upload(api, account(api)))
    transaction = batch["rows"][0]["transaction_id"]
    assert api.delete(f"/api/transactions/{transaction}").status_code == 204
    repeated = upload(api, batch["account_id"])
    assert repeated["rows"][0]["status"] == "EXACT_DUPLICATE"
    confirm(api, repeated)
    assert api.get("/api/transactions").json() == []
    with Session(db_engine) as session:
        source = session.scalar(select(SourceRecord).where(SourceRecord.file_claim.is_not(None)))
        other = session.scalar(select(SourceRecord).where(SourceRecord.file_claim.is_(None)))
        other.file_claim = source.file_claim
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
        other = session.scalar(select(SourceRecord).where(SourceRecord.file_claim.is_(None)))
        other.transaction_id = uuid4()
        with pytest.raises(IntegrityError):
            session.commit()


def test_concurrent_drafts_and_explicit_skip_then_retry(api):
    aid = account(api)
    first, second = upload(api, aid), upload(api, aid)
    confirm(api, first)
    confirm(api, second, 409)
    refreshed = api.get(f"/api/imports/{second['id']}").json()
    confirm(api, refreshed)
    assert len(api.get("/api/transactions").json()) == 1
    separate = upload(api, aid, "date,description,amount\n2026-10-02,Another,-7\n")
    confirm(api, decide(api, separate, 0, action="SKIP"))
    retry = upload(api, aid, "date,description,amount\n2026-10-02,Another,-7\n")
    assert retry["rows"][0]["status"] == "NEW"


def test_wrong_link_and_inactive_account_cannot_post(api):
    aid = account(api)
    batch = upload(api, aid)
    wrong = decide(api, batch, 0, action="LINK", transaction_id=str(uuid4()))
    confirm(api, wrong, 422)
    api.delete(f"/api/accounts/{aid}")
    new = decide(api, batch, 0, action="NEW")
    assert not new["ready"]
    confirm(api, new, 422)


def test_new_file_observation_keeps_identity_when_profile_changes(api):
    aid = account(api)
    config = {
        **CONFIG,
        "source_namespace": "synthetic-bank",
        "columns": {**CONFIG["columns"], "external_id": 3},
    }
    first = upload(
        api, aid, "date,description,amount,id\n2026-10-01,First,-2,synthetic-1\n", config
    )
    confirm(api, first)
    content = "date,description,amount,id\n2026-10-01,New export,-2,synthetic-1\n"
    observation = upload(api, aid, content, config)
    assert confirm(api, observation)["counts"]["duplicate"] == 1
    changed = upload(api, aid, content, {**config, "source_namespace": ""})
    assert changed["rows"][0]["status"] == "EXACT_DUPLICATE"


def test_rule_priority_payee_resolution_and_manual_override(api):
    aid = account(api)
    payee = api.post("/api/payees", json={"name": "Fictional Shop"}).json()["id"]
    other = api.post("/api/payees", json={"name": "Other Fictional"}).json()["id"]
    for priority, status in [(10, "NEEDS_REVIEW"), (1, "REVIEWED")]:
        assert (
            api.post(
                "/api/rules",
                json={
                    "name": f"Synthetic rule {priority}",
                    "enabled": True,
                    "priority": priority,
                    "match_mode": "ALL",
                    "conditions": [
                        {"field": "description", "operator": "contains", "value": "fictional"}
                    ],
                    "actions": {"review_status": status},
                },
            ).status_code
            == 201
        )
    batch = upload(api, aid)
    assert batch["rows"][0]["candidate"]["payee_id"] == payee
    assert batch["rows"][0]["candidate"]["review_status"] == "REVIEWED"
    batch = decide(api, batch, 0, action="NEW", payee_id=other, review_status="NEEDS_REVIEW")
    result = confirm(api, batch)
    assert result["rows"][0]["candidate"]["payee_id"] == other
    row = api.get("/api/transactions").json()[0]
    assert row["payee_id"] == other and row["review_status"] == "NEEDS_REVIEW"


def test_deleted_draft_category_can_be_skipped(api):
    batch = upload(api, account(api))
    category = api.post("/api/categories", json={"name": "Synthetic temporary"}).json()["id"]
    batch = decide(api, batch, 0, action="NEW", category_id=category)
    assert api.delete(f"/api/categories/{category}").status_code == 204
    batch = api.get(f"/api/imports/{batch['id']}").json()
    assert batch["rows"][0]["status"] == "INVALID"
    batch = decide(api, batch, 0, action="SKIP")
    assert confirm(api, batch)["counts"]["skipped"] == 1


def test_currency_symbol_cannot_silently_change_currency(api):
    batch = upload(api, account(api), "date,description,amount\n2026-10-01,Synthetic,US$ 25.00\n")
    assert batch["rows"][0]["status"] == "INVALID"
