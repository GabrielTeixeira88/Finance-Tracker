from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_holdings_workspace import mark
from test_investments import account, asset, payload, post

from app.allocation_models import AllocationTarget, AllocationTargetWeight
from app.allocation_targets import effective_band

PATH = "/api/investments/allocation-targets"


def data(**changes):
    return {
        "name": "Fictional balanced plan",
        "dimension": "asset_class",
        "currency": "BRL",
        "scope": "all",
        "weights": [dict(category="ETF", target_bps=6000), dict(category="CASH", target_bps=4000)],
        **changes,
    }


def create(api, **changes):
    response = api.post(PATH, json=data(**changes))
    assert response.status_code == 201, response.text
    return response.json()["target"]


def test_exact_drift_uses_authoritative_cash_inclusive_portfolio_and_never_posts(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid))
    mark(api, sid, "2026-02-03", "150")
    before = api.get("/api/accounts").json()
    target = create(api)
    response = api.get(f"{PATH}/{target['id']}/drift?as_of=2026-02-03")
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["total_value"] == "10500.000000"
    rows = {r["category"]: r for r in report["rows"]}
    assert rows["ETF"]["current_value"] == "1500.000000"
    assert rows["ETF"]["target_value"] == "6300.000000"
    assert rows["ETF"]["value_delta"] == "-4800.000000"
    assert rows["CASH"]["value_delta"] == "4800.000000"
    assert report["out_of_band_count"] == 2
    assert abs(
        Decimal(rows["ETF"]["current_bps"]) + Decimal(rows["CASH"]["current_bps"]) - 10000
    ) < Decimal(".000002")
    assert api.get("/api/accounts").json() == before


def test_save_revisions_and_delete_retain_rows_with_optimistic_conflict_guards(api, db_engine):
    account(api)
    target = create(api)
    changed = data(expected_version=1, band_type="hybrid", relative_factor_bps=2000)
    response = api.put(f"{PATH}/{target['id']}", json=changed)
    assert response.status_code == 200, response.text
    assert response.json()["target"]["version"] == 2
    assert api.put(f"{PATH}/{target['id']}", json=changed).status_code == 409
    assert api.delete(f"{PATH}/{target['id']}?expected_version=1").status_code == 409
    assert api.delete(f"{PATH}/{target['id']}?expected_version=2").status_code == 200
    assert api.get(PATH).json() == []
    with Session(db_engine) as db:
        assert db.get(AllocationTarget, UUID(target["id"])).active is False
        assert len(list(db.scalars(select(AllocationTargetWeight)))) == 4


def test_invalid_totals_scopes_duplicates_and_float_basis_points_leave_no_configuration(api):
    for changes in [
        dict(weights=[dict(category="ETF", target_bps=9999)]),
        dict(account_ids=[str(uuid4())]),
        dict(scope="accounts"),
        dict(
            weights=[dict(category="ETF", target_bps=5000), dict(category="ETF", target_bps=5000)]
        ),
        dict(weights=[dict(category="ETF", target_bps=10000.5)]),
    ]:
        response = api.post(PATH, json={**data(), **changes})
        assert response.status_code in (404, 422), response.text
    assert api.get(PATH).json() == []


def test_scope_and_missing_or_empty_coverage_never_become_zero_weights(api):
    aid, sid = account(api), asset(api)
    other = account(api, name="Other fictional brokerage")
    post(api, payload(aid, sid))
    target = create(api, scope="accounts", account_ids=[aid])
    report = api.get(f"{PATH}/{target['id']}/drift?as_of=2026-02-03").json()
    assert report["quality"] == "UNAVAILABLE"
    assert report["total_value"] is None
    assert report["out_of_band_count"] is None
    assert all(r["current_bps"] is None and r["drift_bps"] is None for r in report["rows"])
    only_cash = create(api, name="Cash scope", scope="accounts", account_ids=[other])
    report = api.get(f"{PATH}/{only_cash['id']}/drift?as_of=2026-02-03").json()
    assert report["total_value"] == "10000.000000"
    assert (
        next(r for r in report["rows"] if r["category"] == "CASH")["current_bps"] == "10000.000000"
    )


def test_target_account_foreign_keys_are_enforced(db_engine):
    with Session(db_engine) as db, pytest.raises(IntegrityError):
        db.add(
            AllocationTargetWeight(
                target_id=uuid4(), version=1, category="ETF", target_bps=10000, required=True
            )
        )
        db.commit()


def test_source_absolute_and_hybrid_tolerance_boundaries():
    assert effective_band(5000, 500, 2000, "absolute") == 500
    assert effective_band(5000, 500, 2000, "hybrid") == 1000
    assert effective_band(100, 500, 2000, "hybrid") == 500
