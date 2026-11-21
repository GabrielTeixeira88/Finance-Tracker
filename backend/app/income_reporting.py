"""Offline payment-date reporting currency projection. Native postings remain authoritative."""

from collections import defaultdict
from decimal import Decimal, localcontext

from app.investment_schemas import settled
from app.market_valuation import FXBook, preferences

FIELDS = ("gross", "fees", "taxes", "net")
ZERO = Decimal(0)


def reporting_income(session, events, start, end, currency):
    fx = FXBook(session, end, preferences(session)["fx_provider"])
    converted, missing = [], set()
    with localcontext() as context:
        context.prec = 60
        for event in events:
            rate, evidence = fx.convert(Decimal(1), event["currency"], currency, event["date"])
            if rate is None:
                missing.add(event["currency"])
            # The six-place reporting boundary is per payment, so displayed payment,
            # month/account/security/type totals reconcile. Native ledger money is unchanged.
            amounts = {
                field: settled(event[field] * rate) if rate is not None else None
                for field in FIELDS
            }
            converted.append(
                {
                    **event,
                    **amounts,
                    "currency": currency,
                    "original": {
                        "currency": event["currency"],
                        **{field: event[field] for field in FIELDS},
                    },
                    "fx": evidence,
                }
            )

        def aggregate(selected):
            return {
                field: None
                if any(row[field] is None for row in selected)
                else sum((row[field] for row in selected), ZERO)
                for field in FIELDS
            }

        months = defaultdict(list)
        for event in converted:
            months[event["date"].strftime("%Y-%m")].append(event)
        breakdowns = {}
        for dimension in ("year", "account", "security", "type"):
            buckets = defaultdict(list)
            for event in converted:
                identity = (
                    event["asset_id"]
                    if dimension == "security"
                    else event["account_id"]
                    if dimension == "account"
                    else str(event["date"].year)
                    if dimension == "year"
                    else event["type"]
                )
                buckets[identity].append(event)
            breakdowns[dimension] = [
                dict(
                    id=str(identity) if identity is not None else None,
                    name=rows[0]["symbol"]
                    if dimension == "security"
                    else rows[0]["account"]
                    if dimension == "account"
                    else str(identity),
                    currency=currency,
                    **aggregate(rows),
                )
                for identity, rows in sorted(buckets.items(), key=lambda item: str(item[0]))
            ]
        return dict(
            currency=currency,
            quality="PARTIAL" if missing else "COMPLETE",
            missing_currencies=sorted(missing),
            totals=aggregate(converted),
            known_net=sum((row["net"] for row in converted if row["net"] is not None), ZERO),
            start=start,
            end=end,
            events=converted,
            months=[
                dict(month=month, currency=currency, **aggregate(rows))
                for month, rows in sorted(months.items())
            ],
            breakdowns=breakdowns,
            method="PAYMENT_DATE_FX_PER_PAYMENT_SIX_DECIMAL_REPORTING",
            fx_policy=(
                "Eligible cached payment-date FX; at most seven prior calendar days; "
                "no future rates. No live refresh."
            ),
        )
