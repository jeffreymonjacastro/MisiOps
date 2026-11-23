from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from core.forecast_features import LIMA, shift_month
from main import app
from models.category import Category
from models.prediction import PredictionObservation
from models.transaction import Transaction
from models.user import User

pytestmark = pytest.mark.anyio
URL = "/api/v1/predictions/month-end"


@pytest.mark.parametrize(
    ("prediction", "status"),
    [
        (250, "expected_surplus"),
        (-250, "expected_deficit"),
        (-100, "tight_close"),
        (0, "tight_close"),
        (100, "tight_close"),
    ],
)
async def test_forecast_uses_authenticated_history_and_inclusive_band(
    client, auth_headers, db_session, monkeypatch, prediction, status
):
    headers = await auth_headers()
    other = await auth_headers(email="other@example.com")
    owner = await db_session.scalar(select(User).where(User.email == "ana@example.com"))
    category = await db_session.scalar(
        select(Category).where(Category.user_id == owner.id, Category.type == "income").limit(1)
    )
    start = datetime.now(LIMA).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for offset in [-2, -1]:
        occurred = shift_month(start, offset)
        db_session.add(
            Transaction(
                amount=100,
                type="income",
                transaction_date=occurred,
                created_at=occurred,
                user_id=owner.id,
                category_id=category.id,
            )
        )
    await db_session.commit()
    monkeypatch.setattr(
        app.state,
        "forecast_model",
        SimpleNamespace(
            version="fixture",
            bands=dict(early=100, middle=100, late=100),
            predict=lambda _: prediction,
        ),
        raising=False,
    )
    response = await client.get(URL, headers=headers)
    assert response.status_code == 200, response.text
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.json()["status"] == status
    assert response.json()["projected_net"] == prediction
    assert (await client.get(URL, headers=other)).json()["reason"] == "insufficient_history"
    assert (await client.get(URL)).status_code == 401
    observation = await db_session.scalar(select(PredictionObservation))
    assert observation.user_id == owner.id
    assert (await client.delete("/api/v1/user/", headers=headers)).status_code == 204
    assert await db_session.scalar(select(PredictionObservation)) is None


async def test_disabled_model_does_not_prevent_transaction_summary(client, auth_headers):
    headers = await auth_headers()
    assert (await client.get(URL, headers=headers)).json()["reason"] == "model_unavailable"
    assert (await client.get("/api/v1/transactions/summary", headers=headers)).status_code == 200


async def test_expected_but_unavailable_model_fails_deployment_readiness(
    client, monkeypatch, auth_headers
):
    monkeypatch.setattr(app.state, "forecast_release_required", True, raising=False)
    monkeypatch.setattr(app.state, "forecast_model", None, raising=False)
    assert (await client.get("/api/v1/predictions/health")).status_code == 503
    assert (await client.get("/")).status_code == 503
    headers = await auth_headers()
    assert (await client.get("/api/v1/transactions/summary", headers=headers)).status_code == 200
