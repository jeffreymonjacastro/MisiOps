import re
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

TxType = Literal["income", "expense"]
Amount = Annotated[Decimal, Field(gt=0, le=1_000_000_000, decimal_places=2)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]

_DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _empty_to_none(value):
    return None if isinstance(value, str) and value.strip() == "" else value


def _date_only_to_datetime(value):
    # "YYYY-MM-DD" from a date input becomes that day at 00:00 (UTC, see _utc_not_future)
    if isinstance(value, str) and _DATE_ONLY.match(value):
        return datetime.fromisoformat(value)
    return value


def _utc_not_future(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    value = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    if value > datetime.now(UTC):
        raise ValueError("transaction_date must not be in the future")
    return value


class TransactionCreate(BaseModel):
    amount: Amount
    type: TxType
    category_id: int = Field(gt=0)
    description: Description | None = None
    transaction_date: datetime | None = None

    _desc = field_validator("description", mode="before")(_empty_to_none)
    _date_before = field_validator("transaction_date", mode="before")(_date_only_to_datetime)
    _date_after = field_validator("transaction_date")(_utc_not_future)


class TransactionUpdate(BaseModel):
    """All fields optional. Omitted = unchanged. The resulting row is re-validated."""

    model_config = ConfigDict(extra="ignore")

    amount: Amount | None = None
    type: TxType | None = None
    category_id: int | None = Field(default=None, gt=0)
    description: Description | None = None
    transaction_date: datetime | None = None

    _desc = field_validator("description", mode="before")(_empty_to_none)
    _date_before = field_validator("transaction_date", mode="before")(_date_only_to_datetime)
    _date_after = field_validator("transaction_date")(_utc_not_future)


class CategoryRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: TxType


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    type: TxType
    source: str
    description: str | None
    transaction_date: datetime
    category: CategoryRef


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    limit: int
    offset: int


class CategoryTotal(BaseModel):
    category_id: int
    name: str
    type: TxType
    budget: float | None
    total: float


class SummaryOut(BaseModel):
    period_start: date
    period_end: date
    total_income: float
    total_expense: float
    balance: float
    monthly_budget_limit: float
    remaining_budget: float | None
    by_category: list[CategoryTotal]
