import hashlib
import json
from dataclasses import dataclass
from math import isfinite
from pathlib import Path

import skops.io
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from core.forecast_features import BUCKETS, FEATURE_CONTRACT, FEATURE_NAMES

# GradientBoosting stores these two scikit-learn loss classes in its fitted state.
TRUSTED_TYPES = {
    "sklearn._loss.loss.HalfSquaredError",
    "sklearn._loss._loss.CyHalfSquaredError",
    "sklearn._loss.link.IdentityLink",
    "sklearn._loss.link.Interval",
}


@dataclass(frozen=True)
class ForecastModel:
    version: str
    bands: dict[str, float]
    baseline_mae: dict[str, float]
    references: dict
    estimator: Pipeline

    def predict(self, features: dict[str, float]) -> float:
        return float(self.estimator.predict([[features[name] for name in FEATURE_NAMES]])[0])


def load_release(directory: Path) -> ForecastModel:
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    report_path = directory / "evaluation.json"
    report_bytes = report_path.read_bytes()
    if hashlib.sha256(report_bytes).hexdigest() != manifest["evaluation_sha256"]:
        raise ValueError("Forecast evaluation checksum mismatch")
    report = json.loads(report_bytes)
    if (
        report["gate"]["decision"] != "accepted"
        or manifest["dataset_sha256"] != report["dataset_sha256"]
        or manifest["model"] != report["selected_model"]
        or manifest["feature_contract"] != FEATURE_CONTRACT
        or manifest["feature_names"] != list(FEATURE_NAMES)
    ):
        raise ValueError("Forecast release is not compatible or was not approved by the gate")
    model_bytes = (directory / "model.skops").read_bytes()
    checksum = hashlib.sha256(model_bytes).hexdigest()
    if checksum != manifest["model_sha256"] or manifest["version"] != checksum[:16]:
        raise ValueError("Forecast model checksum mismatch")
    for values in (manifest["error_bands"], manifest["reference_mae"]):
        if set(values) != set(BUCKETS) or any(not isfinite(x) or x < 0 for x in values.values()):
            raise ValueError("Invalid forecast error bands")
    unexpected = set(skops.io.get_untrusted_types(data=model_bytes)) - TRUSTED_TYPES
    if unexpected:
        raise ValueError("Forecast artifact contains unsupported types")
    estimator = skops.io.loads(model_bytes, trusted=sorted(TRUSTED_TYPES))
    if (
        type(estimator) is not Pipeline
        or list(estimator.named_steps) != ["scale", "model"]
        or estimator.named_steps["scale"] != "passthrough"
        and type(estimator.named_steps["scale"]) is not StandardScaler
        or type(estimator.named_steps["model"])
        not in (LinearRegression, Ridge, RandomForestRegressor, GradientBoostingRegressor)
        or estimator.named_steps["model"].n_features_in_ != len(FEATURE_NAMES)
    ):
        raise ValueError("Unsupported forecast pipeline")
    return ForecastModel(
        checksum[:16],
        manifest["error_bands"],
        manifest["reference_mae"],
        manifest["references"],
        estimator,
    )
