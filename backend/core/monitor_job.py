"""Finalize delayed labels and report aggregates for the deployed forecast model."""

import asyncio
import json
import os
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import URL, case, func, select, update
from sqlalchemy.ext.asyncio import create_async_engine

from core.forecast_features import FEATURE_CONTRACT, LABEL_GRACE, LIMA
from core.forecast_model import load_release
from core.forecast_monitor import summarize
from models.prediction import PredictionObservation
from models.transaction import Transaction


async def settle(connection, observations, now):
    groups = defaultdict(set)
    for row in observations:
        start = datetime.combine(row.period_start, datetime.min.time(), tzinfo=LIMA)
        end = datetime.combine(row.period_end + timedelta(days=1), datetime.min.time(), tzinfo=LIMA)
        if row.actual_cents is None and now >= end + LABEL_GRACE:
            groups[(start, end)].add(row.user_id)
    finalized = 0
    for (start, end), owners in groups.items():
        query = (
            select(
                Transaction.user_id,
                func.sum(
                    case(
                        (Transaction.type == "income", Transaction.amount),
                        else_=-Transaction.amount,
                    )
                ),
            )
            .where(
                Transaction.user_id.in_(owners),
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
                Transaction.created_at < end + LABEL_GRACE,
            )
            .group_by(Transaction.user_id)
        )
        actuals = dict.fromkeys(owners, 0)
        actuals.update(
            (owner, int(amount * 100)) for owner, amount in (await connection.execute(query)).all()
        )
        # Unknown timestamps prevent a claims-grade historical label for that owner/month.
        incomplete = (
            select(Transaction.user_id)
            .where(
                Transaction.user_id.in_(owners),
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
                Transaction.created_at.is_(None),
            )
            .distinct()
        )
        for owner in (await connection.execute(incomplete)).scalars():
            actuals.pop(owner, None)
        for owner, actual in actuals.items():
            result = await connection.execute(
                update(PredictionObservation)
                .where(
                    PredictionObservation.user_id == owner,
                    PredictionObservation.period_start == start.date(),
                    PredictionObservation.actual_cents.is_(None),
                )
                .values(actual_cents=actual, evaluated_at=now)
            )
            finalized += result.rowcount
    return finalized


async def run():
    model = load_release(Path(os.environ["FORECAST_RELEASE_DIR"]))
    env = os.getenv("APP_ENV", "local")
    url = URL.create(
        "postgresql+asyncpg",
        username=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.environ["POSTGRES_SERVER"],
        database=os.environ["POSTGRES_DB"],
    )
    engine = create_async_engine(url, hide_parameters=True)
    now = datetime.now(UTC)
    window_start = now - timedelta(days=120)
    try:
        async with engine.begin() as connection:
            query = (
                select(PredictionObservation.__table__)
                .where(
                    PredictionObservation.cutoff >= window_start,
                    PredictionObservation.model_version == model.version,
                    PredictionObservation.feature_contract == FEATURE_CONTRACT,
                )
                .order_by(PredictionObservation.cutoff.desc())
            )
            recent = (await connection.execute(query)).all()
            finalized = await settle(connection, recent, now)
            unique = {}
            for row in (await connection.execute(query)).all():
                key = row.user_id, row.period_start, row.bucket
                unique.setdefault(
                    key,
                    {
                        "features": row.features,
                        "bucket": row.bucket,
                        "band": row.band_cents / 100,
                        "prediction": row.forecast_cents / 100,
                        "actual": None if row.actual_cents is None else row.actual_cents / 100,
                    },
                )
    finally:
        await engine.dispose()
    report = summarize(unique.values(), model)
    print(
        json.dumps(
            report
            | {
                "event": "forecast_monitor",
                "environment": env,
                "labels_finalized": finalized,
                "window_start": window_start.isoformat(),
                "window_end": now.isoformat(),
            },
            allow_nan=False,
        )
    )
    for bucket, metrics in report["by_cutoff"].items():
        print(
            json.dumps(
                {
                    "event": "forecast_metrics",
                    "environment": env,
                    "bucket": bucket,
                    "model_version": model.version,
                    "retrain": int(metrics["decision"] == "retrain_candidate"),
                    "drift": int(metrics["decision"] == "investigate_drift"),
                    "count": metrics["observations"],
                    "mae": metrics["mae"],
                },
                allow_nan=False,
            )
        )


if __name__ == "__main__":
    asyncio.run(run())
