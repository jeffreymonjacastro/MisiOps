from pathlib import Path

from core.forecast_model import load_release
from core.forecast_monitor import summarize
from simulation.monitor_scenarios import observations

RELEASE = Path(__file__).resolve().parents[2] / "backend" / "forecast_release"


def test_stable_drift_and_quality_are_separate():
    model = load_release(RELEASE)
    stable = summarize(observations(model, "steady"), model)["by_cutoff"]
    changed = summarize(observations(model, "input_shift"), model)["by_cutoff"]
    degraded = summarize(observations(model, "degraded_close"), model)["by_cutoff"]
    assert all(row["decision"] == "stable" and row["mae"] is None for row in stable.values())
    assert all(
        row["decision"] == "investigate_drift" and row["mae"] is None for row in changed.values()
    )
    assert all(
        row["decision"] == "retrain_candidate" and row["mae"] > 0 for row in degraded.values()
    )
    assert all(
        row["decision"] == "insufficient_sample"
        for row in summarize([], model)["by_cutoff"].values()
    )
