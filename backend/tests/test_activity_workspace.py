from test_investments import account, asset, payload, post


def page(api, **params):
    response = api.get("/api/investments/workspace/activities", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_combined_activity_filters_and_stable_pagination(api):
    aid, sid = account(api), asset(api)
    first = post(api, payload(aid, sid, notes="Fictional education purchase"))
    second = post(api, payload(aid, sid, notes="Fictional education purchase"))
    post(api, payload(aid, sid, activity_date="2026-02-03", notes="Other purpose"))
    filters = dict(
        account_id=aid,
        asset_id=sid,
        query="education",
        activity_type="BUY",
        start="2026-02-01",
        end="2026-02-02",
        status="active",
        limit=1,
    )
    before = api.get("/api/accounts").json()
    report = page(api, **filters)
    assert report["total"] == 2
    assert report["rows"][0]["id"] == second["id"]
    assert page(api, **filters, offset=1)["rows"][0]["id"] == first["id"]
    assert page(api, **{**filters, "descending": False})["rows"][0]["id"] == first["id"]
    assert api.get("/api/accounts").json() == before


def test_literal_search_void_status_and_invalid_ranges(api):
    aid, sid = account(api), asset(api)
    row = post(api, payload(aid, sid, notes="Fictional 100% example"))
    post(api, payload(aid, sid, notes="Different example"))
    assert page(api, query="%")["total"] == 1
    assert api.post(f"/api/investments/activities/{row['id']}/void").status_code == 200
    assert page(api, status="voided")["total"] == 1
    assert page(api, status="active")["total"] == 1
    assert (
        api.get("/api/investments/workspace/activities?start=2026-03-01&end=2026-02-01").status_code
        == 422
    )
    assert api.get("/api/investments/workspace/activities?activity_type=SPLIT").status_code == 422
