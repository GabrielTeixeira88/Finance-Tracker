from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field, TypeAdapter, model_validator

from app.schemas import (
    Currency,
    Description,
    Input,
    Money,
    Name,
    OpeningMoney,
    Output,
    ReviewStatus,
)


class Condition(Input):
    field: Literal[
        "description",
        "payee_name",
        "amount",
        "transaction_type",
        "currency",
        "account_id",
        "category_id",
        "review_status",
    ]
    operator: Literal[
        "contains", "not_contains", "equals", "starts_with", "greater_than", "less_than"
    ]
    value: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_operator(self):
        if not self.value.strip():
            raise ValueError("Condition value cannot be blank")
        allowed = (
            {"contains", "not_contains", "equals", "starts_with"}
            if self.field in {"description", "payee_name"}
            else {"equals", "greater_than", "less_than"}
            if self.field == "amount"
            else {"equals"}
        )
        if self.operator not in allowed:
            raise ValueError("Unsupported operator for this field")
        if self.field == "amount":
            self.value = str(TypeAdapter(OpeningMoney).validate_python(self.value))
        if self.field in {"account_id", "category_id"}:
            self.value = str(UUID(self.value))
        if self.field == "currency":
            TypeAdapter(Currency).validate_python(self.value)
        if self.field == "review_status":
            TypeAdapter(ReviewStatus).validate_python(self.value)
        if self.field == "transaction_type" and self.value not in {"INCOME", "EXPENSE"}:
            raise ValueError("Rules classify ordinary income/expense transactions only")
        return self


class RuleActions(Input):
    payee_id: UUID | None = None
    category_id: UUID | None = None
    review_status: ReviewStatus | None = None

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set or any(
            getattr(self, field) is None for field in self.model_fields_set
        ):
            raise ValueError("Choose at least one non-null metadata assignment")
        return self


class RuleInput(Input):
    name: Name
    enabled: bool = True
    priority: int = Field(default=100, ge=0, le=100000)
    match_mode: Literal["ALL", "ANY"] = "ALL"
    conditions: list[Condition] = Field(min_length=1, max_length=12)
    actions: RuleActions


class RuleOutput(Output, RuleInput):
    pass


class RulePreview(Input):
    rule: RuleInput
    rule_id: UUID | None = None


class RuleApply(Input):
    preview_token: str = Field(min_length=64, max_length=64)


class SuggestionAccept(Input):
    rule: RuleInput | None = None


class ScheduleInput(Input):
    name: Name
    description: Description
    transaction_type: Literal["INCOME", "EXPENSE"]
    account_id: UUID
    payee_id: UUID | None = None
    category_id: UUID | None = None
    amount: Money
    currency: Currency
    frequency: Literal["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]
    start_date: date
    end_date: date | None = None
    enabled: bool = True
    amount_is_approximate: bool = False
    amount_tolerance: OpeningMoney = Decimal("0")

    @model_validator(mode="after")
    def valid_dates(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must not precede start date")
        if not self.amount_is_approximate and self.amount_tolerance != 0:
            raise ValueError("Only approximate schedules may have a tolerance")
        return self


class ScheduleOutput(Output, ScheduleInput):
    next_due_date: date | None = None


class MatchInput(Input):
    transaction_id: UUID


class OccurrencePost(Input):
    amount: Money
    transaction_date: date
