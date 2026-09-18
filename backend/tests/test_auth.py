import logging

import pytest

from core.config import settings
from core.security import create_access_token

pytestmark = pytest.mark.anyio

LOGIN = "/api/v1/auth/login"
ME = "/api/v1/user/"


# --- US1: register -----------------------------------------------------------


async def test_register_ok(register):
    r = await register()
    assert r.status_code == 201
    body = r.json()
    assert isinstance(body["id"], int)
    assert body["name"] == "Ana"
    assert body["email"] == "ana@example.com"
    assert body["telegram_chat_id"] is None
    assert body["monthly_budget_limit"] == 0
    assert body["budget_start_day"] == 1
    assert body["created_at"]
    assert "password" not in body
    assert "hashed_password" not in body


async def test_register_normalises_email(register):
    r = await register(email="  Ana@Example.com ")
    assert r.status_code == 201
    assert r.json()["email"] == "ana@example.com"


async def test_register_stores_telegram_chat_id(register):
    r = await register(telegram_chat_id="123456")
    assert r.status_code == 201
    assert r.json()["telegram_chat_id"] == "123456"


async def test_register_duplicate_email_case_insensitive(register):
    assert (await register()).status_code == 201
    r = await register(email="Ana@Example.com")
    assert r.status_code == 409
    assert r.json() == {"detail": "Email already registered"}


async def test_register_duplicate_telegram_chat_id(register):
    assert (await register(telegram_chat_id="42")).status_code == 201
    r = await register(email="bob@example.com", telegram_chat_id="42")
    assert r.status_code == 409
    assert r.json() == {"detail": "Telegram chat id already linked to another account"}


@pytest.mark.parametrize(
    "field,value",
    [("email", "not-an-email"), ("password", "short12"), ("password", "x" * 129), ("name", "")],
)
async def test_register_validation(register, field, value):
    r = await register(**{field: value})
    assert r.status_code == 422
    assert any(field in err["loc"] for err in r.json()["detail"])


# --- US2: login --------------------------------------------------------------


async def test_login_ok(client, register):
    await register()
    r = await client.post(LOGIN, json={"email": "ana@example.com", "password": "secret123"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


async def test_login_email_case_insensitive(client, register):
    await register()
    r = await client.post(LOGIN, json={"email": "ANA@example.com", "password": "secret123"})
    assert r.status_code == 200


async def test_login_wrong_password_and_unknown_email_same_body(client, register):
    await register()
    wrong = await client.post(LOGIN, json={"email": "ana@example.com", "password": "nope-nope"})
    unknown = await client.post(LOGIN, json={"email": "ghost@example.com", "password": "secret123"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Invalid credentials"}
    assert wrong.headers["www-authenticate"] == "Bearer"


async def test_token_grants_access_to_protected_route(client, auth_headers):
    r = await client.get(ME, headers=await auth_headers())
    assert r.status_code == 200


async def test_expired_token_rejected(client, register, monkeypatch):
    user_id = (await register()).json()["id"]
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", -1)
    token = create_access_token(user_id)
    r = await client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


@pytest.mark.parametrize(
    "headers", [{}, {"Authorization": "Basic abc"}, {"Authorization": "Bearer not.a.jwt"}]
)
async def test_bad_bearer_variants(client, headers):
    r = await client.get(ME, headers=headers)
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


async def test_tampered_token_rejected(client, auth_headers):
    token = (await auth_headers())["Authorization"].split()[1]
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    r = await client.get(ME, headers={"Authorization": f"Bearer {tampered}"})
    assert r.status_code == 401


async def test_failed_login_logs_warning_without_password(client, register, caplog):
    await register()
    with caplog.at_level(logging.WARNING, logger="misiops.auth"):
        await client.post(LOGIN, json={"email": "ana@example.com", "password": "wrong-pass"})
    messages = [rec.getMessage() for rec in caplog.records if rec.name == "misiops.auth"]
    assert any("ana@example.com" in m for m in messages)
    assert all("wrong-pass" not in m for m in messages)
