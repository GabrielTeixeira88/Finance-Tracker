"""One local demo ledger: household, sourced fixed income and fictional equity income."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app import ledger, schemas
from app.demo import etf_showcase, income_portfolio, income_showcase, real_market
from app.demo.real_market_snapshot import scenario_root as household_root
from app.market_models import MarketSettings
from app.models import DemoFixture, FinancialAccount

VERSION = "unified-brazil-demo-1"


def scenario_root(root):
    fingerprint = household_root(root).name.rsplit("-", 1)[-1]
    return root.with_name(root.name + "-unified-1-" + fingerprint)


def seed(session):
    if session.get(DemoFixture, VERSION):
        return False
    real_market.seed(session)
    extend(session)
    return True


def extend(session):
    """Add once to a verified household copy, without rewriting any financial history."""
    if session.get(DemoFixture, VERSION):
        return False
    fixture = session.get(DemoFixture, real_market.VERSION)
    if fixture is None:
        raise ValueError("Unified demo requires a verified historical household")
    checking = session.get(FinancialAccount, real_market.identity("row/2"))
    if checking is None or checking.type != "CHECKING" or checking.currency != "BRL":
        raise ValueError("Historical household checking identity is unavailable")
    settings = session.scalar(select(MarketSettings))
    # All currencies are BRL. No synthetic FX observations or live FX conversions.
    # Official CDI factors and Treasury MANUAL/OFFICIAL_PU observations stay intact.
    settings.fx_provider = "SYNTHETIC"
    capital = ledger.create_account(
        session,
        schemas.AccountCreate(
            name="Initial investment capital",
            type="CASH",
            currency="BRL",
            institution="Fictional demo capital",
            opening_balance="93000",
            opening_date=date(2024, 10, 1),
        ),
    )
    ledger.create_transfer(
        session,
        schemas.TransferCreate(
            source_account_id=capital.id,
            destination_account_id=checking.id,
            amount="93000",
            currency="BRL",
            transaction_date=date(2024, 10, 1),
            description="Fictional opening investment capital; internal funding, not income",
        ),
    )
    capital.active = False  # The auditable zero-balance funding account stays in history.
    brokerage = etf_showcase.populate(session, checking)
    income_account = income_showcase.populate(session, checking, brokerage)
    income_portfolio.populate(session, checking, income_account)
    brokerage.name = "Equity brokerage"
    income_account.name = "Income portfolio"
    fixture.id = VERSION
    evidence = {**fixture.payload["market_evidence"]}
    evidence["warnings"] = (
        []
        if evidence["etf_coverage"] == "COMPLETE"
        else [
            "Real WRLD11/IVVB11 history is unavailable. SIM securities and their cash "
            "distributions are fictional; CDI and Treasury observations retain official provenance."
        ]
    )
    fixture.payload = {**fixture.payload, "unified": True, "market_evidence": evidence}
    session.flush()
    from app.demo.holdings_activities import extend as extend_holdings

    extend_holdings(session)
    from app.demo.spending_content import extend as extend_spending

    extend_spending(session)
    from app.demo.goal_content import extend as extend_goals

    extend_goals(session)
    from app.demo.performance_content import extend as extend_performance

    extend_performance(session)
    from app.demo.dashboard_content import extend as extend_dashboard

    extend_dashboard(session)
    from app.demo.settings_content import extend as extend_settings

    extend_settings(session)
    from app.demo.audit_content import extend as extend_audit

    extend_audit(session)
    session.flush()
    # New funded purchases must not alter original household or savings cash at replay end.
    if ledger.balances(session, cutoff=date(2026, 9, 30))[capital.id] != Decimal(0):
        raise ValueError("Opening investment capital did not reconcile")
    return True
