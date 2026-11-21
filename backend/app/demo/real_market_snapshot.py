"""Offline observations. Restricted ETF exports stay local and are never bundled."""

import hashlib
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit

from app.config import PROJECT_ROOT
from app.fixed_income_calendar import days
from app.historical_cdi import factor, parse_sgs

START, END = date(2024, 10, 1), date(2026, 9, 30)
VERSION = "real-market-brazil-3"
OFFICIAL = Path(__file__).with_name("observations") / "brazil-2024-2026.json"
LOCAL_ETF = PROJECT_ROOT / "data" / "real-market-snapshot" / "etfs.json"
ETF_PLAN = (
    ("WRLD11", "2024-11-05", "2"),
    ("WRLD11", "2025-07-07", "2"),
    ("WRLD11", "2026-04-06", "3"),
    ("IVVB11", "2025-02-05", "1"),
    ("IVVB11", "2025-11-05", "2"),
    ("IVVB11", "2026-08-05", "1"),
)


def load_official():
    data = json.loads(OFFICIAL.read_text(encoding="utf-8"))
    rates = parse_sgs(json.dumps(data["cdi"]).encode())
    annual = parse_sgs(json.dumps(data["cdi_annual"]).encode(), annual=True)
    expected = set(days(START, END))
    if not expected.issubset(rates) or rates.keys() != annual.keys():
        raise ValueError("Official CDI history has missing business dates")
    from decimal import localcontext

    with localcontext() as ctx:
        ctx.prec = 60
        for day, rate in rates.items():
            implied = ((1 + annual[day] / 100) ** (Decimal(1) / 252) - 1) * 100
            if abs(implied - rate) > Decimal("0.0000005"):
                raise ValueError("Daily/annual SGS units or observations disagree")
    return data, {day: factor(value) for day, value in rates.items()}


def load_etfs(path=LOCAL_ETF):
    """Read an explicitly prepared, attributed, authorized private export.

    Absence is an honest partial scenario. Malformed/existing exports fail closed.
    Corporate actions need explicit review: unsupported actions are not guessed.
    """
    if not path.exists():
        return None
    raw = path.read_bytes()
    if len(raw) > 2_000_000:
        raise ValueError("ETF snapshot exceeds the bounded history budget")
    data = json.loads(raw)
    if not isinstance(data, dict) or set(data) != {
        "start",
        "end",
        "convention",
        "authorized_local_use",
        "instruments",
    }:
        raise ValueError("Use the documented snapshot schema; do not include credentials")
    if data.get("start") != START.isoformat() or data.get("end") != END.isoformat():
        raise ValueError("ETF snapshot must cover the fixed demonstration window")
    if data.get("authorized_local_use") is not True or data.get("convention") != "RAW_CLOSE":
        raise ValueError("Authorized unadjusted closing observations are required")
    if set(data.get("instruments", {})) != {"WRLD11", "IVVB11"}:
        raise ValueError("Verify both exact B3 ETF identities")
    for symbol, instrument in data["instruments"].items():
        if not isinstance(instrument, dict) or set(instrument) != {
            "currency",
            "exchange",
            "provider",
            "license",
            "license_terms_url",
            "source_url",
            "action_source_url",
            "retrieved_on",
            "actions_reviewed_through",
            "corporate_actions_reviewed",
            "corporate_actions",
            "prices",
        }:
            raise ValueError("Use attributed ETF records without credentials or extra payloads")
        if not all(
            isinstance(instrument[k], str) and 0 < len(instrument[k]) <= 500
            for k in ("provider", "license")
        ):
            raise ValueError("Provider and local-use license descriptions are required")
        if instrument["actions_reviewed_through"] != END.isoformat():
            raise ValueError("Corporate-action evidence must cover the entire replay window")
        if instrument.get("currency") != "BRL" or instrument.get("exchange") != "B3":
            raise ValueError("ETF exchange/currency mismatch")
        if (
            instrument.get("corporate_actions_reviewed") is not True
            or instrument.get("corporate_actions") != []
        ):
            raise ValueError(
                "Unsupported/unreviewed corporate actions: cannot seed valid performance"
            )
        for url in [
            instrument.get(k, "") for k in ("source_url", "action_source_url", "license_terms_url")
        ]:
            parsed = urlsplit(url)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("Supply credential-free HTTPS source/evidence URLs")
        if not END <= date.fromisoformat(instrument["retrieved_on"]) <= date.today():
            raise ValueError("Retrieval date must cover the historical reference date")
        quotes = {}
        for row in instrument["prices"]:
            if set(row) != {"date", "close"}:
                raise ValueError("Retain only exact date and raw close in price records")
            day = date.fromisoformat(row["date"])
            if not isinstance(row["close"], str):
                raise ValueError("ETF prices must be exact decimal strings")
            value = Decimal(row["close"])
            if (
                not value.is_finite()
                or not 0 < value < Decimal("1e18")
                or value != value.quantize(Decimal("0.000001"))
            ):
                raise ValueError("Invalid raw ETF close")
            if not START <= day <= END or day in quotes or day.weekday() >= 5:
                raise ValueError("Duplicate/out-of-window ETF observation")
            quotes[day] = value
        if not quotes or (END - max(quotes)).days > 7:
            raise ValueError("ETF reference-date coverage is missing")
        # No interpolated history: reject any long unexplained quote gaps.
        ordered = sorted(quotes)
        if (ordered[0] - START).days > 7 or any(
            (b - a).days > 7 for a, b in zip(ordered, ordered[1:], strict=False)
        ):
            raise ValueError("ETF history contains a coverage gap longer than seven days")
        instrument["quotes"] = quotes
        for ticker, target, _quantity in ETF_PLAN:
            if ticker == symbol:
                execution_day(instrument, date.fromisoformat(target))
    data["sha256"] = hashlib.sha256(raw).hexdigest()
    return data


def execution_day(instrument, target):
    eligible = sorted(
        day for day in instrument["quotes"] if target <= day and (day - target).days <= 7
    )
    if not eligible:
        raise ValueError("No verified trading observation near the requested purchase date")
    return eligible[0]


def scenario_root(root):
    # A new authorized snapshot opens a NEW owned scenario; never changes the
    # baseline or edits of an already prepared replay. No client supplies paths.
    digest = hashlib.sha256(OFFICIAL.read_bytes())
    digest.update(VERSION.encode("ascii"))
    if LOCAL_ETF.exists():
        load_etfs()
        digest.update(LOCAL_ETF.read_bytes())
    return root.with_name(root.name + "-real-market-br-" + digest.hexdigest()[:12])
