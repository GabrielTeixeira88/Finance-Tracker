"""Deterministic narrative facts. Text/translation belongs to the UI, never an LLM."""

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, localcontext

from app import spending
from app.investments import wire


def facts(session, start, as_of, currency, rows, summary, daily):
    pace = spending.pace(start, as_of, Decimal(summary["expenses"]))
    elapsed = pace["elapsed_days"]
    prior = spending.shift(start, -1)
    prior_days = min(elapsed, (start - prior).days)
    previous = defaultdict(lambda: Decimal(0))
    with localcontext() as ctx:
        ctx.prec = 60
        for row in session.execute(
            spending.report_query(prior, prior + timedelta(days=prior_days), currency)
        ):
            _, expense = spending.flow(
                row.transaction_type, row.amount, row.refund_link_id is not None
            )
            previous[str(row.category_id) if row.category_id else None] += expense
        changes = []
        comparisons = []
        for row in rows:
            now, before = Decimal(row["spent"]), previous[row["category_id"]]
            comparisons.append(
                dict(
                    category_id=row["category_id"],
                    current=now,
                    previous=before,
                    change=now - before,
                )
            )
            if elapsed and now != before:
                changes.append(
                    dict(
                        category_id=row["category_id"],
                        name=row["name"],
                        current=now,
                        previous=before,
                        change=now - before,
                        kind="new_category"
                        if before == 0 and now > 0
                        else "quiet_category"
                        if now == 0 and before > 0
                        else "spending_change",
                    )
                )
        changes.sort(key=lambda r: (-abs(r["change"]), r["name"]))
        recent_start = start + timedelta(days=max(0, elapsed - 7))
        recent_end = start + timedelta(days=elapsed)
        recent = sum((v for d, v in daily.items() if recent_start <= d < recent_end), Decimal(0))
        weekdays = defaultdict(lambda: Decimal(0))
        for day, value in daily.items():
            if start <= day < recent_end:
                weekdays[day.weekday()] += value
        target, spent = Decimal(summary["available"]), Decimal(summary["expenses"])
        previous_spending = sum(previous.values(), Decimal(0))
        return wire(
            dict(
                changes=changes[:8],
                previous_days=prior_days,
                previous_spending=previous_spending,
                change_percent=spending.ratio(spent - previous_spending, previous_spending),
                comparisons=comparisons,
                remaining_days=pace["days_in_month"] - elapsed,
                recent_daily=recent / min(7, elapsed) if elapsed else None,
                budget_status="no_budget"
                if target <= 0
                else "over_budget"
                if spent > target
                else "approaching_budget"
                if spent >= target * Decimal("0.9")
                else "within_budget",
                weekdays=[dict(weekday=i, value=weekdays[i]) for i in range(7)],
            )
        )
