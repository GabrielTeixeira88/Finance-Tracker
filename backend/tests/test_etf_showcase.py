"""Fictional observations only; isolated migrated databases and actual ledger services."""

from datetime import date
from decimal import Decimal, localcontext

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import investment_analytics, investments, ledger, market_valuation, wealth
from app.demo.app import create_demo_app
from app.demo.etf_showcase import END, START, TRADES, prices, seed
from app.demo.runtime import DemoStore
from app.models import Asset, FinancialAccount, InvestmentActivity, PriceObservation, Transaction


def test_deterministic_prices_have_declines_recovery_and_distinct_regimes():
    for index in (0, 1):
        values = list(prices(index))
        assert values == list(prices(index))
        assert len(values) > 500
        assert all(day.weekday() < 5 and value > 0 for day, value in values)
        changes = [b[1] - a[1] for a, b in zip(values, values[1:], strict=False)]
        assert any(v > 0 for v in changes) and any(v < 0 for v in changes)
        lookup = dict(values)
        assert lookup[date(2025, 4, 30)] < lookup[date(2025, 1, 31)]
        assert lookup[END] > lookup[date(2026, 3, 31)]


def test_real_posting_cost_cash_performance_and_net_worth(tmp_path):
    store = DemoStore(tmp_path / "showcase", tmp_path / "normal.db", "etf-showcase").initialize()
    try:
        with Session(store.engine) as db, localcontext() as context:
            context.prec = 60
            assert seed(db) is False
            assets = list(db.scalars(select(Asset).order_by(Asset.symbol)))
            assert {a.symbol for a in assets} == {"SIM-GLOBAL-ETF", "SIM-SP500-ETF"}
            assert all(a.exchange == "SYNTHETIC" for a in assets)
            marks = list(db.scalars(select(PriceObservation)))
            assert len(marks) == len(list(prices(0))) * 2
            assert {m.source for m in marks} == {"SYNTHETIC"}
            activities = list(db.scalars(select(InvestmentActivity)))
            assert len(activities) == len(TRADES)
            assert len(list(db.scalars(select(Transaction)))) == 3  # Opening + linked funding.
            portfolio = investments.portfolio(db, as_of=END, serialize=False)
            global_position = next(
                h for h in portfolio["holdings"] if h["symbol"] == "SIM-GLOBAL-ETF"
            )
            assert global_position["quantity"] == 230
            assert (
                next(h for h in portfolio["holdings"] if h["symbol"] == "SIM-SP500-ETF")["quantity"]
                == 110
            )
            quotes = [dict(prices(i)) for i in (0, 1)]
            basis = sum(
                (
                    Decimal(q) * quotes[0][date.fromisoformat(d)]
                    for d, i, k, q in TRADES
                    if i == 0 and k == "BUY"
                ),
                Decimal(0),
            )
            removed = basis * 40 / 270
            assert global_position["cost_basis"] == basis - removed
            assert global_position["realized"] == quotes[0][date(2026, 6, 5)] * 40 - removed
            assert global_position["market_value"] == quotes[0][END] * 230
            for account in db.scalars(select(FinancialAccount)):
                assert ledger.balances(db, cutoff=END).get(account.id, Decimal(0)) >= 0
            historical = market_valuation.history(db, START, END)
            assert not any(p["missing_assets"] or p["missing_fx"] for p in historical["points"])
            assert len({p["value"] for p in historical["points"]}) > 300
            accounts = list(db.scalars(select(FinancialAccount)))
            checking = next(a for a in accounts if a.type == "CHECKING")
            brokerage = next(a for a in accounts if a.type == "INVESTMENT")
            total = portfolio["totals"][0]["total_value"]
            assert (
                wealth.net_worth(db, END, END, "BRL")["value"]
                == total + ledger.balances(db, cutoff=END)[checking.id]
            )
            performance = investment_analytics.performance(db, START, END, "BRL", [brokerage.id])
            assert performance["twr"]["value"] is not None
            assert performance["xirr"]["value"] is not None
            allocation = investment_analytics.allocation(db, END, "BRL")
            assert allocation["quality"] == "COMPLETE"
            assert Decimal(allocation["total_value"]) == total
    finally:
        store.close()
    assert not (tmp_path / "normal.db").exists()


def test_switch_reset_and_stale_generation_are_scenario_scoped(tmp_path, monkeypatch):
    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    monkeypatch.setattr("app.demo.real_market_snapshot.LOCAL_ETF", tmp_path / "missing.json")
    normal = tmp_path / "personal.db"
    normal.write_bytes(b"untouched normal data sentinel")
    with TestClient(
        create_demo_app(normal, tmp_path / "owned", scenario="real-market-br"),
        base_url="http://127.0.0.1:8001",
    ) as api:
        runtime = api.get("/api/runtime").json()
        original = api.get("/api/net-worth/history", params={"start": END, "end": END}).json()
        period = {"date_from": "2026-09-01", "date_to": "2026-10-01", "currency": "BRL"}
        original_spending = api.get("/api/spending/summary", params=period).json()
        assert Decimal(original_spending["expenses"]) > 0
        headers = {"X-Finance-Demo": "1", "X-Demo-Generation": runtime["generation"]}
        response = api.post(
            "/api/demo-control/scenario", json={"scenario": "etf-showcase"}, headers=headers
        )
        assert response.status_code == 200
        assert Decimal(api.get("/api/spending/summary", params=period).json()["expenses"]) == 0
        generation = response.json()["generation"]
        before = api.get("/api/investments/portfolio").json()
        headers["X-Demo-Generation"] = generation
        reset = api.post(
            "/api/demo-control/reset",
            json={"confirmation": "RESET FICTIONAL DEMO"},
            headers=headers,
        )
        assert reset.status_code == 200
        assert api.get("/api/investments/portfolio").json() == before
        assert (
            api.post(
                "/api/demo-control/reset",
                json={"confirmation": "RESET FICTIONAL DEMO"},
                headers=headers,
            ).status_code
            == 409
        )
        headers["X-Demo-Generation"] = reset.json()["generation"]
        assert (
            api.post(
                "/api/demo-control/scenario", json={"scenario": "real-market-br"}, headers=headers
            ).status_code
            == 200
        )
        assert (
            api.get("/api/net-worth/history", params={"start": END, "end": END}).json() == original
        )
        assert api.get("/api/spending/summary", params=period).json() == original_spending
        assert api.get("/api/market-data/status").status_code == 403
    assert normal.read_bytes() == b"untouched normal data sentinel"
