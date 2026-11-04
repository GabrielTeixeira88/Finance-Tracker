"""Fictional contracts and dated factors. No live rates, offers or network calls."""

from datetime import date, timedelta
from decimal import Decimal, localcontext

from app.fixed_income import daily_factor, subscribe
from app.fixed_income_calendar import business_day, days
from app.fixed_income_models import FixedIncomeIndex
from app.fixed_income_schemas import Subscription
from app.investment_schemas import settled
from app.models import PriceObservation


def seed_fixed_income(session, accounts, identity, start, end, stamp):
    # Illustrative annualized paths, NOT claimed BCB/CDI historical observations.
    regimes = [
        (date(2024, 10, 1), "10.65", "10.68"),
        (date(2025, 1, 1), "12.15", "12.18"),
        (date(2025, 4, 1), "14.15", "14.18"),
        (date(2025, 7, 1), "14.90", "14.93"),
        (date(2026, 4, 1), "14.40", "14.43"),
        (date(2026, 7, 1), "13.90", "13.93"),
        (date(2026, 9, 17), "13.65", "13.68"),
    ]
    factors = {}
    for day in days(start, end + timedelta(days=1)):
        regime = next(r for r in reversed(regimes) if r[0] <= day)
        for index, annual in [("CDI", regime[1]), ("SELIC_OVER", regime[2])]:
            factor = daily_factor(Decimal(annual)).quantize(Decimal("1e-18"))
            factors[index, day] = factor
            session.add(
                FixedIncomeIndex(
                    index_name=index, observation_date=day, source="SYNTHETIC", factor=factor
                )
            )
    session.flush()
    specs = [
        (
            "daily",
            "CDB Demo — Liquidez Diária",
            "CDB_CDI",
            "2025-01-06",
            "2027-01-06",
            "8000",
            "1",
            "100",
            "0",
            "DAILY",
        ),
        (
            "110",
            "CDB Demo — 110% CDI",
            "CDB_CDI",
            "2025-10-06",
            "2027-10-06",
            "6000",
            "1",
            "110",
            "0",
            "AT_MATURITY",
        ),
        (
            "120",
            "CDB Demo — 120% CDI",
            "CDB_CDI",
            "2026-08-05",
            "2026-11-03",
            "2500",
            "1",
            "120",
            "0",
            "AT_MATURITY",
        ),
        (
            "fixed",
            "CDB Demo — Prefixado 13.50%",
            "CDB_FIXED",
            "2026-03-06",
            "2027-03-08",
            "4000",
            "1",
            "0",
            "13.50",
            "AT_MATURITY",
        ),
        (
            "selic",
            "Tesouro Selic 2029 — Demo",
            "TESOURO_SELIC",
            "2026-06-05",
            "2029-03-01",
            "0.6",
            "10000",
            "0",
            "0",
            "DAILY",
        ),
    ]
    for key, name, kind, purchase, maturity, quantity, price, multiplier, fixed, liquidity in specs:
        contract = subscribe(
            session,
            Subscription(
                request_id=identity("fixed-income/" + key),
                account_id=accounts["Brazilian Brokerage"].id,
                name=name,
                issuer="Fictional Brazilian Treasury example"
                if key == "selic"
                else "Fictional Demo Bank " + key,
                instrument_type=kind,
                settlement_date=purchase,
                maturity_date=maturity,
                redemption_from=purchase if liquidity == "DAILY" else maturity,
                liquidity=liquidity,
                quantity=quantity,
                acquisition_price=price,
                cdi_percent=multiplier,
                annual_rate=fixed,
                spread_rate="0.05" if key == "selic" else "0",
                index_source="SYNTHETIC",
                fictional=True,
                fgc_eligible=key != "selic",
                notes="Entirely fictional. Business-day settlement; no automatic redemption. "
                + (
                    "Promotional 90-day example; principal cap BRL 2,500; no early redemption."
                    if key == "120"
                    else "No broker fee assumed; not an actual issuer offer."
                ),
            ),
        )
        if kind != "TESOURO_SELIC":
            continue
        with localcontext() as ctx:
            ctx.prec = 60
            day = contract.settlement_date
            factor = Decimal(1)
            initial_duration = Decimal(len(list(days(day, contract.maturity_date)))) / 252
            purchase_discount = Decimal("1.0005") ** initial_duration
            while day < end:
                if business_day(day):
                    factor *= factors["SELIC_OVER", day]
                day += timedelta(days=1)
                if not business_day(day):
                    continue
                spread = (
                    Decimal("0.003")
                    if date(2026, 7, 15) <= day < date(2026, 9, 1)
                    else Decimal("0.001")
                    if day >= date(2026, 9, 1)
                    else Decimal("0.0005")
                )
                remaining = Decimal(len(list(days(day, contract.maturity_date)))) / 252
                unit = settled(
                    contract.acquisition_price
                    * factor
                    * purchase_discount
                    / (1 + spread) ** remaining
                )
                session.add(
                    PriceObservation(
                        asset_id=contract.asset_id,
                        currency="BRL",
                        price_date=day,
                        price=unit,
                        source="SYNTHETIC",
                        price_type="RAW_CLOSE",
                        fetched_at=stamp,
                    )
                )
    session.flush()
