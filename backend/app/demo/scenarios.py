"""Synthetic sources use the real parsers, review and confirmation services."""

import base64
import json
from datetime import date
from uuid import UUID

from sqlalchemy import select

from app import ingestion, ledger, reconciliation, rules, schemas
from app.demo.seed import STAMP, identity
from app.gmail_models import GmailMessageClaim
from app.gmail_parsers import normalize_message, parse_message
from app.ingestion_schemas import Confirm, CSVConfiguration, Decision, Upload
from app.models import FinancialAccount, ImportBatch, SourceRecord, Transaction
from app.reconciliation_models import Statement
from app.reconciliation_routes import Clear, StatementChange, StatementCreate

CSV_CONFIG = CSVConfiguration(
    date_format="%Y-%m-%d",
    decimal_separator=".",
    columns={"date": 0, "description": 1, "amount": 2, "external_id": 3},
    source_namespace="synthetic-showcase",
)


def sample_files():
    """Generated text is explicitly fictional; no filesystem upload source is read."""
    return {
        "demo-checking.csv": (
            "date,description,amount,id\n"
            "2026-09-27,Synthetic Cedar grocery notification,-85,cedar-85\n"
            "2026-09-28,Synthetic new stationery,-18.75,new-stationery\n"
            "2026-09-25,Synthetic ambiguous cafe,-42,cafe-review\n"
        ),
        "demo-credit-card.csv": (
            "date,description,amount,id\n"
            "2026-09-28,Synthetic card purchase,-63.25,card-new\n"
            "2026-09-29,Synthetic refund requires linking,45.75,refund-review\n"
            "2026-09-03,Synthetic card payment transfer,1620,payment-review\n"
        ),
        "demo-checking.ofx": (
            "OFXHEADER:100\n"
            "DATA:OFXSGML\n"
            "VERSION:102\n"
            "SECURITY:NONE\n"
            "ENCODING:USASCII\n"
            "CHARSET:1252\n"
            "COMPRESSION:NONE\n"
            "OLDFILEUID:NONE\n"
            "NEWFILEUID:NONE\n"
            "\n"
            "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL\n"
            "<BANKACCTFROM><BANKID>FICTIONAL\n"
            "<ACCTID>SYNTHETIC-ONLY\n"
            "<ACCTTYPE>CHECKING\n"
            "</BANKACCTFROM><BANKTRANLIST><DTSTART>20260901\n"
            "<DTEND>20260930\n"
            "<STMTTRN><TRNTYPE>DEBIT\n"
            "<DTPOSTED>20260927120000\n"
            "<TRNAMT>-85.00\n"
            "<FITID>FICTIONAL-CEDAR-85\n"
            "<NAME>Synthetic Cedar grocery notification\n"
            "</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"
        ),
    }


def upload_sample(session, name):
    files = sample_files()
    if name not in files:
        raise ValueError("Unknown synthetic sample")
    account = session.scalar(
        select(FinancialAccount).where(
            FinancialAccount.name == ("Credit Card" if "credit-card" in name else "Checking")
        )
    )
    return ingestion.create_batch(
        session,
        Upload(
            filename=name,
            content_base64=base64.b64encode(files[name].encode()).decode(),
            source_type="OFX" if name.endswith(".ofx") else "CSV",
            account_id=account.id,
            configuration=None if name.endswith(".ofx") else CSV_CONFIG,
        ),
    )


def simulate_notification(session, message_id="showcase-notification-2"):
    """No Google service, vault, OAuth token, network call or connected status."""
    claim = rules.digest(["GMAIL", "fictional-alex@example.invalid", message_id])
    prior = session.scalar(select(GmailMessageClaim).where(GmailMessageClaim.identity == claim))
    if prior:
        return session.get(ImportBatch, session.get(SourceRecord, prior.source_id).import_batch_id)
    initial = message_id == "showcase-notification-1"
    body = (
        "SYNTHETIC BANK DEMO v1\n"
        f"Date: {'26' if initial else '30'}/09/2026\n"
        f"Amount: {'85,00' if initial else '47,20'}\n"
        "Currency: BRL\nKind: DEBIT_PURCHASE\n"
        "Description: Synthetic Cedar grocery notification"
        f"{' followup' if not initial else ''}\n"
        "Merchant: Fictional Cedar Market\n"
    )
    message = normalize_message(
        {
            "id": message_id,
            "threadId": "fictional-thread",
            "internalDate": "1790726400000",
            "payload": {
                "mimeType": "text/plain",
                "headers": [
                    {"name": "From", "value": "notifications@synthetic-bank.example"},
                    {"name": "Subject", "value": "[SYNTHETIC BANK] Transaction v1"},
                ],
                "body": {"data": base64.urlsafe_b64encode(body.encode()).decode()},
            },
        }
    )
    normalized, parser, errors = parse_message(message)
    account = session.scalar(select(FinancialAccount).where(FinancialAccount.name == "Checking"))
    batch = ImportBatch(
        source_type="GMAIL",
        filename="Synthetic Gmail notification simulation",
        file_hash=claim,
        account_id=account.id,
        configuration={},
        source_context={
            "warnings": ["Fictional notification simulation; no Gmail connection."],
            "simulation": True,
        },
        counts={"total": 1},
    )
    session.add(batch)
    session.flush()
    source = SourceRecord(
        import_batch_id=batch.id,
        row_number=1,
        source_type="GMAIL",
        external_id=message_id,
        source_fingerprint=claim,
        external_fingerprint=claim,
        raw_data={
            **parser,
            "original_candidate": json.dumps(normalized),
            "sender": message.sender,
            "subject": message.subject,
            "received_at": message.received_at,
            "parsed_at": STAMP.isoformat(),
            "simulation": "yes",
        },
        normalized_data=normalized,
        validation_errors=errors,
    )
    session.add(source)
    session.flush()
    session.add(GmailMessageClaim(identity=claim, source_id=source.id))
    session.flush()
    return batch


def confirm(session, batch):
    return ingestion.confirm(
        session,
        batch,
        Confirm(
            preview_token=ingestion.preview(session, batch)["preview_token"], account_confirmed=True
        ),
    )


def seed_scenarios(session, accounts, categories):
    # One purchase, two independent pieces of evidence, and an exact-repeat draft.
    batch = simulate_notification(session, "showcase-notification-1")
    result = confirm(session, batch)
    transaction_id = UUID(result["rows"][0]["transaction_id"])
    ofx = upload_sample(session, "demo-checking.ofx")
    source = ingestion.source_rows(session, ofx)[0]
    ingestion.decide(
        session, ofx, source.id, Decision(action="LINK", transaction_id=transaction_id)
    )
    confirm(session, ofx)
    reconciliation.clear_transaction(
        session,
        transaction_id,
        Clear(request_id=identity("cleared-grocery"), cleared=True, source_id=source.id),
    )
    upload_sample(session, "demo-checking.ofx")
    for i, account in enumerate(["Checking", "Checking", "Credit Card"]):
        ledger.create_transaction(
            session,
            schemas.TransactionCreate(
                account_id=accounts[account].id,
                currency="BRL",
                transaction_type="EXPENSE",
                amount="42",
                transaction_date=date(2026, 9, 24 + i % 2),
                description="Synthetic ambiguous cafe",
                category_id=categories["Restaurants"],
            ),
        )
    upload_sample(session, "demo-checking.csv")
    # Completed historical cash statement, computed from actual ledger entries.
    cash = list(
        session.scalars(
            select(Transaction).where(
                Transaction.account_id == accounts["Cash"].id,
                Transaction.transaction_date <= date(2024, 10, 31),
            )
        )
    )
    for row in cash:
        reconciliation.clear_transaction(
            session, row.id, Clear(request_id=identity(f"clear/{row.id}"), cleared=True)
        )
    balance = sum(row.amount if row.direction == "IN" else -row.amount for row in cash)
    shown = reconciliation.create_statement(
        session,
        StatementCreate(
            request_id=identity("statement"),
            account_id=accounts["Cash"].id,
            cutoff=date(2024, 10, 31),
            ending_balance=str(balance),
            notes="Synthetic completed statement",
        ),
    )
    statement = session.get(Statement, UUID(shown["id"]))
    reconciliation.transition_statement(
        session,
        statement,
        StatementChange(
            request_id=identity("statement-complete"),
            token=shown["token"],
            action="COMPLETE",
            reason="Synthetic cash statement verified",
        ),
    )
