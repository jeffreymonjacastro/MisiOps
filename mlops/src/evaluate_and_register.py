import argparse
import shutil
from pathlib import Path

import mlflow
import skops.io
from core.forecast_features import BUCKETS, FEATURE_NAMES
from core.forecast_model import TRUSTED_TYPES, load_release
from src.common import (
    CONFIG,
    DATA,
    REPORTS,
    configure_tracking,
    digest,
    read_json,
    read_records,
    settings,
    write_json,
)
from src.train import baseline, matrix, sliced, split


def quality_gate(candidate, reference, config, champion=None):
    reasons = []
    if candidate["mae"] >= reference["mae"]:
        reasons.append("Candidate MAE must beat the historical baseline")
    if candidate["deficits"] < config["minimum_deficits"]:
        reasons.append("Insufficient held-out deficit observations")
    elif candidate["deficit_miss_rate"] > config["maximum_deficit_miss_rate"]:
        reasons.append("Candidate misses too many deficit outcomes")
    if champion is not None and candidate["mae"] >= champion["mae"]:
        reasons.append("Candidate MAE must beat the approved model on fresh periods")
    return {"decision": "rejected" if reasons else "accepted", "reasons": reasons}


def evaluate(args):
    config = settings(args.config)
    training = read_json(args.training / "training.json")
    artifact = args.training / "model.skops"
    if (
        training["prepared_sha256"] != digest(args.input)
        or training["config_sha256"] != digest(args.config)
        or training["candidate_sha256"] != digest(artifact)
    ):
        raise ValueError("Training inputs or candidate hash differ from evaluation")
    _, _, test = split(read_records(args.input), config)
    if sorted({row["period"] for row in test}) != training["test_months"]:
        raise ValueError("Test partitions do not match the frozen training metadata")
    model = skops.io.load(artifact, trusted=sorted(TRUSTED_TYPES))
    bands = training["error_bands"]
    candidate = sliced(test, model.predict(matrix(test)), bands)
    reference = sliced(test, baseline(test))
    champion = None
    comparison_note = "First release"
    if args.champion:
        manifest = read_json(args.champion / "manifest.json")
        if min(training["test_months"]) <= max(manifest["test_months"]):
            comparison_note = "No fresh common test periods after the approved release"
        else:
            approved = load_release(args.champion)
            champion = sliced(test, approved.estimator.predict(matrix(test)), approved.bands)
            comparison_note = f"Compared on fresh test data with {approved.version}"
    gate = quality_gate(
        candidate["overall"],
        reference["overall"],
        config,
        champion["overall"] if champion else None,
    )
    if args.champion and champion is None:
        gate = {"decision": "rejected", "reasons": [*gate["reasons"], comparison_note]}
    report = {
        "selected_model": training["selected_model"],
        "dataset_sha256": training["dataset_sha256"],
        "prepared_sha256": training["prepared_sha256"],
        "code_revision": training["code_revision"],
        "recipe": training["recipe"],
        "test_months": training["test_months"],
        "fit_through": training["fit_through"],
        "error_bands": bands,
        "validation": training["comparisons"],
        "holdout": {"candidate": candidate, "baseline": reference, "champion": champion},
        "champion_comparison": comparison_note,
        "gate": gate,
    }
    output = args.output
    evaluation = output / "evaluation.json"
    write_json(evaluation, report)
    card = output / "model-card.md"
    card.write_text(
        "# MisiOps month-end forecast\n\n"
        f"- Candidate: {training['selected_model']}\n"
        f"- Gate: {gate['decision']}\n"
        f"- Holdout months: {', '.join(training['test_months'])}\n"
        f"- Candidate MAE: PEN {candidate['overall']['mae']:.2f}\n"
        f"- Baseline MAE: PEN {reference['overall']['mae']:.2f}\n"
        f"- Deficits missed: {candidate['overall']['missed_deficits']} "
        f"of {candidate['overall']['deficits']}\n"
        f"- Reasons: {'; '.join(gate['reasons']) or 'All release metrics passed'}\n"
        f"- Dataset SHA-256: `{training['dataset_sha256']}`\n"
        f"- Candidate SHA-256: `{training['candidate_sha256']}`\n\n"
        "Predicts recorded PEN income minus expenses in a calendar month. "
        "Training and validation used synthetic profiles. "
        "Cutoff error bands describe validation error, not probability or interval coverage.\n",
        encoding="utf-8",
    )
    configure_tracking()
    run_id = training["comparisons"][training["selected_model"]]["run_id"]
    with mlflow.start_run(run_id=run_id):
        mlflow.log_metrics(
            {"test_mae": candidate["overall"]["mae"], "test_rmse": candidate["overall"]["rmse"]}
        )
        mlflow.set_tag("quality_gate", gate["decision"])
        mlflow.log_artifact(str(evaluation))
        mlflow.log_artifact(str(card))
    if gate["decision"] != "accepted":
        raise SystemExit("Model quality gate rejected candidate: " + "; ".join(gate["reasons"]))
    manifest = {
        "version": training["candidate_sha256"][:16],
        "model_sha256": training["candidate_sha256"],
        "evaluation_sha256": digest(evaluation),
        "model": training["selected_model"],
        "feature_contract": training["feature_contract"],
        "feature_names": list(FEATURE_NAMES),
        "dataset_sha256": training["dataset_sha256"],
        "code_revision": training["code_revision"],
        "mlflow_run_id": run_id,
        "error_bands": bands,
        "test_months": training["test_months"],
        "reference_mae": {
            bucket: candidate.get(bucket, candidate["overall"])["mae"] for bucket in BUCKETS
        },
        "references": training["references"],
    }
    release = output / "accepted"
    release.mkdir(exist_ok=True)
    shutil.copyfile(artifact, release / "model.skops")
    shutil.copyfile(evaluation, release / "evaluation.json")
    write_json(release / "manifest.json", manifest)
    approved = load_release(release)
    print(f"Accepted candidate {approved.version}: {card}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=CONFIG)
    parser.add_argument("--input", type=Path, default=DATA / "features.jsonl")
    parser.add_argument("--training", type=Path, default=REPORTS / "training")
    parser.add_argument("--output", type=Path, default=REPORTS / "evaluation")
    parser.add_argument("--champion", type=Path)
    evaluate(parser.parse_args())
