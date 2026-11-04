"""Official SGS adapters: dated percent observations, never a current-rate proxy.

SGS 12 is percent per business day. SGS 4389 is percent per annum, basis 252;
it is an independent check, not another factor to multiply into the balance.
Network acquisition belongs to explicit snapshot preparation, not this parser.
"""

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation, localcontext


def parse_sgs(payload: bytes, *, annual=False):
    if len(payload) > 2_000_000:
        raise ValueError("SGS response exceeds the observation budget")
    rows = json.loads(payload, parse_float=Decimal)
    if not isinstance(rows, list) or not rows or len(rows) > 4000:
        raise ValueError("Expected a bounded SGS observation list")
    result = {}
    for row in rows:
        day = datetime.strptime(row["data"], "%d/%m/%Y").date()
        raw = row["valor"]
        if not isinstance(raw, str):
            raise ValueError("SGS values must retain their decimal text")
        try:
            rate = Decimal(raw)
        except InvalidOperation:
            raise ValueError("Invalid SGS rate") from None
        if not rate.is_finite() or not 0 <= rate <= (100 if annual else 1):
            raise ValueError("SGS rate outside supported units")
        if day in result:
            raise ValueError("Duplicate SGS observation date")
        result[day] = rate
    return dict(sorted(result.items()))


def factor(daily_percent):
    with localcontext() as ctx:
        ctx.prec = 60
        return (Decimal(1) + daily_percent / 100).quantize(Decimal("1e-18"))


def accumulate(rates, dates, multiplier=Decimal(100)):
    """[application, valuation); the caller supplies contractual business dates.

    A missing required date is unavailable, not zero growth. A percentage of CDI
    multiplies each day's effective rate, not the two-year accumulated return.
    """
    with localcontext() as ctx:
        ctx.prec = 60
        value = Decimal(1)
        for day in dates:
            if day not in rates:
                return None
            value *= 1 + rates[day] * multiplier / 10000
        return value
