"""Read-only analytics over the existing investment ledger and valuation readers."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import func, select

from app import investments
from app.analytics_models import AssetClassification
from app.market_valuation import FXBook, PriceBook, history, preferences
from app.models import Asset, FinancialAccount, InvestmentActivity, Transaction, Transfer
from app.performance_math import ZERO, metric, time_weighted, xirr


def scope_accounts(session, account_ids=None):
    accounts = list(
        session.scalars(select(FinancialAccount).where(FinancialAccount.type == "INVESTMENT"))
    )
    if account_ids is not None:
        selected = set(account_ids)
        accounts = [a for a in accounts if a.id in selected]
        if {a.id for a in accounts} != selected:
            raise HTTPException(404, "Investment account not found")
    return accounts


def external_flows(session, account_ids, start, end, currency, fx):
    """Exact linked boundaries; no fuzzy pairing and no activity cash duplication."""
    ids = set(account_ids)
    transfers = {t.id: t for t in session.scalars(select(Transfer))}
    entries = list(
        session.scalars(
            select(Transaction).where(
                Transaction.deleted_at.is_(None),
                Transaction.transaction_date > start,
                Transaction.transaction_date <= end,
            )
        )
    )
    by_id = {t.id: t for t in entries}
    totals = defaultdict(lambda: ZERO)
    rows = []
    with localcontext() as ctx:
        ctx.prec = 60
        for entry in entries:
            if entry.account_id not in ids:
                continue
            reason = None
            if entry.transaction_type == "TRANSFER":
                transfer = transfers.get(entry.transfer_id)
                if transfer is None:
                    reason = "UNKNOWN_TRANSFER_BOUNDARY"
                else:
                    source = by_id.get(transfer.source_entry_id)
                    destination = by_id.get(transfer.destination_entry_id)
                    valid = source is not None and destination is not None
                    if valid:
                        valid = all(
                            t.transfer_id == transfer.id
                            and t.amount == transfer.amount
                            and t.currency == transfer.currency
                            and t.transaction_date == transfer.transaction_date
                            and t.account_id == aid
                            and t.direction == direction
                            for t, aid, direction in (
                                (source, transfer.source_account_id, "OUT"),
                                (destination, transfer.destination_account_id, "IN"),
                            )
                        )
                    if not valid:
                        reason = "UNKNOWN_TRANSFER_BOUNDARY"
                    elif {transfer.source_account_id, transfer.destination_account_id} <= ids:
                        continue
            signed = entry.amount if entry.direction == "IN" else -entry.amount
            converted, conversion = fx.convert(
                signed, entry.currency, currency, entry.transaction_date
            )
            if converted is None:
                reason = "MISSING_FLOW_FX"
            rows.append(
                {
                    "id": entry.id,
                    "date": entry.transaction_date,
                    "account_id": entry.account_id,
                    "type": entry.transaction_type,
                    "amount": signed,
                    "currency": entry.currency,
                    "reporting_amount": None if reason else converted,
                    "fx": conversion,
                    "reason": reason,
                }
            )
            day = entry.transaction_date
            if reason:
                totals[day] = None
            elif totals[day] is not None:
                totals[day] += converted
    return rows, totals


def performance(session, start, end, currency, account_ids=None, benchmark_id=None):
    accounts = scope_accounts(session, account_ids)
    ids = [a.id for a in accounts]
    if start is None:
        dates = [
            session.scalar(
                select(func.min(Transaction.transaction_date)).where(
                    Transaction.account_id.in_(ids),
                    Transaction.deleted_at.is_(None),
                    Transaction.transaction_date <= end,
                )
            ),
            session.scalar(
                select(func.min(InvestmentActivity.activity_date)).where(
                    InvestmentActivity.account_id.in_(ids),
                    InvestmentActivity.voided_at.is_(None),
                    InvestmentActivity.activity_date <= end,
                )
            ),
        ]
        start = min((d for d in dates if d is not None), default=end) - timedelta(days=1)
    if start >= end:
        raise HTTPException(422, "Performance needs distinct ordered closing-value dates")
    values = history(
        session, start, end, reporting_currency=currency, account_ids=ids, serialize=False
    )
    fx = FXBook(session, end, preferences(session)["fx_provider"])
    flows, daily = external_flows(session, ids, start, end, currency, fx)
    twr, points = time_weighted(values["points"], daily)
    opening = values["points"][0]["value"]
    closing = values["points"][-1]["value"]
    reasons = sorted({f["reason"] for f in flows if f["reason"]})
    if opening is None or closing is None:
        reasons.append("MISSING_ENDPOINT_VALUATION")
    if (opening is not None and opening < ZERO) or (closing is not None and closing < ZERO):
        reasons.append("NEGATIVE_CAPITAL")
    with localcontext() as ctx:
        ctx.prec = 60
        net = None if any(v is None for v in daily.values()) else sum(daily.values(), ZERO)
        gain = metric(
            None if reasons else closing - opening - net,
            "ENDING_MINUS_BEGINNING_MINUS_NET_EXTERNAL_FLOWS",
            *reasons,
        )
        irr = (
            metric(None, "XIRR_ACTUAL_365_ANNUALIZED", *reasons)
            if reasons
            else xirr(
                [
                    (start, -opening),
                    *[(f["date"], -f["reporting_amount"]) for f in flows],
                    (end, closing),
                ]
            )
        )
        benchmark = None
        if benchmark_id is not None:
            book = PriceBook(session, end)
            asset = book.assets.get(benchmark_id)
            if asset is None:
                raise HTTPException(404, "Benchmark security not found")
            base = None
            benchmark_points = []
            for point in points:
                quote = book.select(benchmark_id, point["date"], historical=True)
                value, _ = (
                    fx.convert(quote.price, quote.currency, currency, point["date"])
                    if quote
                    else (None, None)
                )
                if point["date"] == start:
                    base = value
                benchmark_points.append(
                    {
                        "date": point["date"],
                        "return_percent": (value / base - 1) * 100
                        if value is not None and base
                        else None,
                    }
                )
            benchmark_value = benchmark_points[-1]["return_percent"]
            missing_days = sum(p["return_percent"] is None for p in benchmark_points)
            benchmark_metric = metric(
                benchmark_value,
                "ALIGNED_PRICE_RETURN",
                *(["MISSING_BENCHMARK_COVERAGE"] if missing_days else []),
            )
            if benchmark_value is not None and missing_days:
                benchmark_metric["quality"] = "PARTIAL"
            benchmark = {
                "asset_id": asset.id,
                "symbol": asset.symbol,
                "currency": asset.currency,
                "method": "PRICE_RETURN_PROXY_NOT_TOTAL_RETURN_INDEX",
                "points": benchmark_points,
                "return": benchmark_metric,
                "missing_days": missing_days,
                "source": quote.source if quote else None,
                "quote_date": quote.price_date if quote else None,
                "refreshed_at": quote.fetched_at if quote else None,
                "difference_percentage_points": twr["value"] - benchmark_value
                if twr["value"] is not None and benchmark_value is not None
                else None,
            }
    return investments.wire(
        {
            "start": start,
            "end": end,
            "currency": currency,
            "accounts": [{"id": a.id, "name": a.name} for a in accounts],
            "opening_value": opening,
            "ending_value": closing,
            "net_external_flows": net,
            "absolute_gain": gain,
            "twr": twr,
            "xirr": irr,
            "points": points,
            "valuation": values,
            "flows": flows,
            "benchmark": benchmark,
        }
    )


def income(session, start, end, account_ids=None, asset_id=None):
    if start > end or end > date.today() or (end - start).days > 3660:
        raise HTTPException(422, "Select an ordered historical period")
    accounts = {a.id: a for a in scope_accounts(session, account_ids)}
    rows = investments.activities(session, as_of=end)
    assets = {a.id: a for a in session.scalars(select(Asset))}
    events = []
    groups = {}
    with localcontext() as ctx:
        ctx.prec = 60
        for row in rows:
            if (
                row.account_id not in accounts
                or row.activity_date < start
                or row.activity_type not in {"DIVIDEND", "INTEREST"}
                or (asset_id and row.asset_id != asset_id)
            ):
                continue
            events.append(
                {
                    "id": row.id,
                    "date": row.activity_date,
                    "account_id": row.account_id,
                    "account": accounts[row.account_id].name,
                    "asset_id": row.asset_id,
                    "symbol": assets[row.asset_id].symbol if row.asset_id else "Cash interest",
                    "type": row.activity_type,
                    "currency": row.currency,
                    "gross": row.gross_amount,
                    "fees": row.fees,
                    "taxes": row.taxes,
                    "net": row.cash_amount,
                }
            )
            key = row.currency, row.activity_date.strftime("%Y-%m")
            group = groups.setdefault(
                key,
                {
                    "currency": row.currency,
                    "month": key[1],
                    "gross": ZERO,
                    "fees": ZERO,
                    "taxes": ZERO,
                    "net": ZERO,
                },
            )
            for field, value in (
                ("gross", row.gross_amount),
                ("fees", row.fees),
                ("taxes", row.taxes),
                ("net", row.cash_amount),
            ):
                group[field] += value
        breakdowns = {}
        for dimension in ("year", "account", "security", "type"):
            buckets = {}
            for entry in events:
                label = (
                    str(entry["date"].year)
                    if dimension == "year"
                    else entry["symbol"]
                    if dimension == "security"
                    else entry[dimension]
                )
                identity = (
                    entry["asset_id"]
                    if dimension == "security"
                    else entry["account_id"]
                    if dimension == "account"
                    else label
                )
                key = entry["currency"], str(identity)
                bucket = buckets.setdefault(
                    key,
                    {
                        "name": label,
                        "id": identity,
                        "currency": entry["currency"],
                        "gross": ZERO,
                        "fees": ZERO,
                        "taxes": ZERO,
                        "net": ZERO,
                    },
                )
                for field in ("gross", "fees", "taxes", "net"):
                    bucket[field] += entry[field]
            breakdowns[dimension] = [buckets[k] for k in sorted(buckets)]
    return investments.wire(
        {
            "start": start,
            "end": end,
            "method": "RECORDED_INVESTMENT_INCOME",
            "events": events,
            "months": [groups[k] for k in sorted(groups)],
            "breakdowns": breakdowns,
            "quality": "COMPLETE",
        }
    )


def allocation(session, as_of, currency, account_ids=None):
    """Cash-inclusive allocation. Unknown coverage never inflates known weights."""
    if as_of > date.today():
        raise HTTPException(422, "Select a historical valuation date")
    accounts = {a.id: a for a in scope_accounts(session, account_ids)}
    snapshot = investments.portfolio(session, as_of=as_of, serialize=False)
    book = PriceBook(session, as_of)
    fx = FXBook(session, as_of, preferences(session)["fx_provider"])
    metadata = {r.asset_id: r for r in session.scalars(select(AssetClassification))}
    rows = []
    reasons = set()
    with localcontext() as ctx:
        ctx.prec = 60
        for position in snapshot["positions"]:
            if position["account_id"] not in accounts or not position["quantity"]:
                continue
            asset_id = position["asset_id"]
            quote = book.select(asset_id, as_of, historical=True)
            original = position["quantity"] * quote.price if quote else None
            converted, _ = (
                fx.convert(original, position["currency"], currency, as_of)
                if original is not None
                else (None, None)
            )
            if converted is None:
                reasons.add("MISSING_PRICE_OR_FX")
            classification = metadata.get(asset_id)
            rows.append(
                {
                    "asset_id": asset_id,
                    "account_id": position["account_id"],
                    "security": f"{position['symbol']} · {position['exchange']} "
                    f"· {position['currency']}",
                    "account": accounts[position["account_id"]].name,
                    "asset_class": position["asset_type"],
                    "currency": position["currency"],
                    "sector": classification.sector
                    if classification and classification.sector
                    else "Unknown",
                    "geography": classification.geography
                    if classification and classification.geography
                    else "Unknown",
                    "original_value": original,
                    "value": converted,
                }
            )
        for account in snapshot["accounts"]:
            if account["id"] not in accounts:
                continue
            value, _ = fx.convert(account["cash"], account["currency"], currency, as_of)
            if account["cash"] == ZERO:
                value = ZERO
            if value is None:
                reasons.add("MISSING_CASH_FX")
            if account["cash"] < ZERO:
                reasons.add("NEGATIVE_CASH_ALLOCATION")
            rows.append(
                {
                    "asset_id": None,
                    "account_id": account["id"],
                    "security": "Cash",
                    "account": account["name"],
                    "asset_class": "CASH",
                    "currency": account["currency"],
                    "sector": "Cash",
                    "geography": "Unknown",
                    "original_value": account["cash"],
                    "value": value,
                }
            )
        known = sum((r["value"] for r in rows if r["value"] is not None), ZERO)
        total = None if reasons else known
        groups = {}
        for dimension in ("security", "account", "asset_class", "currency", "sector", "geography"):
            buckets = {}
            for row in rows:
                bucket = buckets.setdefault(
                    row[dimension],
                    {"name": row[dimension], "value": ZERO, "complete": True, "members": []},
                )
                bucket["members"].append(
                    {"account_id": row["account_id"], "asset_id": row["asset_id"]}
                )
                if row["value"] is None:
                    bucket["complete"] = False
                else:
                    bucket["value"] += row["value"]
            for bucket in buckets.values():
                if not bucket["complete"]:
                    bucket["value"] = None
                bucket["weight_percent"] = (
                    bucket["value"] / total * 100
                    if total and total > ZERO and bucket["value"] is not None
                    else None
                )
            groups[dimension] = sorted(
                buckets.values(),
                key=lambda b: (b["value"] is None, -(b["value"] or ZERO), b["name"]),
            )
        concentration = {}
        # Cash is visible in allocation but not a security concentration holding.
        securities = [r for r in groups["security"] if r["name"] != "Cash"]
        for count in (1, 3, 5):
            concentration[str(count)] = (
                sum((r["value"] or ZERO for r in securities[:count]), ZERO) / total * 100
                if total and total > ZERO
                else None
            )
    return investments.wire(
        {
            "as_of": as_of,
            "currency": currency,
            "method": "CASH_PLUS_HISTORICAL_MARKET_VALUE",
            "quality": "PARTIAL" if reasons else "COMPLETE",
            "reasons": sorted(reasons),
            "total_value": total,
            "known_value": known,
            "groups": groups,
            "concentration": concentration,
            "rows": rows,
            "metadata_policy": "Current user-declared metadata, including on past dates; "
            "Unknown is not inferred. No ETF look-through.",
        }
    )


def insights(session, start, end, currency, account_ids=None, asset_id=None):
    if start > end or end > date.today() or (end - start).days > 3660:
        raise HTTPException(422, "Select an ordered historical range of at most ten years")
    accounts = {a.id: a for a in scope_accounts(session, account_ids)}
    ids = set(accounts)
    rows = [r for r in investments.activities(session, as_of=end) if r.account_id in ids]
    opening = investments.reconstruct([r for r in rows if r.activity_date <= start])
    closing = investments.reconstruct(rows)
    prices = PriceBook(session, end)
    fx = FXBook(session, end, preferences(session)["fx_provider"])
    by_key = defaultdict(list)
    activity_counts = defaultdict(int)
    for row in rows:
        if row.activity_date > start:
            by_key[(row.account_id, row.asset_id, row.currency)].append(row)
            activity_counts[(row.activity_date.strftime("%Y-%m"), row.activity_type)] += 1
    positions = []
    with localcontext() as ctx:
        ctx.prec = 60
        for key, final in closing.items():
            aid, sid, original_currency = key
            if asset_id and sid != asset_id:
                continue
            initial = opening.get(
                key, dict(quantity=ZERO, cost_basis=ZERO, realized=ZERO, income=ZERO)
            )
            activity = by_key[key]
            security = prices.assets.get(sid)
            before = prices.select(sid, start, historical=True) if sid else None
            after = prices.select(sid, end, historical=True) if sid else None
            first_value = (
                initial["quantity"] * before.price
                if before
                else None
                if initial["quantity"]
                else ZERO
            )
            last_value = (
                final["quantity"] * after.price if after else None if final["quantity"] else ZERO
            )
            unrealized = last_value - final["cost_basis"] if last_value is not None else None
            unrealized_change = (
                unrealized - (first_value - initial["cost_basis"])
                if unrealized is not None and first_value is not None
                else None
            )
            realized = final["realized"] - initial["realized"]
            net_income = final["income"] - initial["income"]
            standalone = sum(
                (r.cash_amount for r in activity if r.activity_type in {"FEE", "TAX"}), ZERO
            )
            fees = sum(
                (r.fees + (r.gross_amount if r.activity_type == "FEE" else ZERO) for r in activity),
                ZERO,
            )
            taxes = sum(
                (
                    r.taxes + (r.gross_amount if r.activity_type == "TAX" else ZERO)
                    for r in activity
                ),
                ZERO,
            )
            contribution = metric(
                None, "UNCHANGED_QUANTITY_FX_DECOMPOSITION", "REQUIRES_UNCHANGED_PRICED_POSITION"
            )
            if (
                before
                and after
                and initial["quantity"] == final["quantity"]
                and initial["quantity"] > ZERO
                and not any(r.activity_type in {"BUY", "SELL"} for r in activity)
            ):
                rate0, _ = fx.convert(Decimal(1), original_currency, currency, start)
                rate1, _ = fx.convert(Decimal(1), original_currency, currency, end)
                if rate0 is not None and rate1 is not None:
                    contribution = metric(
                        final["quantity"] * after.price * (rate1 - rate0),
                        "ENDING_LOCAL_VALUE_TIMES_FX_CHANGE",
                    )
                    contribution["local_price_effect"] = (
                        final["quantity"] * (after.price - before.price) * rate0
                    )
            positions.append(
                {
                    "account_id": aid,
                    "account": accounts[aid].name,
                    "asset_id": sid,
                    "symbol": security.symbol if security else "Account cash income / charges",
                    "currency": original_currency,
                    "quantity": final["quantity"],
                    "cost_basis": final["cost_basis"],
                    "average_cost": final["cost_basis"] / final["quantity"]
                    if final["quantity"]
                    else ZERO,
                    "market_value": last_value,
                    "realized": realized,
                    "unrealized": unrealized,
                    "unrealized_change": unrealized_change,
                    "income": net_income,
                    "fees": fees,
                    "taxes": taxes,
                    "standalone_charges": standalone,
                    "total_gain": realized + unrealized_change + net_income - standalone
                    if unrealized_change is not None
                    else None,
                    "fx_contribution": contribution,
                }
            )
    return investments.wire(
        {
            "start": start,
            "end": end,
            "currency": currency,
            "positions": positions,
            "activity_trends": [
                {"month": month, "type": kind, "count": count}
                for (month, kind), count in sorted(activity_counts.items())
            ],
            "method": "PERIOD_PNL_COMPONENTS_ORIGINAL_CURRENCIES",
            "warning": "Recorded fees/taxes are already included in trade basis, proceeds "
            "or net income. Only standalone charges are deducted separately. Components "
            "are not a full reporting-currency attribution. FX decomposition is restricted "
            "to unchanged quantities; no yield is projected.",
        }
    )
