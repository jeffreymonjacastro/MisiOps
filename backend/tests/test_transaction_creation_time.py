from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from models.category import Category
from models.transaction import Transaction

pytestmark = pytest.mark.anyio


async def test_creation_time_is_assigned_by_server_and_survives_edit(
    client, auth_headers, db_session
):
    headers = await auth_headers()
    category = await db_session.scalar(select(Category).where(Category.type == "expense").limit(1))
    response = await client.post(
        "/api/v1/transactions",
        headers=headers,
        json=dict(
            type="expense",
            category_id=category.id,
            amount=10,
            transaction_date="2025-01-03",
            created_at="2025-01-04",
        ),
    )
    assert response.status_code == 201, response.text
    identifier = response.json()["id"]
    transaction = await db_session.scalar(select(Transaction).where(Transaction.id == identifier))
    recorded = transaction.created_at
    assert abs((recorded.replace(tzinfo=UTC) - datetime.now(UTC)).total_seconds()) < 60
    response = await client.patch(
        f"/api/v1/transactions/{identifier}",
        headers=headers,
        json={"amount": 20, "created_at": "2025-01-05"},
    )
    assert response.status_code == 200, response.text
    await db_session.refresh(transaction)
    assert transaction.created_at == recorded
