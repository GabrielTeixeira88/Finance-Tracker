"""Allowlisted, non-posting automation. Evaluation is pure; writes share the caller's UoW."""

import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select

from app.automation_schemas import RuleInput
from app.models import (
    Category,
    FinancialAccount,
    Payee,
    RuleApplication,
    Transaction,
    TransactionRule,
)

FIELDS = {"payee_id", "category_id", "review_status"}


def normalize(value):
    return " ".join((value or "").split()).casefold()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def string_value(value):
    return str(value) if value is not None else None


def rule_data(rule):
    return {key: getattr(rule, key) for key in RuleInput.model_fields}


def validate_references(session, data):
    for field, model in (("payee_id", Payee), ("category_id", Category)):
        value = getattr(data.actions, field)
        if value is not None and session.get(model, value) is None:
            raise HTTPException(404, f"Rule {field} reference not found")
    for condition in data.conditions:
        model = {"account_id": FinancialAccount, "category_id": Category}.get(condition.field)
        if model and session.get(model, UUID(condition.value)) is None:
            raise HTTPException(404, "Rule condition reference not found")


def save_rule(session, data, rule=None):
    validate_references(session, data)
    values = data.model_dump(mode="json")
    values["actions"] = data.actions.model_dump(mode="json", exclude_unset=True)
    if rule is None:
        rule = TransactionRule(**values)
        session.add(rule)
    else:
        for key, value in values.items():
            setattr(rule, key, value)
    session.flush()
    return rule


def active_rules(session):
    return list(
        session.scalars(
            select(TransactionRule)
            .where(TransactionRule.enabled)
            .order_by(TransactionRule.priority, TransactionRule.created_at, TransactionRule.id)
        )
    )


def basis(row, payees):
    values = {
        key: getattr(row, key)
        for key in ("description", "amount", "account_id", "transaction_type", "currency", *FIELDS)
    }
    for field, assignment in (row.rule_assignments or {}).items():
        if field in FIELDS and field not in (row.manual_fields or []):
            values[field] = assignment["base_value"]
    values["payee_name"] = payees.get(string_value(values["payee_id"]), "")
    return values


def matches(condition, values):
    field, operator, expected = condition["field"], condition["operator"], condition["value"]
    actual = values.get(field)
    if field in {"description", "payee_name"}:
        actual, expected = normalize(actual), normalize(expected)
        return {
            "contains": lambda: expected in actual,
            "not_contains": lambda: expected not in actual,
            "equals": lambda: actual == expected,
            "starts_with": lambda: actual.startswith(expected),
        }[operator]()
    if field == "amount":
        actual, expected = Decimal(actual), Decimal(expected)
        return {
            "equals": lambda: actual == expected,
            "greater_than": lambda: actual > expected,
            "less_than": lambda: actual < expected,
        }[operator]()
    return string_value(actual) == expected


def evaluate(row, rules, payees):
    """Conditions use pre-rule values; a rule's output never becomes its own input."""
    if row.transaction_type not in {"INCOME", "EXPENSE"} or row.deleted_at:
        return {"matched": [], "proposed": [], "skipped": []}
    values, claimed = basis(row, payees), set()
    result = {"matched": [], "proposed": [], "skipped": []}
    ordered = sorted(
        rules,
        key=lambda r: (r.priority, r.created_at or datetime.max.replace(tzinfo=UTC), str(r.id)),
    )
    for rule in ordered:
        if not rule.enabled:
            continue
        checks = [matches(c, values) for c in rule.conditions]
        if not (all(checks) if rule.match_mode == "ALL" else any(checks)):
            continue
        result["matched"].append(str(rule.id))
        for field, after in rule.actions.items():
            action = {
                "field": field,
                "before": string_value(getattr(row, field)),
                "after": after,
                "rule_id": str(rule.id),
                "rule_name": rule.name,
            }
            if field in (row.manual_fields or []):
                result["skipped"].append({**action, "reason": "Manual override"})
            elif field in claimed:
                result["skipped"].append({**action, "reason": "Higher-priority matching action"})
            else:
                claimed.add(field)
                if action["before"] == after:
                    result["skipped"].append({**action, "reason": "Already assigned"})
                else:
                    result["proposed"].append(action)
    return result


def apply_evaluation(session, row, result, target=None):
    assignments, audits = dict(row.rule_assignments or {}), {}
    for action in result["proposed"]:
        if target is not None and action["rule_id"] != str(target):
            continue
        field = action["field"]
        original = assignments.get(field, {}).get("base_value", action["before"])
        setattr(row, field, UUID(action["after"]) if field.endswith("_id") else action["after"])
        assignments[field] = {
            "rule_id": action["rule_id"],
            "rule_name": action["rule_name"],
            "base_value": original,
        }
        audit = audits.setdefault(action["rule_id"], {"name": action["rule_name"], "changes": {}})
        audit["changes"][field] = {"before": action["before"], "after": action["after"]}
    if audits:
        row.rule_assignments = assignments
        for rule_id, audit in audits.items():
            session.add(
                RuleApplication(
                    transaction_id=row.id,
                    rule_id=rule_id,
                    rule_name=audit["name"],
                    changes=audit["changes"],
                )
            )
    return bool(audits)


def apply_new(session, row):
    rules = active_rules(session)
    if rules:
        payees = {str(p.id): p.name for p in session.scalars(select(Payee))}
        apply_evaluation(session, row, evaluate(row, rules, payees))


def preview(session, target):
    rules = [r for r in active_rules(session) if r.id != target.id] + [target]
    payees = {str(p.id): p.name for p in session.scalars(select(Payee))}
    rows = list(
        session.scalars(
            select(Transaction)
            .where(
                Transaction.deleted_at.is_(None),
                Transaction.transaction_type.in_(["INCOME", "EXPENSE"]),
            )
            .order_by(Transaction.transaction_date.desc(), Transaction.id)
        )
    )
    details, evaluations = [], []
    for row in rows:
        result = evaluate(row, rules, payees)
        if str(target.id) not in result["matched"]:
            continue
        proposed = [a for a in result["proposed"] if a["rule_id"] == str(target.id)]
        skipped = [a for a in result["skipped"] if a["rule_id"] == str(target.id)]
        details.append(
            {
                "transaction_id": str(row.id),
                "description": row.description,
                "date": row.transaction_date.isoformat(),
                "amount": str(row.amount),
                "currency": row.currency,
                "proposed": proposed,
                "skipped": skipped,
                "updated_at": str(row.updated_at),
            }
        )
        evaluations.append((row, result))
    payload = {
        "match_count": len(details),
        "change_count": sum(bool(d["proposed"]) for d in details),
        "skipped_fields": sum(len(d["skipped"]) for d in details),
        "rows": details[:50],
    }
    payload["preview_token"] = digest({"rules": [rule_data(r) for r in rules], "details": details})
    return payload, evaluations


def apply_history(session, rule, token):
    if not rule.enabled:
        raise HTTPException(409, "Enable the rule before applying it")
    result, evaluations = preview(session, rule)
    if token != result["preview_token"]:
        raise HTTPException(409, "Preview is stale. Preview again before applying")
    for row, evaluation in evaluations:
        apply_evaluation(session, row, evaluation, rule.id)
    session.flush()
    return {
        "applied": result["change_count"],
        "matched": result["match_count"],
        "skipped_fields": result["skipped_fields"],
    }
