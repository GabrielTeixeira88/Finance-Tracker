from decimal import Decimal

from test_budgets import category, entry
from test_wealth import account, post


def report(api, start="2026-09-01", end="2026-10-01", as_of="2026-09-30"):
    response = api.get(
        "/api/spending/workspace",
        params={
            "date_from": start,
            "date_to": end,
            "currency": "BRL",
            "as_of": as_of,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_workspace_preserves_financial_scenario_and_separates_net_saving(api):
    checking = account(api, "Checking", "5000", "CHECKING")
    savings = account(api, "Savings", "2000")
    cat = category(api)
    entry(api, checking["id"], cat, "200")
    entry(api, checking["id"], cat, "1000", kind="INCOME")
    post(
        api,
        "/transfers",
        dict(
            source_account_id=checking["id"],
            destination_account_id=savings["id"],
            amount="500",
            currency="BRL",
            transaction_date="2026-09-12",
        ),
    )
    before = api.get("/api/accounts").json()
    values = report(api)["current"]
    assert Decimal(values["income"]) == 1000
    assert Decimal(values["expenses"]) == 200
    assert Decimal(values["net_flow"]) == 800
    assert Decimal(values["net_saved"]) == 500
    assert Decimal(values["after_savings"]) == 300
    balances = {row["name"]: Decimal(row["balance"]) for row in before}
    assert balances == {"Checking": Decimal(5300), "Savings": Decimal(2500)}
    assert api.get("/api/accounts").json() == before


def test_return_from_saving_and_card_payment_never_become_personal_income_or_expense(api):
    checking = account(api, "Checking", "1000", "CHECKING")
    savings = account(api, "Savings", "2000")
    card = account(api, "Card", "0", "CREDIT_CARD")
    for source, destination, amount in [(savings, checking, "100"), (checking, card, "200")]:
        post(
            api,
            "/transfers",
            dict(
                source_account_id=source["id"],
                destination_account_id=destination["id"],
                amount=amount,
                currency="BRL",
                transaction_date="2026-09-12",
            ),
        )
    data = report(api)
    assert Decimal(data["current"]["income"]) == Decimal(data["current"]["expenses"]) == 0
    assert Decimal(data["current"]["net_saved"]) == -100
    assert Decimal(data["current"]["after_savings"]) == 100


def test_refunds_use_credit_date_and_preserve_negative_spending(api):
    checking = account(api, kind="CHECKING")
    cat = category(api)
    purchase = entry(api, checking["id"], cat, "200", day="2026-08-20")
    post(
        api,
        "/spending/refunds",
        dict(
            purchase_id=purchase["id"],
            account_id=checking["id"],
            amount="50",
            transaction_date="2026-09-10",
        ),
    )
    data = report(api)
    assert Decimal(data["current"]["income"]) == 0
    assert Decimal(data["current"]["expenses"]) == -50
    assert Decimal(data["categories"][0]["current"]) == -50
    assert sum(Decimal(day["spending"]) for day in data["daily"]) == -50


def test_same_elapsed_comparison_and_calendar_weekdays(api):
    checking = account(api, kind="CHECKING")
    cat = category(api)
    entry(api, checking["id"], cat, "25.123456", day="2026-08-10")
    entry(api, checking["id"], cat, "90", day="2026-08-11")
    entry(api, checking["id"], cat, "45.654321", day="2026-09-10")
    data = report(api, end="2026-09-11", as_of="2026-09-10")
    assert data["previous_end_exclusive"] == "2026-08-11"
    assert data["previous"]["expenses"] == "25.123456"
    assert data["current"]["change"] == "20.530865"
    assert data["weekdays"][3]["amount"] == "45.654321"  # Thursday, calendar date only.
    assert len(data["daily"]) == 10
    assert data["categories"][0]["history"][-1]["amount"] == "45.654321"


def test_missing_currency_is_not_converted_and_future_period_is_rejected(api):
    foreign = account(api, "Foreign", "1000", "CHECKING", "USD")
    post(
        api,
        "/transactions",
        dict(
            account_id=foreign["id"],
            currency="USD",
            transaction_type="EXPENSE",
            amount="32.123456",
            transaction_date="2026-09-10",
            description="Fictional foreign expense",
        ),
    )
    data = report(api)
    assert data["other_currencies"] == ["USD"]
    assert Decimal(data["current"]["expenses"]) == 0
    assert (
        api.get(
            "/api/spending/workspace",
            params={
                "date_from": "2026-09-01",
                "date_to": "2026-10-02",
                "as_of": "2026-09-30",
                "currency": "BRL",
            },
        ).status_code
        == 422
    )


def test_category_and_group_appearance_is_optional_preserved_and_balance_neutral(api):
    account(api)
    before = api.get("/api/accounts").json()
    cat = post(
        api, "/categories", dict(name="Fictional category", color="#5989AB", icon="ShoppingCart")
    )
    renamed = api.put("/api/categories/" + cat["id"], json={"name": "Renamed category"})
    assert renamed.status_code == 200
    assert renamed.json()["color"] == "#5989AB"
    assert renamed.json()["icon"] == "ShoppingCart"
    group = post(api, "/budgets/groups", dict(name="Fictional group", color="#8A6CBA", icon="Gift"))
    updated = api.put(
        "/api/budgets/groups/" + group["id"], json={"name": "Renamed group", "sort_order": 1}
    )
    assert updated.json()["icon"] == "Gift"
    assert (
        api.put(
            "/api/categories/" + cat["id"],
            json={"name": "Renamed category", "color": "url(unsafe)"},
        ).status_code
        == 422
    )
    assert api.get("/api/accounts").json() == before
    assert api.delete("/api/categories/" + cat["id"]).status_code == 204
    assert api.delete("/api/budgets/groups/" + group["id"]).status_code == 204


def test_daily_category_history_and_gross_saving_destinations_reconcile(api):
    checking = account(api, "Checking", "1000", "CHECKING")
    savings = account(api, "Savings", "2000")
    cat = category(api)
    entry(api, checking["id"], cat, "10.123456", day="2026-09-03")
    entry(api, checking["id"], cat, "20.654321", day="2026-09-10")
    for source, destination, amount in [(checking, savings, "500"), (savings, checking, "100")]:
        post(
            api,
            "/transfers",
            dict(
                source_account_id=source["id"],
                destination_account_id=destination["id"],
                amount=amount,
                currency="BRL",
                transaction_date="2026-09-12",
            ),
        )
    before = api.get("/api/accounts").json()
    data = report(api)
    points = data["categories"][0]["daily_history"]
    assert [row["date"] for row in points] == ["2026-09-03", "2026-09-10"]
    assert sum(Decimal(row["amount"]) for row in points) == Decimal("30.777777")
    assert Decimal(data["saving_destinations"][0]["amount"]) == 500
    assert Decimal(data["current"]["from_savings"]) == 100
    assert Decimal(data["current"]["net_saved"]) == 400
    assert api.get("/api/accounts").json() == before
