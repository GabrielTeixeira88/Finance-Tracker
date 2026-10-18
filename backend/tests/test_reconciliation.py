from uuid import uuid4

import pytest
from test_ingestion import confirm, decide, upload
from test_ledger import account, entry


def command(**values):
    return {"request_id": str(uuid4()), **values}


def clear(api, id, **values):
    return api.post(f"/api/transactions/{id}/clearing", json=command(cleared=True, **values))


def statement(api, aid, balance, cutoff="2026-10-31"):
    result = api.post(
        "/api/reconciliation/sessions",
        json=command(
            account_id=aid,
            cutoff=cutoff,
            ending_balance=balance,
        ),
    )
    assert result.status_code == 200, result.text
    return result.json()


def transition(api, value, action="COMPLETE"):
    return api.post(
        f"/api/reconciliation/sessions/{value['id']}",
        json=command(
            action=action,
            token=value["token"],
            reason="Synthetic statement verification",
        ),
    )


def test_cross_date_sources_preserve_one_posting_and_manual_metadata(api):
    acct = account(api)
    first = confirm(
        api, upload(api, acct["id"], "date,description,amount\n2026-10-10,Fake grocery,-85\n")
    )
    tid = first["rows"][0]["transaction_id"]
    category = api.post("/api/categories", json={"name": "Synthetic groceries"}).json()
    api.patch(
        f"/api/transactions/{tid}",
        json={"category_id": category["id"], "review_status": "REVIEWED"},
    )
    incoming = upload(
        api, acct["id"], "date,description,amount\n2026-10-11,SUPERMERCADO FAKE,-85\n"
    )
    assert incoming["rows"][0]["status"] == "POSSIBLE_DUPLICATE"
    assert "Dates 1 day(s) apart" in incoming["rows"][0]["matches"][0]["evidence"]
    incoming = decide(api, incoming, 0, action="LINK", transaction_id=tid)
    linked = confirm(api, incoming)
    assert api.get(f"/api/transactions/{tid}").json()["category_id"] == category["id"]
    assert len(api.get("/api/transactions").json()) == 1
    source_id = linked["rows"][0]["id"]
    assert clear(api, tid, source_id=source_id).status_code == 200
    s = statement(api, acct["id"], "-85")
    completed = transition(api, s)
    assert completed.status_code == 200, completed.text
    assert api.delete(f"/api/transactions/{tid}").status_code == 409
    assert (
        api.patch(f"/api/transactions/{tid}", json={"review_status": "NEEDS_REVIEW"}).status_code
        == 409
    )
    assert len(api.get(f"/api/transactions/{tid}/sources").json()["sources"]) == 2
    assert transition(api, completed.json(), "REOPEN").status_code == 200
    view = next(v for v in api.get("/api/reconciliation/candidates").json() if v["id"] == source_id)
    body = command(action="UNLINK", token=view["token"], reason="Wrong synthetic source")
    response = api.post(f"/api/reconciliation/sources/{source_id}", json=body)
    assert response.status_code == 200, response.text
    assert api.post(f"/api/reconciliation/sources/{source_id}", json=body).status_code == 200
    repeated = upload(
        api, acct["id"], "date,description,amount\n2026-10-11,SUPERMERCADO FAKE,-85\n"
    )
    assert repeated["rows"][0]["status"] == "INVALID"
    assert len(api.get("/api/transactions").json()) == 1


def test_statement_exact_cutoff_openings_future_and_cascade(api):
    acct = account(api, opening="5000")
    expense = entry(api, acct).json()
    entry(api, acct, "INCOME", "1000")
    entry(api, acct, "INCOME", "777", transaction_date="2026-12-01")
    for row in api.get("/api/transactions?date_to=2026-10-31").json():
        assert clear(api, row["id"]).status_code == 200
    wrong = statement(api, acct["id"], "5800.000001")
    assert transition(api, wrong).status_code == 409
    first = transition(api, statement(api, acct["id"], "5800"))
    assert first.status_code == 200, first.text
    second = transition(api, statement(api, acct["id"], "5800", "2026-11-30"))
    assert second.status_code == 200, second.text
    assert entry(api, acct, amount="5").status_code == 409
    fresh = next(
        s for s in api.get("/api/reconciliation/sessions").json() if s["id"] == first.json()["id"]
    )
    assert transition(api, fresh, "REOPEN").status_code == 200
    assert clear(api, expense["id"]).status_code == 200
    sessions = api.get("/api/reconciliation/sessions").json()
    assert sum(s["status"] == "REOPENED" for s in sessions) == 2


def test_credit_card_liability_and_clear_idempotency(api):
    acct = account(api, type="CREDIT_CARD")
    row = entry(api, acct, amount="123.000001").json()
    body = command(cleared=True)
    url = f"/api/transactions/{row['id']}/clearing"
    assert api.post(url, json=body).status_code == 200
    assert api.post(url, json=body).status_code == 200
    assert api.post(url, json={**body, "cleared": False}).status_code == 409
    assert transition(api, statement(api, acct["id"], "-123.000001")).status_code == 200
    assert (
        len(
            [
                r
                for r in api.get("/api/reconciliation/history").json()
                if r["action"] == "CLEARING_CHANGED"
            ]
        )
        == 1
    )


def test_safe_merge_keeps_metadata_and_retries_once(api):
    acct = account(api)
    one, two = entry(api, acct).json(), entry(api, acct).json()
    url = f"/api/reconciliation/merge-preview?survivor_id={one['id']}&duplicate_id={two['id']}"
    view = api.get(url).json()
    assert view["balance_change"] == "200.000000" and not view["blockers"]
    body = command(survivor_id=one["id"], duplicate_id=two["id"], token=view["token"])
    response = api.post("/api/reconciliation/merge", json=body)
    assert response.status_code == 200, response.text
    assert api.post("/api/reconciliation/merge", json=body).status_code == 200
    assert len(api.get("/api/transactions").json()) == 1
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "-200.000000"


def test_amount_conflict_requires_explicit_separate_decision(api):
    acct = account(api)
    entry(api, acct, amount="100", description="Synthetic grocery")
    batch = upload(api, acct["id"], "date,description,amount\n2026-10-05,Synthetic grocery,-98\n")
    assert batch["rows"][0]["status"] == "CONFLICT"
    assert not batch["ready"]
    batch = decide(api, batch, 0, action="NEW")
    assert not batch["ready"]
    batch = decide(api, batch, 0, action="NEW", acknowledge_classification=True)
    confirm(api, batch)
    assert len(api.get("/api/transactions").json()) == 2


@pytest.mark.parametrize("different", ["account", "direction", "date"])
def test_incompatible_records_never_match(api, different):
    acct = account(api)
    other = account(api, name="Other synthetic account") if different == "account" else acct
    entry(
        api,
        other,
        "INCOME" if different == "direction" else "EXPENSE",
        "85",
        transaction_date="2026-09-01" if different == "date" else "2026-10-10",
    )
    batch = upload(api, acct["id"], "date,description,amount\n2026-10-11,Fake shop,-85\n")
    assert batch["rows"][0]["status"] == "NEW"


def test_competing_matches_and_stale_preview(api):
    acct = account(api)
    entry(api, acct, amount="85", transaction_date="2026-10-10")
    entry(api, acct, amount="85", transaction_date="2026-10-11")
    batch = upload(api, acct["id"], "date,description,amount\n2026-10-11,Fake shop,-85\n")
    assert len(batch["rows"][0]["matches"]) == 2 and not batch["ready"]
    view = api.get("/api/reconciliation/candidates").json()[0]
    body = command(action="DISMISS", token=view["token"], reason="Separate events")
    assert api.post(f"/api/reconciliation/sources/{view['id']}", json=body).status_code == 200
    assert (
        api.post(
            f"/api/reconciliation/sources/{view['id']}", json={**body, "request_id": str(uuid4())}
        ).status_code
        == 409
    )
    view = api.get("/api/reconciliation/candidates").json()[0]
    assert (
        api.post(
            f"/api/reconciliation/sources/{view['id']}",
            json=command(action="REOPEN", token=view["token"], reason="Inspect again"),
        ).status_code
        == 200
    )


def test_transfer_and_card_payment_reconcile_without_spending_twice(api):
    checking = account(api, opening="5000")
    savings = account(api, name="Savings", opening="2000")
    entry(api, checking, amount="200")
    entry(api, checking, "INCOME", "1000")
    response = api.post(
        "/api/transfers",
        json={
            "source_account_id": checking["id"],
            "destination_account_id": savings["id"],
            "amount": "500",
            "currency": "BRL",
            "transaction_date": "2026-10-04",
        },
    )
    assert response.status_code == 201
    for acct, expected in [(checking, "5300"), (savings, "2500")]:
        for row in api.get(f"/api/transactions?account_id={acct['id']}").json():
            assert clear(api, row["id"]).status_code == 200
        assert transition(api, statement(api, acct["id"], expected)).status_code == 200
        assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == expected + ".000000"
    total = api.get("/api/dashboard?month=2026-10").json()["totals"][0]
    assert total["income"] == "1000.000000" and total["expenses"] == "200.000000"


def test_foreign_keys_immutable_audit_and_statement_lock(db_engine, api):
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    acct = account(api)
    row = entry(api, acct).json()
    assert clear(api, row["id"]).status_code == 200
    assert transition(api, statement(api, acct["id"], "-200")).status_code == 200
    for sql in ["DELETE FROM reconciliation_audits", "UPDATE transactions SET description='wrong'"]:
        with pytest.raises(IntegrityError), db_engine.begin() as connection:
            connection.execute(text(sql))


def test_v08_populated_migration_preserves_old_records(tmp_path):
    from alembic import command as migration
    from sqlalchemy.orm import Session
    from test_analytics_migration_demo import config_for
    from test_budget_migration_demo import snapshot

    from app.database import make_engine
    from app.seed_analytics_demo import seed_analytics_demo

    config = config_for(tmp_path / "synthetic-v08.db")
    migration.upgrade(config, "sqlite_0010")
    engine = make_engine(config.attributes["database_url"])
    with Session(engine) as session, session.begin():
        seed_analytics_demo(session)
    from datetime import date

    from sqlalchemy import select
    from test_gmail import Google, Vault, sync

    from app.config import Settings
    from app.gmail_routes import Configuration
    from app.gmail_service import GmailService, connection, write
    from app.models import FinancialAccount

    service = GmailService(engine, Settings(_env_file=None), Google(), Vault())
    with write(engine) as session:
        row = connection(session)
        row.mailbox, row.status = "synthetic@example.invalid", "CONNECTED"
        aid = session.scalar(select(FinancialAccount.id).where(FinancialAccount.type == "CHECKING"))
    service.configure(
        Configuration(
            label_id="Label_demo", account_id=aid, start=date(2026, 10, 1), end=date(2026, 10, 2)
        )
    )
    assert sync(service)[0] == "COMPLETED"
    service.stop.set()
    before = snapshot(engine)
    assert len(before["gmail_message_claims"]) == 1
    engine.dispose()
    migration.upgrade(config, "head")
    migration.check(config)
    after = snapshot(engine)
    assert all(after[table] == values for table, values in before.items())
    assert not after["reconciliation_statements"]
    engine.dispose()


def test_gmail_then_ofx_statement_and_repeated_sources(api, db_engine):
    from datetime import date

    from test_gmail import BODY, HEADERS, Google, Vault, message, queue, sync
    from test_ingestion import FIXTURES

    from app.config import Settings
    from app.gmail_routes import Configuration, get_service
    from app.gmail_service import GmailService, connection, write
    from app.main import app

    acct = account(api)
    google = Google()
    google.messages = {"m1": message(body=BODY.replace("01/10/2026", "10/10/2026"))}
    service = GmailService(db_engine, Settings(_env_file=None), google, Vault())
    with write(db_engine) as session:
        row = connection(session)
        row.mailbox, row.status = "synthetic@example.invalid", "CONNECTED"
    service.configure(
        Configuration(
            label_id="Label_demo",
            account_id=acct["id"],
            start=date(2026, 10, 10),
            end=date(2026, 10, 11),
        )
    )
    app.dependency_overrides[get_service] = lambda: service
    try:
        assert sync(service)[0] == "COMPLETED"
        batch = queue(api)[0]
        payload = {"items": [{"batch_id": batch["id"], "preview_token": batch["preview_token"]}]}
        assert api.post("/api/gmail/approve", json=payload, headers=HEADERS).status_code == 200
        tid = api.get("/api/transactions").json()[0]["id"]
        assert api.get(f"/api/transactions/{tid}/sources").json()["clearing_status"] == "UNCLEARED"
        raw = (
            (FIXTURES / "bank-sgml.ofx")
            .read_text()
            .replace("20261001120000", "20261011120000")
            .replace("-32.50", "-85.00")
            .replace("SYNTHETIC SHOP", "SUPERMERCADO SYNTHETIC")
        )
        imported = upload(api, acct["id"], raw, filename="synthetic.ofx")
        assert imported["rows"][0]["status"] == "POSSIBLE_DUPLICATE"
        imported = decide(api, imported, 0, action="LINK", transaction_id=tid)
        linked = confirm(api, imported)
        assert clear(api, tid, source_id=linked["rows"][0]["id"]).status_code == 200
        completed = transition(api, statement(api, acct["id"], "-85"))
        assert completed.status_code == 200, completed.text
        repeat = upload(api, acct["id"], raw, filename="synthetic.ofx")
        assert confirm(api, repeat)["counts"]["duplicate"] == 1
        assert sync(service)[0] == "COMPLETED"
        assert api.post("/api/gmail/approve", json=payload, headers=HEADERS).status_code == 200
        assert len(api.get("/api/transactions").json()) == 1
        assert (
            api.get("/api/dashboard?month=2026-10").json()["totals"][0]["expenses"] == "85.000000"
        )
        assert api.get(f"/api/transactions/{tid}/sources").json()["clearing_status"] == "RECONCILED"
    finally:
        app.dependency_overrides.pop(get_service, None)
        service.stop.set()


def test_reassign_source_is_atomic_and_preserves_metadata(api, monkeypatch):
    from fastapi import HTTPException

    from app import reconciliation

    acct = account(api)
    first = confirm(api, upload(api, acct["id"]))
    source_id = first["rows"][0]["id"]
    original = first["rows"][0]["transaction_id"]
    target = entry(
        api,
        acct,
        amount="32.50",
        transaction_date="2026-10-02",
        description="Explicit synthetic survivor",
    ).json()
    view = next(
        row for row in api.get("/api/reconciliation/candidates").json() if row["id"] == source_id
    )
    body = command(
        action="LINK",
        token=view["token"],
        reason="Verified same synthetic event",
        transaction_id=target["id"],
    )
    original_audit = reconciliation.audit

    def fail(*args, **kwargs):
        raise HTTPException(503, "Synthetic rollback")

    monkeypatch.setattr(reconciliation, "audit", fail)
    assert api.post(f"/api/reconciliation/sources/{source_id}", json=body).status_code == 503
    assert api.get(f"/api/transactions/{original}/sources").json()["source_count"] == 1
    monkeypatch.setattr(reconciliation, "audit", original_audit)
    assert api.post(f"/api/reconciliation/sources/{source_id}", json=body).status_code == 200
    assert api.post(f"/api/reconciliation/sources/{source_id}", json=body).status_code == 200
    assert api.get(f"/api/transactions/{target['id']}/sources").json()["source_count"] == 1
    assert (
        api.get(f"/api/transactions/{target['id']}").json()["description"]
        == "Explicit synthetic survivor"
    )
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "-65.000000"


def test_rejected_proposal_does_not_reappear_in_import_or_automatically_post(api):
    acct = account(api)
    row = entry(api, acct, amount="85", transaction_date="2026-10-10").json()
    batch = upload(api, acct["id"], "date,description,amount\n2026-10-11,Fake store,-85\n")
    view = api.get("/api/reconciliation/candidates").json()[0]
    response = api.post(
        f"/api/reconciliation/sources/{view['id']}",
        json=command(
            action="REJECT",
            token=view["token"],
            transaction_id=row["id"],
            reason="Two real synthetic purchases",
        ),
    )
    assert response.status_code == 200, response.text
    refreshed = api.get(f"/api/imports/{batch['id']}").json()
    assert not refreshed["ready"] and refreshed["rows"][0]["matches"] == []
    assert len(api.get("/api/transactions").json()) == 1


def test_merge_failure_rolls_back_provenance_and_ledger(api, monkeypatch):
    from fastapi import HTTPException

    from app import reconciliation

    acct = account(api)
    original = confirm(api, upload(api, acct["id"]))["rows"][0]["transaction_id"]
    duplicate = entry(api, acct, amount="32.50", transaction_date="2026-10-01").json()["id"]
    shown = api.get(
        f"/api/reconciliation/merge-preview?survivor_id={duplicate}&duplicate_id={original}"
    ).json()

    def fail(*args, **kwargs):
        raise HTTPException(503, "Synthetic interruption")

    monkeypatch.setattr(reconciliation, "audit", fail)
    result = api.post(
        "/api/reconciliation/merge",
        json=command(survivor_id=duplicate, duplicate_id=original, token=shown["token"]),
    )
    assert result.status_code == 503
    assert len(api.get("/api/transactions").json()) == 2
    assert api.get(f"/api/transactions/{original}/sources").json()["source_count"] == 1


def test_pending_bank_source_blocks_statement_but_explicit_skip_resolves(api):
    acct = account(api)
    batch = upload(api, acct["id"])
    shown = statement(api, acct["id"], "0")
    assert shown["pending_source_ids"]
    assert transition(api, shown).status_code == 409
    decide(api, batch, 0, action="SKIP")
    refreshed = api.get("/api/reconciliation/sessions").json()[0]
    assert not refreshed["pending_source_ids"]
    assert transition(api, refreshed).status_code == 200


def test_same_request_key_cannot_target_a_different_transaction(api):
    acct = account(api)
    first, second = entry(api, acct).json(), entry(api, acct).json()
    body = command(cleared=True)
    assert api.post(f"/api/transactions/{first['id']}/clearing", json=body).status_code == 200
    assert api.post(f"/api/transactions/{second['id']}/clearing", json=body).status_code == 409
    assert api.get("/api/transactions?clearing_status=CLEARED").json()[0]["id"] == first["id"]
    assert api.get("/api/transactions?clearing_status=UNCLEARED").json()[0]["id"] == second["id"]


def test_financial_correction_invalidates_clearing_but_metadata_does_not(api):
    acct = account(api)
    row = entry(api, acct).json()
    assert clear(api, row["id"]).status_code == 200
    assert (
        api.patch(
            f"/api/transactions/{row['id']}", json={"review_status": "NEEDS_REVIEW"}
        ).status_code
        == 200
    )
    assert api.get(f"/api/transactions/{row['id']}/sources").json()["clearing_status"] == "CLEARED"
    response = api.put(
        f"/api/transactions/{row['id']}",
        json={
            "amount": "199",
            "transaction_type": "EXPENSE",
            "transaction_date": "2026-10-04",
            "description": "Corrected synthetic entry",
        },
    )
    assert response.status_code == 200, response.text
    assert (
        api.get(f"/api/transactions/{row['id']}/sources").json()["clearing_status"] == "UNCLEARED"
    )
    assert any(
        row["action"] == "CLEARING_INVALIDATED"
        for row in api.get("/api/reconciliation/history").json()
    )


def test_later_bank_posting_does_not_change_completed_cutoff(api):
    acct = account(api)
    row = entry(api, acct, amount="85", transaction_date="2026-10-31").json()
    october = transition(api, statement(api, acct["id"], "0"))
    assert october.status_code == 200, october.text
    assert clear(api, row["id"]).status_code == 409
    assert clear(api, row["id"], bank_date="2026-11-01").status_code == 200
    historical = next(
        s for s in api.get("/api/reconciliation/sessions").json() if s["id"] == october.json()["id"]
    )
    assert historical["difference"] == "0.000000"
    assert row["id"] in historical["settlement_after_cutoff_ids"]
    assert transition(api, statement(api, acct["id"], "-85", "2026-11-30")).status_code == 200


def test_identical_legitimate_purchases_require_explicit_keep_separate(api, db_engine):
    acct = account(api)
    raw = "date,description,amount\n2026-10-10,Synthetic same merchant,-85\n"
    first = confirm(api, upload(api, acct["id"], raw))
    # A second distinct source row, despite identical financial fields, is not proof.
    batch = upload(api, acct["id"], raw.rstrip() + "\n2026-10-10,Synthetic same merchant,-85\n")
    assert batch["rows"][1]["status"] == "POSSIBLE_DUPLICATE"
    assert not batch["ready"]
    batch = decide(api, batch, 0, action="LINK", transaction_id=first["rows"][0]["transaction_id"])
    batch = decide(api, batch, 1, action="NEW")
    confirm(api, batch)
    assert len(api.get("/api/transactions").json()) == 2
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "-170.000000"
    # Recreate physical connections: durable claims, not in-memory state, prevent repeats.
    db_engine.dispose()
    repeated = upload(api, acct["id"], raw.rstrip() + "\n2026-10-10,Synthetic same merchant,-85\n")
    assert confirm(api, repeated)["counts"]["duplicate"] == 2
    assert len(api.get("/api/transactions").json()) == 2


def test_statement_fifty_difference_correct_recomplete_and_durable_audit(api, db_engine):
    acct = account(api, opening="5250")
    opening = api.get("/api/transactions").json()[0]
    assert clear(api, opening["id"]).status_code == 200
    value = statement(api, acct["id"], "5300")
    assert value["difference"] == "50.000000"
    assert transition(api, value).status_code == 409
    missing = entry(api, acct, "INCOME", "50").json()
    assert clear(api, missing["id"]).status_code == 200
    current = api.get("/api/reconciliation/sessions").json()[0]
    completed = transition(api, current)
    assert completed.status_code == 200
    reopened = transition(api, completed.json(), "REOPEN")
    assert reopened.status_code == 200
    assert transition(api, reopened.json()).status_code == 200
    db_engine.dispose()
    history = api.get("/api/reconciliation/history").json()
    assert sum(r["action"] == "STATEMENT_COMPLETE" for r in history) == 2
    assert any(r["action"] == "STATEMENT_REOPEN" for r in history)
    assert api.get("/api/reconciliation/sessions").json()[0]["difference"] == "0.000000"


def test_duplicate_correction_recalculates_budget_and_cash_flow(api):
    from decimal import Decimal

    from test_budgets import category, report, row, target

    acct, cat = account(api), category(api)
    target(api, cat, month="2026-10")
    first = entry(api, acct, category_id=cat).json()
    second = entry(api, acct, category_id=cat).json()
    assert Decimal(row(report(api, month="2026-10"), cat)["spent"]) == Decimal("400")
    view = api.get(
        f"/api/reconciliation/merge-preview?survivor_id={first['id']}&duplicate_id={second['id']}"
    ).json()
    result = api.post(
        "/api/reconciliation/merge",
        json=command(survivor_id=first["id"], duplicate_id=second["id"], token=view["token"]),
    )
    assert result.status_code == 200
    assert Decimal(row(report(api, month="2026-10"), cat)["spent"]) == Decimal("200")
    totals = api.get("/api/dashboard?month=2026-10").json()["totals"][0]
    assert totals["expenses"] == "200.000000"
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "-200.000000"


def test_patch_date_correction_requires_fresh_clearing(api):
    acct = account(api)
    row = entry(api, acct).json()
    assert clear(api, row["id"]).status_code == 200
    response = api.patch(f"/api/transactions/{row['id']}", json={"transaction_date": "2026-10-05"})
    assert response.status_code == 200
    assert (
        api.get(f"/api/transactions/{row['id']}/sources").json()["clearing_status"] == "UNCLEARED"
    )
    assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == "-200.000000"
    assert clear(api, row["id"]).status_code == 200
    assert transition(api, statement(api, acct["id"], "-200")).status_code == 200
    assert (
        api.patch(
            f"/api/transactions/{row['id']}", json={"transaction_date": "2026-10-06"}
        ).status_code
        == 409
    )


def test_card_purchase_payment_and_each_bank_source_preserve_one_expense(api):
    from decimal import Decimal

    from test_ledger import transfer

    checking = account(api, opening="1000")
    card = account(api, name="Synthetic card", type="CREDIT_CARD")
    entry(api, card)
    payment = transfer(api, checking, card, amount="200").json()
    sides = {
        row["direction"]: row["id"]
        for row in api.get("/api/transactions?transaction_type=TRANSFER").json()
        if row["transfer_id"] == payment["id"]
    }
    for acct, amount, side in (
        (checking, "-200", sides["OUT"]),
        (card, "200", sides["IN"]),
    ):
        batch = upload(
            api,
            acct["id"],
            f"date,description,amount\n2026-10-04,Synthetic card payment,{amount}\n",
        )
        confirm(api, decide(api, batch, 0, action="LINK", transaction_id=side))
    for acct, expected in ((checking, "800"), (card, "0")):
        for row in api.get(f"/api/transactions?account_id={acct['id']}").json():
            assert clear(api, row["id"]).status_code == 200
        assert transition(api, statement(api, acct["id"], expected)).status_code == 200
        assert api.get(f"/api/accounts/{acct['id']}").json()["balance"] == expected + ".000000"
    totals = api.get("/api/dashboard?month=2026-10").json()["totals"][0]
    assert Decimal(totals["income"]) == Decimal("0")
    assert Decimal(totals["expenses"]) == Decimal("200")
