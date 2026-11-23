from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from math import isfinite

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user
from core.database import get_db
from core.forecast_features import (
    FEATURE_CONTRACT,
    LOOKBACK_MONTHS,
    Movement,
    build_features,
    cutoff_bucket,
    forecast_month,
    shift_month,
)
from models.prediction import PredictionObservation
from models.transaction import Transaction
from models.user import User
from schemas.prediction import ForecastResponse

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/health")
async def forecast_health(request: Request, response: Response):
    model = getattr(request.app.state, "forecast_model", None)
    if model is None and getattr(request.app.state, "forecast_release_required", False):
        response.status_code = 503
    response.headers["Cache-Control"] = "no-store"
    return {"model_version": model.version if model else None}


def _now() -> datetime:
    return datetime.now(UTC)


def cents(value: float) -> int:
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


@router.get("/month-end", response_model=ForecastResponse)
async def month_end(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ForecastResponse:
    response.headers["Cache-Control"] = "private, no-store"
    cutoff = _now()
    start, end = forecast_month(cutoff)
    period = dict(
        period_start=start.date(), period_end=(end - timedelta(days=1)).date(), cutoff=cutoff
    )
    model = getattr(request.app.state, "forecast_model", None)
    if model is None:
        return ForecastResponse(**period, status="unavailable", reason="model_unavailable")

    query = select(
        Transaction.transaction_date, Transaction.created_at, Transaction.type, Transaction.amount
    ).where(
        Transaction.user_id == user.id,
        Transaction.transaction_date >= shift_month(start, -LOOKBACK_MONTHS).astimezone(UTC),
        Transaction.transaction_date <= cutoff,
        Transaction.created_at <= cutoff,
    )
    rows = (await db.execute(query)).all()
    features = build_features(
        [
            Movement(occurred, recorded, kind, int(amount * 100))
            for occurred, recorded, kind, amount in rows
        ],
        cutoff,
    )
    if features is None:
        return ForecastResponse(**period, status="unavailable", reason="insufficient_history")
    estimate = model.predict(features)
    if not isfinite(estimate):
        return ForecastResponse(**period, status="unavailable", reason="model_unavailable")
    bucket = cutoff_bucket(cutoff)
    amount, band = cents(estimate), cents(model.bands[bucket])
    if abs(amount) <= band:
        status = "tight_close"
    elif amount > 0:
        status = "expected_surplus"
    else:
        status = "expected_deficit"
    db.add(
        PredictionObservation(
            **period,
            user_id=user.id,
            model_version=model.version,
            feature_contract=FEATURE_CONTRACT,
            bucket=bucket,
            forecast_cents=amount,
            band_cents=band,
            features=features,
        )
    )
    await db.commit()
    return ForecastResponse(
        **period,
        status=status,
        projected_net=amount / 100,
        error_band=band / 100,
        model_version=model.version,
    )
