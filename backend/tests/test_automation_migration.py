from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, text
from sqlalchemy.orm import Session

from app.database import make_engine
from app.models import Transaction


def test_populated_phase2a_migration_preserves_metadata_and_exact_postings(tmp_path):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "phase2a-upgrade.db"))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0003")
    engine = make_engine(url)
    account_id, payee_id, transaction_id = [uuid4().hex for _ in range(3)]
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO financial_accounts (id,name,type,currency) "
                "VALUES (:id,'Synthetic','CHECKING','BRL')"
            ),
            {"id": account_id},
        )
        conn.execute(
            text(
                "INSERT INTO payees (id,name,normalized_name) "
                "VALUES (:id,'Synthetic Payee','synthetic payee')"
            ),
            {"id": payee_id},
        )
        conn.execute(
            text(
                "INSERT INTO transactions (id,account_id,payee_id,transaction_type,direction,"
                "amount,currency,transaction_date,description,review_status) VALUES "
                "(:id,:account,:payee,'EXPENSE','OUT','000000000000000010123456','BRL',"
                "'2026-10-01','Synthetic original','NEEDS_REVIEW')"
            ),
            {"id": transaction_id, "account": account_id, "payee": payee_id},
        )
        before = dict(conn.execute(text("SELECT * FROM transactions")).mappings().one())
    command.upgrade(config, "head")
    command.check(config)
    with engine.connect() as conn:
        after = dict(conn.execute(text("SELECT * FROM transactions")).mappings().one())
        after.pop("manual_fields")
        after.pop("rule_assignments")
        assert after == before
        assert list(conn.execute(text("PRAGMA foreign_key_check"))) == []
    with Session(engine) as session:
        row = session.get(Transaction, UUID(transaction_id))
        assert set(row.manual_fields) == {"payee_id", "category_id", "review_status"}
        assert row.amount == Decimal("10.123456")
    engine.dispose()
