from datetime import date
from decimal import ROUND_HALF_EVEN, Decimal, localcontext
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas import Currency, Input, Money, Name, OpeningMoney

KINDS = Literal["BUY", "SELL", "DIVIDEND", "INTEREST", "FEE", "TAX"]


def settled(value):
    with localcontext() as ctx:
        ctx.prec = 60
        return value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_EVEN)


class AssetInput(Input):
    symbol: str = Field(min_length=1, max_length=40)
    name: Name
    asset_type: Literal["STOCK", "ETF", "FUND", "BOND", "REIT", "FII", "BDR", "OTHER"]
    exchange: str = Field(min_length=1, max_length=40)
    currency: Currency
    isin: str | None = Field(default=None, pattern=r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")

    @field_validator("symbol", "exchange")
    @classmethod
    def identity(cls, value):
        normalized = " ".join(value.split()).upper()
        if not normalized or len(normalized) > 40:
            raise ValueError("Enter a symbol/exchange of 1 to 40 characters")
        return normalized


class ActivityInput(Input):
    request_id: UUID
    account_id: UUID
    asset_id: UUID | None = None
    activity_type: KINDS
    activity_date: date
    quantity: OpeningMoney = Decimal("0")
    unit_price: OpeningMoney = Decimal("0")
    gross_amount: Money | None = None
    fees: OpeningMoney = Decimal("0")
    taxes: OpeningMoney = Decimal("0")
    currency: Currency
    notes: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def financial_shape(self):
        with localcontext() as ctx:
            ctx.prec = 60
            if self.activity_type in {"BUY", "SELL"}:
                if not self.asset_id or self.quantity <= 0 or self.unit_price <= 0:
                    raise ValueError("Trades require an asset, positive quantity and price")
                gross = settled(self.quantity * self.unit_price)
                if self.gross_amount is not None and self.gross_amount != gross:
                    raise ValueError(
                        "Gross amount must equal quantity times price (six decimal settlement)"
                    )
                self.gross_amount = gross
            elif self.quantity or self.unit_price:
                raise ValueError("Only trades have quantity and unit price")
            elif self.gross_amount is None:
                raise ValueError("Enter the gross cash amount")
            if self.activity_type in {"FEE", "TAX"} and (self.fees or self.taxes):
                raise ValueError("Standalone fees/taxes cannot contain additional charges")
            if not self.gross_amount or self.gross_amount >= Decimal("1e18"):
                raise ValueError("Gross amount is outside the supported positive range")
            if not 0 < self.cash_amount < Decimal("1e18"):
                raise ValueError("Net cash must be positive and within the supported range")
        return self

    @property
    def cash_amount(self):
        with localcontext() as ctx:
            ctx.prec = 60
            charges = self.fees + self.taxes
            return (
                self.gross_amount + charges
                if self.activity_type == "BUY"
                else self.gross_amount - charges
            )


class PriceInput(Input):
    price_date: date
    price: Money
    currency: Currency
