import argparse
from pathlib import Path

from core.forecast_model import load_release
from core.forecast_monitor import summarize
from simulation.monitor_scenarios import SCENARIOS, observations
from src.common import REPORTS, ROOT, write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", choices=SCENARIOS, default="steady")
    parser.add_argument("--release", type=Path, default=ROOT.parent / "backend/forecast_release")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    model = load_release(args.release)
    report = summarize(observations(model, args.scenario), model)
    output = args.output or REPORTS / f"monitor-{args.scenario}.json"
    write_json(output, report | {"environment": "synthetic", "scenario": args.scenario})
    print(args.scenario, {bucket: row["decision"] for bucket, row in report["by_cutoff"].items()})


if __name__ == "__main__":
    main()
