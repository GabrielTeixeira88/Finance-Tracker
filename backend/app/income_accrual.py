"""Read-only contractual earnings, kept separate from distributions and Treasury marks."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext

from fastapi import HTTPException

from app import investments
from app.fixed_income import tax_estimate
from app.fixed_income_reporting import redemption_results
from app.investment_schemas import settled
from app.market_valuation import PriceBook

ZERO = Decimal(0)


def accrual_income(session, start, end, account_ids=None):
    from app.investment_analytics import scope_accounts

    if start > end or end > date.today() or (end - start).days > 3660:
        raise HTTPException(422, "Select an ordered historical period of at most ten years")
    accounts = {account.id: account for account in scope_accounts(session, account_ids)}
    book = PriceBook(session, end)
    contracts = {
        asset: contract
        for asset, contract in book.fixed.contracts.items()
        if contract.account_id in accounts
        and contract.instrument_type != "TESOURO_SELIC"
        and contract.settlement_date <= end
    }
    rows = [row for row in investments.activities(session, as_of=end) if row.account_id in accounts]
    by_asset = defaultdict(list)
    for row in rows:
        if row.asset_id in contracts:
            by_asset[row.asset_id].append(row)
    # Reuse the authoritative weighted-average reconstruction only on posting dates.
    # The number of reconstructions depends on postings, not calendar points.
    states = {}
    for asset, entries in by_asset.items():
        seen, timeline = [], []
        grouped = defaultdict(list)
        for row in entries:
            grouped[row.activity_date].append(row)
        contract = contracts[asset]
        for day, entries_on_day in sorted(grouped.items()):
            seen.extend(entries_on_day)
            position = investments.reconstruct(seen)[(contract.account_id, asset, "BRL")]
            timeline.append((day, position))
        states[asset] = timeline

    redemptions = [
        row
        for row in redemption_results(session, rows, accounts, book.assets, start)
        if row["asset_id"] in contracts
    ]
    with localcontext() as context:
        context.prec = 60

        def snapshot(day):
            values = []
            for asset, contract in contracts.items():
                state = next(
                    (position for when, position in reversed(states.get(asset, [])) if when <= day),
                    None,
                )
                if not state or not state["quantity"]:
                    continue
                quote = book.select(asset, day, historical=True)
                principal = state["cost_basis"]
                value = state["quantity"] * quote.price if quote else None
                # Match the existing contract snapshot's settlement boundary.
                if value is not None:
                    value = settled(value)
                estimate = (
                    tax_estimate(principal, value, (day - contract.settlement_date).days)
                    if value is not None
                    else None
                )
                values.append(
                    dict(
                        principal=principal,
                        value=value,
                        gross_interest=value - principal if value is not None else None,
                        estimated_net_earnings=estimate["estimated_net"] - principal
                        if estimate
                        else None,
                        income_tax=estimate["income_tax"] if estimate else None,
                        iof=estimate["iof"] if estimate else None,
                    )
                )

            def total(field):
                return (
                    None
                    if any(row[field] is None for row in values)
                    else sum((row[field] for row in values), ZERO)
                )

            return dict(
                date=day,
                principal=total("principal"),
                value=total("value"),
                gross_interest=total("gross_interest"),
                estimated_net_earnings=total("estimated_net_earnings"),
                income_tax=total("income_tax"),
                iof=total("iof"),
                cdi_return_percent=None,
                contract_return_percent=None,
                quality="PARTIAL" if any(row["value"] is None for row in values) else "COMPLETE",
            )

        opening = snapshot(start - timedelta(days=1))
        # Do not invent a flat history before the first contractual application.
        points, day = (
            [],
            max(
                start,
                min(
                    (c.settlement_date for c in contracts.values()), default=end + timedelta(days=1)
                ),
            ),
        )
        while day <= end:
            points.append(snapshot(day))
            day += timedelta(days=1)
        closing = points[-1] if points else snapshot(end)
        redeemed_gross = sum((row["gross"] - row["principal"] for row in redemptions), ZERO)
        redeemed_net = sum((row["realized"] for row in redemptions), ZERO)
        gross = (
            closing["gross_interest"] - opening["gross_interest"] + redeemed_gross
            if closing["gross_interest"] is not None and opening["gross_interest"] is not None
            else None
        )
        net = (
            closing["estimated_net_earnings"] - opening["estimated_net_earnings"] + redeemed_net
            if closing["estimated_net_earnings"] is not None
            and opening["estimated_net_earnings"] is not None
            else None
        )
        return investments.wire(
            dict(
                start=start,
                end=end,
                currency="BRL",
                opening=opening,
                closing=closing,
                period=dict(
                    gross=gross,
                    estimated_net=net,
                    redeemed_gross=redeemed_gross,
                    redeemed_net=redeemed_net,
                ),
                history=dict(
                    currency="BRL",
                    source="DERIVED_CONTRACTUAL_ACCRUAL",
                    fictional=any(contract.fictional for contract in contracts.values()),
                    points=points,
                ),
                contracts_count=len(contracts),
                quality="COMPLETE"
                if all(point["quality"] == "COMPLETE" for point in [opening, *points])
                else "PARTIAL",
                method="CLOSING_OUTSTANDING_MINUS_PRIOR_DAY_OPENING_PLUS_REALIZED_REDEMPTION_GAINS",
                net_policy=(
                    "Estimated net earnings include changes in hypothetical IR/IOF reserves "
                    "plus actual net redemption gains. Not cash income or a promised return; "
                    "no Treasury marks included."
                ),
            )
        )
