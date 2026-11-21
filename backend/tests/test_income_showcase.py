"""Approved fictional payments use real postings in a separately owned scenario."""

from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import investment_analytics, investments, ledger, wealth
from app.demo.app import create_demo_app
from app.demo.etf_showcase import END, START
from app.demo.income_showcase import QUANTITY, SYMBOL, seed
from app.demo.runtime import DemoStore
from app.models import Asset, FinancialAccount, InvestmentActivity, PriceObservation


def test_income_seed_reconciles_all_payments_positions_cash_and_net_worth(tmp_path):
    store = DemoStore(tmp_path / "income", tmp_path / "personal.db", "income-showcase").initialize()
    try:
        with Session(store.engine) as db:
            assert seed(db) is False
            events = list(db.scalars(select(InvestmentActivity)))
            assert len(events) == 35
            assert len(list(db.scalars(select(PriceObservation)))) == 1566
            assert len(list(db.scalars(select(Asset)))) == 3
            data = investment_analytics.income(db, START, END, currency="BRL")
            assert len(data["events"]) == 27
            dividend = [e for e in data["events"] if e["type"] == "DIVIDEND"]
            interest = [e for e in data["events"] if e["type"] == "INTEREST"]
            assert len(dividend) == 7 and len(interest) == 20
            assert sum((Decimal(e["net"]) for e in dividend), Decimal(0)) == Decimal("697.50")
            assert sum((Decimal(e["net"]) for e in interest), Decimal(0)) == Decimal("502.50")
            assert Decimal(data["reporting"]["totals"]["net"]) == 1200
            for dimension in ("account", "security", "type", "year"):
                assert (
                    sum((Decimal(r["net"]) for r in data["breakdowns"][dimension]), Decimal(0))
                    == 1200
                )
            assert len(data["months"]) == 20
            accounts = list(db.scalars(select(FinancialAccount)))
            checking = next(a for a in accounts if a.type == "CHECKING")
            cash = ledger.balances(db, cutoff=END)
            assert cash[checking.id] == 17000  # Internal funding, not additional wealth/income.
            assert all(value >= 0 for value in cash.values())
            positions = investments.portfolio(db, as_of=END, serialize=False)
            holding = next(h for h in positions["holdings"] if h["symbol"] == SYMBOL)
            assert holding["quantity"] == QUANTITY
            assert holding["income"] == Decimal("697.50")
            total = positions["totals"][0]["total_value"]
            assert wealth.net_worth(db, END, END, "BRL")["value"] == total + 17000
            # One new asset's unrealized gain and 1,200 actual credits explain all added wealth.
            assert total + 17000 == Decimal("113724.568505") + holding["unrealized"] + 1200
            assert (
                investment_analytics.income(db, date(2026, 1, 1), END, currency="BRL")["reporting"][
                    "totals"
                ]["net"]
                == "585.750000"
            )
            performance = investment_analytics.performance(db, START, END, "BRL")
            assert performance["twr"]["value"] is not None
            assert performance["xirr"]["value"] is not None
    finally:
        store.close()
    assert not (tmp_path / "personal.db").exists()


def test_income_switch_reset_resume_preserves_original_showcase_and_personal_data(tmp_path):
    personal = tmp_path / "personal.db"
    personal.write_bytes(b"personal sentinel")
    with TestClient(
        create_demo_app(personal, tmp_path / "owned", scenario="etf-showcase"),
        base_url="http://127.0.0.1:8001",
    ) as api:
        runtime = api.get("/api/runtime").json()
        original = api.get("/api/accounts").json()
        headers = {"X-Finance-Demo": "1", "X-Demo-Generation": runtime["generation"]}

        def switch(scenario):
            result = api.post(
                "/api/demo-control/scenario", json={"scenario": scenario}, headers=headers
            )
            assert result.status_code == 200, result.text
            headers["X-Demo-Generation"] = result.json()["generation"]

        switch("income-showcase")
        query = f"/api/investments/analytics/income?start={START}&end={END}&currency=BRL"
        baseline = api.get(query).json()
        assert Decimal(baseline["reporting"]["totals"]["net"]) == 1200
        reset = api.post(
            "/api/demo-control/reset",
            json={"confirmation": "RESET FICTIONAL DEMO"},
            headers=headers,
        )
        assert reset.status_code == 200
        assert api.get(query).json() == baseline
        assert (
            api.post(
                "/api/demo-control/reset",
                json={"confirmation": "RESET FICTIONAL DEMO"},
                headers=headers,
            ).status_code
            == 409
        )
        headers["X-Demo-Generation"] = reset.json()["generation"]
        switch("etf-showcase")
        assert api.get("/api/accounts").json() == original
        assert api.get(query).json()["events"] == []
        switch("income-showcase")
        assert api.get(query).json() == baseline
    assert personal.read_bytes() == b"personal sentinel"
