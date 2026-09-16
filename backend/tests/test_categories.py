import pytest
from sqlalchemy import func, select

from models.category import Category

pytestmark = pytest.mark.anyio

CAT = "/api/v1/category/"
EXPENSE = ["Comida", "Compras", "Entretenimiento", "Otros", "Salud", "Transporte", "Vivienda"]
INCOME = ["Otros", "Sueldo"]
NOT_FOUND = {"detail": "Category not found"}
NAME_TAKEN = {"detail": "Category name already exists"}


async def _create(client, headers, **body):
    return await client.post(
        CAT, headers=headers, json={"name": "Gimnasio", "type": "expense", **body}
    )


# --- US1: list ---------------------------------------------------------------


async def test_new_user_gets_spanish_defaults(client, auth_headers):
    r = await client.get(CAT, headers=await auth_headers())
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 9
    assert [c["type"] for c in items] == ["expense"] * 7 + ["income"] * 2
    assert [c["name"] for c in items if c["type"] == "expense"] == EXPENSE
    assert [c["name"] for c in items if c["type"] == "income"] == INCOME
    assert all(set(c) == {"id", "name", "type", "budget"} for c in items)
    assert all(c["budget"] is None for c in items)


async def test_list_is_per_user(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    await _create(client, h1)
    names2 = [c["name"] for c in (await client.get(CAT, headers=h2)).json()]
    assert "Gimnasio" not in names2
    assert len(names2) == 9


async def test_list_unauthenticated(client):
    assert (await client.get(CAT)).status_code == 401


# --- US2: create -------------------------------------------------------------


async def test_create_ok(client, auth_headers):
    h = await auth_headers()
    r = await _create(client, h, budget=150)
    assert r.status_code == 201
    body = r.json()
    assert isinstance(body["id"], int)
    assert body["name"] == "Gimnasio"
    assert body["type"] == "expense"
    assert body["budget"] == 150
    assert "Gimnasio" in [c["name"] for c in (await client.get(CAT, headers=h)).json()]


async def test_create_without_budget_is_null(client, auth_headers):
    r = await _create(client, await auth_headers())
    assert r.status_code == 201
    assert r.json()["budget"] is None


async def test_create_duplicate_name_case_insensitive(client, auth_headers):
    h = await auth_headers()
    assert (await _create(client, h)).status_code == 201
    r = await _create(client, h, name="gimnasio")
    assert r.status_code == 409
    assert r.json() == NAME_TAKEN


async def test_create_same_name_other_user_ok(client, auth_headers):
    assert (await _create(client, await auth_headers())).status_code == 201
    assert (await _create(client, await auth_headers(email="bob@example.com"))).status_code == 201


async def test_create_same_name_other_type_ok(client, auth_headers):
    h = await auth_headers()
    # "Otros" already exists for both types by default; a name may repeat across types
    r = await _create(client, h, name="Sueldo", type="expense")
    assert r.status_code == 201
    r = await _create(client, h, name="Sueldo", type="income")
    assert r.status_code == 409


@pytest.mark.parametrize(
    "field,value",
    [("name", ""), ("name", "x" * 51), ("type", "other"), ("budget", -1), ("budget", 1.005)],
)
async def test_create_validation(client, auth_headers, field, value):
    r = await _create(client, await auth_headers(), **{field: value})
    assert r.status_code == 422
    assert any(field in err["loc"] for err in r.json()["detail"])


async def test_create_trims_name(client, auth_headers):
    r = await _create(client, await auth_headers(), name="  Gym  ")
    assert r.status_code == 201
    assert r.json()["name"] == "Gym"


# --- US3: update -------------------------------------------------------------


async def _created_id(client, headers, **body):
    return (await _create(client, headers, **body)).json()["id"]


async def test_patch_budget_only(client, auth_headers):
    h = await auth_headers()
    cid = await _created_id(client, h, budget=100)
    r = await client.patch(f"{CAT}{cid}", headers=h, json={"budget": 250})
    assert r.status_code == 200
    assert r.json() == {"id": cid, "name": "Gimnasio", "type": "expense", "budget": 250}


async def test_patch_budget_null_clears(client, auth_headers):
    h = await auth_headers()
    cid = await _created_id(client, h, budget=100)
    r = await client.patch(f"{CAT}{cid}", headers=h, json={"budget": None})
    assert r.status_code == 200
    assert r.json()["budget"] is None


async def test_patch_empty_body_unchanged(client, auth_headers):
    h = await auth_headers()
    before = (await _create(client, h, budget=100)).json()
    r = await client.patch(f"{CAT}{before['id']}", headers=h, json={})
    assert r.status_code == 200
    assert r.json() == before


async def test_patch_rename_duplicate(client, auth_headers):
    h = await auth_headers()
    cid = await _created_id(client, h)
    r = await client.patch(f"{CAT}{cid}", headers=h, json={"name": "comida"})
    assert r.status_code == 409
    assert r.json() == NAME_TAKEN


async def test_patch_type_change_allowed_without_transactions(client, auth_headers):
    h = await auth_headers()
    cid = await _created_id(client, h)
    r = await client.patch(f"{CAT}{cid}", headers=h, json={"type": "income"})
    assert r.status_code == 200
    assert r.json()["type"] == "income"


async def test_patch_other_users_category_404(client, auth_headers):
    cid = await _created_id(client, await auth_headers())
    h2 = await auth_headers(email="bob@example.com")
    r = await client.patch(f"{CAT}{cid}", headers=h2, json={"name": "Robo"})
    assert r.status_code == 404
    assert r.json() == NOT_FOUND


async def test_patch_unknown_id_404(client, auth_headers):
    r = await client.patch(f"{CAT}99999", headers=await auth_headers(), json={"name": "X"})
    assert r.status_code == 404
    assert r.json() == NOT_FOUND


async def test_patch_id_zero_422(client, auth_headers):
    r = await client.patch(f"{CAT}0", headers=await auth_headers(), json={"name": "X"})
    assert r.status_code == 422


async def test_patch_default_category_allowed(client, auth_headers):
    h = await auth_headers()
    comida = next(c for c in (await client.get(CAT, headers=h)).json() if c["name"] == "Comida")
    r = await client.patch(f"{CAT}{comida['id']}", headers=h, json={"name": "Alimentos"})
    assert r.status_code == 200
    assert r.json()["name"] == "Alimentos"


# --- US4: delete -------------------------------------------------------------


async def test_delete_ok(client, auth_headers):
    h = await auth_headers()
    cid = await _created_id(client, h)
    r = await client.delete(f"{CAT}{cid}", headers=h)
    assert r.status_code == 204
    assert r.content == b""
    assert cid not in [c["id"] for c in (await client.get(CAT, headers=h)).json()]


async def test_delete_other_users_category_404(client, auth_headers):
    cid = await _created_id(client, await auth_headers())
    r = await client.delete(f"{CAT}{cid}", headers=await auth_headers(email="bob@example.com"))
    assert r.status_code == 404


async def test_delete_unknown_404(client, auth_headers):
    r = await client.delete(f"{CAT}99999", headers=await auth_headers())
    assert r.status_code == 404
    assert r.json() == NOT_FOUND


async def test_delete_default_category_allowed(client, auth_headers):
    h = await auth_headers()
    comida = next(c for c in (await client.get(CAT, headers=h)).json() if c["name"] == "Comida")
    assert (await client.delete(f"{CAT}{comida['id']}", headers=h)).status_code == 204


async def test_delete_all_then_list_empty_array(client, auth_headers):
    h = await auth_headers()
    for c in (await client.get(CAT, headers=h)).json():
        assert (await client.delete(f"{CAT}{c['id']}", headers=h)).status_code == 204
    assert (await client.get(CAT, headers=h)).json() == []


async def test_user_delete_cascades_categories(client, auth_headers, db_session):
    h = await auth_headers()
    assert (await client.delete("/api/v1/user/", headers=h)).status_code == 204
    count = (await db_session.execute(select(func.count()).select_from(Category))).scalar_one()
    assert count == 0


# --- FR-015 (transactions feature): guards ----------------------------------

TX = "/api/v1/transactions"


async def _add_tx(client, h, category_id, amount=10):
    r = await client.post(
        TX, headers=h, json={"amount": amount, "type": "expense", "category_id": category_id}
    )
    assert r.status_code == 201
    return r.json()["id"]


async def test_patch_type_change_blocked_with_transactions(client, auth_headers):
    h = await auth_headers()
    cid = await _created_id(client, h)
    await _add_tx(client, h, cid)
    r = await client.patch(f"{CAT}{cid}", headers=h, json={"type": "income"})
    assert r.status_code == 409
    assert r.json() == {"detail": "Category has 1 transactions"}
    assert (
        await client.patch(f"{CAT}{cid}", headers=h, json={"name": "Deporte"})
    ).status_code == 200


async def test_delete_blocked_with_transactions(client, auth_headers):
    h = await auth_headers()
    cid = await _created_id(client, h)
    t1 = await _add_tx(client, h, cid)
    t2 = await _add_tx(client, h, cid)
    r = await client.delete(f"{CAT}{cid}", headers=h)
    assert r.status_code == 409
    assert r.json() == {"detail": "Category has 2 transactions"}
    for t in (t1, t2):
        assert (await client.delete(f"{TX}/{t}", headers=h)).status_code == 204
    assert (await client.delete(f"{CAT}{cid}", headers=h)).status_code == 204
