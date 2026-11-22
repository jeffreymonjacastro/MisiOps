"""Seed a disposable instance and assert API parity. Run through the backend container."""

import asyncio
import json
import os
import statistics
import time
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from api.v1.predictions import cents
from core.config import settings
from core.database import SessionLocal, engine
from core.forecast_features import Movement, build_features, forecast_month, shift_month
from core.forecast_model import load_release
from models.category import Category
from models.transaction import Transaction
from models.user import User
from sqlalchemy import select

API = "http://127.0.0.1:8000/api/v1"


def call(path, data=None, token=None, method=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    with urlopen(
        Request(API + path, data=body, headers=headers, method=method), timeout=10
    ) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


async def seed(email):
    now = datetime.now(UTC)
    start, _ = forecast_month(now)
    rows = []
    for offset in range(-3, 1):
        month = shift_month(start, offset)
        for day, kind, value in [
            (1, "income", 260000),
            (2, "expense", 130000),
            (9, "expense", 63000),
            (21, "expense", 45000),
        ]:
            occurred = month.replace(day=day)
            recorded = occurred + timedelta(hours=1)
            if recorded > now:
                continue
            rows.append(Movement(occurred, recorded, kind, value))
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == email))
        categories = (
            await session.scalars(
                select(Category).where(Category.user_id == user.id).order_by(Category.id)
            )
        ).all()
        cat = {row.type: row.id for row in categories}
        session.add_all(
            [
                Transaction(
                    user_id=user.id,
                    category_id=cat[row.kind],
                    type=row.kind,
                    amount=Decimal(row.cents) / 100,
                    transaction_date=row.occurred_at,
                    created_at=row.recorded_at,
                )
                for row in rows
            ]
        )
        await session.commit()
    await engine.dispose()
    return rows


def main():
    keep = os.getenv("FORECAST_DEMO_KEEP") == "1"
    email = os.getenv("FORECAST_DEMO_EMAIL") or f"forecast-{uuid4().hex}@example.com"
    password = os.getenv("FORECAST_DEMO_PASSWORD") or uuid4().hex
    if keep and "FORECAST_DEMO_PASSWORD" not in os.environ:
        raise SystemExit("Set FORECAST_DEMO_PASSWORD when keeping the demo account")
    deadline = time.monotonic() + 120
    while True:
        try:
            call("/predictions/health")
            break
        except URLError as exc:
            if time.monotonic() >= deadline:
                raise SystemExit("The forecast API did not become ready within two minutes") from exc
            time.sleep(2)
    call("/auth/register", {"email": email, "password": password, "name": "Forecast Demo"})
    token = call("/auth/login", {"email": email, "password": password})["access_token"]
    try:
        rows = asyncio.run(seed(email))
        release = load_release(Path(settings.FORECAST_RELEASE_DIR))
        times = []
        for _ in range(21):
            begin = time.perf_counter()
            result = call("/predictions/month-end", token=token)
            times.append(time.perf_counter() - begin)
            snapshot = build_features(rows, datetime.fromisoformat(result["cutoff"]))
            assert snapshot is not None
            assert result["model_version"] == release.version, result
            assert abs(cents(result["projected_net"]) - cents(release.predict(snapshot))) <= 1
        p95 = statistics.quantiles(times[1:], n=100, method="inclusive")[94]
        assert p95 < 2, f"forecast p95 was {p95:.3f}s"
        print(f"Forecast parity within PEN 0.01 · {release.version} · warm p95 {p95:.3f}s")
        if keep:
            print(f"Demo account: {email}")
    finally:
        if not keep:
            call("/user/", token=token, method="DELETE")


if __name__ == "__main__":
    main()
