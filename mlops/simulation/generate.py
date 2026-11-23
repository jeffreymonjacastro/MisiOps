"""Generate synthetic movements with an independent occurrence and registration clock."""

import argparse
import json
import random
from calendar import monthrange
from datetime import datetime, timedelta
from pathlib import Path

from core.forecast_features import LIMA, shift_month
from src.common import CONFIG, DATA, digest, settings, write_json

GENERATOR_VERSION = 2


def simulate(config: dict):
    first = datetime.fromisoformat(config["first_month"]).replace(tzinfo=LIMA)
    for user in range(1, config["users"] + 1):
        rng = random.Random(f"{config['seed']}:{user}")
        income = rng.uniform(1800, 7200)
        salaried = rng.random() < 0.70
        subscription_day = rng.randint(17, 26)
        salary_day = rng.choice([1, 15, 26, 28])
        spending_ratio = rng.uniform(0.67, 1.20)
        for index in range(config["months"]):
            month = shift_month(first, index)
            days = monthrange(month.year, month.month)[1]
            recurring = income * spending_ratio
            movements = [
                (rng.randint(1, 4), "expense", recurring * rng.uniform(0.31, 0.35)),
                (subscription_day, "expense", recurring * rng.uniform(0.20, 0.27)),
            ]
            earnings = income * (rng.uniform(0.96, 1.04) if salaried else rng.uniform(0.65, 1.35))
            if salaried:
                movements.append((salary_day, "income", earnings))
            else:
                share = rng.uniform(0.25, 0.65)
                movements.extend(
                    [
                        (rng.randint(1, 12), "income", earnings * share),
                        (rng.randint(16, 28), "income", earnings * (1 - share)),
                    ]
                )
            if month.month in (7, 12) and salaried:
                movements.append((15, "income", earnings * rng.uniform(0.4, 0.9)))
            for day in rng.sample(range(1, days + 1), rng.randint(13, 22)):
                movements.append((day, "expense", recurring * rng.uniform(0.012, 0.034)))
            if rng.random() < 0.20:
                movements.append(
                    (rng.randint(1, days), "expense", recurring * rng.uniform(0.09, 0.37))
                )
            for position, (day, kind, amount) in enumerate(sorted(movements)):
                identifier = user * 10**8 + index * 100 + position
                occurred = month.replace(day=day, hour=rng.randint(8, 20))
                delay = rng.choices([0, 1, 3, 10], weights=[85, 9, 5, 1])[0]
                recorded = occurred + timedelta(days=delay, minutes=rng.randint(1, 120))
                yield {
                    "id": identifier,
                    "user_id": user,
                    "kind": kind,
                    "amount_cents": max(1, round(amount * 100)),
                    "currency": "PEN",
                    "occurred_at": occurred.isoformat(),
                    "recorded_at": recorded.isoformat(),
                }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=CONFIG)
    parser.add_argument("--output", type=Path, default=DATA / "transactions.jsonl")
    parser.add_argument("--months", type=int)
    args = parser.parse_args()
    config = settings(args.config)
    if args.months is not None:
        config["months"] = args.months
    if not 12 <= config["months"] <= 120:
        parser.error("simulate between 12 and 120 months")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as file:
        for row in simulate(config):
            file.write((json.dumps(row, separators=(",", ":")) + "\n").encode())
    write_json(
        args.output.with_suffix(".manifest.json"),
        {
            "origin": "synthetic",
            "generator_version": GENERATOR_VERSION,
            "seed": config["seed"],
            "users": config["users"],
            "months": config["months"],
            "first_month": config["first_month"],
            "dataset_sha256": digest(args.output),
        },
    )


if __name__ == "__main__":
    main()
