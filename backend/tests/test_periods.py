from datetime import date

import pytest

from core.periods import budget_period


@pytest.mark.parametrize(
    "today,start_day,expected",
    [
        (date(2026, 9, 16), 1, (date(2026, 9, 1), date(2026, 9, 30))),  # calendar month
        (date(2026, 9, 20), 15, (date(2026, 9, 15), date(2026, 10, 14))),  # on/after start day
        (date(2026, 9, 10), 15, (date(2026, 8, 15), date(2026, 9, 14))),  # before start day
        (date(2026, 12, 20), 15, (date(2026, 12, 15), date(2027, 1, 14))),  # year rollover
        (date(2027, 1, 5), 15, (date(2026, 12, 15), date(2027, 1, 14))),  # January, before
        (date(2026, 3, 5), 28, (date(2026, 2, 28), date(2026, 3, 27))),  # February, day 28
        (date(2026, 2, 28), 28, (date(2026, 2, 28), date(2026, 3, 27))),  # exactly on start
    ],
)
def test_budget_period(today, start_day, expected):
    assert budget_period(today, start_day) == expected
