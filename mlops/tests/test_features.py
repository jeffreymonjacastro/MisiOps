from datetime import datetime

from core.forecast_features import LIMA, Movement, build_features, forecast_month


def date(month, day):
    return datetime(2025, month, day, 12, tzinfo=LIMA)


def test_replay_excludes_late_future_and_unknown_rows():
    rows = [
        Movement(date(1, 1), date(1, 1), "income", 100_000),
        Movement(date(2, 1), date(2, 1), "income", 100_000),
        Movement(date(3, 2), date(3, 2), "income", 100_000),
        Movement(date(3, 6), date(3, 6), "expense", 98_000),
        Movement(date(3, 6), date(3, 15), "expense", 75_000),
        Movement(date(3, 20), date(3, 20), "expense", 1_000),
        Movement(date(3, 6), None, "expense", 50_000),
    ]
    features = build_features(rows, date(3, 14))
    assert features is not None
    assert features["income_mtd"] == 1000
    assert features["expense_mtd"] == 980
    assert features["derived_net"] == 20
    assert features["days_remaining"] == 17
    assert build_features(rows[2:], date(3, 14)) is None


def test_reporting_boundary_uses_lima_calendar():
    boundary = datetime.fromisoformat("2025-04-01T03:00:00+00:00")
    start, end = forecast_month(boundary)
    assert start.date().isoformat() == "2025-03-01"
    assert end.date().isoformat() == "2025-04-01"
