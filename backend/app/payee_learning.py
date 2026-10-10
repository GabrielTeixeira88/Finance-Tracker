"""Conservative suggestions from distinct explicit corrections; never creates enabled rules."""

import re
from datetime import UTC, datetime

from sqlalchemy import select

from app.config import get_settings
from app.models import Payee, RuleSuggestion, Transaction, TransactionCorrection, TransactionRule
from app.rules import FIELDS, digest, normalize, string_value

GENERIC = {
    "payment",
    "purchase",
    "transaction",
    "debit",
    "credit",
    "online",
    "card",
    "bank",
    "transfer",
    "synthetic",
    "demo",
    "fictional",
    "the",
    "store",
    "pos",
    "ref",
    "bill",
}


def safe_pattern(description):
    # Only a trailing reference number is generalized, never a broad shared token.
    pattern = re.sub(r"\s+[0-9-]+$", "", normalize(description)).strip()
    meaningful = [w for w in re.findall(r"[^\W\d_]+", pattern) if len(w) >= 4 and w not in GENERIC]
    return pattern if meaningful and 4 <= len(pattern) <= 120 else None


def manual_change(session, row, before, fields, source="USER"):
    explicit = set(fields) & FIELDS
    row.manual_fields = sorted(set(row.manual_fields or []) | explicit)
    row.rule_assignments = {
        k: v for k, v in (row.rule_assignments or {}).items() if k not in explicit
    }
    changes = {
        field: {"before": string_value(before[field]), "after": string_value(getattr(row, field))}
        for field in explicit & {"payee_id", "category_id"}
        if before[field] != getattr(row, field)
    }
    if changes and row.transaction_type in {"INCOME", "EXPENSE"}:
        session.add(
            TransactionCorrection(
                transaction_id=row.id,
                source=source,
                changes=changes,
                created_at=datetime.now(UTC),
                context={
                    "pattern": safe_pattern(row.description),
                    "account_id": str(row.account_id),
                    "currency": row.currency,
                    "transaction_type": row.transaction_type,
                    "payee_id": string_value(row.payee_id),
                    "category_id": string_value(row.category_id),
                },
            )
        )


def equivalent(conditions, actions, rule):
    def canonical(items):
        return sorted((c["field"], c["operator"], normalize(c["value"])) for c in items)

    return (
        rule.match_mode == "ALL"
        and canonical(conditions) == canonical(rule.conditions)
        and actions == rule.actions
    )


def refresh_suggestions(session):
    session.flush()
    latest = {}
    for correction in session.scalars(
        select(TransactionCorrection)
        .join(Transaction)
        .where(Transaction.deleted_at.is_(None))
        .order_by(TransactionCorrection.created_at, TransactionCorrection.id)
    ):
        latest[correction.transaction_id] = correction
    groups = {}
    for correction in latest.values():
        context = correction.context
        current_row = session.get(Transaction, correction.transaction_id)
        if any(
            context[field] != string_value(getattr(current_row, field))
            for field in ("account_id", "currency", "transaction_type", "payee_id", "category_id")
        ) or context["pattern"] != safe_pattern(current_row.description):
            continue
        if not context["pattern"]:
            continue
        key = {k: context[k] for k in ("pattern", "account_id", "currency", "transaction_type")}
        groups.setdefault(digest(key), []).append(context)
    existing = {s.fingerprint: s for s in session.scalars(select(RuleSuggestion))}
    rules = list(session.scalars(select(TransactionRule)))
    for suggestion in existing.values():
        if suggestion.status == "PENDING":
            suggestion.status = "STALE"
    for fingerprint, contexts in groups.items():
        current = existing.get(fingerprint)
        if current and current.status in {"ACCEPTED", "DISMISSED"}:
            continue
        targets = {(c["payee_id"], c["category_id"]) for c in contexts}
        if len(contexts) < get_settings().learning_min_examples or len(targets) != 1:
            continue
        payee_id, category_id = next(iter(targets))
        if not payee_id or not category_id:
            continue
        context = contexts[0]
        conditions = [
            {"field": "description", "operator": "starts_with", "value": context["pattern"]}
        ]
        conditions += [
            {"field": key, "operator": "equals", "value": context[key]}
            for key in ("account_id", "currency", "transaction_type")
        ]
        actions = {"payee_id": payee_id, "category_id": category_id}
        if any(equivalent(conditions, actions, rule) for rule in rules):
            continue
        if current is None:
            from uuid import UUID

            payee = session.get(Payee, UUID(payee_id))
            current = RuleSuggestion(fingerprint=fingerprint, name=f"Suggested: {payee.name}"[:120])
            session.add(current)
        current.conditions, current.actions = conditions, actions
        current.support_count, current.status = len(contexts), "PENDING"
    session.flush()
