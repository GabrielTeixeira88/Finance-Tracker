"""Read-only exact risk summaries of the established end-of-day TWR path.

Reference conventions: pinned Wealthfolio portfolio-engine/measure.rs volatility
and risk_from_samples. Keep Python Decimal throughout (including log/sqrt), retain
missing-data guards, and use the application's documented actual/365 TWR
annualization. Volatility frequency uses actual covered days, not assumed B3 days.
"""

from decimal import Decimal, localcontext

from app.performance_math import metric

ZERO, ONE = Decimal(0), Decimal(1)


def performance_statistics(twr, points, flows):
    methods = {
        "annualized_twr": "TWR_ACTUAL_365_ANNUALIZED",
        "volatility": "LOG_RETURN_SAMPLE_STDDEV_ACTUAL_FREQUENCY_365_25",
        "max_drawdown": "PEAK_TO_TROUGH_FLOW_ADJUSTED_TWR_INDEX",
    }

    def unavailable(key, *reasons):
        return metric(None, methods[key], *reasons)

    if twr["value"] is None:
        return {key: unavailable(key, *twr["reasons"]) for key in methods}
    with localcontext() as context:
        context.prec = 60
        days = (points[-1]["date"] - points[0]["date"]).days
        base = ONE + twr["value"] / 100
        if days <= 0 or base < ZERO:
            annual = unavailable("annualized_twr", "INVALID_ANNUALIZATION_PERIOD")
        elif base == ZERO:
            annual = metric(Decimal(-100), methods["annualized_twr"])
        else:
            log_rate = base.ln() * 365 / days
            annual = (
                unavailable("annualized_twr", "ANNUALIZATION_OUT_OF_RANGE")
                if abs(log_rate) > 20
                else metric((log_rate.exp() - ONE) * 100, methods["annualized_twr"])
            )
        if annual["value"] is not None and days < 365:
            annual["reasons"].append("SHORT_PERIOD_ANNUALIZATION")
        logs, covered_days = [], 0
        cumulative, peak, drawdown = ONE, ONE, ZERO
        invalid_log = False
        for previous, current in zip(points, points[1:], strict=False):
            # Zero-capital/funding-only days are not invested risk observations.
            if previous["value"] == ZERO:
                continue
            factor = (current["value"] - flows.get(current["date"], ZERO)) / previous["value"]
            cumulative *= factor
            peak = max(peak, cumulative)
            drawdown = min(drawdown, cumulative / peak - ONE)
            if factor <= ZERO:
                invalid_log = True
            else:
                logs.append(factor.ln())
                covered_days += (current["date"] - previous["date"]).days
        if invalid_log:
            volatility = unavailable("volatility", "NONPOSITIVE_RETURN_FACTOR")
        elif len(logs) < 2 or covered_days <= 0:
            volatility = unavailable("volatility", "INSUFFICIENT_RISK_OBSERVATIONS")
        else:
            count = Decimal(len(logs))
            mean = sum(logs, ZERO) / count
            variance = sum(((value - mean) ** 2 for value in logs), ZERO) / (count - ONE)
            frequency = count * Decimal("365.25") / covered_days
            volatility = metric((variance * frequency).sqrt() * 100, methods["volatility"])
        return {
            "annualized_twr": annual,
            "volatility": volatility,
            "max_drawdown": metric(drawdown * 100, methods["max_drawdown"]),
        }
