from datetime import datetime

import pytest
from simulation.generate import simulate
from src.validate_data import validate


def test_simulation_replays_reproducibly_and_includes_late_registrations():
    config = {"seed": 125, "users": 4, "months": 12, "first_month": "2023-01-01"}
    rows = list(simulate(config))
    assert rows == list(simulate(config))
    extended = {row["id"]: row for row in simulate(config | {"months": 13})}
    assert all(extended[row["id"]] == row for row in rows)
    assert len(validate(rows)["months"]) == 12
    assert any(
        (
            datetime.fromisoformat(row["recorded_at"]) - datetime.fromisoformat(row["occurred_at"])
        ).days
        > 0
        for row in rows
    )
    with pytest.raises(ValueError, match="duplicate"):
        validate(rows + rows[:1])
