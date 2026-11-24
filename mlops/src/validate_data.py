import argparse
from datetime import datetime
from pathlib import Path

from core.forecast_features import forecast_month, shift_month
from src.common import DATA, REPORTS, digest, read_json, read_records, write_json


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate(rows: list[dict]) -> dict:
    seen = set()
    months = set()
    users = set()
    for line, row in enumerate(rows, 1):
        try:
            identifier, user = row["id"], row["user_id"]
            require(type(identifier) is int and identifier > 0, "invalid transaction id")
            require(identifier not in seen, "duplicate transaction id")
            require(type(user) is int and user > 0, "invalid user id")
            require(row["kind"] in ("income", "expense"), "invalid transaction kind")
            require(row["currency"] == "PEN", "invalid currency")
            amount = row["amount_cents"]
            require(type(amount) is int and 0 < amount < 10**12, "invalid amount in cents")
            occurred = datetime.fromisoformat(row["occurred_at"])
            recorded = datetime.fromisoformat(row["recorded_at"])
            require(
                occurred.utcoffset() is not None and recorded.utcoffset() is not None,
                "timestamps require offsets",
            )
            require(occurred <= recorded, "recorded before occurrence")
        except (KeyError, ValueError, TypeError) as exc:
            raise ValueError(f"Row {line}: {exc}") from exc
        months.add(forecast_month(occurred)[0])
        seen.add(identifier)
        users.add(user)
    ordered = sorted(months)
    if len(ordered) < 12 or any(
        shift_month(a, 1) != b for a, b in zip(ordered, ordered[1:], strict=False)
    ):
        raise ValueError("At least 12 contiguous months are required")
    return {
        "rows": len(rows),
        "users": len(users),
        "months": [m.date().isoformat() for m in ordered],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DATA / "transactions.jsonl")
    parser.add_argument("--report", type=Path, default=REPORTS / "data-validation.json")
    args = parser.parse_args()
    try:
        provenance = read_json(args.input.with_suffix(".manifest.json"))
        if provenance["origin"] != "synthetic" or provenance["dataset_sha256"] != digest(
            args.input
        ):
            raise ValueError("Snapshot provenance or checksum mismatch")
        report = validate(read_records(args.input))
        if len(report["months"]) != provenance["months"] or report["users"] != provenance["users"]:
            raise ValueError("Snapshot coverage differs from its manifest")
    except (ValueError, KeyError, OSError) as exc:
        write_json(args.report, {"decision": "rejected", "reason": str(exc)})
        raise SystemExit(str(exc)) from exc
    write_json(
        args.report,
        {
            "decision": "accepted",
            **report,
            **{
                "dataset_sha256": provenance["dataset_sha256"],
            },
        },
    )


if __name__ == "__main__":
    main()
