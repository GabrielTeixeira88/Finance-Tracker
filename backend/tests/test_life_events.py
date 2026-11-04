from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session
from test_budgets import category, entry
from test_wealth import account

from app.market_models import FXObservation


def create(api, **changes):
    data = (
        dict(
            name="Fictional trip",
            start_date="2026-09-01",
            end_date="2026-09-30",
            currency="BRL",
            planned_budget="500",
        )
        | changes
    )
    response = api.post("/api/life-events", json=data)
    assert response.status_code == 201, response.text
    return response.json(), data


def link(api, event, *ids):
    return api.post(f"/api/life-events/{event['id']}/transactions", json={"transaction_ids": ids})


def detail(api, event, day="2026-10-01"):
    response = api.get(f"/api/life-events/{event['id']}", params={"as_of": day})
    assert response.status_code == 200, response.text
    return response.json()


def test_event_refunds_categories_dates_and_delete_preserve_ledger(api):
    a, c = account(api), category(api)
    purchase = entry(api, a["id"], c, "200.123456")
    credit = entry(api, a["id"], None, "20.123456", "2026-10-01", "INCOME")
    assert (
        api.post(
            "/api/spending/refunds/link",
            json={"purchase_id": purchase["id"], "refund_id": credit["id"]},
        ).status_code
        == 201
    )
    event, data = create(api)
    before = api.get("/api/accounts").json()
    assert link(api, event, purchase["id"]).status_code == 200
    assert link(api, event, purchase["id"]).status_code == 200
    early = detail(api, event, "2026-09-30")
    assert Decimal(early["actual_cost"]) == Decimal("200.123456")
    result = detail(api, event)
    assert Decimal(result["actual_cost"]) == 180
    assert Decimal(result["remaining"]) == 320
    assert result["categories"] == [{"id": c, "name": "Synthetic Groceries", "value": "180.000000"}]
    assert result["transaction_count"] == 2
    assert (
        api.patch(
            f"/api/life-events/{event['id']}", json={**data, "end_date": "2026-09-09"}
        ).status_code
        == 409
    )
    assert (
        api.patch(
            f"/api/life-events/{event['id']}", json={**data, "name": "Renamed fictional trip"}
        ).status_code
        == 200
    )
    assert api.delete(f"/api/life-events/{event['id']}").status_code == 204
    assert api.get("/api/accounts").json() == before
    assert api.get(f"/api/transactions/{purchase['id']}").status_code == 200


def test_event_batch_atomicity_unique_purchase_and_boundary_guards(api):
    a, c = account(api), category(api)
    good = entry(api, a["id"], c, day="2026-09-01")
    last = entry(api, a["id"], c, day="2026-09-30")
    bad = entry(api, a["id"], c, day="2026-08-31")
    event, _ = create(api)
    other, _ = create(api, name="Another fictional event")
    assert link(api, event, good["id"], bad["id"]).status_code == 422
    assert detail(api, event)["linked_ids"] == []
    assert link(api, event, good["id"], last["id"]).status_code == 200
    assert link(api, other, good["id"]).status_code == 409
    inc = entry(api, a["id"], None, kind="INCOME")
    assert link(api, event, inc["id"]).status_code == 422
    b = account(api, name="Other")
    transfer = api.post(
        "/api/transfers",
        json=dict(
            source_account_id=a["id"],
            destination_account_id=b["id"],
            amount="50",
            currency="BRL",
            transaction_date="2026-09-10",
        ),
    ).json()
    side = next(
        row
        for row in api.get("/api/transactions").json()
        if row.get("transfer_id") == transfer["id"]
    )
    assert link(api, event, side["id"]).status_code == 422
    assert (
        api.delete(f"/api/life-events/{event['id']}/transactions/{good['id']}").status_code == 204
    )
    assert link(api, other, good["id"]).status_code == 200


@pytest.mark.parametrize(
    "rate_day,complete", [("2026-09-09", True), ("2026-09-02", False), ("2026-09-11", False)]
)
def test_event_dated_fx_no_future_or_stale_conversion(api, db_engine, rate_day, complete):
    a = account(api, currency="USD")
    tx = api.post(
        "/api/transactions",
        json=dict(
            account_id=a["id"],
            currency="USD",
            transaction_type="EXPENSE",
            amount="12.34",
            transaction_date="2026-09-10",
            description="Synthetic foreign purchase",
        ),
    ).json()
    with Session(db_engine) as session:
        for currency, rate in [("USD", "1.1"), ("BRL", "5.5")]:
            session.add(
                FXObservation(
                    base_currency="EUR",
                    quote_currency=currency,
                    rate_date=date.fromisoformat(rate_day),
                    rate=Decimal(rate),
                    provider="ECB",
                    fetched_at=datetime(2026, 9, 12, tzinfo=UTC),
                )
            )
        session.commit()
    event, _ = create(api)
    assert link(api, event, tx["id"]).status_code == 200
    result = detail(api, event)
    assert result["complete"] is complete
    assert (
        result["actual_cost"] is None
        if not complete
        else Decimal(result["actual_cost"]) == Decimal("61.70")
    )
    assert result["native_totals"][0]["currency"] == "USD"


def test_event_invalid_dates_budget_and_future_cutoff(api):
    for changes in [{"start_date": "2026-10-01"}, {"planned_budget": "-1"}]:
        response = api.post(
            "/api/life-events",
            json=dict(
                name="Invalid", start_date="2026-09-01", end_date="2026-09-30", currency="BRL"
            )
            | changes,
        )
        assert response.status_code == 422
    event, _ = create(api)
    assert api.get(f"/api/life-events/{event['id']}?as_of=2099-01-01").status_code == 422
