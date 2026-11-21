"""Exact read-only display projections; the existing wealth reader remains authoritative.

Presentation concepts adapted from Wealthfolio 92b4647, Net Worth components/utils.ts.
Financial implementation uses Decimal, explicit coverage and existing ledger flows.
SPDX-License-Identifier: AGPL-3.0-only
"""

from datetime import date, timedelta
from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import func, select

from app import investment_analytics, market_valuation, wealth
from app.investment_schemas import settled
from app.models import FinancialAccount, InvestmentActivity, Transaction
from app.wealth_models import ManualPosition

ZERO = Decimal(0)
DAYS_PER_MONTH = Decimal("365.25") / 12


def difference(first, last, field="value"):
    if first.get(field) is None or last.get(field) is None:
        return None
    return last[field] - first[field]


def momentum(points, start, end, tracked_since):
    """Equal-length closing-value windows; never infer an unrecorded baseline.

    Monthly bars use actual observed endpoints, including partial boundary months.
    Missing coverage inside a bar leaves that bar unavailable rather than joining gaps.
    """
    indexed = {p["date"]: p for p in points}
    span = (end - start).days
    prior_start = start - timedelta(days=min(span, (start - date.min).days))
    selected = [p for p in points if start <= p["date"] <= end]
    current = difference(selected[0], selected[-1]) if selected else None
    previous = indexed.get(prior_start)
    prior_change = (
        difference(previous, indexed[start])
        if previous is not None
        and (start - prior_start).days == span
        and tracked_since is not None
        and prior_start >= tracked_since
        else None
    )
    if not span or tracked_since is None or start < tracked_since:
        current = None
    bars = []
    window = [p for p in points if prior_start <= p["date"] <= end]
    baseline = window[0] if window else None
    for i, point in enumerate(window):
        last_of_month = i == len(window) - 1 or window[i + 1]["date"].month != point["date"].month
        if not last_of_month:
            continue
        eligible = (
            baseline is not None and tracked_since is not None and baseline["date"] >= tracked_since
        )
        covered = eligible and all(
            p["value"] is not None for p in window if baseline["date"] <= p["date"] <= point["date"]
        )
        bars.append(
            dict(
                month=point["date"].strftime("%Y-%m"),
                value=difference(baseline, point) if covered else None,
                current=point["date"] > start,
            )
        )
        baseline = point
    return dict(
        current_change=current,
        prior_change=prior_change,
        beat_by=current - prior_change
        if current is not None and prior_change is not None
        else None,
        prior_start=prior_start,
        bars=bars,
        method="Equal-length closing-value windows; monthly bars include partial boundary months. "
        "Net worth changes include contributions and are not investment returns.",
    )


def drivers(session, points, start, end, currency):
    first, last = points[0], points[-1]
    delta = difference(first, last)
    days = (end - start).days
    accounts = list(session.scalars(select(FinancialAccount)))
    fx = market_valuation.FXBook(session, end, market_valuation.preferences(session)["fx_provider"])
    all_flows, daily = investment_analytics.external_flows(
        session, [a.id for a in accounts], start, end, currency, fx
    )
    investment_flows, investment_daily = investment_analytics.external_flows(
        session, [a.id for a in accounts if a.type == "INVESTMENT"], start, end, currency, fx
    )
    reasons = sorted({f["reason"] for f in all_flows + investment_flows if f["reason"]})
    if delta is None:
        reasons.append("MISSING_ENDPOINT_VALUATION")
    if not days:
        reasons.append("DISTINCT_DATES_REQUIRED")
    if reasons:
        return dict(available=False, reasons=reasons, per_month=None, drivers=[], change=delta)
    delta = settled(delta)
    funding = settled(sum(daily.values(), ZERO))
    investment = settled(
        difference(first, last, "portfolio_value") - sum(investment_daily.values(), ZERO)
    )
    other = settled(difference(first, last, "manual_asset_value"))
    debt = settled(-difference(first, last, "manual_debt_value"))
    # This is an explicit bridge, not an invented gain: remaining cash/FX translation
    # after dated ledger funding, portfolio return and manual value/debt changes.
    cash_fx = delta - funding - investment - other - debt
    rows = [
        dict(key=key, value=value, per_month=settled(value * DAYS_PER_MONTH / days))
        for key, value in (
            ("funding", funding),
            ("investment", investment),
            ("other", other),
            ("debt", debt),
            ("cash_fx", cash_fx),
        )
    ]
    return dict(
        available=True,
        reasons=[],
        per_month=settled(delta * DAYS_PER_MONTH / days),
        change=delta,
        drivers=rows,
        method="Closing minus opening; ledger funding includes openings/net ordinary postings; "
        "linked transfers cancel. Portfolio gain includes investment FX. Other assets include "
        "record additions/disposals and valuation/FX changes. Manual debt change is not proof "
        "of repayment. Cash/FX includes settlement rounding and is separately reconciled.",
    )


def history_view(session, start, end, currency):
    wealth.valid_day(end)
    if start.year < 2 or start > end or (end - start).days > 3660:
        raise HTTPException(422, "Select an ordered range of at most ten years")
    with localcontext() as context:
        context.prec = 60
        span = (end - start).days
        lower = max(date(2, 1, 1), end - timedelta(days=min(3660, (end - date(2, 1, 1)).days)))
        extended = min(
            start,
            start - timedelta(days=min(span, (start - lower).days)),
            max(lower, end - timedelta(days=min(365, (end - lower).days))),
        )
        report = wealth.net_worth(session, extended, end, currency, details=True)
        recorded_dates = [
            session.scalar(
                select(func.min(Transaction.transaction_date)).where(
                    Transaction.deleted_at.is_(None), Transaction.transaction_date <= end
                )
            ),
            session.scalar(
                select(func.min(InvestmentActivity.activity_date)).where(
                    InvestmentActivity.voided_at.is_(None), InvestmentActivity.activity_date <= end
                )
            ),
            session.scalar(
                select(func.min(ManualPosition.start_date)).where(ManualPosition.start_date <= end)
            ),
        ]
        tracked_since = min((d for d in recorded_dates if d is not None), default=None)
        all_points = report["points"]
        keys = set().union(*(p["breakdown"] for p in all_points))
        for point in all_points:
            for key in keys:
                point["breakdown"].setdefault(key, ZERO)
        selected = [p for p in all_points if p["date"] >= start]
        first, last = selected[0], selected[-1]
        report.update(
            start=start,
            points=selected,
            change=difference(first, last),
            change_ratio=(last["value"] - first["value"]) / first["value"]
            if first["value"] is not None and first["value"] > ZERO and last["value"] is not None
            else None,
            assets_change=difference(first, last, "assets"),
            liabilities_change=difference(first, last, "liabilities"),
        )
        velocity = drivers(session, selected, start, end, currency)
        if tracked_since is None or start < tracked_since:
            velocity.update(
                available=False, reasons=["MISSING_RECORDED_BASELINE"], per_month=None, drivers=[]
            )
        trailing_start = end - timedelta(days=min(365, (end - date.min).days))
        trailing = next((p for p in all_points if p["date"] == trailing_start), None)
        trailing_change = difference(trailing, last) if trailing else None
        trailing_monthly = (
            settled(trailing_change * DAYS_PER_MONTH / 365)
            if trailing_change is not None
            and (end - trailing_start).days == 365
            and tracked_since is not None
            and trailing_start >= tracked_since
            else None
        )
        velocity["trailing_per_month"] = trailing_monthly
        velocity["pace_ratio"] = (
            velocity["per_month"] / trailing_monthly
            if velocity["available"]
            and trailing_monthly
            and span < 335
            and velocity["per_month"] / trailing_monthly > ZERO
            else None
        )
        report["insights"] = dict(
            tracked_since=tracked_since,
            momentum=momentum(all_points, start, end, tracked_since),
            velocity=velocity,
            categories=[
                dict(
                    key=key,
                    change=difference(first["breakdown"], last["breakdown"], key),
                )
                for key in sorted(keys)
            ],
            stale=[
                dict(id=c["id"], name=c["name"], days=(end - c["observation_date"]).days)
                for c in report["components"]
                if c.get("observation_date") and (end - c["observation_date"]).days > 90
            ],
            unlinked_mortgages=[
                p.id
                for p in session.scalars(select(ManualPosition))
                if p.kind == "LIABILITY"
                and p.category == "MORTGAGE"
                and not p.associated_asset_id
                and p.start_date <= end
                and (p.end_date is None or p.end_date > end)
            ],
        )
        return report
