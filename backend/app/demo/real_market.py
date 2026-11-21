"""Fictional investor and contracts; actual dated observations, offline replay."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm.attributes import flag_modified

from app import fixed_income, investments, ledger, schemas, wealth
from app.analytics_models import AssetClassification
from app.database import Base
from app.demo.real_market_snapshot import (
    END,
    ETF_PLAN,
    START,
    VERSION,
    execution_day,
    load_etfs,
    load_official,
)
from app.fixed_income_models import FixedIncomeIndex
from app.fixed_income_schemas import Subscription
from app.investment_schemas import ActivityInput, settled
from app.market_models import AssetPricing, MarketSettings
from app.models import Asset, DemoFixture, PriceObservation, Record, Transaction
from app.wealth_models import Goal, ManualPosition, PositionObservation

STAMP = datetime(2026, 9, 30, tzinfo=UTC)
CAIXINHA = (
    ("2024-12-02", "1000"),
    ("2025-03-05", "300"),
    ("2025-06-02", "300"),
    ("2025-09-01", "500"),
    ("2026-01-05", "500"),
    ("2026-05-04", "400"),
    ("2026-08-03", "300"),
)
CDBS = (
    ("A", "2024-11-05", "2027-11-05", "2000", "100", "0", "DAILY"),
    ("B", "2025-05-05", "2027-05-05", "1500", "110", "0", "AT_MATURITY"),
    ("C", "2026-02-05", "2028-02-07", "1000", "120", "0", "AT_MATURITY"),
    ("D", "2025-09-01", "2027-09-01", "1500", "0", "13.5", "AT_MATURITY"),
)


def identity(value):
    return uuid5(NAMESPACE_URL, f"finance-tracker/{VERSION}/{value}")


def seed(session):
    if session.get(DemoFixture, VERSION):
        return False
    if any(
        session.execute(select(table).limit(1)).first() for table in Base.metadata.sorted_tables
    ):
        raise ValueError("Real-market demo requires an empty, owned demo database")
    official, factors = load_official()
    etfs = load_etfs()
    sequence = 0

    def stable(db, _context, _instances):
        nonlocal sequence
        for row in db.new:
            if isinstance(row, Record):
                sequence += 1
                row.id = row.id or identity(f"row/{sequence}")
                row.created_at = row.updated_at = STAMP
                from app.models import Transfer

                if isinstance(row, Transfer):
                    row.source_entry_id = identity(f"transfer/{sequence}/out")
                    row.destination_entry_id = identity(f"transfer/{sequence}/in")
        for row in db.dirty:
            if isinstance(row, Record):
                row.updated_at = STAMP
                flag_modified(row, "updated_at")

    event.listen(session, "before_flush", stable)
    try:
        session.add(MarketSettings(reporting_currency="BRL", fx_provider="ECB", automatic=False))
        accounts = {}
        for name, kind, opening in [
            ("Checking", "CHECKING", "25000"),
            ("Brazilian Brokerage", "INVESTMENT", "0"),
            ("Caixinha — Emergency Reserve", "INVESTMENT", "0"),
        ]:
            accounts[name] = ledger.create_account(
                session,
                schemas.AccountCreate(
                    name=name,
                    type=kind,
                    currency="BRL",
                    institution="Fictional investor / historical simulation",
                    opening_balance=opening,
                    opening_date=START,
                ),
            )
        for day, factor in factors.items():
            session.add(
                FixedIncomeIndex(
                    index_name="CDI", observation_date=day, source="MANUAL", factor=factor
                )
            )
        session.flush()

        def fund(account, day, amount, text):
            ledger.create_transfer(
                session,
                schemas.TransferCreate(
                    source_account_id=accounts["Checking"].id,
                    destination_account_id=account.id,
                    amount=amount,
                    currency="BRL",
                    transaction_date=day,
                    description=text,
                ),
            )

        from app.demo.brazil_household import seed_goals, seed_household

        savings, household = seed_household(session, accounts["Checking"], START)

        brokerage = accounts["Brazilian Brokerage"]
        for key, purchase, maturity, amount, percent, annual, liquidity in CDBS:
            fund(brokerage, purchase, amount, f"CDB {key} contribution")
            contract = fixed_income.subscribe(
                session,
                Subscription(
                    request_id=identity("cdb/" + key),
                    account_id=brokerage.id,
                    name=f"CDB {key} — {percent}% CDI" if percent != "0" else "CDB D — Fixed 13.5%",
                    issuer="Fictional Example Bank " + key,
                    instrument_type="CDB_CDI" if percent != "0" else "CDB_FIXED",
                    settlement_date=purchase,
                    maturity_date=maturity,
                    redemption_from=purchase if liquidity == "DAILY" else maturity,
                    liquidity=liquidity,
                    quantity=amount,
                    cdi_percent=percent,
                    annual_rate=annual,
                    index_source="MANUAL",
                    fictional=True,
                    fgc_eligible=True,
                    notes="Fictional contract, not a historical bank offer. Official SGS 12 CDI; "
                    "252-business-day fixed compounding. No agent fees. "
                    "Gross accrual; estimated resident-individual IR/IOF.",
                ),
            )
            session.add(
                AssetClassification(
                    asset_id=contract.asset_id,
                    sector="CDI-linked CDB" if percent != "0" else "Fixed-rate CDB",
                    geography="Brazil",
                )
            )
            session.get(Asset, contract.asset_id).symbol = "CDB-" + key
        caixinha = accounts["Caixinha — Emergency Reserve"]
        for day, amount in CAIXINHA:
            fund(caixinha, day, amount, "Caixinha contribution (owned-account transfer)")
            maturity = date.fromisoformat(day).replace(year=date.fromisoformat(day).year + 3)
            from datetime import timedelta

            from app.fixed_income_calendar import business_day

            while not business_day(maturity):
                maturity += timedelta(days=1)
            contract = fixed_income.subscribe(
                session,
                Subscription(
                    request_id=identity("rdb/" + day),
                    account_id=caixinha.id,
                    name="Caixinha RDB · " + day,
                    issuer="Hypothetical Nubank standard RDB",
                    instrument_type="RDB_CDI",
                    settlement_date=day,
                    maturity_date=maturity,
                    redemption_from=day,
                    liquidity="DAILY",
                    quantity=amount,
                    cdi_percent="100",
                    index_source="MANUAL",
                    fictional=True,
                    fgc_eligible=True,
                    notes="Hypothetical 100% CDI RDB modeled after published Nubank terms, "
                    "not a synchronized account. Each contribution is a distinct tax lot. "
                    "Assumed three-year maturity and business-day processing; no Turbo or "
                    "automatic reinvestment. Exact historical individual terms unverified.",
                ),
            )
            session.add(
                AssetClassification(
                    asset_id=contract.asset_id, sector="Nubank RDB / Caixinha", geography="Brazil"
                )
            )

            session.get(Asset, contract.asset_id).symbol = "RDB-" + day

        purchase = next(r for r in official["treasury"] if r["date"] == "2025-01-06")
        price, quantity = Decimal(purchase["purchase"]), Decimal("0.19")
        fund(brokerage, "2025-01-07", settled(price * quantity), "Tesouro Selic 2029 contribution")
        treasury = fixed_income.subscribe(
            session,
            Subscription(
                request_id=identity("treasury/2029"),
                account_id=brokerage.id,
                name="Tesouro Selic 2029",
                issuer="Tesouro Nacional (fictional holding)",
                instrument_type="TESOURO_SELIC",
                settlement_date="2025-01-07",
                maturity_date="2029-03-01",
                redemption_from="2025-01-07",
                quantity=quantity,
                acquisition_price=price,
                index_source="MANUAL",
                fictional=True,
                fgc_eligible=False,
                notes="Official 2029-03-01 maturity. Purchase uses published morning purchase PU; "
                "dated morning sale PU marks gross redemption value, not a closing quote. "
                "Trade 2025-01-06; D+1 settlement 2025-01-07. 0.19 units (0.01 increments). "
                "No broker fee; sole Treasury holding below BRL 10,000 custody exemption. "
                "IR/IOF estimated separately.",
            ),
            record_acquisition_quote=False,
        )
        session.add(
            AssetClassification(
                asset_id=treasury.asset_id, sector="Tesouro Selic", geography="Brazil"
            )
        )
        session.get(Asset, treasury.asset_id).symbol = "TESOURO-SELIC-2029"
        for row in official["treasury"]:
            session.add(
                PriceObservation(
                    asset_id=treasury.asset_id,
                    currency="BRL",
                    price_date=date.fromisoformat(row["date"]),
                    price=Decimal(row["sale"]),
                    source="MANUAL",
                    price_type="OFFICIAL_PU",
                )
            )
        if etfs:
            for symbol, data in etfs["instruments"].items():
                asset = Asset(
                    id=identity(symbol),
                    symbol=symbol,
                    name="Global Equity ETF" if symbol == "WRLD11" else "S&P 500 ETF",
                    exchange="B3",
                    currency="BRL",
                    asset_type="ETF",
                )
                session.add(asset)
                session.flush()
                session.add(AssetPricing(asset_id=asset.id, mode="MANUAL"))
                session.add(
                    AssetClassification(
                        asset_id=asset.id,
                        sector="Global equity ETF" if symbol == "WRLD11" else "S&P 500 ETF",
                        geography="Global" if symbol == "WRLD11" else "United States",
                    )
                )
                for day, close in data["quotes"].items():
                    session.add(
                        PriceObservation(
                            asset_id=asset.id,
                            currency="BRL",
                            price_date=day,
                            price=close,
                            source="MANUAL",
                            price_type="RAW_CLOSE",
                        )
                    )
            session.flush()
            for symbol, target, units in sorted(ETF_PLAN, key=lambda r: r[1]):
                data = etfs["instruments"][symbol]
                day = execution_day(data, date.fromisoformat(target))
                price, quantity = data["quotes"][day], Decimal(units)
                fund(brokerage, day, settled(price * quantity), symbol + " contribution")
                investments.post(
                    session,
                    ActivityInput(
                        request_id=identity(symbol + target),
                        account_id=brokerage.id,
                        asset_id=identity(symbol),
                        activity_type="BUY",
                        activity_date=day,
                        quantity=quantity,
                        unit_price=price,
                        currency="BRL",
                        notes="Fictional execution at verified unadjusted daily close. "
                        "Not an actual broker execution. Local snapshot " + etfs["sha256"],
                    ),
                )
        goal = Goal(
            name="Emergency reserve",
            currency="BRL",
            mode="ACCOUNT",
            target=Decimal("5000"),
            start_date=date(2024, 12, 2),
            deadline=date(2027, 12, 31),
            notes="Reserved Caixinha gross valuation; estimates are not guaranteed net proceeds.",
        )
        session.add(goal)
        session.flush()
        wealth.reserve_investment_account(session, goal, caixinha.id, goal.start_date)
        seed_goals(session, savings, START)
        # Fictional owned assets, independently valued; never cash postings or
        # investment observations. The house and car are owned before the replay.
        for name, category, values in (
            ("House", "REAL_ESTATE", ("300000", "310000", "330000", "340000")),
            ("Car", "VEHICLE", ("45000", "43000", "40000", "38000")),
        ):
            position = ManualPosition(
                name=name,
                kind="ASSET",
                category=category,
                currency="BRL",
                liquidity="ILLIQUID",
                start_date=START,
                notes="Fictional owned asset with illustrative manual valuations; not market data.",
            )
            session.add(position)
            session.flush()
            for day, amount in zip(
                (START, date(2025, 1, 1), date(2026, 1, 1), END), values, strict=True
            ):
                session.add(
                    PositionObservation(
                        position_id=position.id,
                        effective_date=day,
                        amount=Decimal(amount),
                        notes="Fictional manual valuation; no ledger movement.",
                    )
                )
            session.flush()

        dates = set(session.scalars(select(Transaction.transaction_date))) | {START, END}
        if any(
            values.get(accounts["Checking"].id, Decimal(0)) < 0
            for values in ledger.balance_series(session, sorted(dates)).values()
        ):
            raise ValueError(
                "Snapshot execution costs exceed the fictional investor's available funding"
            )
        session.add(
            DemoFixture(
                id=VERSION,
                start_date=START,
                end_date=END,
                payload={
                    "currency": "BRL",
                    "budgets": [],
                    "holdings": [],
                    "performance": [],
                    "activity": [],
                    "household": household,
                    "market_evidence": {
                        "reference_date": END.isoformat(),
                        "retrieved_on": official["retrieved_on"],
                        "sources": official["sources"],
                        "etf_coverage": "COMPLETE" if etfs else "UNAVAILABLE",
                        "etfs": {
                            symbol: {k: v for k, v in info.items() if k not in {"quotes", "prices"}}
                            for symbol, info in etfs["instruments"].items()
                        }
                        if etfs
                        else {},
                        "etf_sha256": etfs["sha256"] if etfs else None,
                        "warnings": []
                        if etfs
                        else [
                            "WRLD11 and IVVB11 are not purchased: authorized raw closes and "
                            "corporate-action review have not been prepared locally. "
                            "Displayed portfolio covers fixed income only."
                        ],
                    },
                },
            )
        )
        session.flush()
    finally:
        event.remove(session, "before_flush", stable)
    return True
