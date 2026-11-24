from pathlib import Path

import yaml

WORKFLOWS = Path(__file__).resolve().parents[2] / ".github" / "workflows"


def test_guide_12_workflow_graph():
    workflow = yaml.safe_load((WORKFLOWS / "mlops.yml").read_text(encoding="utf-8"))
    jobs = workflow["jobs"]
    chain = {
        "tests": "Tests",
        "data-validation": "Data Validation",
        "data-preparation": "Data Preparation",
        "modeling": "Modeling",
        "evaluation": "Evaluation",
        "smoke-test": "Smoke Test",
        "build-and-publish": "Build and Publish",
        "deploy-staging": "Deploy · Staging",
        "deploy-production": "Deploy · Production",
    }
    assert {key: job["name"] for key, job in jobs.items()} == chain
    for current, previous in zip(list(chain)[1:7], list(chain)[:6], strict=True):
        assert jobs[current]["needs"] == previous
    for job, branch, environment in [
        ("deploy-staging", "develop", "dev"),
        ("deploy-production", "main", "prod"),
    ]:
        assert jobs[job]["needs"] == "build-and-publish"
        assert jobs[job]["environment"] == environment
        assert f"github.ref == 'refs/heads/{branch}'" in jobs[job]["if"]
    assert "github.event_name == 'push'" in jobs["deploy-production"]["if"]
    training = next(
        step for step in jobs["modeling"]["steps"] if "src.train" in step.get("run", "")
    )
    assert training["if"] == "github.event_name == 'workflow_dispatch'"
    assert "refs/heads/develop" in jobs["data-validation"]["if"]
    security = yaml.safe_load((WORKFLOWS / "devsecops.yml").read_text(encoding="utf-8"))
    assert "deploy" not in security["jobs"]
