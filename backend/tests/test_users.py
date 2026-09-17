import pytest

pytestmark = pytest.mark.anyio

LOGIN = "/api/v1/auth/login"
ME = "/api/v1/user/"
FIELDS = {
    "id",
    "name",
    "email",
    "telegram_chat_id",
    "monthly_budget_limit",
    "budget_start_day",
    "created_at",
}


# --- US3: get profile --------------------------------------------------------


async def test_get_me_ok(client, auth_headers):
    r = await client.get(ME, headers=await auth_headers())
    assert r.status_code == 200
    assert set(r.json()) == FIELDS


async def test_get_me_unauthenticated(client):
    assert (await client.get(ME)).status_code == 401


async def test_get_me_only_own_data(client, auth_headers):
    h1 = await auth_headers()
    h2 = await auth_headers(email="bob@example.com")
    assert (await client.get(ME, headers=h1)).json()["email"] == "ana@example.com"
    assert (await client.get(ME, headers=h2)).json()["email"] == "bob@example.com"


# --- US4: update profile -----------------------------------------------------


async def test_patch_only_budget_limit(client, auth_headers):
    h = await auth_headers()
    before = (await client.get(ME, headers=h)).json()
    r = await client.patch(ME, headers=h, json={"monthly_budget_limit": 2000})
    assert r.status_code == 200
    after = r.json()
    assert after["monthly_budget_limit"] == 2000
    assert {k: v for k, v in after.items() if k != "monthly_budget_limit"} == {
        k: v for k, v in before.items() if k != "monthly_budget_limit"
    }


async def test_patch_ignores_email_id_password(client, auth_headers):
    h = await auth_headers()
    r = await client.patch(
        ME, headers=h, json={"email": "x@x.com", "id": 999, "password": "newpass123"}
    )
    assert r.status_code == 200
    assert r.json()["email"] == "ana@example.com"
    login = await client.post(LOGIN, json={"email": "ana@example.com", "password": "secret123"})
    assert login.status_code == 200


@pytest.mark.parametrize(
    "payload",
    [{"monthly_budget_limit": -1}, {"budget_start_day": 0}, {"budget_start_day": 29}, {"name": ""}],
)
async def test_patch_validation(client, auth_headers, payload):
    r = await client.patch(ME, headers=await auth_headers(), json=payload)
    assert r.status_code == 422


async def test_patch_empty_body_returns_unchanged_profile(client, auth_headers):
    h = await auth_headers()
    before = (await client.get(ME, headers=h)).json()
    r = await client.patch(ME, headers=h, json={})
    assert r.status_code == 200
    assert r.json() == before


async def test_patch_telegram_null_unlinks_and_empty_string_treated_as_null(client, auth_headers):
    h = await auth_headers(telegram_chat_id="777")
    assert (await client.patch(ME, headers=h, json={"telegram_chat_id": None})).json()[
        "telegram_chat_id"
    ] is None
    assert (await client.patch(ME, headers=h, json={"telegram_chat_id": "888"})).json()[
        "telegram_chat_id"
    ] == "888"
    assert (await client.patch(ME, headers=h, json={"telegram_chat_id": ""})).json()[
        "telegram_chat_id"
    ] is None


async def test_patch_telegram_conflict(client, auth_headers):
    await auth_headers(telegram_chat_id="777")
    h2 = await auth_headers(email="bob@example.com")
    r = await client.patch(ME, headers=h2, json={"telegram_chat_id": "777"})
    assert r.status_code == 409
    assert r.json() == {"detail": "Telegram chat id already linked to another account"}


# --- US5: delete account -----------------------------------------------------


async def test_delete_me(client, auth_headers):
    h = await auth_headers()
    r = await client.delete(ME, headers=h)
    assert r.status_code == 204
    assert r.content == b""
    assert (await client.get(ME, headers=h)).status_code == 401


async def test_email_reusable_after_delete(client, auth_headers, register):
    await client.delete(ME, headers=await auth_headers())
    assert (await register()).status_code == 201


async def test_delete_unauthenticated(client):
    assert (await client.delete(ME)).status_code == 401
