"""Settings metadata and exports never mutate financial history."""

import csv
import io
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session
from test_investments import account, asset

from app.market_models import FXObservation


def test_groups_normalize_membership_and_preserve_ledger(api):
    aid = account(api)
    before = api.get("/api/accounts").json()
    data = {
        "name": "  Household   Assets ",
        "description": "Fictional organization",
        "account_ids": [aid],
    }
    result = api.post("/api/settings/account-groups", json=data)
    assert result.status_code == 201, result.text
    group = result.json()
    assert group["name"] == "Household Assets"
    assert group["account_ids"] == [aid]
    assert (
        api.post(
            "/api/settings/account-groups", json={**data, "name": "household assets"}
        ).status_code
        == 409
    )
    assert (
        api.put(
            f"/api/settings/account-groups/{group['id']}", json={**data, "name": "Renamed"}
        ).status_code
        == 200
    )
    assert api.get("/api/settings/account-groups").json()[0]["name"] == "Renamed"
    assert api.delete(f"/api/settings/account-groups/{group['id']}").status_code == 204
    assert api.get("/api/accounts").json() == before


def test_group_failed_membership_update_is_atomic(api):
    aid = account(api)
    group = api.post(
        "/api/settings/account-groups", json={"name": "Fictional", "account_ids": [aid]}
    ).json()
    result = api.put(
        f"/api/settings/account-groups/{group['id']}",
        json={"name": "Changed", "account_ids": [aid, str(uuid4())]},
    )
    assert result.status_code == 404
    assert api.get("/api/settings/account-groups").json()[0] == group
    assert (
        api.post(
            "/api/settings/account-groups", json={"name": "Duplicate", "account_ids": [aid, aid]}
        ).status_code
        == 422
    )


def test_security_name_only_edit_does_not_change_identity_or_balances(api):
    aid = account(api)
    sid = asset(api)
    before = api.get("/api/accounts").json()
    assert (
        api.patch(
            f"/api/settings/securities/{sid}", json={"name": "Fictional renamed ETF"}
        ).status_code
        == 200
    )
    assert (
        api.patch(
            f"/api/settings/securities/{sid}", json={"name": "Bad", "currency": "USD"}
        ).status_code
        == 422
    )
    assert api.get("/api/investments/assets").json()[0]["symbol"] == "FAKE11"
    assert api.get("/api/accounts").json() == before
    assert api.get(f"/api/accounts/{aid}").status_code == 200


def test_exports_whitelist_exact_values_and_formula_defense(api, db_engine):
    aid = account(api)
    assert (
        api.put(
            f"/api/accounts/{aid}",
            json={"name": "=Fictional formula", "type": "INVESTMENT", "active": True},
        ).status_code
        == 200
    )
    with Session(db_engine) as db, db.begin():
        db.add(
            FXObservation(
                base_currency="EUR",
                quote_currency="BRL",
                rate_date=date(2026, 9, 30),
                rate=Decimal("6.123456789012345678"),
                provider="ECB",
                fetched_at=datetime.now(UTC),
            )
        )
    exported = api.get("/api/settings/exports/fx").json()
    assert exported["records"][0]["rate"] == "6.123456789012345678"
    assert api.get("/api/settings/fx").json()["items"][0]["rate"] == "6.123456789012345678"
    raw = api.get("/api/settings/exports/accounts?format=csv")
    assert raw.headers["cache-control"] == "no-store"
    assert list(csv.DictReader(io.StringIO(raw.text)))[0]["name"] == "'=Fictional formula"
    assert (
        api.get("/api/settings/exports/accounts").json()["records"][0]["name"]
        == "=Fictional formula"
    )
    for private in ["gmail_connections", "source_records", "pluggy_items", "../credentials"]:
        assert api.get(f"/api/settings/exports/{private}").status_code == 404
    assert "credentials" not in api.get("/api/settings/exports").text


def test_reporting_currency_changes_projection_only(api):
    account(api)
    before = api.get("/api/accounts").json()
    assert (
        api.put(
            "/api/market-data/settings",
            json={"automatic": False, "reporting_currency": "EUR", "fx_provider": "ECB"},
        ).status_code
        == 200
    )
    assert api.get("/api/settings/preferences").json() == {"reporting_currency": "EUR"}
    projection = api.get(
        "/api/investments/analytics/dashboard?start=2026-01-01&end=2026-02-28"
    ).json()
    assert projection["performance"]["currency"] == "EUR"
    assert api.get("/api/accounts").json() == before


def test_about_contains_real_version_and_no_local_paths_or_secrets(api):
    from app._version import __version__

    info = api.get("/api/settings/about").json()
    assert info["version"] == __version__
    assert info["database"] == "SQLite"
    assert all(key not in info for key in ["database_path", "api_key", "credentials"])


def test_all_export_datasets_have_valid_reviewed_columns(api):
    account(api)
    for dataset in api.get("/api/settings/exports").json()["datasets"]:
        response = api.get(f"/api/settings/exports/{dataset}?as_of=2026-09-30")
        assert response.status_code == 200, (dataset, response.text)
        assert isinstance(response.json()["records"], list)


def test_additive_migration_retains_populated_ledger(api, db_engine):
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = db_engine.url
    command.downgrade(config, "sqlite_0020")
    aid = account(api)
    before = api.get("/api/accounts").json()
    command.upgrade(config, "head")
    command.check(config)
    assert api.get("/api/accounts").json() == before
    assert (
        api.post(
            "/api/settings/account-groups",
            json={"name": "Fictional upgraded", "account_ids": [aid]},
        ).status_code
        == 201
    )
