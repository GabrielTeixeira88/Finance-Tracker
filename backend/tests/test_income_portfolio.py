"""Rich income display is driven by isolated, deterministic real ledger postings."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import investment_analytics, investments, ledger, wealth
from app.demo.app import create_demo_app
from app.demo.etf_showcase import END, START
from app.demo.income_portfolio import seed
from app.demo.runtime import DemoStore
from app.models import Asset, FinancialAccount, InvestmentActivity, PriceObservation


def test_rich_income_reconciles_every_month_source_and_cash_posting(tmp_path):
    store = DemoStore(tmp_path / "rich", tmp_path / "personal.db", "income-portfolio").initialize()
    try:
        with Session(store.engine) as db:
            assert seed(db) is False
            assert len(list(db.scalars(select(Asset)))) == 11
            assert len(list(db.scalars(select(PriceObservation)))) == 5742
            assert len(list(db.scalars(select(InvestmentActivity)))) == 151
            result = investment_analytics.income(db, START, END, currency="BRL")
            assert len(result["events"]) == 135
            assert len(result["breakdowns"]["security"]) == 10
            assert len(result["breakdowns"]["account"]) == 2
            assert len(result["months"]) == 20
            expected = Decimal("2564.587500")
            assert Decimal(result["reporting"]["totals"]["net"]) == expected
            for group in result["breakdowns"].values():
                assert sum((Decimal(row["net"]) for row in group), Decimal(0)) == expected
            assert sum((Decimal(row["net"]) for row in result["months"]), Decimal(0)) == expected
            balances = ledger.balances(db, cutoff=END)
            assert all(value >= 0 for value in balances.values())
            checking = db.scalar(
                select(FinancialAccount).where(FinancialAccount.type == "CHECKING")
            )
            assert balances[checking.id] == 7000
            portfolio = investments.portfolio(db, as_of=END, serialize=False)
            assert (
                wealth.net_worth(db, END, END, "BRL")["value"]
                == portfolio["totals"][0]["total_value"] + 7000
            )
            performance = investment_analytics.performance(db, START, END, "BRL")
            assert performance["twr"]["value"] is not None
            assert performance["xirr"]["value"] is not None
            assert investment_analytics.allocation(db, END, "BRL")["quality"] == "COMPLETE"
    finally:
        store.close()
    assert not (tmp_path / "personal.db").exists()


def test_rich_scenario_reset_preserves_original_brazil_and_income_workspaces(tmp_path):
    normal = tmp_path / "personal.db"
    normal.write_bytes(b"untouched personal sentinel")
    with TestClient(
        create_demo_app(normal, tmp_path / "owned", scenario="real-market-br"),
        base_url="http://127.0.0.1:8001",
    ) as api:
        brazil = api.get("/api/accounts").json()
        headers = {
            "X-Finance-Demo": "1",
            "X-Demo-Generation": api.get("/api/runtime").json()["generation"],
        }

        def switch(scenario):
            response = api.post(
                "/api/demo-control/scenario", json={"scenario": scenario}, headers=headers
            )
            assert response.status_code == 200, response.text
            headers["X-Demo-Generation"] = response.json()["generation"]

        query = f"/api/investments/analytics/income?start={START}&end={END}&currency=BRL"
        switch("income-showcase")
        original = api.get(query).json()
        switch("income-portfolio")
        rich = api.get(query).json()
        reset = api.post(
            "/api/demo-control/reset",
            json={"confirmation": "RESET FICTIONAL DEMO"},
            headers=headers,
        )
        assert reset.status_code == 200, reset.text
        assert api.get(query).json() == rich
        assert (
            api.post(
                "/api/demo-control/reset",
                json={"confirmation": "RESET FICTIONAL DEMO"},
                headers=headers,
            ).status_code
            == 409
        )
        headers["X-Demo-Generation"] = reset.json()["generation"]
        switch("income-showcase")
        assert api.get(query).json() == original
        switch("real-market-br")
        assert api.get("/api/accounts").json() == brazil
    assert normal.read_bytes() == b"untouched personal sentinel"
