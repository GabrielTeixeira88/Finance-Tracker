"""Contract terms and reference factors, independent of the activity/cash ledger."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, Record
from app.storage_types import ExactMoney, ExactRate


class FixedIncomeContract(Record, Base):
    __tablename__ = "fixed_income_contracts"
    asset_id: Mapped[uuid.UUID] = mapped_column(unique=True)
    account_id: Mapped[uuid.UUID]
    currency: Mapped[str] = mapped_column(String(3))
    instrument_type: Mapped[str] = mapped_column(String(20))
    issuer: Mapped[str] = mapped_column(String(120))
    settlement_date: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[date] = mapped_column(Date)
    redemption_from: Mapped[date] = mapped_column(Date)
    liquidity: Mapped[str] = mapped_column(String(20))
    index_name: Mapped[str | None] = mapped_column(String(12))
    index_source: Mapped[str] = mapped_column(String(12))
    cdi_percent: Mapped[Decimal] = mapped_column(ExactMoney())
    annual_rate: Mapped[Decimal] = mapped_column(ExactMoney())
    spread_rate: Mapped[Decimal] = mapped_column(ExactMoney())
    acquisition_price: Mapped[Decimal] = mapped_column(ExactMoney())
    fictional: Mapped[bool] = mapped_column(Boolean)
    fgc_eligible: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str] = mapped_column(String(1000), default="")
    __table_args__ = (
        ForeignKeyConstraint(["asset_id", "currency"], ["assets.id", "assets.currency"]),
        ForeignKeyConstraint(
            ["account_id", "currency"], ["financial_accounts.id", "financial_accounts.currency"]
        ),
        CheckConstraint("currency='BRL'", name="currency"),
        CheckConstraint(
            "instrument_type IN ('CDB_CDI','RDB_CDI','CDB_FIXED','TESOURO_SELIC')", name="type"
        ),
        CheckConstraint(
            "settlement_date < maturity_date AND redemption_from >= settlement_date "
            "AND redemption_from <= maturity_date",
            name="dates",
        ),
        CheckConstraint("liquidity IN ('DAILY','AT_MATURITY')", name="liquidity"),
        CheckConstraint("index_source IN ('SYNTHETIC','MANUAL')", name="source"),
        CheckConstraint("index_source != 'SYNTHETIC' OR fictional=1", name="fictional"),
        CheckConstraint("instrument_type != 'TESOURO_SELIC' OR fgc_eligible=0", name="fgc"),
        CheckConstraint(
            "(instrument_type IN ('CDB_CDI','RDB_CDI') AND index_name='CDI') OR "
            "(instrument_type='CDB_FIXED' AND index_name IS NULL) OR "
            "(instrument_type='TESOURO_SELIC' AND index_name='SELIC_OVER')",
            name="index",
        ),
        *[
            CheckConstraint(
                f"typeof({field})='text' AND length({field})=24 AND {field} NOT GLOB '*[^0-9]*'",
                name=field,
            )
            for field in ("cdi_percent", "annual_rate", "spread_rate", "acquisition_price")
        ],
        CheckConstraint("acquisition_price > '000000000000000000000000'", name="positive_price"),
    )


class FixedIncomeIndex(Record, Base):
    __tablename__ = "fixed_income_indices"
    index_name: Mapped[str] = mapped_column(String(12))
    observation_date: Mapped[date] = mapped_column(Date, index=True)
    source: Mapped[str] = mapped_column(String(12))
    factor: Mapped[Decimal] = mapped_column(ExactRate())
    __table_args__ = (
        UniqueConstraint("index_name", "observation_date", "source"),
        CheckConstraint("index_name IN ('CDI','SELIC_OVER')", name="index"),
        CheckConstraint("source IN ('SYNTHETIC','MANUAL')", name="source"),
        CheckConstraint(
            "typeof(factor)='text' AND length(factor)=36 AND factor NOT GLOB "
            "'*[^0-9]*' AND factor >= '000000000000000001000000000000000000'",
            name="factor",
        ),
    )
