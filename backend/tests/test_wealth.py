from decimal import Decimal


def post(api, path, data):
    response = api.post("/api" + path, json=data)
    assert response.status_code == 201, response.text
    return response.json()


def account(api, name="Savings", amount="20000", kind="SAVINGS", currency="BRL"):
    return post(
        api,
        "/accounts",
        dict(
            name=name,
            type=kind,
            currency=currency,
            opening_balance=amount,
            opening_date="2025-01-01",
        ),
    )


def position(api, name="Property", kind="ASSET", **extra):
    return post(
        api,
        "/manual-positions",
        dict(
            name=name,
            kind=kind,
            category="REAL_ESTATE" if kind == "ASSET" else "MORTGAGE",
            currency="BRL",
            start_date="2025-01-01",
            **extra,
        ),
    )


def observe(api, p, amount, day="2025-01-01"):
    return post(
        api, f"/manual-positions/{p['id']}/observations", dict(amount=amount, effective_date=day)
    )


def summary(api, day="2025-02-01"):
    r = api.get("/api/net-worth/summary", params={"as_of": day})
    assert r.status_code == 200, r.text
    return r.json()


def goal(api, name="Emergency", mode="ACCOUNT", **extra):
    return post(
        api,
        "/goals",
        dict(
            name=name, mode=mode, currency="BRL", target="15000", start_date="2025-01-01", **extra
        ),
    )


def allocate(api, g, a, amount):
    return post(
        api,
        f"/goals/{g['id']}/entries",
        dict(account_id=a["id"], amount=amount, effective_date="2025-01-01"),
    )


def test_property_mortgage_history_and_no_ledger_postings(api):
    p = position(api)
    d = position(api, "Mortgage", "LIABILITY", associated_asset_id=p["id"])
    observe(api, p, "500000")
    observe(api, d, "300000")
    assert Decimal(summary(api)["value"]) == 200000
    observe(api, p, "510000", "2025-03-01")
    observe(api, d, "290000", "2025-03-01")
    assert Decimal(summary(api)["value"]) == 200000
    assert Decimal(summary(api, "2025-03-01")["value"]) == 220000
    assert api.get("/api/accounts").json() == []


def test_shared_goals_not_assets_and_overallocation_atomic(api):
    a = account(api)
    g, h = goal(api), goal(api, "Travel")
    allocate(api, g, a, "12000")
    allocate(api, h, a, "5000")
    assert Decimal(summary(api)["value"]) == 20000
    bad = api.post(
        f"/api/goals/{h['id']}/entries",
        json=dict(account_id=a["id"], amount="9000", effective_date="2025-02-01"),
    )
    assert bad.status_code == 409
    r = api.get(f"/api/goals/{h['id']}").json()
    assert Decimal(r["saved"]) == 5000
    assert len(r["entries"]) == 1


def test_missing_values_and_fx_not_zero(api):
    p = position(api)
    assert summary(api)["value"] is None
    observe(api, p, "10", "2025-03-01")
    assert summary(api)["value"] is None
    assert Decimal(summary(api, "2025-03-01")["value"]) == 10
    account(api, "Foreign", "100", currency="USD")
    assert summary(api, "2025-03-01")["value"] is None


def test_void_disposal_and_payoff_are_historical(api):
    p = position(api)
    observe(api, p, "500")
    o = observe(api, p, "600", "2025-02-01")
    assert (
        api.post(
            f"/api/manual-observations/{o['id']}/void", json={"reason": "Synthetic correction"}
        ).status_code
        == 200
    )
    assert Decimal(summary(api)["value"]) == 500
    assert (
        api.post(
            f"/api/manual-positions/{p['id']}/close",
            json={"end_date": "2025-03-01", "disposal_proceeds": "450"},
        ).status_code
        == 200
    )
    assert Decimal(summary(api)["value"]) == 500
    assert Decimal(summary(api, "2025-03-01")["value"]) == 0


def test_manual_progress_adjustments_projection(api):
    g = goal(api, mode="MANUAL", deadline="2026-12-31")
    for amount, direction in [("1000", "IN"), ("200", "OUT")]:
        post(
            api,
            f"/goals/{g['id']}/entries",
            dict(amount=amount, direction=direction, effective_date="2025-01-01"),
        )
    r = api.get(f"/api/goals/{g['id']}", params={"as_of": "2026-10-01", "monthly": "5000"}).json()
    assert Decimal(r["saved"]) == 800
    assert Decimal(r["required_monthly"]) == Decimal("4733.34")
    assert r["projected_completion"] == "2026-12-31"
    upcoming = goal(api, "Upcoming", mode="MANUAL", deadline="2026-10-31")
    near = api.get(f"/api/goals/{upcoming['id']}?as_of=2026-10-01").json()
    assert near["near_deadline"]
    assert Decimal(summary(api)["value"]) == 0
    bad = api.post(
        f"/api/goals/{g['id']}/entries",
        json=dict(amount="900", direction="OUT", effective_date="2025-02-01"),
    )
    assert bad.status_code == 409


def test_reject_duplicate_account_and_negative_observations(api):
    account(api)
    assert (
        api.post(
            "/api/manual-positions",
            json=dict(
                name=" savings ",
                kind="ASSET",
                category="OTHER",
                currency="BRL",
                start_date="2025-01-01",
            ),
        ).status_code
        == 409
    )
    p = position(api)
    for amount in ["-1", 1.1, "NaN"]:
        assert (
            api.post(
                f"/api/manual-positions/{p['id']}/observations",
                json=dict(amount=amount, effective_date="2025-01-01"),
            ).status_code
            == 422
        )
