from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response
from pydantic import ValidationError
from sqlalchemy import select

from app import automation_schemas as schemas
from app import ledger, payee_learning, rules, schedules
from app.models import (
    RuleApplication,
    RuleSuggestion,
    Schedule,
    ScheduleCompletion,
    TransactionRule,
)
from app.routes import DB

router = APIRouter(prefix="/api")


def merged_input(schema, record, changes):
    # Validate the merged object through the same allowlisted Pydantic schema as creation.
    values = {key: getattr(record, key) for key in schema.model_fields}
    try:
        return schema.model_validate({**values, **changes})
    except ValidationError as error:
        raise HTTPException(
            422, "Invalid update; check fields, operators, amounts and dates"
        ) from error


@router.get("/rules", response_model=list[schemas.RuleOutput])
def list_rules(db: DB):
    return list(
        db.scalars(
            select(TransactionRule).order_by(
                TransactionRule.priority, TransactionRule.created_at, TransactionRule.id
            )
        )
    )


@router.post("/rules", response_model=schemas.RuleOutput, status_code=201)
def create_rule(data: schemas.RuleInput, db: DB):
    rule = rules.save_rule(db, data)
    payee_learning.refresh_suggestions(db)
    return rule


@router.post("/rules/preview")
def preview_draft(data: schemas.RulePreview, db: DB):
    rules.validate_references(db, data.rule)
    existing = ledger.require(db, TransactionRule, data.rule_id) if data.rule_id else None
    values = data.rule.model_dump(mode="json")
    values["actions"] = data.rule.actions.model_dump(mode="json", exclude_unset=True)
    draft = TransactionRule(
        **values,
        id=existing.id if existing else UUID(int=0),
        created_at=existing.created_at if existing else None,
    )
    return rules.preview(db, draft)[0]


@router.patch("/rules/{record_id}", response_model=schemas.RuleOutput)
def edit_rule(record_id: UUID, data: dict, db: DB):
    rule = ledger.require(db, TransactionRule, record_id)
    rules.save_rule(db, merged_input(schemas.RuleInput, rule, data), rule)
    payee_learning.refresh_suggestions(db)
    return rule


@router.delete("/rules/{record_id}", status_code=204)
def delete_rule(record_id: UUID, db: DB):
    db.delete(ledger.require(db, TransactionRule, record_id))
    db.flush()
    payee_learning.refresh_suggestions(db)
    return Response(status_code=204)


@router.post("/rules/{record_id}/preview")
def preview_rule(record_id: UUID, db: DB):
    return rules.preview(db, ledger.require(db, TransactionRule, record_id))[0]


@router.post("/rules/{record_id}/apply")
def apply_rule(record_id: UUID, data: schemas.RuleApply, db: DB):
    return rules.apply_history(
        db, ledger.require(db, TransactionRule, record_id), data.preview_token
    )


@router.get("/rule-suggestions")
def suggestions(db: DB):
    return list(
        db.scalars(select(RuleSuggestion).order_by(RuleSuggestion.created_at, RuleSuggestion.id))
    )


@router.post("/rule-suggestions/{record_id}/accept", response_model=schemas.RuleOutput)
def accept_suggestion(record_id: UUID, data: schemas.SuggestionAccept, db: DB):
    payee_learning.refresh_suggestions(db)
    suggestion = ledger.require(db, RuleSuggestion, record_id)
    if suggestion.status != "PENDING":
        raise HTTPException(
            409, "Suggestion is no longer pending or supported by consistent evidence"
        )
    proposed = data.rule or schemas.RuleInput(
        name=suggestion.name,
        conditions=suggestion.conditions,
        actions=suggestion.actions,
    )
    rule = rules.save_rule(db, proposed)
    suggestion.status = "ACCEPTED"
    db.flush()
    return rule


@router.post("/rule-suggestions/{record_id}/dismiss")
def dismiss_suggestion(record_id: UUID, db: DB):
    suggestion = ledger.require(db, RuleSuggestion, record_id)
    if suggestion.status not in {"PENDING", "STALE"}:
        raise HTTPException(409, "Suggestion has already been handled")
    suggestion.status = "DISMISSED"
    db.flush()
    return {"status": "DISMISSED"}


@router.get("/transactions/{record_id}/automation")
def automation_history(record_id: UUID, db: DB):
    return list(
        db.scalars(
            select(RuleApplication)
            .where(RuleApplication.transaction_id == record_id)
            .order_by(RuleApplication.created_at, RuleApplication.id)
        )
    )


@router.get("/schedules", response_model=list[schemas.ScheduleOutput])
def list_schedules(db: DB, as_of: date | None = None):
    return [
        schedules.output(db, s, as_of or date.today())
        for s in db.scalars(select(Schedule).order_by(Schedule.name, Schedule.id))
    ]


@router.post("/schedules", response_model=schemas.ScheduleOutput, status_code=201)
def create_schedule(data: schemas.ScheduleInput, db: DB):
    return schedules.output(db, schedules.save_schedule(db, data), date.today())


@router.get("/schedules/upcoming")
def upcoming(db: DB, date_from: date, date_to: date, as_of: date | None = None):
    return schedules.upcoming(db, date_from, date_to, as_of or date.today())


@router.patch("/schedules/{record_id}", response_model=schemas.ScheduleOutput)
def edit_schedule(record_id: UUID, data: dict, db: DB):
    schedule = ledger.require(db, Schedule, record_id)
    schedules.save_schedule(db, merged_input(schemas.ScheduleInput, schedule, data), schedule)
    return schedules.output(db, schedule, date.today())


@router.delete("/schedules/{record_id}", status_code=204)
def delete_schedule(record_id: UUID, db: DB):
    schedule = ledger.require(db, Schedule, record_id)
    if schedules.completion_map(db, schedule):
        raise HTTPException(
            409, "Schedule has confirmed completions; disable it or unlink them first"
        )
    db.delete(schedule)
    db.flush()
    return Response(status_code=204)


@router.get("/schedules/{record_id}/occurrences/{due}/candidates")
def match_candidates(record_id: UUID, due: date, db: DB):
    return schedules.candidates(db, ledger.require(db, Schedule, record_id), due)


@router.post("/schedules/{record_id}/occurrences/{due}/match")
def match_occurrence(record_id: UUID, due: date, data: schemas.MatchInput, db: DB):
    match = schedules.confirm_match(
        db, ledger.require(db, Schedule, record_id), due, data.transaction_id
    )
    return {"transaction_id": match.transaction_id, "status": "COMPLETED"}


@router.post(
    "/schedules/{record_id}/occurrences/{due}/post",
    response_model=ledger.schemas.TransactionOutput,
    status_code=201,
)
def post_occurrence(record_id: UUID, due: date, data: schemas.OccurrencePost, db: DB):
    return schedules.post_occurrence(db, ledger.require(db, Schedule, record_id), due, data)


@router.delete("/schedules/{record_id}/occurrences/{due}/match", status_code=204)
def unlink_occurrence(record_id: UUID, due: date, db: DB):
    record = db.scalar(
        select(ScheduleCompletion).where(
            ScheduleCompletion.schedule_id == record_id, ScheduleCompletion.due_date == due
        )
    )
    if record is None:
        raise HTTPException(404, "Confirmed match not found")
    db.delete(record)
    db.flush()
    return Response(status_code=204)
