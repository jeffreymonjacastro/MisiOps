from datetime import date, timedelta


def budget_period(today: date, start_day: int) -> tuple[date, date]:
    """Inclusive (start, end) of the budget period containing `today`.

    The period starts on `start_day` (1-28) of the current month, or of the previous month
    when `today` is before that day, and ends the day before the next start.
    """
    if today.day >= start_day:
        start = today.replace(day=start_day)
    else:
        last_of_previous_month = today.replace(day=1) - timedelta(days=1)
        start = last_of_previous_month.replace(day=start_day)
    first_of_next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    end = first_of_next_month.replace(day=start_day) - timedelta(days=1)
    return start, end
