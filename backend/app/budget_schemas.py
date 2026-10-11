from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, Field

from app.schemas import Currency, Description, Input, Money, Name, OpeningMoney


def valid_month(value):
    try:
        parsed = date.fromisoformat(value + "-01")
        if not 1900 <= parsed.year <= 2199:
            raise ValueError()
    except ValueError as error:
        raise ValueError("Use a calendar month YYYY-MM between 1900 and 2199") from error
    return value


Month = Annotated[str, AfterValidator(valid_month)]


class TargetInput(Input):
    category_id: UUID
    currency: Currency
    month: Month
    scope: Literal["default", "month"] = "default"
    amount: OpeningMoney
    active: bool = True
    rollover_enabled: bool = False
    group_id: UUID | None = None
    sort_order: int = Field(default=0, ge=0, le=100000)


class GroupInput(Input):
    name: Name
    sort_order: int = Field(default=0, ge=0, le=100000)


class CopyMonth(Input):
    month: Month
    currency: Currency
    replace_existing: bool = False


class RefundInput(Input):
    purchase_id: UUID
    amount: Money
    transaction_date: date
    description: Description = "Purchase refund"
    account_id: UUID


class RefundAssociation(Input):
    purchase_id: UUID
    refund_id: UUID
