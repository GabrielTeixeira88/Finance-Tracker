"""One fictional household, fixed October 2024–September 2026 history."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm.attributes import flag_modified

from app import budget_schemas, budgets, investments, ledger, rules, schedules, schemas, spending
from app.automation_schemas import RuleInput, ScheduleInput
from app.database import Base
from app.investment_schemas import ActivityInput
from app.market_models import AssetPricing, FXObservation, MarketSettings
from app.models import (
    Asset,
    Category,
    DemoFixture,
    Payee,
    PriceObservation,
    Record,
    Transfer,
)
from app.reconciliation_models import ReconciliationAudit
from app.wealth import validate_progress
from app.wealth_models import Goal, GoalEntry, ManualPosition, PositionObservation

VERSION = "showcase-v012-1"
START, END = date(2024, 10, 1), date(2026, 9, 30)
STAMP = datetime(2026, 9, 30, tzinfo=UTC)


def identity(value):
    return uuid5(NAMESPACE_URL, f"finance-tracker/{VERSION}/{value}")


def seed(session):
    if session.get(DemoFixture, VERSION):
        return False
    if any(
        session.execute(select(table).limit(1)).first() for table in Base.metadata.sorted_tables
    ):
        raise ValueError("Showcase requires an empty, authorized demo database")
    sequence = 0

    def stable(db, _context, _instances):
        nonlocal sequence
        for row in list(db.new):
            if isinstance(row, Record):
                sequence += 1
                row.id = row.id or identity(sequence)
                row.created_at = row.updated_at = STAMP
                if isinstance(row, ReconciliationAudit) and row.request_id.version == 4:
                    row.request_id = identity(f"audit/{sequence}")
                if isinstance(row, Transfer):
                    row.source_entry_id = identity(f"{sequence}/out")
                    row.destination_entry_id = identity(f"{sequence}/in")
        for row in db.dirty:
            if isinstance(row, Record):
                row.updated_at = STAMP
                flag_modified(row, "updated_at")
                if getattr(row, "completed_at", None) is not None:
                    row.completed_at = STAMP

    event.listen(session, "before_flush", stable)
    try:
        categories, payees, accounts = {}, {}, {}
        for name in [
            "Salary",
            "Housing",
            "Groceries",
            "Restaurants",
            "Transportation",
            "Utilities",
            "Subscriptions",
            "Shopping",
            "Entertainment",
            "Travel",
            "Health",
            "Insurance",
            "Education",
            "Other",
        ]:
            row = Category(name=name)
            session.add(row)
            session.flush()
            categories[name] = row.id
        for name in [
            "Fictional Atlas Studio",
            "Fictional Cedar Market",
            "Fictional Metro Ride",
            "Fictional Stream",
            "Fictional Corner Cafe",
        ]:
            row = Payee(name=name)
            session.add(row)
            session.flush()
            payees[name] = row.id
        for name, kind, currency, opening, direction in [
            ("Checking", "CHECKING", "BRL", "12500.35", "IN"),
            ("Savings", "SAVINGS", "BRL", "18000", "IN"),
            ("Cash", "CASH", "BRL", "460.50", "IN"),
            ("Credit Card", "CREDIT_CARD", "BRL", "1265.40", "OUT"),
            ("Brazilian Brokerage", "INVESTMENT", "BRL", "8000", "IN"),
            ("International Brokerage", "INVESTMENT", "USD", "6000", "IN"),
            ("European Brokerage", "INVESTMENT", "EUR", "3500", "IN"),
        ]:
            accounts[name] = ledger.create_account(
                session,
                schemas.AccountCreate(
                    name=name,
                    type=kind,
                    currency=currency,
                    institution="FICTIONAL / Alex Morgan demo",
                    opening_balance=opening,
                    opening_direction=direction,
                    opening_date=START - timedelta(days=1),
                ),
            )

        last_card = Decimal("1265.40")
        matches = {}
        for index in range(24):
            year, month = divmod(2024 * 12 + 9 + index, 12)
            month += 1

            def entry(
                day,
                category,
                description,
                amount,
                account="Checking",
                kind="EXPENSE",
                payee=None,
                year=year,
                month=month,
                index=index,
            ):
                row = ledger.create_transaction(
                    session,
                    schemas.TransactionCreate(
                        account_id=accounts[account].id,
                        currency="BRL",
                        transaction_type=kind,
                        amount=amount,
                        transaction_date=date(year, month, day),
                        description="Synthetic / " + description,
                        category_id=categories[category],
                        payee_id=payees.get(payee),
                        review_status="NEEDS_REVIEW" if index == 23 and day > 20 else "REVIEWED",
                    ),
                )
                matches[description] = row
                return row

            def transfer(day, target, amount, year=year, month=month):
                return ledger.create_transfer(
                    session,
                    schemas.TransferCreate(
                        source_account_id=accounts["Checking"].id,
                        destination_account_id=accounts[target].id,
                        amount=amount,
                        currency="BRL",
                        transaction_date=date(year, month, day),
                        description="Synthetic / " + target + " contribution or repayment",
                    ),
                )

            entry(
                2,
                "Salary",
                "Atlas salary",
                str(8500 + index // 8 * 650),
                kind="INCOME",
                payee="Fictional Atlas Studio",
            )
            if index % 3 == 1:
                entry(16, "Other", "Design side project", "675.50", kind="INCOME")
            transfer(3, "Credit Card", last_card)
            transfer(4, "Savings", str(1100 + index // 12 * 300))
            transfer(4, "Brazilian Brokerage", str(750 + index // 12 * 250))
            transfer(5, "Cash", "160")
            card = Decimal(0)
            specs = [(5, "Housing", "Household housing costs", "1800", "Checking", None)]
            for n, day in enumerate([6, 10, 14, 18, 22, 27]):
                specs.append(
                    (
                        day,
                        "Groceries",
                        "Cedar Market checkout " + str(n),
                        str(Decimal("105.35") + Decimal((index * 19 + n * 31) % 7000) / 100),
                        "Checking",
                        "Fictional Cedar Market",
                    )
                )
            for day in [8, 15, 23]:
                specs.append(
                    (
                        day,
                        "Restaurants",
                        "Corner Cafe",
                        "87.40",
                        "Credit Card",
                        "Fictional Corner Cafe",
                    )
                )
            for day in [7, 12, 20, 26]:
                specs.append(
                    (
                        day,
                        "Transportation",
                        "METRO RIDE *TRIP",
                        "32.50",
                        "Cash",
                        "Fictional Metro Ride",
                    )
                )
            specs += [
                (9, "Health", "Gym", "129.90", "Checking", None),
                (11, "Subscriptions", "STREAM MONTHLY", "39.90", "Credit Card", "Fictional Stream"),
                (17, "Entertainment", "Cinema", "76", "Credit Card", None),
                (
                    19,
                    "Shopping",
                    "Fictional online store",
                    str(Decimal("189.75") + index % 5 * 43),
                    "Credit Card",
                    None,
                ),
                (
                    21,
                    "Utilities",
                    "Electricity",
                    str(Decimal("145.60") + index % 6 * 17),
                    "Checking",
                    None,
                ),
                (24, "Utilities", "Internet", "109.90", "Checking", None),
                (25, "Insurance", "Insurance", "210", "Checking", None),
                (28, "Education", "Bookshop", "65.90", "Credit Card", None),
            ]
            if index in [2, 14]:
                specs.append(
                    (26, "Subscriptions", "Annual design tools", "480", "Credit Card", None)
                )
            if index in [7, 19]:
                specs.append((26, "Travel", "Fictional vacation", "2900", "Credit Card", None))
            if index == 16:
                specs.append((26, "Health", "Emergency dental care", "1850", "Checking", None))
            for day, category, desc, amount, account, payee in specs:
                entry(day, category, desc, amount, account, payee=payee)
                if account == "Credit Card":
                    card += Decimal(amount)
            if index in [11, 23]:
                spending.create_refund(
                    session,
                    budget_schemas.RefundInput(
                        purchase_id=matches["Fictional online store"].id,
                        account_id=accounts["Credit Card"].id,
                        amount="45.75",
                        transaction_date=date(year, month, 29),
                        description="Synthetic / partial store refund",
                    ),
                )
                card -= Decimal("45.75")
            last_card = card

        for priority, name, text, category, payee in [
            (10, "Cedar groceries", "Cedar", "Groceries", "Fictional Cedar Market"),
            (20, "Metro variants", "METRO", "Transportation", "Fictional Metro Ride"),
            (30, "Stream subscription", "STREAM", "Subscriptions", "Fictional Stream"),
        ]:
            conditions = [{"field": "description", "operator": "contains", "value": text}]
            if priority == 30:
                conditions.append(
                    {
                        "field": "account_id",
                        "operator": "equals",
                        "value": str(accounts["Credit Card"].id),
                    }
                )
            rules.save_rule(
                session,
                RuleInput(
                    name="Synthetic / " + name,
                    priority=priority,
                    conditions=conditions,
                    actions={
                        "category_id": str(categories[category]),
                        "payee_id": str(payees[payee]),
                    },
                ),
            )
        for desc, category, amount, kind, frequency, start, account in [
            ("Atlas salary", "Salary", "9800", "INCOME", "MONTHLY", "2026-09-02", "Checking"),
            (
                "Household housing costs",
                "Housing",
                "1800",
                "EXPENSE",
                "MONTHLY",
                "2026-09-05",
                "Checking",
            ),
            ("Internet", "Utilities", "109.90", "EXPENSE", "MONTHLY", "2026-10-24", "Checking"),
            ("Electricity", "Utilities", "180", "EXPENSE", "MONTHLY", "2026-09-21", "Checking"),
            (
                "STREAM MONTHLY",
                "Subscriptions",
                "39.90",
                "EXPENSE",
                "MONTHLY",
                "2026-09-11",
                "Credit Card",
            ),
            (
                "Annual insurance renewal",
                "Insurance",
                "2520",
                "EXPENSE",
                "YEARLY",
                "2026-10-25",
                "Checking",
            ),
        ]:
            row = schedules.save_schedule(
                session,
                ScheduleInput(
                    name="Synthetic / " + desc,
                    description="Synthetic / " + desc,
                    account_id=accounts[account].id,
                    currency="BRL",
                    amount=amount,
                    transaction_type=kind,
                    frequency=frequency,
                    start_date=start,
                    category_id=categories[category],
                ),
            )
            if desc in ["Atlas salary", "Household housing costs"]:
                schedules.confirm_match(session, row, date.fromisoformat(start), matches[desc].id)
        for n, (category, amount) in enumerate(
            [
                ("Housing", "1800"),
                ("Groceries", "900"),
                ("Restaurants", "240"),
                ("Transportation", "150"),
                ("Utilities", "310"),
                ("Subscriptions", "90"),
                ("Shopping", "250"),
                ("Entertainment", "120"),
                ("Travel", "250"),
                ("Health", "200"),
                ("Insurance", "220"),
                ("Education", "120"),
                ("Other", "100"),
            ]
        ):
            data = budget_schemas.TargetInput(
                category_id=categories[category],
                currency="BRL",
                month="2024-10",
                amount=amount,
                sort_order=n,
                rollover_enabled=category in ["Shopping", "Travel"],
            )
            budgets.save_target(session, data)
            if category == "Travel":
                budgets.save_target(
                    session,
                    data.model_copy(
                        update={"month": "2026-05", "scope": "month", "amount": Decimal("3000")}
                    ),
                )
        seed_investments(session, accounts)
        seed_wealth(session, accounts)
        from app.demo.scenarios import seed_scenarios

        seed_scenarios(session, accounts, categories)
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
                    "profile": "Alex Morgan — entirely fictional",
                },
            )
        )
        session.flush()
        return True
    finally:
        event.remove(session, "before_flush", stable)


def seed_investments(session, accounts):
    session.add(MarketSettings(automatic=False, reporting_currency="BRL", fx_provider="SYNTHETIC"))
    for index, (symbol, currency, account) in enumerate(
        [
            ("DEMOUP", "BRL", "Brazilian Brokerage"),
            ("DEMOLOSS", "BRL", "Brazilian Brokerage"),
            ("DEMOUS", "USD", "International Brokerage"),
            ("DEMOEU", "EUR", "European Brokerage"),
            ("DEMOBENCH", "BRL", None),
        ]
    ):
        asset = Asset(
            symbol=symbol,
            name="Fictional / " + symbol,
            asset_type="ETF",
            exchange="SYNTHETIC",
            currency=currency,
        )
        session.add(asset)
        session.flush()
        session.add(AssetPricing(asset_id=asset.id, mode="AUTOMATIC", provider="SYNTHETIC"))
        for n in range((END - START).days + 8):
            day = START - timedelta(days=7) + timedelta(days=n)
            if day.weekday() < 5:
                price = (
                    Decimal(100)
                    + Decimal(n) * (Decimal("-0.02") if index == 1 else Decimal("0.035"))
                    + Decimal((n % 31) - 15) / 10
                )
                session.add(
                    PriceObservation(
                        asset_id=asset.id,
                        currency=currency,
                        price_date=day,
                        price=price,
                        source="SYNTHETIC",
                        price_type="RAW_CLOSE",
                        fetched_at=STAMP,
                    )
                )
        session.flush()
        if not account:
            continue
        for seq, (kind, day, quantity, unit, gross) in enumerate(
            [
                ("BUY", "2024-10-07", "10", "100", None),
                ("BUY", "2025-04-07", "5", "105", None),
                (
                    "SELL",
                    "2026-04-07",
                    "15" if index == 1 else "3",
                    "90" if index == 1 else "115",
                    None,
                ),
                ("DIVIDEND", "2025-12-15", "0", "0", "85"),
                ("INTEREST", "2026-06-15", "0", "0", "22.75"),
                ("FEE", "2026-07-15", "0", "0", "4.50"),
                ("TAX", "2026-08-17", "0", "0", "2.25"),
            ]
        ):
            investments.post(
                session,
                ActivityInput(
                    request_id=identity(f"{symbol}/{seq}"),
                    account_id=accounts[account].id,
                    asset_id=asset.id if kind in ["BUY", "SELL", "DIVIDEND"] else None,
                    activity_type=kind,
                    activity_date=day,
                    quantity=quantity,
                    unit_price=unit,
                    gross_amount=gross,
                    currency=currency,
                    notes="Synthetic showcase / no live market data",
                ),
            )
    for n in range((END - START).days + 8):
        day = START - timedelta(days=7) + timedelta(days=n)
        if day.weekday() < 5:
            for currency, base, step in [("BRL", "5.8", "0.0003"), ("USD", "1.08", "0.00002")]:
                session.add(
                    FXObservation(
                        base_currency="EUR",
                        quote_currency=currency,
                        rate_date=day,
                        rate=Decimal(base) + n * Decimal(step),
                        provider="SYNTHETIC",
                        fetched_at=STAMP,
                    )
                )
    session.flush()
    ledger.create_transfer(
        session,
        schemas.TransferCreate(
            source_account_id=accounts["Brazilian Brokerage"].id,
            destination_account_id=accounts["Checking"].id,
            amount="500",
            currency="BRL",
            transaction_date=END,
            description="Synthetic / brokerage cash withdrawal",
        ),
    )


def seed_wealth(session, accounts):
    property_id = None
    for name, kind, category, value, step in [
        ("Fictional Riverside Home", "ASSET", "REAL_ESTATE", "500000", "1250"),
        ("Fictional Mortgage", "LIABILITY", "MORTGAGE", "300000", "0"),
        ("Fictional Compact Car", "ASSET", "VEHICLE", "48000", "-350"),
        ("Fictional Camera Collection", "ASSET", "OTHER", "3200", "15"),
        ("Fictional Interest-only Loan", "LIABILITY", "PERSONAL_LOAN", "12000", "0"),
    ]:
        row = ManualPosition(
            name=name,
            kind=kind,
            category=category,
            currency="BRL",
            start_date=START,
            notes="Synthetic dated observations; principal unchanged, no inferred cash repayments.",
            associated_asset_id=property_id
            if kind == "LIABILITY" and category == "MORTGAGE"
            else None,
        )
        session.add(row)
        session.flush()
        if category == "REAL_ESTATE":
            property_id = row.id
        for n in range(24):
            y, m = divmod(2024 * 12 + 9 + n, 12)
            session.add(
                PositionObservation(
                    position_id=row.id,
                    effective_date=date(y, m + 1, 1),
                    amount=Decimal(value) + n * Decimal(step),
                    notes="Synthetic observation",
                )
            )
        session.flush()
    for name, target, saved, status, mode in [
        ("Emergency fund", "20000", "18000", "ACTIVE", "ACCOUNT"),
        ("International vacation", "12000", "6000", "ACTIVE", "ACCOUNT"),
        ("Vehicle upgrade", "40000", "1000", "ACTIVE", "ACCOUNT"),
        ("Design course", "3000", "3000", "COMPLETED", "MANUAL"),
        ("Home studio", "15000", "2000", "PAUSED", "MANUAL"),
    ]:
        goal = Goal(
            name="Synthetic / " + name,
            currency="BRL",
            mode=mode,
            target=Decimal(target),
            start_date=START,
            deadline=date(2027, 12, 31),
            status=status,
            notes="Fictional shared savings / no additional assets",
        )
        session.add(goal)
        session.flush()
        for n in range(6):
            session.add(
                GoalEntry(
                    goal_id=goal.id,
                    account_id=accounts["Savings"].id if mode == "ACCOUNT" else None,
                    effective_date=date(2026, n + 4, 1),
                    amount=(
                        Decimal(saved) * (n + 1) / 6 if mode == "ACCOUNT" else Decimal(saved) / 6
                    ).quantize(Decimal("0.000001")),
                    direction="IN",
                    notes="Synthetic progress",
                )
            )
        session.flush()
        validate_progress(session, goal)
