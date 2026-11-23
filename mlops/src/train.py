import argparse
from datetime import datetime
from pathlib import Path

import mlflow
import numpy as np
import skops.io
from core.forecast_features import BUCKETS, FEATURE_CONTRACT, FEATURE_NAMES
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from src.common import (
    CONFIG,
    DATA,
    REPORTS,
    ROOT,
    configure_tracking,
    digest,
    read_json,
    read_records,
    revision,
    settings,
    write_json,
)


def split(rows, config):
    months = sorted({row["period"] for row in rows})
    n_test = min(config["test_months"], max(2, len(months) // 5))
    pool = months[: -n_test - 1]  # an embargo month allows the first label to settle
    if len(pool) < 5:
        raise ValueError("Not enough eligible months for training, validation, and final test")
    fold_count = min(config["validation_folds"], (len(pool) - 2) // 2)
    width = min(config["validation_months"], (len(pool) - 3) // fold_count)

    def available(periods, next_rows):
        start = min(datetime.fromisoformat(row["cutoff"]) for row in next_rows)
        return [
            row
            for row in rows
            if row["period"] in periods
            and datetime.fromisoformat(row["label_available_at"]) <= start
        ]

    folds = []
    for train_ix, validation_ix in TimeSeriesSplit(
        n_splits=fold_count,
        test_size=width,
        gap=1,
    ).split(pool):
        valid_months = {pool[i] for i in validation_ix}
        validation = [row for row in rows if row["period"] in valid_months]
        folds.append((available({pool[i] for i in train_ix}, validation), validation))
    test_months = months[-n_test:]
    test = [row for row in rows if row["period"] in test_months]
    return folds, available(set(pool), test), test


def matrix(rows):
    return np.array([[row["features"][name] for name in FEATURE_NAMES] for row in rows])


def regime_metrics(rows, predictions, bands=None):
    targets = np.array([row["target"] for row in rows])
    errors = predictions - targets
    deficit = targets < 0
    if bands is None:
        predicted_deficit = predictions < 0
        tight = np.zeros(len(rows), dtype=bool)
    else:
        limits = np.array([bands[row["bucket"]] for row in rows])
        predicted_deficit = predictions < -limits
        tight = np.abs(predictions) <= limits
    count_deficit = int(deficit.sum())
    missed = int((deficit & ~predicted_deficit).sum())
    return {
        "count": len(rows),
        "mae": float(np.abs(errors).mean()),
        "median_absolute_error": float(np.median(np.abs(errors))),
        "rmse": float(np.sqrt(np.square(errors).mean())),
        "deficits": count_deficit,
        "missed_deficits": missed,
        "deficit_miss_rate": missed / count_deficit if count_deficit else None,
        "deficit_recall": (count_deficit - missed) / count_deficit if count_deficit else None,
        "sign_errors": int(((targets < 0) != (predictions < 0)).sum()),
        "tight_closes": int(tight.sum()),
    }


def baseline(rows):
    return np.array(
        [row["features"]["derived_net"] + row["features"]["historical_remaining"] for row in rows]
    )


def candidates(seed):
    return {
        "linear": Pipeline([("scale", "passthrough"), ("model", LinearRegression())]),
        "ridge": Pipeline([("scale", StandardScaler()), ("model", Ridge(alpha=10))]),
        "random_forest": Pipeline(
            [
                ("scale", "passthrough"),
                (
                    "model",
                    RandomForestRegressor(
                        n_estimators=32,
                        max_depth=6,
                        min_samples_leaf=15,
                        random_state=seed,
                        n_jobs=2,
                    ),
                ),
            ]
        ),
        "gradient_boosting": Pipeline(
            [
                ("scale", "passthrough"),
                (
                    "model",
                    GradientBoostingRegressor(
                        n_estimators=75,
                        max_depth=2,
                        min_samples_leaf=14,
                        random_state=seed,
                    ),
                ),
            ]
        ),
    }


def sliced(rows, predictions, bands=None):
    result = {"overall": regime_metrics(rows, predictions, bands)}
    for bucket in BUCKETS:
        indices = [i for i, row in enumerate(rows) if row["bucket"] == bucket]
        if indices:
            result[bucket] = regime_metrics([rows[i] for i in indices], predictions[indices], bands)
    return result


def distribution(values):
    edges = np.unique(np.quantile(values, [0.2, 0.4, 0.6, 0.8]))
    counts = np.bincount(np.searchsorted(edges, values, side="right"), minlength=len(edges) + 1)
    return {"edges": edges.tolist(), "proportions": (counts / len(values)).tolist()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=CONFIG)
    parser.add_argument("--input", type=Path, default=DATA / "features.jsonl")
    parser.add_argument("--output", type=Path, default=REPORTS / "training")
    args = parser.parse_args()
    config = settings(args.config)
    source = read_json(args.input.with_suffix(".manifest.json"))
    if (
        source["prepared_sha256"] != digest(args.input)
        or source["feature_contract"] != FEATURE_CONTRACT
    ):
        raise SystemExit("Prepared snapshot checksum or feature contract mismatch")
    folds, fitting, test = split(read_records(args.input), config)
    frozen_test = sorted({row["period"] for row in test})
    estimators = candidates(config["seed"])
    comparisons = {}
    training_revision = revision()
    ingredients = [
        args.config,
        ROOT / "uv.lock",
        ROOT / "simulation" / "generate.py",
        *(ROOT / "src").glob("*.py"),
        ROOT.parent / "backend/core/forecast_features.py",
    ]
    recipe = {path.name: digest(path) for path in sorted(ingredients)}
    configure_tracking()
    for name, estimator in {"historical_baseline": None, **estimators}.items():
        validation_rows = []
        predictions = []
        fold_metrics = []
        for train_rows, valid_rows in folds:
            if estimator is None:
                values = baseline(valid_rows)
            else:
                estimator.fit(matrix(train_rows), [row["target"] for row in train_rows])
                values = estimator.predict(matrix(valid_rows))
            validation_rows.extend(valid_rows)
            predictions.extend(values)
            fold_metrics.append(
                {
                    "train_through": max(row["period"] for row in train_rows),
                    "validation_months": sorted({row["period"] for row in valid_rows}),
                    **regime_metrics(valid_rows, values),
                }
            )
        overall = sliced(validation_rows, np.asarray(predictions))
        with mlflow.start_run(run_name=name) as run:
            mlflow.log_params(
                {
                    "seed": config["seed"],
                    "model": name,
                    "feature_contract": FEATURE_CONTRACT,
                    "params": str(estimator.get_params()) if estimator else "same-cut rule",
                }
            )
            mlflow.set_tags(
                {"dataset_sha256": source["dataset_sha256"], "code_revision": training_revision}
            )
            mlflow.log_metrics(
                {
                    "validation_mae": overall["overall"]["mae"],
                    "validation_rmse": overall["overall"]["rmse"],
                }
            )
            mlflow.log_dict(
                {"folds": fold_metrics, "metrics": overall, "recipe": recipe}, "validation.json"
            )
            comparisons[name] = {
                "run_id": run.info.run_id,
                "folds": fold_metrics,
                "metrics": overall,
            }
    winner = min(estimators, key=lambda name: comparisons[name]["metrics"]["overall"]["mae"])
    model = estimators[winner].fit(matrix(fitting), [row["target"] for row in fitting])
    args.output.mkdir(parents=True, exist_ok=True)
    skops.io.dump(model, args.output / "model.skops")
    with mlflow.start_run(run_id=comparisons[winner]["run_id"]):
        mlflow.log_artifact(str(args.output / "model.skops"))
    bands = comparisons[winner]["metrics"]
    evaluation_period = dict(
        test_months=frozen_test, fit_through=max(row["period"] for row in fitting)
    )
    reference_data = matrix(fitting)
    reference_predictions = model.predict(reference_data)
    references = {}
    for bucket in BUCKETS:
        indices = [i for i, row in enumerate(fitting) if row["bucket"] == bucket]
        references[bucket] = {
            name: distribution(reference_data[indices, i]) for i, name in enumerate(FEATURE_NAMES)
        } | {"prediction": distribution(reference_predictions[indices])}
    write_json(
        args.output / "training.json",
        {
            **source,
            **evaluation_period,
            "selected_model": winner,
            "comparisons": comparisons,
            "error_bands": {
                bucket: bands.get(bucket, bands["overall"])["median_absolute_error"]
                for bucket in BUCKETS
            },
            "references": references,
            "code_revision": training_revision,
            "recipe": recipe,
            "config_sha256": digest(args.config),
            "candidate_sha256": digest(args.output / "model.skops"),
        },
    )


if __name__ == "__main__":
    main()
