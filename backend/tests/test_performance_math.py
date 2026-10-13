from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.performance_math import time_weighted, xirr

D = Decimal
START = date(2025, 1, 1)


def twr(values, flows):
    return time_weighted(
        [
            {"date": START + timedelta(days=i), "value": None if v is None else D(v)}
            for i, v in enumerate(values)
        ],
        {START + timedelta(days=i): None if v is None else D(v) for i, v in flows.items()},
    )


@pytest.mark.parametrize(
    "values,flows,expected",
    [
        (["10000", "20000"], {1: "9000"}, "10"),
        (["10000", "5500"], {1: "-5000"}, "5"),
        (["10000", "11000", "12100"], {}, "21"),
        (["10000", "9000", "8100"], {}, "-19"),
        (["0", "10000", "11000"], {1: "10000"}, "10"),
        (["10000", "0", "0", "10000", "11000"], {1: "-10000", 3: "10000"}, "10"),
        (["0.000001", "0.000002"], {}, "100"),
    ],
)
def test_twr_known_answers(values, flows, expected):
    result, series = twr(values, flows)
    assert result["quality"] == "COMPLETE"
    assert result["value"] == D(expected)
    assert series[-1]["return_percent"] == result["value"]


@pytest.mark.parametrize(
    "values,flows,reason",
    [
        (["100", None, "120"], {}, "MISSING_VALUATION"),
        (["100", "120"], {1: None}, "UNKNOWN_EXTERNAL_FLOW"),
        (["0", "50"], {}, "UNDEFINED_ZERO_CAPITAL_RETURN"),
        (["100", "-1"], {}, "NEGATIVE_CAPITAL"),
        (["0", "0"], {}, "NO_FUNDED_RETURN_PERIOD"),
    ],
)
def test_twr_unavailable_never_zero(values, flows, reason):
    result, _ = twr(values, flows)
    assert result["value"] is None
    assert reason in result["reasons"]


@pytest.mark.parametrize("ending,expected", [("1100", "10"), ("900", "-10"), ("1000", "0")])
def test_xirr_known_annual_answers(ending, expected):
    result = xirr([(START, D("-1000")), (START + timedelta(days=365), D(ending))])
    assert abs(result["value"] - D(expected)) < D("1e-20")


def test_xirr_dates_not_simple_profit_ratio():
    result = xirr([(START, D("-1000")), (START + timedelta(days=730), D("1210"))])
    assert abs(result["value"] - 10) < D("1e-20")
    short = xirr([(START, D("-1000")), (START + timedelta(days=30), D("1010"))])
    assert "SHORT_PERIOD_ANNUALIZATION" in short["reasons"]
    assert short["value"] > 10


def test_xirr_ambiguous_roots_are_not_arbitrarily_selected():
    # Annual polynomial has both 10% and 20% roots.
    result = xirr(
        [
            (START, D(-100)),
            (START + timedelta(days=365), D(230)),
            (START + timedelta(days=730), D(-132)),
        ]
    )
    assert result["value"] is None
    assert result["reasons"] == ["POTENTIALLY_MULTIPLE_ROOTS"]


def test_xirr_same_day_and_one_sign():
    assert xirr([(START, D(-100)), (START, D(110))])["value"] is None
    result = xirr([(START, D(100)), (START + timedelta(days=365), D(110))])
    assert result["reasons"] == ["NO_CASH_FLOW_SIGN_CHANGE"]


def test_xirr_published_irregular_cash_flow_example():
    # Independent Microsoft example: https://support.microsoft.com/pl-pl/excel/functions/xirr-function
    flows = [
        ("2008-01-01", "-10000"),
        ("2008-03-01", "2750"),
        ("2008-10-30", "4250"),
        ("2009-02-15", "3250"),
        ("2009-04-01", "2750"),
    ]
    result = xirr([(date.fromisoformat(day), D(value)) for day, value in flows])
    # Published iterative result is specified to 0.000001 percentage-point accuracy.
    assert abs(result["value"] - D("37.3362535")) < D("0.000001")


def test_xirr_irregular_contributions_zero_return_and_same_day_netting():
    result = xirr(
        [
            (START, D(-100)),
            (START + timedelta(days=27), D(-200)),
            (START + timedelta(days=180), D(-700)),
            (START + timedelta(days=365), D(900)),
            (START + timedelta(days=365), D(100)),
        ]
    )
    assert abs(result["value"]) < D("1e-20")


def test_xirr_explicit_solver_failure_and_bounds():
    flows = [(START, D(-100)), (START + timedelta(days=365), D(110))]
    assert xirr(flows, max_iterations=0)["reasons"] == ["SOLVER_DID_NOT_CONVERGE"]
    assert xirr([(START, D(-1)), (START + timedelta(days=1), D(1000000))])["reasons"] == [
        "NO_ROOT_WITHIN_SOLVER_BOUNDS"
    ]


def test_twr_multiple_contributions_preserves_chain():
    # 100 -> 110 gain then 100 deposit; 210 -> 231 gain then 200 deposit.
    result, _ = twr(["100", "210", "431"], {1: "100", 2: "200"})
    assert result["value"] == 21
