"""Fictional ledger cases for coherent source-style dashboard projections."""

from datetime import date, timedelta
from decimal import Decimal

from test_net_worth_view import account, post

from app.net_worth_view import momentum


def test_dashboard_account_scopes_share_values_but_not_internal_funding(api):
    first = account(api, "Fictional brokerage A", "INVESTMENT", "1000")
    second = account(api, "Fictional brokerage B", "INVESTMENT", "0")
    post(
        api,
        "/transfers",
        source_account_id=first,
        destination_account_id=second,
        amount="250.123456",
        currency="BRL",
        transaction_date="2025-01-15",
        description="Fictional internal investment transfer",
    )
    params = dict(start="2025-01-01", end="2025-01-31")
    before = api.get("/api/accounts").json()
    response = api.get("/api/investments/analytics/dashboard", params=params)
    assert response.status_code == 200, response.text
    result = response.json()
    ordinary = api.get("/api/investments/analytics/performance", params=params).json()
    assert result["performance"] == ordinary
    assert sum(Decimal(a["value"]) for a in result["accounts"]) == Decimal("1000")
    assert all(Decimal(a["gain"]["value"]) == 0 for a in result["accounts"])
    assert all(Decimal(p["net_contribution"]) == 1000 for p in result["points"])
    for row in result["accounts"]:
        direct = api.get(
            "/api/investments/analytics/performance",
            params={
                **params,
                "account_ids": row["id"],
            },
        ).json()
        assert row["gain"] == direct["absolute_gain"]
        assert row["twr"] == direct["twr"]
    scoped = api.get(
        "/api/investments/analytics/dashboard",
        params={
            **params,
            "account_ids": second,
        },
    ).json()
    assert Decimal(scoped["points"][-1]["net_contribution"]) == Decimal("250.123456")
    assert len(scoped["accounts"]) == 1
    assert api.get("/api/accounts").json() == before


def test_dashboard_empty_and_invalid_account_are_explicit(api):
    params = dict(start="2025-01-01", end="2025-01-31")
    result = api.get("/api/investments/analytics/dashboard", params=params).json()
    assert result["accounts"] == []
    assert Decimal(result["performance"]["ending_value"]) == 0
    ordinary = account(api, "Not a brokerage")
    assert (
        api.get(
            "/api/investments/analytics/dashboard",
            params={
                **params,
                "account_ids": ordinary,
            },
        ).status_code
        == 404
    )


def test_missing_fx_keeps_dashboard_total_and_contribution_overlay_unavailable(api):
    account(api, "Fictional foreign brokerage", "INVESTMENT", "100", "USD")
    response = api.get(
        "/api/investments/analytics/dashboard",
        params={
            "start": "2025-01-02",
            "end": "2025-01-31",
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["performance"]["ending_value"] is None
    assert result["accounts"][0]["value"] is None
    assert all(p["value"] is None and p["net_contribution"] is None for p in result["points"])


def test_dashboard_demo_extension_is_idempotent_preserves_edits_and_personal_file(
    tmp_path, monkeypatch
):
    from sqlalchemy.orm import Session

    from app.demo import dashboard_content
    from app.demo.runtime import DemoStore
    from app.wealth_models import ManualPosition

    monkeypatch.setattr("app.demo.real_market.load_etfs", lambda: None)
    personal = tmp_path / "personal.db"
    personal.write_bytes(b"never open this normal database")
    store = DemoStore(tmp_path / "owned", personal, "unified").initialize()
    try:
        with Session(store.engine) as db, db.begin():
            row = db.get(ManualPosition, dashboard_content.identity("audio-collection"))
            row.name = "Preserved custom name"
            assert dashboard_content.extend(db) is False
            assert row.name == "Preserved custom name"
        from app.net_worth_view import history_view

        with Session(store.engine) as db:
            report = history_view(db, date(2026, 9, 1), date(2026, 9, 30), "BRL")
            assert any(
                s["name"] == "Preserved custom name" and s["days"] == 138
                for s in report["insights"]["stale"]
            )
        assert personal.read_bytes() == b"never open this normal database"
    finally:
        store.close()


def test_momentum_exact_windows_months_negative_and_missing_coverage():
    start = date(2025, 2, 1)
    points = [
        dict(
            date=date(2025, 1, 1) + timedelta(days=i),
            value=Decimal("1000.123456") + i * Decimal("0.123456"),
        )
        for i in range(63)
    ]
    end = date(2025, 3, 4)  # 31-day periods on both sides.
    result = momentum(points, start, end, date(2025, 1, 1))
    assert result["current_change"] == result["prior_change"] == Decimal("3.827136")
    assert result["beat_by"] == 0
    assert result["bars"][-1]["current"]
    points[-1]["value"] = Decimal("-10")
    assert momentum(points, start, end, date(2025, 1, 1))["current_change"] < 0
    points[35]["value"] = None
    assert any(b["value"] is None for b in momentum(points, start, end, date(2025, 1, 1))["bars"])
    assert momentum(points, start, end, start)["prior_change"] is None
