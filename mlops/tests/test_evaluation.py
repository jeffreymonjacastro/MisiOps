from datetime import datetime, timedelta

import numpy as np
from core.forecast_features import LABEL_GRACE, LIMA, shift_month
from src.evaluate_and_register import quality_gate
from src.train import regime_metrics, split


def test_time_folds_leave_months_and_late_labels_out():
    first = datetime(2024, 1, 1, tzinfo=LIMA)
    rows = []
    for index in range(10):
        month = shift_month(first, index)
        for day in (7, 14, 21):
            rows.append(
                {
                    "period": month.date().isoformat(),
                    "cutoff": (month + timedelta(days=day - 1)).isoformat(),
                    "label_available_at": (shift_month(month, 1) + LABEL_GRACE).isoformat(),
                }
            )
    folds, refit, test = split(rows, dict(test_months=6, validation_months=3, validation_folds=3))
    for training, validation in [*folds, (refit, test)]:
        assert max(row["label_available_at"] for row in training) < min(
            row["cutoff"] for row in validation
        )
        assert max(row["period"] for row in training) < min(row["period"] for row in validation)
    assert not (
        {row["period"] for row in test} & {row["period"] for _, valid in folds for row in valid}
    )


def test_tight_deficit_counts_as_missed_and_gate_rejects():
    rows = [{"target": -3.0, "bucket": "early"}, {"target": 5.0, "bucket": "early"}]
    metrics = regime_metrics(rows, np.array([-1.0, 5.0]), {"early": 1.0})
    assert metrics["tight_closes"] == metrics["missed_deficits"] == 1
    assert (
        quality_gate(metrics, {"mae": 5}, dict(minimum_deficits=1, maximum_deficit_miss_rate=0.5))[
            "decision"
        ]
        == "rejected"
    )
