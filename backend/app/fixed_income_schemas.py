from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.fixed_income_calendar import business_day
from app.schemas import Input, Money, Name, OpeningMoney


class Subscription(Input):
    request_id: UUID
    account_id: UUID
    name: Name
    issuer: Name
    instrument_type: Literal["CDB_CDI", "RDB_CDI", "CDB_FIXED", "TESOURO_SELIC"]
    settlement_date: date
    maturity_date: date
    redemption_from: date
    liquidity: Literal["DAILY", "AT_MATURITY"] = "DAILY"
    quantity: Money
    acquisition_price: Money = Decimal("1")
    cdi_percent: OpeningMoney = Decimal("0")
    annual_rate: OpeningMoney = Decimal("0")
    spread_rate: OpeningMoney = Decimal("0")
    index_source: Literal["SYNTHETIC", "MANUAL"] = "MANUAL"
    fictional: bool = False
    fgc_eligible: bool = False
    notes: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def terms(self):
        if (
            not self.settlement_date <= self.redemption_from <= self.maturity_date
            or self.settlement_date >= self.maturity_date
        ):
            raise ValueError("Order settlement, redemption availability and maturity dates")
        if (self.maturity_date - self.settlement_date).days > 3660:
            raise ValueError("Contracts are limited to ten years")
        if not business_day(self.settlement_date) or not business_day(self.maturity_date):
            raise ValueError("Use effective business-day settlement and maturity dates")
        if self.settlement_date > date.today():
            raise ValueError("Future subscriptions are not ledger activities")
        if self.index_source == "SYNTHETIC" and not self.fictional:
            raise ValueError("Synthetic observations require a fictional contract")
        if self.liquidity == "AT_MATURITY" and self.redemption_from != self.maturity_date:
            raise ValueError("Maturity-only products cannot allow earlier redemption")
        if self.instrument_type in {"CDB_CDI", "RDB_CDI"}:
            if (
                not 0 < self.cdi_percent <= 300
                or self.annual_rate
                or self.spread_rate
                or self.acquisition_price != 1
            ):
                raise ValueError(
                    "CDI CDB uses a positive CDI percentage and one-real principal units"
                )
        elif self.instrument_type == "CDB_FIXED":
            if (
                not 0 < self.annual_rate <= 100
                or self.cdi_percent
                or self.spread_rate
                or self.acquisition_price != 1
            ):
                raise ValueError("Fixed CDB uses an annual rate and one-real principal units")
        elif self.cdi_percent or self.annual_rate or self.fgc_eligible or self.spread_rate > 10:
            raise ValueError(
                "Tesouro Selic has no CDI rate or FGC coverage; use explicit purchase/market prices"
            )
        return self


class Redemption(Input):
    request_id: UUID
    settlement_date: date
    quantity: Money
    unit_price: Money | None = None
    fees: OpeningMoney = Decimal("0")


class IndexInput(Input):
    index_name: Literal["CDI", "SELIC_OVER"]
    observation_date: date
    source: Literal["MANUAL", "SYNTHETIC"] = "MANUAL"
    factor: Decimal = Field(ge=Decimal("1"), le=Decimal("1.1"), max_digits=19, decimal_places=18)

    @model_validator(mode="after")
    def historical(self):
        if self.observation_date > date.today() or not business_day(self.observation_date):
            raise ValueError("Index observations require a past or current business day")
        return self
