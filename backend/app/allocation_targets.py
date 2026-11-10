"""Exact target configuration and drift, never trade proposals or cash postings.

Band conventions follow pinned allocation_targets/model.rs and drift_service.rs.
Reuse the canonical allocation denominator and explicit classification metadata.
"""

from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import select

from app.allocation_models import AllocationTarget, AllocationTargetAccount, AllocationTargetWeight
from app.investment_analytics import allocation, scope_accounts
from app.investments import wire


def weights(session, target):
    return list(
        session.scalars(
            select(AllocationTargetWeight)
            .where(
                AllocationTargetWeight.target_id == target.id,
                AllocationTargetWeight.version == target.version,
            )
            .order_by(AllocationTargetWeight.category)
        )
    )


def accounts(session, target):
    return list(
        session.scalars(
            select(AllocationTargetAccount.account_id)
            .where(
                AllocationTargetAccount.target_id == target.id,
                AllocationTargetAccount.version == target.version,
            )
            .order_by(AllocationTargetAccount.account_id)
        )
    )


def detail(session, target):
    return wire(
        dict(target=target, weights=weights(session, target), account_ids=accounts(session, target))
    )


def save(session, data, target=None, *, new_id=None):
    if sum(row.target_bps for row in data.weights) != 10000:
        raise HTTPException(422, "Target weights must total exactly 100 percent")
    if len({row.category for row in data.weights}) != len(data.weights):
        raise HTTPException(422, "Choose each classification once")
    if len(set(data.account_ids)) != len(data.account_ids):
        raise HTTPException(422, "Choose each account once")
    if data.scope == "accounts":
        if not data.account_ids:
            raise HTTPException(422, "Select at least one investment account")
        scope_accounts(session, data.account_ids)
    elif data.account_ids:
        raise HTTPException(422, "All-account targets cannot retain hidden account selections")
    if target:
        if not target.active:
            raise HTTPException(
                410, "Deleted target configuration is retained and cannot be edited"
            )
        if data.expected_version != target.version:
            raise HTTPException(409, "Target changed; reload before saving")
        target.version += 1
    else:
        target = AllocationTarget(version=1, active=True, **({"id": new_id} if new_id else {}))
        session.add(target)
    for name in (
        "name",
        "dimension",
        "currency",
        "scope",
        "band_type",
        "band_bps",
        "relative_factor_bps",
    ):
        setattr(target, name, getattr(data, name))
    session.flush()
    session.add_all(
        [
            AllocationTargetWeight(target_id=target.id, version=target.version, **row.model_dump())
            for row in data.weights
        ]
    )
    session.add_all(
        [
            AllocationTargetAccount(
                target_id=target.id, version=target.version, account_id=account_id
            )
            for account_id in data.account_ids
        ]
    )
    session.flush()
    return target


def effective_band(target_bps, band_bps, relative_factor_bps, band_type):
    # Source uses integer BPS and truncates the relative product before max.
    return (
        max(band_bps, target_bps * relative_factor_bps // 10000)
        if band_type == "hybrid"
        else band_bps
    )


def drift(session, target, day):
    scope = accounts(session, target) if target.scope == "accounts" else None
    report = allocation(session, day, target.currency, scope)
    complete = report["quality"] == "COMPLETE" and report["total_value"] is not None
    total = Decimal(report["total_value"]) if complete else None
    complete = complete and total > 0
    current = {row["name"]: row for row in report["groups"][target.dimension]}
    configured = {row.category: row for row in weights(session, target)}
    rows = []
    with localcontext() as context:
        context.prec = 60
        for category in sorted(set(current) | set(configured)):
            config, actual = configured.get(category), current.get(category)
            target_bps = config.target_bps if config else 0
            required = config.required if config else False
            current_value = (
                Decimal(actual["value"])
                if actual and actual["value"] is not None
                else Decimal(0)
                if actual is None and complete
                else None
            )
            current_bps = current_value / total * 10000 if complete else None
            target_value = total * target_bps / 10000 if complete else None
            delta = current_bps - target_bps if current_bps is not None else None
            band = effective_band(
                target_bps, target.band_bps, target.relative_factor_bps, target.band_type
            )
            status = (
                "unavailable"
                if delta is None
                else "not_targeted"
                if not config and current_value > 0
                else "within_band"
                if abs(delta) <= band
                else "overweight"
                if delta > 0
                else "underweight"
            )
            rows.append(
                dict(
                    category=category,
                    current_value=current_value,
                    current_bps=current_bps,
                    target_bps=target_bps,
                    target_value=target_value,
                    drift_bps=delta,
                    value_delta=current_value - target_value if complete else None,
                    effective_band_bps=band,
                    required=required,
                    status=status,
                    members=actual["members"] if actual else [],
                )
            )
    return wire(
        dict(
            target_id=target.id,
            as_of=day,
            currency=target.currency,
            dimension=target.dimension,
            scope=target.scope,
            account_ids=scope or [],
            total_value=total if complete else None,
            known_value=report["known_value"],
            quality="COMPLETE" if complete else "UNAVAILABLE",
            rows=rows,
            out_of_band_count=(
                sum(
                    r["status"] == "not_targeted"
                    or (r["required"] and r["status"] in {"overweight", "underweight"})
                    for r in rows
                )
                if complete
                else None
            ),
            reasons=report["reasons"]
            if report["reasons"]
            else []
            if complete
            else ["NONPOSITIVE_PORTFOLIO_VALUE"],
            method="CASH_INCLUSIVE_DATED_VALUES_VS_LOCAL_PLANNING_TARGETS",
            limitations=[
                "No trades, liquidity recommendations or tax/fee optimization",
                report["metadata_policy"],
            ],
        )
    )
