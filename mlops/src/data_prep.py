import argparse
import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from core.forecast_features import (
    FEATURE_CONTRACT,
    LABEL_GRACE,
    Movement,
    build_features,
    cutoff_bucket,
    forecast_month,
)
from src.common import (
    CONFIG,
    DATA,
    REPORTS,
    digest,
    read_json,
    read_records,
    settings,
    write_json,
)


def prepare(rows: list[dict], cutoff_days: list[int]):
    by_user = defaultdict(list)
    months = set()
    for row in rows:
        occurred = datetime.fromisoformat(row["occurred_at"])
        recorded = datetime.fromisoformat(row["recorded_at"])
        by_user[row["user_id"]].append(
            Movement(occurred, recorded, row["kind"], row["amount_cents"])
        )
        months.add(forecast_month(occurred)[0])
    for owner, movements in sorted(by_user.items()):
        for period in sorted(months):
            _, end = forecast_month(period)
            available = end + LABEL_GRACE
            target = (
                sum(
                    row.cents if row.kind == "income" else -row.cents
                    for row in movements
                    if period <= row.occurred_at < end and row.recorded_at < available
                )
                / 100
            )
            for day in cutoff_days:
                cutoff = period + timedelta(days=day, microseconds=-1)
                if cutoff >= end:
                    continue
                features = build_features(movements, cutoff)
                if features is not None:
                    yield {
                        "user_id": owner,
                        "period": period.date().isoformat(),
                        "cutoff": cutoff.isoformat(),
                        "bucket": cutoff_bucket(cutoff),
                        "label_available_at": available.isoformat(),
                        "features": features,
                        "target": target,
                    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=CONFIG)
    parser.add_argument("--input", type=Path, default=DATA / "transactions.jsonl")
    parser.add_argument("--validation", type=Path, default=REPORTS / "data-validation.json")
    parser.add_argument("--output", type=Path, default=DATA / "features.jsonl")
    args = parser.parse_args()
    report = read_json(args.validation)
    if report["decision"] != "accepted" or report["dataset_sha256"] != digest(args.input):
        raise SystemExit("Run the data gate on the exact snapshot first")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as file:
        for row in prepare(read_records(args.input), settings(args.config)["cutoff_days"]):
            file.write((json.dumps(row, separators=(",", ":"), allow_nan=False) + "\n").encode())
    write_json(
        args.output.with_suffix(".manifest.json"),
        {
            "dataset_sha256": report["dataset_sha256"],
            "prepared_sha256": digest(args.output),
            "feature_contract": FEATURE_CONTRACT,
        },
    )


if __name__ == "__main__":
    main()
