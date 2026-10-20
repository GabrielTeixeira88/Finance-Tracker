from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, inspect, select, text
from sqlalchemy.orm import Session

from app.database import make_engine
from app.gmail_models import GmailConnection, GmailMessageClaim, GmailSyncRun
from app.models import FinancialAccount, ImportBatch, SourceRecord
from app.seed_analytics_demo import seed_analytics_demo


def test_populated_v09_upgrade_preserves_every_existing_row(tmp_path):
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "synthetic-v09.db"))
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0011")
    engine = make_engine(url)
    with Session(engine) as db, db.begin():
        assert seed_analytics_demo(db)
        account = db.scalar(select(FinancialAccount))
        db.add(GmailConnection(mailbox="synthetic@example.invalid", account_id=account.id))
        db.add(GmailSyncRun(mode="BACKFILL", status="COMPLETED", processed=1))
        batch = ImportBatch(
            source_type="GMAIL",
            filename="Synthetic migration notification",
            file_hash="a" * 64,
            account_id=account.id,
            configuration={},
            source_context={"synthetic": True},
        )
        db.add(batch)
        db.flush()
        candidate = SourceRecord(
            import_batch_id=batch.id,
            row_number=1,
            source_type="GMAIL",
            external_id="synthetic-message",
            source_fingerprint="b" * 64,
            raw_data={"synthetic": True},
            normalized_data={"description": "Fictional candidate", "amount": "10.00"},
            validation_errors=[],
        )
        db.add(candidate)
        db.flush()
        db.add(GmailMessageClaim(identity="c" * 64, source_id=candidate.id))
    with engine.connect() as connection:
        tables = [t for t in inspect(connection).get_table_names() if t != "alembic_version"]
        before = {
            t: list(connection.execute(text(f'SELECT * FROM "{t}" ORDER BY rowid'))) for t in tables
        }
    command.upgrade(config, "head")
    command.check(config)
    with engine.connect() as connection:
        for table in tables:
            assert (
                list(connection.execute(text(f'SELECT * FROM "{table}" ORDER BY rowid')))
                == before[table]
            )
        assert not list(connection.execute(text("PRAGMA foreign_key_check")))
        assert connection.scalar(text("PRAGMA integrity_check")) == "ok"
    engine.dispose()
