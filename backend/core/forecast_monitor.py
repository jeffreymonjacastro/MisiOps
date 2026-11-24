from collections import defaultdict
from statistics import mean

import numpy as np

from core.forecast_features import BUCKETS

MIN_SAMPLE = 30
PSI_LIMIT = 0.25
MAE_RATIO_LIMIT = 1.30


def psi(values, reference):
    edges = np.asarray(reference["edges"])
    actual = np.bincount(np.searchsorted(edges, values, side="right"), minlength=len(edges) + 1)
    observed = np.maximum(actual / len(values), 0.001)
    expected = np.maximum(reference["proportions"], 0.001)
    return float(np.sum((observed - expected) * np.log(observed / expected)))


def summarize(observations, model):
    grouped = defaultdict(list)
    for row in observations:
        grouped[row["bucket"]].append(row)
    report = {}
    for bucket in BUCKETS:
        rows = grouped[bucket]
        labeled = [item for item in rows if item["actual"] is not None]
        metrics = {
            "observations": len(rows),
            "settled_observations": len(labeled),
            "input_drift": None,
            "prediction_drift": None,
            "mae": None,
            "rmse": None,
            "deficits": None,
            "missed_deficits": None,
            "decision": "insufficient_sample",
        }
        if len(rows) >= MIN_SAMPLE:
            reference = model.references[bucket]
            drifts = {
                key: psi([row["features"][key] for row in rows], bins)
                for key, bins in reference.items()
                if key != "prediction"
            }
            prediction_drift = psi([row["prediction"] for row in rows], reference["prediction"])
            metrics.update(input_drift=drifts, prediction_drift=prediction_drift, decision="stable")
            if max([prediction_drift, *drifts.values()]) >= PSI_LIMIT:
                metrics["decision"] = "investigate_drift"
        if len(labeled) >= MIN_SAMPLE:
            errors = [row["prediction"] - row["actual"] for row in labeled]
            mae = mean(abs(n) for n in errors)
            deficits = [row for row in labeled if row["actual"] < 0]
            missed = sum(row["prediction"] >= -row["band"] for row in deficits)
            metrics.update(
                mae=mae,
                rmse=mean(n**2 for n in errors) ** 0.5,
                deficits=len(deficits),
                missed_deficits=missed,
            )
            if mae > model.baseline_mae[bucket] * MAE_RATIO_LIMIT:
                metrics["decision"] = "retrain_candidate"
        report[bucket] = metrics
    return {"model_version": model.version, "by_cutoff": report}
