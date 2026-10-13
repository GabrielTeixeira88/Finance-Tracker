"""Pure exact return calculations, independent of persistence and provider schemas."""

from collections import defaultdict
from datetime import date
from decimal import Decimal, localcontext

ZERO = Decimal(0)
ONE = Decimal(1)


def metric(value, method, *reasons):
    return {
        "value": value,
        "method": method,
        "quality": "UNAVAILABLE" if value is None else "COMPLETE",
        "reasons": list(reasons),
    }


def time_weighted(points, flows):
    """Daily end-of-day flows; points include the opening boundary closing value.

    Missing days poison the cumulative chain, rather than restarting it and
    implying an uninterrupted return. Zero-capital dormant days are neutral only
    when no unexplained profit exists. Percentages, not fractions, are returned.
    """
    method = "DAILY_TWR_END_OF_DAY_FLOWS"
    reasons = set()
    factor = ONE
    funded = False
    series = []
    if len(points) < 2:
        return metric(None, method, "INSUFFICIENT_PERIOD"), series
    with localcontext() as ctx:
        ctx.prec = 60
        first = points[0]
        series.append(
            {"date": first["date"], "return_percent": ZERO if first["value"] is not None else None}
        )
        for previous, current in zip(points, points[1:], strict=False):
            opening, closing = previous["value"], current["value"]
            flow = flows.get(current["date"], ZERO)
            if opening is None or closing is None:
                reasons.add("MISSING_VALUATION")
            elif flow is None:
                reasons.add("UNKNOWN_EXTERNAL_FLOW")
            elif opening < ZERO or closing < ZERO:
                reasons.add("NEGATIVE_CAPITAL")
            elif opening == ZERO:
                if closing != flow:
                    reasons.add("UNDEFINED_ZERO_CAPITAL_RETURN")
            elif closing - flow < ZERO:
                reasons.add("INVALID_FLOW_ADJUSTED_VALUE")
            elif not reasons:
                funded = True
                factor *= (closing - flow) / opening
            series.append(
                {
                    "date": current["date"],
                    "return_percent": None if reasons else (factor - ONE) * 100,
                }
            )
        if not funded and not reasons:
            reasons.add("NO_FUNDED_RETURN_PERIOD")
        if not funded:
            for point in series:
                point["return_percent"] = None
        result = metric(None if reasons else (factor - ONE) * 100, method, *sorted(reasons))
    return result, series


def xirr(cash_flows: list[tuple[date, Decimal]], *, max_iterations=200):
    """Annualized actual/365 return with a bounded Decimal log-rate bisection.

    A single chronological sign change guarantees at most one root. With more
    sign changes we deliberately return ambiguity: a guessed root is unsafe.
    Same-day legs are netted for solving (the source flow report retains gross).
    Search domain exp(-20)-1 through exp(20)-1 is explicit, not an unlimited claim.
    """
    method = "XIRR_ACTUAL_365_ANNUALIZED"
    with localcontext() as ctx:
        ctx.prec = 60
        daily = defaultdict(lambda: ZERO)
        for day, amount in cash_flows:
            daily[day] += amount
        rows = sorted((day, amount) for day, amount in daily.items() if amount)
        if len(rows) < 2:
            return metric(None, method, "INSUFFICIENT_DATED_CASH_FLOWS")
        signs = [amount > ZERO for _, amount in rows]
        changes = sum(a != b for a, b in zip(signs, signs[1:], strict=False))
        if changes == 0:
            return metric(None, method, "NO_CASH_FLOW_SIGN_CHANGE")
        if changes > 1:
            return metric(None, method, "POTENTIALLY_MULTIPLE_ROOTS")
        origin = rows[0][0]
        terms = [(Decimal((day - origin).days) / 365, amount) for day, amount in rows]
        scale = sum((abs(amount) for _, amount in terms), ZERO)

        def npv(log_rate):
            return sum(
                (amount / scale * (-years * log_rate).exp() for years, amount in terms), ZERO
            )

        low, high = Decimal(-20), Decimal(20)
        low_value, high_value = npv(low), npv(high)
        if low_value * high_value > ZERO:
            return metric(None, method, "NO_ROOT_WITHIN_SOLVER_BOUNDS")
        for _ in range(max_iterations):
            middle = (low + high) / 2
            value = npv(middle)
            if abs(value) < Decimal("1e-28") or high - low < Decimal("1e-28"):
                result = metric((middle.exp() - ONE) * 100, method)
                if (rows[-1][0] - origin).days < 365:
                    result["reasons"].append("SHORT_PERIOD_ANNUALIZATION")
                return result
            if (low_value > ZERO) == (value > ZERO):
                low, low_value = middle, value
            else:
                high = middle
        return metric(None, method, "SOLVER_DID_NOT_CONVERGE")
