from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class ForecastResponse(BaseModel):
    period_start: date
    period_end: date
    cutoff: datetime
    currency: Literal["PEN"] = "PEN"
    status: Literal["expected_surplus", "expected_deficit", "tight_close", "unavailable"]
    reason: Literal["insufficient_history", "model_unavailable"] | None = None
    projected_net: float | None = None
    error_band: float | None = None
    model_version: str | None = None
