from datetime import date, timedelta
from decimal import Decimal

from app.performance_math import time_weighted
from app.performance_risk import performance_statistics


def calculate(values, flows=None, spacing=1):
    start = date(2025, 1, 1)
    points = [
        dict(date=start + timedelta(days=i * spacing), value=None if v is None else Decimal(v))
        for i, v in enumerate(values)
    ]
    mapped = {start + timedelta(days=i * spacing): Decimal(v) for i, v in (flows or {}).items()}
    twr, _ = time_weighted(points, mapped)
    return performance_statistics(twr, points, mapped)


def test_contributions_are_not_risk_returns_or_drawdowns():
    result = calculate(["100", "110", "198", "207.9"], {2: "99"})
    # Actual return factors: 1.1, .9, 1.05. The deposit is excluded.
    assert abs(result["max_drawdown"]["value"] - Decimal("-10")) < Decimal("1e-45")
    assert result["volatility"]["value"] > 0
    assert "SHORT_PERIOD_ANNUALIZATION" in result["annualized_twr"]["reasons"]


def test_constant_return_has_zero_volatility_and_actual_day_annualization():
    result = calculate(["100", "110", "121"], spacing=365)
    assert abs(result["volatility"]["value"]) < Decimal("1e-40")
    assert abs(result["annualized_twr"]["value"] - Decimal("10")) < Decimal("1e-40")
    assert result["max_drawdown"]["value"] == 0


def test_volatility_frequency_scales_with_actual_covered_days():
    daily = calculate(["100", "110", "99"])["volatility"]["value"]
    weekly = calculate(["100", "110", "99"], spacing=7)["volatility"]["value"]
    assert abs(daily / weekly - Decimal(7).sqrt()) < Decimal("1e-25")


def test_missing_coverage_and_dormant_capital_do_not_fabricate_risk():
    missing = calculate(["100", None, "110"])
    assert all(row["value"] is None for row in missing.values())
    dormant = calculate(["0", "100", "100", "100"], {1: "100"})
    assert dormant["volatility"]["value"] == 0
    assert dormant["max_drawdown"]["value"] == 0
    assert calculate(["100", "110"])["volatility"]["value"] is None


def test_total_loss_preserves_drawdown_and_rejects_log_volatility():
    result = calculate(["100", "50", "0"])
    assert result["max_drawdown"]["value"] == -100
    assert result["annualized_twr"]["value"] == -100
    assert result["volatility"]["value"] is None


def test_extreme_short_period_annualization_is_explicitly_unavailable():
    result = calculate(["1", "2"])
    assert result["annualized_twr"]["value"] is None
    assert result["annualized_twr"]["reasons"] == ["ANNUALIZATION_OUT_OF_RANGE"]
