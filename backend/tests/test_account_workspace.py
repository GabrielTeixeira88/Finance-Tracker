from test_investments import account, asset, payload, post


def test_native_account_cash_and_holdings_reconcile_without_double_count(api):
    aid, sid = account(api), asset(api)
    post(api, payload(aid, sid))
    response = api.post(
        f"/api/investments/assets/{sid}/prices",
        json={"price_date": "2026-02-02", "price": "120", "currency": "BRL"},
    )
    assert response.status_code == 201
    before = api.get("/api/accounts").json()
    response = api.get(
        f"/api/accounts/{aid}/workspace", params={"start": "2026-02-01", "end": "2026-02-02"}
    )
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["cash"] == "9000.000000"
    assert report["value"] == "10200.000000"
    assert report["summary"]["cost_basis"] == "1000.000000"
    assert report["history"]["points"][0]["value"] is None
    assert api.get("/api/accounts").json() == before


def test_cash_account_history_keeps_events_and_validates_scope(api):
    response = api.post(
        "/api/accounts",
        json={
            "name": "Fictional cash",
            "type": "CASH",
            "currency": "BRL",
            "opening_balance": "1234.567891",
            "opening_date": "2026-02-01",
        },
    )
    aid = response.json()["id"]
    report = api.get(
        f"/api/accounts/{aid}/workspace", params={"start": "2026-01-31", "end": "2026-02-02"}
    ).json()
    assert report["cash"] == report["value"] == "1234.567891"
    assert [point["value"] for point in report["history"]["points"]] == [
        "0.000000",
        "1234.567891",
        "1234.567891",
    ]
    assert report["summary"] is None
    assert (
        api.get(
            f"/api/accounts/{aid}/workspace", params={"start": "2026-02-03", "end": "2026-02-01"}
        ).status_code
        == 422
    )
