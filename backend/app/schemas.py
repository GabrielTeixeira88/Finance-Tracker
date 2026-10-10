from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator


def exact_decimal(value):
    if not isinstance(value, (str, Decimal)):
        raise ValueError("Money must be sent as a decimal string, never a JSON number")
    return value


Money = Annotated[
    Decimal,
    BeforeValidator(exact_decimal),
    Field(gt=0, lt=Decimal("1e18"), max_digits=24, decimal_places=6, allow_inf_nan=False),
]
OpeningMoney = Annotated[
    Decimal,
    BeforeValidator(exact_decimal),
    Field(ge=0, lt=Decimal("1e18"), max_digits=24, decimal_places=6, allow_inf_nan=False),
]
Name = Annotated[str, Field(min_length=1, max_length=120)]
Description = Annotated[str, Field(min_length=1, max_length=500)]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
AccountType = Literal["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT"]
TransactionType = Literal["INCOME", "EXPENSE", "TRANSFER", "OPENING_BALANCE"]
ReviewStatus = Literal["NEEDS_REVIEW", "REVIEWED"]
MetadataField = Literal["payee_id", "category_id", "review_status"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AccountCreate(Input):
    name: Name
    type: AccountType
    currency: Currency
    institution: Name | None = None
    opening_balance: OpeningMoney = Decimal("0")
    opening_direction: Literal["IN", "OUT"] = "IN"
    opening_date: date | None = None

    @model_validator(mode="after")
    def require_opening_date(self):
        if self.opening_balance and self.opening_date is None:
            raise ValueError("An opening date is required for a nonzero opening balance")
        return self


class AccountUpdate(Input):
    name: Name
    type: AccountType
    institution: Name | None = None
    active: bool = True


class CategoryInput(Input):
    name: Name


class PayeeInput(Input):
    name: Name


class TransactionMetadata(Input):
    payee_id: UUID | None = None
    category_id: UUID | None = None
    review_status: ReviewStatus | None = None

    @model_validator(mode="after")
    def explicit_fields(self):
        if not self.model_fields_set:
            raise ValueError("Choose at least one field to update")
        for field in self.model_fields_set - {"payee_id", "category_id", "merchant"}:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class TransactionPatch(TransactionMetadata):
    description: Description | None = None
    merchant: Name | None = None
    transaction_date: date | None = None
    unlock_fields: list[MetadataField] = Field(default_factory=list, max_length=3)


class BulkMetadata(Input):
    transaction_ids: list[UUID] = Field(min_length=1, max_length=200)
    changes: TransactionMetadata


class TransactionInput(Input):
    transaction_type: Literal["INCOME", "EXPENSE"]
    amount: Money
    transaction_date: date
    description: Description
    merchant: Name | None = None
    category_id: UUID | None = None
    payee_id: UUID | None = None
    review_status: ReviewStatus = "REVIEWED"


class TransactionCreate(TransactionInput):
    account_id: UUID
    currency: Currency


class TransferCreate(Input):
    source_account_id: UUID
    destination_account_id: UUID
    amount: Money
    currency: Currency
    transaction_date: date
    description: Description = "Transfer"


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


class AccountOutput(Output):
    name: str
    type: AccountType
    currency: str
    institution: str | None
    active: bool
    balance: Decimal


class CategoryOutput(Output):
    name: str


class PayeeOutput(Output):
    name: str


class TransactionOutput(Output):
    account_id: UUID
    transaction_type: TransactionType
    direction: Literal["IN", "OUT"]
    amount: Decimal
    currency: str
    transaction_date: date
    description: str
    merchant: str | None
    category_id: UUID | None
    payee_id: UUID | None
    payee: PayeeOutput | None
    review_status: ReviewStatus
    transfer_id: UUID | None
    deleted_at: datetime | None
    manual_fields: list[MetadataField]
    rule_assignments: dict


class TransferOutput(Output):
    source_account_id: UUID
    destination_account_id: UUID
    amount: Decimal
    currency: str
    transaction_date: date
    description: str


class CurrencySummary(BaseModel):
    currency: str
    total_balance: Decimal
    income: Decimal
    expenses: Decimal


class DashboardOutput(BaseModel):
    month: str
    totals: list[CurrencySummary]
    accounts: list[AccountOutput]
    recent_transactions: list[TransactionOutput]
