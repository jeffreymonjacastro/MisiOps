import hashlib
import json
import os
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "configs" / "forecast.yaml"
DATA = ROOT / "data"
REPORTS = ROOT / "reports"


def settings(path: Path = CONFIG) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(data, indent=2, sort_keys=True, allow_nan=False) + "\n").encode())


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_records(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def revision() -> str:
    return (
        os.getenv("GITHUB_SHA")
        or subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            text=True,
        ).strip()
    )


def configure_tracking() -> None:
    import mlflow

    path = ROOT / ".tracking"
    path.mkdir(exist_ok=True)
    mlflow.set_tracking_uri(
        os.getenv("MLFLOW_TRACKING_URI") or f"sqlite:///{(path / 'mlflow.db').as_posix()}"
    )
    experiment = "MisiOps month-end net"
    if mlflow.get_experiment_by_name(experiment) is None and not os.getenv("MLFLOW_TRACKING_URI"):
        mlflow.create_experiment(experiment, artifact_location=(path / "artifacts").as_uri())
    mlflow.set_experiment(experiment)
