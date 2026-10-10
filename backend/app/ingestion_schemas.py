"""Source-independent candidates and explicitly configured, bounded file inputs."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas import Currency, Description, Input, Money, Name, ReviewStatus

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 2000


class CSVConfiguration(Input):
    delimiter: Literal[",", ";"] = ","
    encoding: Literal["utf-8-sig", "cp1252"] = "utf-8-sig"
    has_header: bool = True
    date_format: Literal["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]
    decimal_separator: Literal[".", ","]
    thousands_separator: Literal["", ".", ","] = ""
    amount_mode: Literal["signed", "reversed", "type", "debit_credit"] = "signed"
    columns: dict[str, int] = Field(max_length=8)
    source_namespace: str = Field(default="", max_length=120)

    @model_validator(mode="after")
    def mapping(self):
        allowed = {
            "date",
            "description",
            "amount",
            "currency",
            "external_id",
            "type",
            "debit",
            "credit",
        }
        if set(self.columns) - allowed or any(
            type(v) is not int or not 0 <= v < 100 for v in self.columns.values()
        ):
            raise ValueError("Map recognized fields to column indexes 0–99")
        required = {"date", "description"} | (
            {"debit", "credit"} if self.amount_mode == "debit_credit" else {"amount"}
        )
        if self.amount_mode == "type":
            required.add("type")
        if not required <= self.columns.keys() or len(set(self.columns.values())) != len(
            self.columns
        ):
            raise ValueError("Required mappings must be present and use distinct columns")
        if self.amount_mode == "debit_credit" and "amount" in self.columns:
            raise ValueError("Choose amount or separate debit/credit, not both")
        if self.amount_mode != "debit_credit" and {"debit", "credit"} & self.columns.keys():
            raise ValueError("Debit/credit columns require debit_credit mode")
        if self.thousands_separator == self.decimal_separator:
            raise ValueError("Decimal and thousands separators must differ")
        return self


class Upload(Input):
    filename: str = Field(min_length=1, max_length=200)
    content_base64: str = Field(max_length=((MAX_BYTES + 2) // 3) * 4)
    source_type: Literal["CSV", "OFX"]
    account_id: UUID
    configuration: CSVConfiguration | None = None


class ProfileInput(Input):
    name: Name
    configuration: CSVConfiguration
    default_account_id: UUID | None = None


class Candidate(Input):
    transaction_date: date
    description: Description
    amount: Money
    currency: Currency
    transaction_type: Literal["INCOME", "EXPENSE"]
    payee_id: UUID | None = None
    category_id: UUID | None = None
    review_status: ReviewStatus = "NEEDS_REVIEW"
    ambiguity: str | None = None


class Decision(Input):
    action: Literal["NEW", "SKIP", "LINK"]
    transaction_id: UUID | None = None
    payee_id: UUID | None = None
    category_id: UUID | None = None
    review_status: ReviewStatus | None = None
    acknowledge_classification: bool = False
    schedule_id: UUID | None = None
    due_date: date | None = None

    @model_validator(mode="after")
    def links(self):
        if (self.action == "LINK") != (self.transaction_id is not None):
            raise ValueError("A link requires an existing transaction")
        if (self.schedule_id is None) != (self.due_date is None):
            raise ValueError("Schedule matching requires an occurrence date")
        if "review_status" in self.model_fields_set and self.review_status is None:
            raise ValueError("Choose a review status")
        return self


class Confirm(Input):
    preview_token: str = Field(min_length=64, max_length=64)
    account_confirmed: bool
