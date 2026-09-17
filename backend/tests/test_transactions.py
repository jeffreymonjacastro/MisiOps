from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select

from models.transaction import Transaction

pytestmark = pytest.mark.anyio

TX = "/api/v1/transactions"
CAT = "/api/v1/category/"
TX_NOT_FOUND = {"detail": "Transaction not found"}
CAT_NOT_FOUND = {"detail": "Category not found"}
MISMATCH = {"detail": "Transaction type does not match category type"}


async def _cat_id(client, h, name):
    return next(c["id"] for c in (await client.get(CAT, headers=h)).json() if c["name"] == name)


async def _create(client, h, **body):
    payload = {"amount": 25.5, "type": "expense", **body}
    if "category_id" not in payload:
        payload["category_id"] = await _cat_id(client, h, "Comida")
    return await client.post(TX, headers=h, json=payload)


async def _income(client, h, amount, **body):
    return await _create(
        client,
        h,
        amount=amount,
        type="income",
        category_id=await _cat_id(client, h, "Sueldo"),
        **body,
    )


# --- US1: create -------------------------------------------------------------


async def test_create_ok(client, auth_headers):
    h = await auth_headers()
    r = await _create(client, h)
    assert r.status_code == 201
    body = r.json()
    assert isinstance(body["id"], int)
    assert body["amount"] == 25.5
    assert body["type"] == "expense"
    assert body["source"] == "manual"
    assert body["description"] is None
    assert body["transaction_date"][:10] == datetime.now(UTC).date().isoformat()
    assert body["category"] == {
        "id": await _cat_id(client, h, "Comida"),
        "name": "Comida",
        "type": "expense",
    }
    assert set(body) == {
        "id",
        "amount",
        "type",
        "source",
        "description",
        "transaction_date",
        "category",
    }


async def test_create_with_date_only(client, auth_headers):
    r = await _create(client, await auth_headers(), transaction_date="2026-01-15")
    assert r.status_code == 201
    assert r.json()["transaction_date"].startswith("2026-01-15T00:00:00")


async def test_create_with_aware_datetime_converted_to_utc(client, auth_headers):
    r = await _create(client, await auth_headers(), transaction_date="2026-01-15T10:00:00-05:00")
    assert r.status_code == 201
    assert r.json()["transaction_date"].startswith("2026-01-15T15:00:00")


async def test_create_type_mismatch_422(client, auth_headers):
    h = await auth_headers()
    r = await _create(client, h, type="income")  # Comida is an expense category
    assert r.status_code == 422
    assert r.json() == MISMATCH


@pytest.mark.parametrize(
    "field,value",
    [
        ("amount", 0),
        ("amount", -1),
        ("amount", 1_000_000_001),
        ("amount", 1.005),
        ("description", "x" * 256),
        ("transaction_date", (datetime.now(UTC) + timedelta(days=1)).date().isoformat()),
        ("category_id", 0),
    ],
)
async def test_create_validation(client, auth_headers, field, value):
    r = await _create(client, await auth_headers(), **{field: value})
    assert r.status_code == 422
    assert any(field in err["loc"] for err in r.json()["detail"])


async def test_create_category_not_owned_404(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    other = await _cat_id(client, h2, "Comida")
    assert (await _create(client, h1, category_id=other)).json() == CAT_NOT_FOUND
    r = await _create(client, h1, category_id=99999)
    assert r.status_code == 404
    assert r.json() == CAT_NOT_FOUND


async def test_create_empty_description_is_null(client, auth_headers):
    r = await _create(client, await auth_headers(), description="   ")
    assert r.status_code == 201
    assert r.json()["description"] is None


# --- US2: list ---------------------------------------------------------------


async def _seed(client, h, n):
    for i in range(1, n + 1):
        assert (
            await _create(client, h, amount=i, transaction_date=f"2026-01-{i:02d}")
        ).status_code == 201


async def test_list_pagination(client, auth_headers):
    h = await auth_headers()
    await _seed(client, h, 12)
    r = await client.get(TX, headers=h, params={"limit": 5})
    assert r.status_code == 200
    page = r.json()
    assert len(page["items"]) == 5
    assert page["total"] == 12
    assert page["limit"] == 5
    assert page["offset"] == 0
    assert page["items"][0]["transaction_date"].startswith("2026-01-12")
    r = await client.get(TX, headers=h, params={"limit": 5, "offset": 10})
    assert len(r.json()["items"]) == 2
    assert r.json()["total"] == 12


async def test_list_default_limit_20(client, auth_headers):
    h = await auth_headers()
    await _seed(client, h, 25)
    page = (await client.get(TX, headers=h)).json()
    assert len(page["items"]) == 20
    assert page["limit"] == 20
    assert page["total"] == 25


async def test_list_filters_and(client, auth_headers):
    h = await auth_headers()
    comida = await _cat_id(client, h, "Comida")
    transporte = await _cat_id(client, h, "Transporte")
    await _create(client, h, category_id=comida)
    await _create(client, h, category_id=transporte)
    await _income(client, h, 100)
    page = (
        await client.get(TX, headers=h, params={"type": "expense", "category_id": comida})
    ).json()
    assert page["total"] == 1
    assert page["items"][0]["category"]["id"] == comida
    assert (await client.get(TX, headers=h, params={"type": "income"})).json()["total"] == 1


async def test_list_filter_type_invalid_422(client, auth_headers):
    assert (
        await client.get(TX, headers=await auth_headers(), params={"type": "other"})
    ).status_code == 422


async def test_list_foreign_category_filter_empty(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    await _create(client, h2)
    page = (
        await client.get(
            TX, headers=h1, params={"category_id": await _cat_id(client, h2, "Comida")}
        )
    ).json()
    assert page == {"items": [], "total": 0, "limit": 20, "offset": 0}


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
async def test_list_limit_offset_validation(client, auth_headers, params):
    assert (await client.get(TX, headers=await auth_headers(), params=params)).status_code == 422


async def test_list_isolation_and_user_id_ignored(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    await _create(client, h1, amount=1)
    await _create(client, h2, amount=2)
    page = (await client.get(TX, headers=h1, params={"user_id": 2})).json()
    assert page["total"] == 1
    assert page["items"][0]["amount"] == 1


async def test_list_unauthenticated(client):
    assert (await client.get(TX)).status_code == 401


# --- US3: summary ------------------------------------------------------------

SUMMARY = f"{TX}/summary"


async def test_summary_default_period(client, auth_headers):
    h = await auth_headers()
    await _income(client, h, 1000)
    await _income(client, h, 500)
    await _create(client, h, amount=300)
    s = (await client.get(SUMMARY, headers=h)).json()
    assert s["total_income"] == 1500
    assert s["total_expense"] == 300
    assert s["balance"] == 1200
    assert s["monthly_budget_limit"] == 0
    assert s["remaining_budget"] is None
    assert [r["type"] for r in s["by_category"]] == ["expense", "income"]
    assert s["by_category"][0] == {
        "category_id": await _cat_id(client, h, "Comida"),
        "name": "Comida",
        "type": "expense",
        "budget": None,
        "total": 300,
    }
    assert s["by_category"][1]["total"] == 1500
    assert "budget" in s["by_category"][1]


async def test_summary_period_from_budget_start_day(client, auth_headers, monkeypatch):
    h = await auth_headers()
    await client.patch("/api/v1/user/", headers=h, json={"budget_start_day": 15})
    monkeypatch.setattr("api.v1.transactions._today", lambda: date(2026, 9, 20))
    s = (await client.get(SUMMARY, headers=h)).json()
    assert (s["period_start"], s["period_end"]) == ("2026-09-15", "2026-10-14")
    monkeypatch.setattr("api.v1.transactions._today", lambda: date(2026, 9, 10))
    s = (await client.get(SUMMARY, headers=h)).json()
    assert (s["period_start"], s["period_end"]) == ("2026-08-15", "2026-09-14")


async def test_summary_remaining_budget(client, auth_headers):
    h = await auth_headers()
    await _create(client, h, amount=300)
    await client.patch("/api/v1/user/", headers=h, json={"monthly_budget_limit": 2000})
    s = (await client.get(SUMMARY, headers=h)).json()
    assert s["monthly_budget_limit"] == 2000
    assert s["remaining_budget"] == 1700


async def test_summary_explicit_range(client, auth_headers):
    h = await auth_headers()
    await _create(client, h, amount=10, transaction_date="2026-01-10")
    await _create(client, h, amount=20, transaction_date="2026-02-10")
    s = (
        await client.get(SUMMARY, headers=h, params={"from": "2026-01-01", "to": "2026-01-31"})
    ).json()
    assert s["total_expense"] == 10
    assert (s["period_start"], s["period_end"]) == ("2026-01-01", "2026-01-31")


async def test_summary_range_validation(client, auth_headers):
    h = await auth_headers()
    r = await client.get(SUMMARY, headers=h, params={"from": "2026-02-01", "to": "2026-01-01"})
    assert r.status_code == 422
    assert r.json() == {"detail": "from must not be after to"}
    r = await client.get(SUMMARY, headers=h, params={"from": "2026-01-01"})
    assert r.status_code == 422
    assert r.json() == {"detail": "from and to must be given together"}


async def test_summary_empty(client, auth_headers):
    s = (await client.get(SUMMARY, headers=await auth_headers())).json()
    assert (s["total_income"], s["total_expense"], s["balance"]) == (0, 0, 0)
    assert s["by_category"] == []


async def test_summary_exact_cents(client, auth_headers):
    h = await auth_headers()
    await _create(client, h, amount=0.1)
    await _create(client, h, amount=0.2)
    assert (await client.get(SUMMARY, headers=h)).json()["total_expense"] == 0.3


async def test_summary_boundaries(client, auth_headers):
    h = await auth_headers()
    await _create(client, h, amount=1, transaction_date="2026-01-01T00:00:00Z")
    await _create(client, h, amount=2, transaction_date="2026-01-31T23:59:59Z")
    await _create(client, h, amount=4, transaction_date="2026-02-01T00:00:00Z")
    s = (
        await client.get(SUMMARY, headers=h, params={"from": "2026-01-01", "to": "2026-01-31"})
    ).json()
    assert s["total_expense"] == 3


async def test_summary_isolation(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    await _create(client, h2, amount=999)
    assert (await client.get(SUMMARY, headers=h1)).json()["total_expense"] == 0


# --- US4: update -------------------------------------------------------------


async def test_patch_amount_only(client, auth_headers):
    h = await auth_headers()
    before = (await _create(client, h, description="Almuerzo")).json()
    r = await client.patch(f"{TX}/{before['id']}", headers=h, json={"amount": 30})
    assert r.status_code == 200
    assert r.json() == {**before, "amount": 30}


async def test_patch_category_mismatch_422(client, auth_headers):
    h = await auth_headers()
    tx = (await _create(client, h)).json()
    r = await client.patch(
        f"{TX}/{tx['id']}", headers=h, json={"category_id": await _cat_id(client, h, "Sueldo")}
    )
    assert r.status_code == 422
    assert r.json() == MISMATCH


async def test_patch_type_and_category_together_200(client, auth_headers):
    h = await auth_headers()
    tx = (await _create(client, h)).json()
    sueldo = await _cat_id(client, h, "Sueldo")
    r = await client.patch(
        f"{TX}/{tx['id']}", headers=h, json={"type": "income", "category_id": sueldo}
    )
    assert r.status_code == 200
    assert r.json()["type"] == "income"
    assert r.json()["category"]["name"] == "Sueldo"


async def test_patch_category_not_owned_404(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    tx = (await _create(client, h1)).json()
    r = await client.patch(
        f"{TX}/{tx['id']}", headers=h1, json={"category_id": await _cat_id(client, h2, "Comida")}
    )
    assert r.status_code == 404
    assert r.json() == CAT_NOT_FOUND


async def test_patch_empty_body_unchanged(client, auth_headers):
    h = await auth_headers()
    before = (await _create(client, h)).json()
    r = await client.patch(f"{TX}/{before['id']}", headers=h, json={})
    assert r.status_code == 200
    assert r.json() == before


async def test_patch_other_users_404(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    tx = (await _create(client, h1)).json()
    r = await client.patch(f"{TX}/{tx['id']}", headers=h2, json={"amount": 1})
    assert r.status_code == 404
    assert r.json() == TX_NOT_FOUND


async def test_patch_unknown_404(client, auth_headers):
    r = await client.patch(f"{TX}/99999", headers=await auth_headers(), json={"amount": 1})
    assert r.status_code == 404
    assert r.json() == TX_NOT_FOUND


async def test_patch_id_zero_422(client, auth_headers):
    assert (
        await client.patch(f"{TX}/0", headers=await auth_headers(), json={"amount": 1})
    ).status_code == 422


async def test_patch_future_date_422(client, auth_headers):
    h = await auth_headers()
    tx = (await _create(client, h)).json()
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).date().isoformat()
    assert (
        await client.patch(f"{TX}/{tx['id']}", headers=h, json={"transaction_date": tomorrow})
    ).status_code == 422


# --- US5: delete -------------------------------------------------------------


async def test_delete_ok(client, auth_headers):
    h = await auth_headers()
    tx = (await _create(client, h, amount=50)).json()
    r = await client.delete(f"{TX}/{tx['id']}", headers=h)
    assert r.status_code == 204
    assert r.content == b""
    assert (await client.get(TX, headers=h)).json()["total"] == 0
    assert (await client.get(SUMMARY, headers=h)).json()["total_expense"] == 0


async def test_delete_other_users_404(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    tx = (await _create(client, h1)).json()
    assert (await client.delete(f"{TX}/{tx['id']}", headers=h2)).status_code == 404


async def test_delete_unknown_404(client, auth_headers):
    r = await client.delete(f"{TX}/99999", headers=await auth_headers())
    assert r.status_code == 404
    assert r.json() == TX_NOT_FOUND


async def test_delete_unauthenticated(client):
    assert (await client.delete(f"{TX}/1")).status_code == 401


async def test_user_delete_cascades_transactions(client, auth_headers, db_session):
    h = await auth_headers()
    await _create(client, h)
    assert (await client.delete("/api/v1/user/", headers=h)).status_code == 204
    count = (await db_session.execute(select(func.count()).select_from(Transaction))).scalar_one()
    assert count == 0
