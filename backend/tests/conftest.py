import os

os.environ.setdefault(
    "SECRET_KEY", "test-secret-key-with-at-least-32-bytes"
)  # must run before the app imports settings

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from core.database import Base, get_db
from main import app

DEFAULT_USER = {"name": "Ana", "email": "ana@example.com", "password": "secret123"}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", poolclass=StaticPool)

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def register(client):
    async def _register(**overrides):
        return await client.post("/api/v1/auth/register", json={**DEFAULT_USER, **overrides})

    return _register


@pytest.fixture
def auth_headers(client, register):
    async def _headers(**overrides):
        data = {**DEFAULT_USER, **overrides}
        await register(**overrides)
        r = await client.post(
            "/api/v1/auth/login", json={"email": data["email"], "password": data["password"]}
        )
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _headers
