"""Small owned-demo organization examples; no financial or integration mutations."""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app.models import DemoFixture, FinancialAccount
from app.settings_models import AccountGroup, AccountGroupMember

MARKER = "settings_content"
CONTENT_VERSION = 1


def extend(session):
    from app.demo.unified import VERSION

    fixture = session.get(DemoFixture, VERSION)
    if fixture is None:
        raise ValueError("Settings examples require an owned unified demo")
    if fixture.payload.get(MARKER) == CONTENT_VERSION:
        return False
    stamp = datetime(2026, 9, 30, tzinfo=UTC)
    accounts = list(session.scalars(select(FinancialAccount).where(FinancialAccount.active)))
    for name, investment in (("Household", False), ("Investments", True)):
        identifier = uuid5(NAMESPACE_URL, "finance-tracker/settings-demo-1/" + name)
        if session.get(AccountGroup, identifier) is not None:
            continue
        session.add(
            AccountGroup(
                id=identifier,
                name=name,
                normalized_name=name.casefold(),
                description="Fictional account organization; no separate holdings",
                created_at=stamp,
                updated_at=stamp,
            )
        )
        session.flush()
        session.add_all(
            AccountGroupMember(group_id=identifier, account_id=account.id)
            for account in accounts
            if (account.type == "INVESTMENT") == investment
        )
    fixture.payload = {**fixture.payload, MARKER: CONTENT_VERSION}
    session.flush()
    return True
