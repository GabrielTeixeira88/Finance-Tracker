"""Owned-demo-only Spending examples. Source observations and prior edits are retained."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import budget_schemas, budgets, ledger, life_events, schemas, spending
from app.demo import real_market
from app.life_event_models import LifeEventLink
from app.models import (
    BudgetGroup,
    BudgetMonthOverride,
    BudgetTarget,
    BudgetVersion,
    Category,
    DemoFixture,
    FinancialAccount,
    RefundLink,
    Transaction,
)
from app.spending_appearance import ClassificationAppearance

CONTENT_VERSION = 1
MARKER = "spending_ui_content"
STAMP = datetime(2026, 9, 30, tzinfo=UTC)


def identity(key):
    return uuid5(NAMESPACE_URL, "finance-tracker/unified-spending-1/" + key)


def extend(session):
    from app.demo.unified import VERSION

    fixture = session.get(DemoFixture, VERSION)
    if fixture is None:
        raise ValueError("Spending examples require an owned unified demo")
    if fixture.payload.get(MARKER) == CONTENT_VERSION:
        return False
    checking = session.get(FinancialAccount, real_market.identity("row/2"))
    if checking is None or checking.type != "CHECKING" or checking.currency != "BRL":
        raise ValueError("Unified household checking identity is unavailable")
    categories = {row.name: row for row in session.scalars(select(Category))}
    groups = {}
    for name, color, icon in [
        ("Needs", "#5B7CA7", "Home"),
        ("Wants", "#927DB1", "ShoppingBag"),
        ("Personal", "#B39950", "User"),
        ("Giving", "#B86650", "Gift"),
    ]:
        group = session.get(BudgetGroup, identity("group/" + name))
        if group is None:
            group = BudgetGroup(
                id=identity("group/" + name),
                name=name,
                sort_order=len(groups),
                created_at=STAMP,
                updated_at=STAMP,
            )
            session.add(group)
            session.flush()
            session.add(
                ClassificationAppearance(
                    id=identity("group-style/" + name),
                    group_id=group.id,
                    color=color,
                    icon=icon,
                    created_at=STAMP,
                    updated_at=STAMP,
                )
            )
        groups[name] = group
    names = {
        "Housing": ("Needs", "Home"),
        "Groceries": ("Needs", "ShoppingCart"),
        "Transportation": ("Needs", "Train"),
        "Fuel": ("Needs", "Fuel"),
        "Utilities": ("Needs", "Lightbulb"),
        "Insurance": ("Needs", "Shield"),
        "Restaurants": ("Wants", "UtensilsCrossed"),
        "Shopping": ("Wants", "ShoppingBag"),
        "Entertainment": ("Wants", "Film"),
        "Subscriptions": ("Wants", "Tv"),
        "Travel": ("Wants", "Plane"),
        "Education": ("Personal", "GraduationCap"),
        "Health": ("Personal", "Heart"),
        "Other": ("Personal", "Tag"),
    }
    for order, (name, (group_name, icon)) in enumerate(names.items()):
        category = categories.get(name)
        if category is None:
            continue
        target = session.scalar(
            select(BudgetTarget).where(
                BudgetTarget.category_id == category.id, BudgetTarget.currency == "BRL"
            )
        )
        if target is None:
            continue
        # Append versioned plan examples. Never overwrite a saved version or override.
        for month in ("2025-01", "2026-01"):
            parsed = spending.month_start(month)
            if session.scalar(
                select(BudgetVersion.id).where(
                    BudgetVersion.target_id == target.id, BudgetVersion.month == parsed
                )
            ):
                continue
            previous = session.scalar(
                select(BudgetVersion)
                .where(BudgetVersion.target_id == target.id, BudgetVersion.month < parsed)
                .order_by(BudgetVersion.month.desc())
                .limit(1)
            )
            if previous:
                amount = previous.amount
                if name == "Shopping" and month == "2026-01":
                    amount = Decimal("150")
                budgets.save_target(
                    session,
                    budget_schemas.TargetInput(
                        category_id=category.id,
                        currency="BRL",
                        month=month,
                        amount=amount,
                        active=previous.active,
                        group_id=groups[group_name].id,
                        sort_order=order,
                        rollover_enabled=name in {"Shopping", "Education"} and month == "2026-01",
                    ),
                )
        if not session.scalar(
            select(ClassificationAppearance.id).where(
                ClassificationAppearance.category_id == category.id
            )
        ):
            style = session.get(ClassificationAppearance, identity("group-style/" + group_name))
            session.add(
                ClassificationAppearance(
                    id=identity("category-style/" + name),
                    category_id=category.id,
                    color=style.color,
                    icon=icon,
                    created_at=STAMP,
                    updated_at=STAMP,
                )
            )
        if name in {"Travel", "Restaurants"}:
            month = date(2026, 8, 1)
            if not session.scalar(
                select(BudgetMonthOverride.id).where(
                    BudgetMonthOverride.target_id == target.id, BudgetMonthOverride.month == month
                )
            ):
                budgets.save_target(
                    session,
                    budget_schemas.TargetInput(
                        category_id=category.id,
                        currency="BRL",
                        month="2026-08",
                        scope="month",
                        amount="1000" if name == "Travel" else "450",
                        group_id=groups[group_name].id,
                        sort_order=order,
                    ),
                )
    # One visible, linked partial refund and an unbudgeted purchase; no invented market data.
    shopping = categories.get("Shopping")
    purchase = (
        session.scalar(
            select(Transaction)
            .where(
                Transaction.account_id == checking.id,
                Transaction.transaction_type == "EXPENSE",
                Transaction.deleted_at.is_(None),
                Transaction.category_id == shopping.id,
                Transaction.transaction_date == date(2026, 9, 17),
            )
            .order_by(Transaction.id)
        )
        if shopping
        else None
    )
    refunded = Decimal(0)
    expense = Decimal(0)
    if checking.active and purchase is not None:
        already_refunded = sum(
            session.scalars(
                select(Transaction.amount)
                .join(RefundLink, RefundLink.refund_id == Transaction.id)
                .where(RefundLink.purchase_id == purchase.id)
            ),
            Decimal(0),
        )
        if purchase.amount - already_refunded >= Decimal(35):
            spending.create_refund(
                session,
                budget_schemas.RefundInput(
                    purchase_id=purchase.id,
                    account_id=checking.id,
                    amount="35",
                    transaction_date=date(2026, 9, 24),
                    description="Fictional partial return of household shopping",
                ),
            )
            refunded = Decimal(35)
    if checking.active:
        ledger.create_transaction(
            session,
            schemas.TransactionCreate(
                account_id=checking.id,
                transaction_type="EXPENSE",
                amount="90",
                currency="BRL",
                transaction_date=date(2026, 9, 8),
                description="Bicycle repair",
                review_status="NEEDS_REVIEW",
            ),
        )
        expense = Decimal(90)
    # Link existing purchases only; event metadata never creates spending.
    linked = set(session.scalars(select(LifeEventLink.transaction_id)))
    events = [
        (
            "Coastal holiday",
            "TRAVEL",
            "2026-05-01",
            "2026-05-31",
            ["Travel", "Restaurants", "Transportation"],
            "4000",
            "blue",
            "plane",
        ),
        (
            "Home refresh",
            "HOME",
            "2026-07-01",
            "2026-07-31",
            ["Shopping", "Housing"],
            "3500",
            "purple",
            "home",
        ),
        (
            "Music weekend",
            "FESTIVAL",
            "2026-08-01",
            "2026-08-31",
            ["Entertainment", "Restaurants"],
            "1200",
            "amber",
            "music",
        ),
        (
            "Autumn course",
            "EDUCATION",
            "2026-09-01",
            "2026-09-30",
            ["Education", "Transportation"],
            "1500",
            "green",
            "book",
        ),
    ]
    for name, kind, start, end, names_in_event, budget, color, icon in events:
        event = life_events.save(
            session,
            life_events.EventInput(
                name=name,
                event_type=kind,
                start_date=start,
                end_date=end,
                currency="BRL",
                planned_budget=budget,
                color=color,
                icon=icon,
                description="Fictional household event; amounts derive from linked purchases.",
            ),
        )
        event.id, event.created_at, event.updated_at = identity("event/" + name), STAMP, STAMP
        session.flush()
        ids = [
            row.id
            for row in session.scalars(
                select(Transaction).where(
                    Transaction.account_id == checking.id,
                    Transaction.transaction_type == "EXPENSE",
                    Transaction.deleted_at.is_(None),
                    Transaction.transaction_date >= date.fromisoformat(start),
                    Transaction.transaction_date <= date.fromisoformat(end),
                    Transaction.category_id.in_(
                        [categories[n].id for n in names_in_event if n in categories]
                    ),
                )
            )
            if row.id not in linked
        ]
        if ids:
            life_events.link(session, event, ids)
            linked.update(ids)
    fixture.payload = {
        **fixture.payload,
        MARKER: CONTENT_VERSION,
        "spending_extension": {
            "refund": str(refunded),
            "expense": str(expense),
            "net_cash_change": str(refunded - expense),
        },
    }
    session.flush()
    return True
