from calendar import monthrange
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from statistics import mean, pstdev
from zoneinfo import ZoneInfo

LIMA = ZoneInfo("America/Lima")
FEATURE_CONTRACT = 2
LOOKBACK_MONTHS = 3
MIN_HISTORY_MONTHS = 2
LABEL_GRACE = timedelta(days=7)
BUCKETS = ("early", "middle", "late")
FEATURE_NAMES = (
    "income_mtd",
    "expense_mtd",
    "derived_net",
    "expense_last_7d",
    "days_remaining",
    "prior_net_mean",
    "prior_net_std",
    "prior_income_mean",
    "prior_expense_mean",
    "historical_remaining",
    "month_day_fraction",
    "bonus_month",
)


@dataclass(frozen=True)
class Movement:
    occurred_at: datetime
    recorded_at: datetime | None
    kind: str
    cents: int


def aware(value: datetime) -> datetime:
    # SQLite tests return naive UTC values for timezone-aware database fields.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def shift_month(start: datetime, offset: int) -> datetime:
    year, month = divmod(start.year * 12 + start.month - 1 + offset, 12)
    return start.replace(year=year, month=month + 1)


def forecast_month(cutoff: datetime) -> tuple[datetime, datetime]:
    start = aware(cutoff).astimezone(LIMA).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start, shift_month(start, 1)


def cutoff_bucket(cutoff: datetime) -> str:
    return BUCKETS[min((aware(cutoff).astimezone(LIMA).day - 1) // 10, 2)]


def _sums(rows):
    income = sum(row.cents for row in rows if row.kind == "income")
    expense = sum(row.cents for row in rows if row.kind == "expense")
    return income / 100, expense / 100


def build_features(rows: list[Movement], cutoff: datetime) -> dict[str, float] | None:
    local = aware(cutoff).astimezone(LIMA)
    start, _ = forecast_month(local)
    history_start = shift_month(start, -LOOKBACK_MONTHS)
    by_period: dict[datetime, list[Movement]] = {}
    for row in rows:
        occurred = aware(row.occurred_at)
        if (
            row.recorded_at is not None
            and aware(row.recorded_at) <= local
            and history_start <= occurred <= local
        ):
            period, _ = forecast_month(occurred)
            by_period.setdefault(period, []).append(row)
    history = {month: items for month, items in by_period.items() if month < start}
    if len(history) < MIN_HISTORY_MONTHS:
        return None
    current = by_period.get(start, [])
    income, expense = _sums(current)
    historical = [_sums(items) for items in history.values()]
    historical_nets = [i - e for i, e in historical]
    remaining = []
    for (month, items), net in zip(history.items(), historical_nets, strict=True):
        prior_cut = month.replace(
            day=min(local.day, monthrange(month.year, month.month)[1]),
            hour=local.hour,
            minute=local.minute,
            second=local.second,
            microsecond=local.microsecond,
        )
        partial = [
            row
            for row in items
            if aware(row.occurred_at) <= prior_cut and aware(row.recorded_at) <= prior_cut
        ]
        prior_income, prior_expense = _sums(partial)
        remaining.append(net - (prior_income - prior_expense))
    days = monthrange(start.year, start.month)[1]
    recent = local - timedelta(days=7)
    return {
        "income_mtd": income,
        "expense_mtd": expense,
        "derived_net": income - expense,
        "expense_last_7d": sum(
            row.cents
            for row in current
            if row.kind == "expense" and aware(row.occurred_at) > recent
        )
        / 100,
        "days_remaining": float(days - local.day),
        "prior_net_mean": mean(historical_nets),
        "prior_net_std": pstdev(historical_nets),
        "prior_income_mean": mean(i for i, _ in historical),
        "prior_expense_mean": mean(e for _, e in historical),
        "historical_remaining": mean(remaining),
        "month_day_fraction": local.day / days,
        "bonus_month": float(local.month in (7, 12)),
    }
