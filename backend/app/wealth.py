"""Read-only wealth projections and non-posting manual records."""

from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_CEILING, Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import select

from app import ledger, market_valuation
from app.models import FinancialAccount, Transaction
from app.wealth_models import (
    Goal,
    GoalAccountFunding,
    GoalEntry,
    ManualPosition,
    PositionObservation,
)

ZERO = Decimal(0)


def valid_day(day):
    if day > date.today() or day.year < 2:
        raise HTTPException(422, "Use a historical effective date")


def position_values(session, position):
    return list(
        session.scalars(
            select(PositionObservation)
            .where(PositionObservation.position_id == position.id)
            .order_by(
                PositionObservation.effective_date,
                PositionObservation.created_at,
                PositionObservation.id,
            )
        )
    )


def check_position(session, position):
    valid_day(position.start_date)
    if position.kind == "ASSET" and any(
        getattr(position, key) is not None
        for key in ("interest_rate", "minimum_payment", "payment_frequency", "expected_payoff_date")
    ):
        raise HTTPException(422, "Loan terms apply only to liabilities")
    if position.expected_payoff_date and position.expected_payoff_date < position.start_date:
        raise HTTPException(422, "Expected payoff precedes the debt start")
    if position.end_date:
        valid_day(position.end_date)
        if position.end_date < position.start_date:
            raise HTTPException(422, "End date must follow ownership start")
    if position.associated_asset_id:
        asset = ledger.require(session, ManualPosition, position.associated_asset_id)
        if position.kind != "LIABILITY" or asset.kind != "ASSET" or asset.id == position.id:
            raise HTTPException(422, "Only a liability may link to a separate manual asset")
        if asset.currency != position.currency:
            raise HTTPException(422, "Linked property and debt must share a currency")
    # Manual records cannot represent ledger accounts or investment securities.
    names = {" ".join(a.name.split()).casefold() for a in session.scalars(select(FinancialAccount))}
    from app.models import Asset

    names.update(" ".join(a.name.split()).casefold() for a in session.scalars(select(Asset)))
    names.update(" ".join(a.symbol.split()).casefold() for a in session.scalars(select(Asset)))
    names.update(
        " ".join(p.name.split()).casefold()
        for p in session.scalars(select(ManualPosition))
        if p.id != position.id
    )
    if " ".join(position.name.split()).casefold() in names:
        raise HTTPException(
            409, "Already represented by an account or security; do not duplicate it"
        )
    if position.category.upper() in {
        "CREDIT_CARD",
        "INVESTMENT",
        "CASH",
        "CHECKING",
        "SAVINGS",
        "SECURITY",
    }:
        raise HTTPException(422, "Use the existing financial account or investment workflow")


def add_observation(session, position, data):
    valid_day(data.effective_date)
    if data.effective_date < position.start_date or (
        position.end_date and data.effective_date >= position.end_date
    ):
        raise HTTPException(422, "Observation must fall within ownership dates")
    if any(
        o.effective_date == data.effective_date and not o.voided_at
        for o in position_values(session, position)
    ):
        raise HTTPException(409, "Correct or void the existing observation on this date first")
    row = PositionObservation(position_id=position.id, **data.model_dump())
    session.add(row)
    session.flush()
    return row


def void_record(record, reason):
    if record.voided_at:
        raise HTTPException(409, "Record is already voided")
    record.voided_at = datetime.now(UTC)
    record.void_reason = reason


def net_worth(session, start, end, currency):
    valid_day(end)
    if start > end or (end - start).days > 3660 or start.year < 2:
        raise HTTPException(422, "Select an ordered range of at most ten years")
    with localcontext() as ctx:
        ctx.prec = 60
        accounts = list(session.scalars(select(FinancialAccount).order_by(FinancialAccount.name)))
        investments = {
            a.id: market_valuation.history(session, start, end, a.id, a.currency, serialize=False)[
                "points"
            ]
            for a in accounts
            if a.type == "INVESTMENT"
        }
        cash = ledger.balance_series(
            session, [start + timedelta(days=n) for n in range((end - start).days + 1)]
        )
        positions = list(session.scalars(select(ManualPosition).order_by(ManualPosition.name)))
        observations = {
            p.id: [o for o in position_values(session, p) if not o.voided_at] for p in positions
        }
        fx = market_valuation.FXBook(
            session, end, market_valuation.preferences(session)["fx_provider"]
        )
        points, final = [], []
        day = start
        while day <= end:
            balances = cash[day]
            components = []
            for a in accounts:
                amount = balances.get(a.id, ZERO)
                missing = []
                if a.id in investments:
                    point = investments[a.id][(day - start).days]
                    amount = point["known_value"]
                    missing = (
                        ["Missing historical investment price"] if point["missing_assets"] else []
                    )
                components.append(
                    dict(
                        id=a.id,
                        name=a.name,
                        source="ACCOUNT",
                        category=a.type,
                        currency=a.currency,
                        native_value=amount,
                        missing=missing,
                        liquidity="MARKETABLE" if a.type == "INVESTMENT" else "LIQUID",
                        active=a.active,
                    )
                )
            for p in positions:
                if day < p.start_date or (p.end_date and day >= p.end_date):
                    continue
                eligible = [o for o in observations[p.id] if o.effective_date <= day]
                amount = eligible[-1].amount if eligible else None
                components.append(
                    dict(
                        id=p.id,
                        name=p.name,
                        source=p.kind,
                        category=p.category,
                        currency=p.currency,
                        native_value=(-amount if p.kind == "LIABILITY" else amount)
                        if amount is not None
                        else None,
                        missing=[] if eligible else ["Missing dated manual value"],
                        liquidity=p.liquidity,
                        observation_date=eligible[-1].effective_date if eligible else None,
                    )
                )
            assets, debts, liquid = ZERO, ZERO, ZERO
            for c in components:
                converted, provenance = (
                    fx.convert(c["native_value"], c["currency"], currency, day)
                    if c["native_value"] is not None
                    else (None, None)
                )
                # A genuinely zero position needs no exchange rate.
                if c["native_value"] == ZERO:
                    converted, provenance = ZERO, None
                c.update(value=converted, fx=provenance)
                if converted is None and c["native_value"] is not None:
                    c["missing"].append("Missing historical FX")
                if converted is not None:
                    assets += max(converted, ZERO)
                    debts += max(-converted, ZERO)
                    if c["liquidity"] == "LIQUID":
                        liquid += max(converted, ZERO)
                    elif c["source"] == "ACCOUNT" and c["category"] == "INVESTMENT":
                        brokerage_cash = max(balances.get(c["id"], ZERO), ZERO)
                        converted_cash, _ = fx.convert(brokerage_cash, c["currency"], currency, day)
                        if converted_cash is not None:
                            liquid += converted_cash
            complete = not any(c["missing"] for c in components)
            points.append(
                dict(
                    date=day,
                    value=assets - debts if complete else None,
                    known_value=assets - debts,
                    assets=assets if complete else None,
                    liabilities=debts if complete else None,
                    complete=complete,
                )
            )
            final = components
            day += timedelta(days=1)
        complete = points[-1]["complete"]
        categories = {}
        for c in final:
            key = (
                c["category"],
                "LIABILITY"
                if c["source"] == "LIABILITY"
                or (c["native_value"] is not None and c["native_value"] < 0)
                else "ASSET",
            )
            row = categories.setdefault(
                key, dict(category=key[0], kind=key[1], known_value=ZERO, complete=True)
            )
            row["known_value"] += abs(c["value"]) if c["value"] is not None else ZERO
            row["complete"] = row["complete"] and not c["missing"]
        for row in categories.values():
            row["value"] = row["known_value"] if row["complete"] else None
        return dict(
            currency=currency,
            start=start,
            end=end,
            points=points,
            components=final,
            categories=list(categories.values()),
            assets=assets if complete else None,
            liabilities=debts if complete else None,
            value=assets - debts if complete else None,
            known_value=assets - debts,
            complete=complete,
            change=points[-1]["value"] - points[0]["value"]
            if complete and points[0]["complete"]
            else None,
            change_ratio=(points[-1]["value"] - points[0]["value"]) / points[0]["value"]
            if complete and points[0]["complete"] and points[0]["value"] > 0
            else None,
            assets_change=points[-1]["assets"] - points[0]["assets"]
            if complete and points[0]["complete"]
            else None,
            liabilities_change=points[-1]["liabilities"] - points[0]["liabilities"]
            if complete and points[0]["complete"]
            else None,
            debt_to_assets=debts / assets if complete and assets else None,
            liquid_share=liquid / assets if complete and assets else None,
            method=(
                "End-of-day ledger and historical investment valuations; "
                "manual values carry forward until disposal. Goals are not assets."
            ),
        )


def goal_entries(session, goal):
    return list(
        session.scalars(
            select(GoalEntry)
            .where(GoalEntry.goal_id == goal.id)
            .order_by(GoalEntry.effective_date, GoalEntry.created_at, GoalEntry.id)
        )
    )


def allocation_map(session, day, book=None):
    allocations = {}
    for g in book.goals if book else session.scalars(select(Goal).where(Goal.mode == "ACCOUNT")):
        if g.mode != "ACCOUNT":
            continue
        if g.start_date > day or (g.archived_date and g.archived_date <= day):
            continue
        for entry in book.entries.get(g.id, []) if book else goal_entries(session, g):
            if not entry.voided_at and entry.effective_date <= day:
                allocations[(g.id, entry.account_id)] = entry.amount
    return allocations


def goal_progress(session, goal, day, book=None):
    if day < goal.start_date:
        return ZERO, []
    funding = (
        book.funding.get(goal.id)
        if book
        else session.scalar(select(GoalAccountFunding).where(GoalAccountFunding.goal_id == goal.id))
    )
    if funding:
        if day < funding.effective_date or (goal.archived_date and goal.archived_date <= day):
            return ZERO, []
        if book:
            point = book.investments.get((funding.account_id, day))
        else:
            point = market_valuation.history(
                session, day, day, account_id=funding.account_id, serialize=False
            )["points"][0]
        value = point["value"] if point else None
        return (
            (max(value, ZERO), [])
            if value is not None
            else (ZERO, ["Investment funding has missing dated market coverage"])
        )
    if goal.mode == "MANUAL":
        return sum(
            (
                e.amount if e.direction == "IN" else -e.amount
                for e in (book.entries.get(goal.id, []) if book else goal_entries(session, goal))
                if not e.voided_at and e.effective_date <= day
            ),
            ZERO,
        ), []
    allocation = allocation_map(session, day, book)
    balances = book.balances[day] if book else ledger.balances(session, cutoff=day)
    warnings = []
    own = {a: v for (g, a), v in allocation.items() if g == goal.id}
    for a in own:
        total = sum((v for (_, account), v in allocation.items() if account == a), ZERO)
        if total > max(balances.get(a, ZERO), ZERO):
            warnings.append("Allocated savings exceed the current account balance")
    return sum(own.values(), ZERO), warnings


def check_goal(session, goal):
    valid_day(goal.start_date)
    if goal.deadline and goal.deadline < goal.start_date:
        raise HTTPException(422, "Deadline must follow the goal start")
    funding = session.scalar(
        select(GoalAccountFunding).where(GoalAccountFunding.goal_id == goal.id)
    )
    if funding and (
        goal.mode != "ACCOUNT"
        or session.get(FinancialAccount, funding.account_id).currency != goal.currency
        or goal.start_date > funding.effective_date
    ):
        raise HTTPException(
            409, "Preserve the reserved investment account's currency, mode and funding date"
        )
    for e in goal_entries(session, goal):
        if not e.voided_at and e.effective_date < goal.start_date:
            raise HTTPException(409, "Start date cannot exclude existing progress")


def validate_progress(session, goal):
    session.flush()
    dates = {
        e.effective_date
        for e in session.scalars(select(GoalEntry).where(GoalEntry.voided_at.is_(None)))
    }
    dates.add(date.today())
    dates.update(
        session.scalars(
            select(Transaction.transaction_date).where(
                Transaction.deleted_at.is_(None),
                Transaction.transaction_date <= date.today(),
                Transaction.transaction_date >= goal.start_date,
            )
        )
    )
    book = GoalBook(session, dates)
    for day in sorted(dates):
        value, warnings = goal_progress(session, goal, day, book)
        if value < 0 or warnings:
            raise HTTPException(409, "Progress cannot be negative or exceed shared account savings")


def add_goal_entry(session, goal, data):
    valid_day(data.effective_date)
    if session.scalar(select(GoalAccountFunding).where(GoalAccountFunding.goal_id == goal.id)):
        raise HTTPException(
            409,
            "This goal tracks its reserved investment account; fund or redeem that account instead",
        )
    if goal.status in {"ARCHIVED", "COMPLETED"} or data.effective_date < goal.start_date:
        raise HTTPException(409, "Reopen the goal or choose a date after its start")
    if goal.mode == "ACCOUNT":
        if data.account_id is None or data.direction != "IN":
            raise HTTPException(422, "Account goals require a nonnegative allocation")
        account = ledger.posting_account(session, data.account_id)
        if account.type not in {"CHECKING", "SAVINGS", "CASH"} or account.currency != goal.currency:
            raise HTTPException(422, "Allocate same-currency cash, checking or savings")
    elif data.account_id is not None:
        raise HTTPException(422, "Manual contributions cannot link an account")
    if goal.mode == "ACCOUNT" and any(
        e.account_id == data.account_id
        and e.effective_date == data.effective_date
        and not e.voided_at
        for e in goal_entries(session, goal)
    ):
        raise HTTPException(409, "Correct the existing dated allocation first")
    entry = GoalEntry(goal_id=goal.id, **data.model_dump())
    session.add(entry)
    validate_progress(session, goal)
    return entry


def goal_detail(session, goal, day, monthly=ZERO):
    valid_day(day)
    with localcontext() as ctx:
        ctx.prec = 60
        saved, warnings = goal_progress(session, goal, day)
        remaining = max(goal.target - saved, ZERO)
        months = (
            (goal.deadline.year - day.year) * 12 + goal.deadline.month - day.month + 1
            if goal.deadline and goal.deadline >= day
            else None
        )
        import calendar

        closed_month = day.day == calendar.monthrange(day.year, day.month)[1]
        if months and closed_month:
            months -= 1
        if (
            months
            and goal.deadline.day < calendar.monthrange(goal.deadline.year, goal.deadline.month)[1]
        ):
            months -= 1
        required = (
            (remaining / months).quantize(Decimal("0.01"), rounding=ROUND_CEILING)
            if months
            else None
        )
        count = (
            int((remaining / monthly).to_integral_value(rounding=ROUND_CEILING))
            if monthly > 0
            else None
        )
        completion = None
        if count is not None and count <= 600:
            y, m = divmod(day.year * 12 + day.month - 1 + max(count - 1, 0) + closed_month, 12)
            completion = date(y, m + 1, calendar.monthrange(y, m + 1)[1])
        if not remaining:
            completion = day
        dates = sorted(
            ({goal.start_date, day} if goal.start_date <= day else {day})
            | {e.effective_date for e in goal_entries(session, goal) if e.effective_date <= day}
        )
        if goal.mode == "ACCOUNT":
            # Include balance-changing dates so an intervening cash shortage is visible.
            dates = sorted(
                set(dates)
                | set(
                    session.scalars(
                        select(Transaction.transaction_date).where(
                            Transaction.transaction_date >= goal.start_date,
                            Transaction.transaction_date <= day,
                            Transaction.deleted_at.is_(None),
                        )
                    )
                )
            )
            if goal.archived_date and goal.archived_date <= day:
                dates = sorted(set(dates) | {goal.archived_date})
        funding = session.scalar(
            select(GoalAccountFunding).where(GoalAccountFunding.goal_id == goal.id)
        )
        if funding:
            # Daily valuation includes accrual without daily ledger/goal postings.
            dates = [
                goal.start_date + timedelta(days=n) for n in range((day - goal.start_date).days + 1)
            ]
        book = GoalBook(session, dates)
        result = dict(
            goal=goal,
            saved=None if warnings else saved,
            allocated=saved,
            remaining=None if warnings else remaining,
            warnings=warnings,
            entries=goal_entries(session, goal),
            funding_account_id=funding.account_id if funding else None,
            funding_basis="GROSS_ACCOUNT_VALUE" if funding else "RECORDED_ALLOCATIONS",
            progress=(saved / goal.target if goal.target else Decimal(1)) if not warnings else None,
            milestones=[
                n
                for n in [25, 50, 75, 100]
                if not warnings and (not goal.target or saved * 100 >= goal.target * n)
            ],
            required_monthly=None if warnings else required,
            projected_completion=None if warnings else completion,
            overdue=bool(goal.deadline and goal.deadline < day and remaining),
            near_deadline=bool(
                goal.deadline and 0 <= (goal.deadline - day).days <= 30 and remaining
            ),
            history=[
                dict(
                    date=d,
                    value=None
                    if goal_progress(session, goal, d, book)[1]
                    else goal_progress(session, goal, d, book)[0],
                )
                for d in dates
            ],
            projection_method=(
                "Hypothetical equal contributions at future month ends after the as-of date; "
                "no interest or investment return. Maximum horizon 50 years."
            ),
        )
        from app.goal_trajectory import schedule_pace, trajectory

        result["as_of"] = day
        result["schedule_pace"] = schedule_pace(goal, day, saved, warnings)
        result["trajectory"] = trajectory(goal, day, saved, warnings, result["history"], monthly)
        return result


def investment_goal_funding(session):
    return session.scalars(select(GoalAccountFunding))


class GoalBook:
    def __init__(self, session, days):
        from collections import defaultdict

        self.goals = list(session.scalars(select(Goal)))
        self.entries = defaultdict(list)
        for row in session.scalars(
            select(GoalEntry).order_by(GoalEntry.effective_date, GoalEntry.created_at, GoalEntry.id)
        ):
            self.entries[row.goal_id].append(row)
        self.balances = ledger.balance_series(session, days)
        self.funding = {f.goal_id: f for f in investment_goal_funding(session)}
        self.investments = {}
        if days:
            for funding in self.funding.values():
                points = market_valuation.history(
                    session, min(days), max(days), account_id=funding.account_id, serialize=False
                )["points"]
                self.investments.update({(funding.account_id, p["date"]): p for p in points})


def reserve_investment_account(session, goal, account_id, effective_date):
    """Explicit exclusive reservation; only metadata, never a financial posting."""
    account = ledger.posting_account(session, account_id)
    valid_day(effective_date)
    if goal.mode != "ACCOUNT" or account.type != "INVESTMENT" or account.currency != goal.currency:
        raise HTTPException(422, "Reserve a same-currency investment account for an account goal")
    if effective_date < goal.start_date or goal_entries(session, goal):
        raise HTTPException(409, "Whole-account funding cannot overlap recorded allocations")
    if session.scalar(
        select(GoalAccountFunding).where(
            (GoalAccountFunding.account_id == account_id) | (GoalAccountFunding.goal_id == goal.id)
        )
    ):
        raise HTTPException(409, "Investment account is already reserved")
    row = GoalAccountFunding(goal_id=goal.id, account_id=account_id, effective_date=effective_date)
    session.add(row)
    session.flush()
    return row


def savings_allocations(session, day):
    valid_day(day)
    with localcontext() as ctx:
        ctx.prec = 60
        allocation = allocation_map(session, day)
        balances = ledger.balances(session, cutoff=day)
        rows = []
        for account in session.scalars(
            select(FinancialAccount).where(
                FinancialAccount.type.in_(["CHECKING", "SAVINGS", "CASH"])
            )
        ):
            allocated = sum((v for (_, a), v in allocation.items() if a == account.id), ZERO)
            available = max(balances.get(account.id, ZERO), ZERO)
            rows.append(
                dict(
                    account_id=account.id,
                    name=account.name,
                    currency=account.currency,
                    balance=available,
                    allocated=allocated,
                    unallocated=available - allocated,
                    overallocated=allocated > available,
                )
            )
        for funding in session.scalars(select(GoalAccountFunding)):
            goal = session.get(Goal, funding.goal_id)
            if funding.effective_date > day or (goal.archived_date and goal.archived_date <= day):
                continue
            account = session.get(FinancialAccount, funding.account_id)
            value, warnings = goal_progress(session, goal, day)
            rows.append(
                dict(
                    account_id=account.id,
                    name=account.name,
                    currency=account.currency,
                    balance=None if warnings else value,
                    allocated=None if warnings else value,
                    unallocated=None if warnings else ZERO,
                    overallocated=False,
                )
            )
        return rows
