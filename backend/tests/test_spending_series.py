from decimal import Decimal

from test_budgets import category, entry
from test_ingestion import account


def test_series_uses_exact_ledger_expenses_and_half_open_boundaries(api):
    aid, cat = account(api), category(api)
    entry(api, aid, cat, "0.123456", "2026-09-10")
    entry(api, aid, cat, "0.100001", "2026-09-10")
    entry(api, aid, cat, "1000", "2026-09-10", "INCOME")
    entry(api, aid, cat, "999", "2026-10-01")
    response = api.get(
        "/api/spending/summary",
        params={
            "currency": "BRL",
            "date_from": "2026-09-01",
            "date_to": "2026-10-01",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["daily"]) == 1
    assert Decimal(data["daily"][0]["amount"]) == Decimal("0.223457")
    assert Decimal(data["monthly"][0]["expenses"]) == Decimal(data["expenses"])
    assert Decimal(data["monthly"][0]["income"]) == Decimal("1000")
    assert data["date_to_exclusive"] == "2026-10-01"

    assert data["payees"] == [{"payee_id": None, "spent": "0.223457"}]
