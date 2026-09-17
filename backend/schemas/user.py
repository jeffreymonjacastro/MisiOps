from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
TelegramId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _email_before(value):
    return normalize_email(value) if isinstance(value, str) else value


def _empty_to_none(value):
    return None if value == "" else value


class UserCreate(BaseModel):
    name: Name
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    telegram_chat_id: TelegramId | None = None

    _norm_email = field_validator("email", mode="before")(_email_before)
    _norm_telegram = field_validator("telegram_chat_id", mode="before")(_empty_to_none)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

    _norm_email = field_validator("email", mode="before")(_email_before)


class UserUpdate(BaseModel):
    """All fields optional. Omitted = unchanged; telegram_chat_id null = unlink."""

    model_config = ConfigDict(extra="ignore")

    name: Name | None = None
    telegram_chat_id: TelegramId | None = None
    monthly_budget_limit: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    budget_start_day: int | None = Field(default=None, ge=1, le=28)

    _norm_telegram = field_validator("telegram_chat_id", mode="before")(_empty_to_none)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    telegram_chat_id: str | None
    # float so JSON emits a number (Decimal would serialise as a string)
    monthly_budget_limit: float
    budget_start_day: int
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
