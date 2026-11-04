from decimal import Decimal

from test_budgets import category, entry, report, target
from test_ingestion import account


def test_narrative_compares_elapsed_days_and_excludes_transfers(api):
    a, b, c = account(api), account(api, "Other"), category(api)
    target(api, c)
    entry(api, a, c, "50", "2026-08-05")
    entry(api, a, c, "900", "2026-08-20")
    entry(api, a, c, "150", "2026-09-05")
    credit = entry(api, a, None, "30", "2026-09-10", "INCOME")
    purchase = entry(api, a, c, "100", "2026-09-08")
    assert (
        api.post(
            "/api/spending/refunds/link",
            json={"purchase_id": purchase["id"], "refund_id": credit["id"]},
        ).status_code
        == 201
    )
    api.post(
        "/api/transfers",
        json=dict(
            source_account_id=a,
            destination_account_id=b,
            amount="1000",
            currency="BRL",
            transaction_date="2026-09-09",
        ),
    )
    data = report(api, as_of="2026-09-10")
    narrative = data["narrative"]
    assert narrative["previous_days"] == 10 and narrative["remaining_days"] == 20
    assert Decimal(narrative["previous_spending"]) == 50
    assert Decimal(narrative["change_percent"]) == 340
    comparison = next(r for r in narrative["comparisons"] if r["category_id"] == c)
    assert Decimal(comparison["previous"]) == 50
    assert Decimal(comparison["change"]) == 170
    change = next(r for r in narrative["changes"] if r["category_id"] == c)
    assert Decimal(change["previous"]) == 50
    assert Decimal(change["current"]) == 220
    assert Decimal(change["change"]) == 170
    assert sum(Decimal(d["value"]) for d in narrative["weekdays"]) == 220
    assert narrative["budget_status"] == "within_budget"
