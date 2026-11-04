"""Versioned BR national banking calendar; municipal/exceptional closures excluded.

ANBIMA national holidays, including Carnival, Good Friday and Corpus Christi.
December 31 and municipal closures are intentionally not inferred. Settlement
cutoffs are product-specific: this application records the effective settlement date.
"""

from datetime import date, timedelta
from functools import lru_cache


@lru_cache
def holidays(year):
    # Gregorian computus, integer arithmetic only.
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    correction = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * correction) // 451
    easter = date(
        year, (h + correction - 7 * m + 114) // 31, (h + correction - 7 * m + 114) % 31 + 1
    )
    fixed = [(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (12, 25)]
    if year >= 2024:
        fixed.append((11, 20))
    return {date(year, month, day) for month, day in fixed} | {
        easter + timedelta(days=offset) for offset in (-48, -47, -2, 60)
    }


def business_day(day):
    return day.weekday() < 5 and day not in holidays(day.year)


def days(start, end):
    """Accrual interval [settlement, valuation): never consume a future day's factor."""
    day = start
    while day < end:
        if business_day(day):
            yield day
        day += timedelta(days=1)
