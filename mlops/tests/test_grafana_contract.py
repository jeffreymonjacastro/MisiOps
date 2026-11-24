"""Keep the local Grafana dashboard aligned with what the forecast monitor publishes (spec 014)."""

import json
import re
from pathlib import Path

import yaml
from core.forecast_features import BUCKETS, FEATURE_NAMES

ROOT = Path(__file__).resolve().parents[2]
MONITORING = ROOT / "mlops" / "monitoring"
GRAFANA = MONITORING / "grafana"
INFRA = (ROOT / "infra" / "lib" / "forecast-monitor.ts").read_text(encoding="utf-8")
MONITOR_JOB = (ROOT / "backend" / "core" / "monitor_job.py").read_text(encoding="utf-8")
SUMMARY = (ROOT / "backend" / "core" / "forecast_monitor.py").read_text(encoding="utf-8")
DASHBOARD = json.loads(
    (GRAFANA / "dashboards" / "forecast-monitoring.json").read_text(encoding="utf-8")
)
DATASOURCES = yaml.safe_load(
    (GRAFANA / "provisioning" / "datasources" / "cloudwatch.yml").read_text(encoding="utf-8")
)
COMPOSE = yaml.safe_load((MONITORING / "docker-compose.yml").read_text(encoding="utf-8"))


def targets():
    for panel in DASHBOARD["panels"]:
        for target in panel.get("targets", []):
            yield panel, target


def metric_targets():
    return [t for _, t in targets() if t.get("queryMode") == "Metrics"]


def logs_targets():
    return [t for _, t in targets() if t.get("queryMode") == "Logs"]


def test_dashboard_uses_every_published_metric_and_nothing_else():
    published = set(re.findall(r"\['\w+', '(\w+)', \d+\]", INFRA)) | set(
        re.findall(r"metricName: '(\w+)'", INFRA)
    )
    assert published == {"DriftDetected", "RetrainingRecommended", "MeanAbsoluteErrorPEN"}
    assert {t["metricName"] for t in metric_targets()} == published
    assert "metricNamespace: `MisiOps/Forecast/${environment}`" in INFRA
    for target in metric_targets():
        assert target["namespace"] == "MisiOps/Forecast/${env}"
        expected = {"Cutoff": ["*"]} if target["metricName"] == "MeanAbsoluteErrorPEN" else {}
        assert target["dimensions"] == expected
    assert "dimensions: { Cutoff: '$.bucket' }" in INFRA


def test_logs_queries_read_the_monitor_log_group_and_report_fields():
    assert "logGroupName: `/misiops/${environment}/forecast-monitor`" in INFRA
    assert '"event": "forecast_monitor"' in MONITOR_JOB
    assert logs_targets(), "the dashboard must read the monitor reports"
    report_keys = set(re.findall(r'"(\w+)":', SUMMARY)) | {"model_version", "labels_finalized"}
    for target in logs_targets():
        assert target["logGroupNames"] == ["/misiops/${env}/forecast-monitor"]
        expression = target["expression"]
        assert 'filter event = "forecast_monitor"' in expression
        assert re.search(r"\blimit 20\b", expression)
        for cutoff, key in re.findall(r"by_cutoff\.(\$cutoff|\w+)\.(\w+)", expression):
            assert cutoff in (*BUCKETS, "$cutoff")
            assert key in report_keys, key
        for feature in re.findall(r"input_drift\.(\w+)", expression):
            assert feature in FEATURE_NAMES
    drift = " ".join(t["expression"] for t in logs_targets() if "input_drift" in t["expression"])
    assert set(re.findall(r"input_drift\.(\w+)", drift)) == set(FEATURE_NAMES)


def test_panels_follow_the_environment_selector():
    variables = {v["name"]: v for v in DASHBOARD["templating"]["list"]}
    assert [o["value"] for o in variables["env"]["options"]] == ["dev", "prod"]
    assert [o["value"] for o in variables["cutoff"]["options"]] == list(BUCKETS)
    provisioned = {source["uid"] for source in DATASOURCES["datasources"]}
    assert provisioned == {"misiops-dev", "misiops-prod"}
    for panel, target in targets():
        for ref in (panel["datasource"], target["datasource"]):
            assert ref == {"type": "cloudwatch", "uid": "misiops-${env}"}


def test_alarm_panels_mirror_the_cloudwatch_alarm_rule():
    alarms = [p for p in DASHBOARD["panels"] if p["title"].endswith("alarm (last hour)")]
    assert {p["targets"][0]["metricName"] for p in alarms} == {
        "DriftDetected",
        "RetrainingRecommended",
    }
    assert "statistic: 'Maximum', period: Duration.hours(1)" in INFRA
    for panel in alarms:
        assert panel["timeFrom"] == "1h"
        assert panel["targets"][0]["statistic"] == "Maximum"
        assert panel["targets"][0]["period"] == "3600"
        steps = panel["fieldConfig"]["defaults"]["thresholds"]["steps"]
        assert steps[-1]["value"] == 1


def test_data_sources_assume_a_read_only_role_without_fallback():
    for source in DATASOURCES["datasources"]:
        data = source["jsonData"]
        assert source["type"] == "cloudwatch"
        assert source["editable"] is False
        assert data["authType"] == "default"
        assert data["defaultRegion"] == "us-east-1"
        assert re.fullmatch(r"\$\{GRAFANA_(DEV|PROD)_ROLE_ARN\}", data["assumeRoleArn"])
        assert "secureJsonData" not in source
    environment = COMPOSE["services"]["grafana"]["environment"]
    assert environment["GRAFANA_DEV_ROLE_ARN"].startswith("${GRAFANA_DEV_ROLE_ARN:?")
    assert re.fullmatch(
        r"\$\{GRAFANA_PROD_ROLE_ARN:-arn:aws:iam::000000000000:role/[\w-]+\}",
        environment["GRAFANA_PROD_ROLE_ARN"],
    )
    assert "ForecastDashboardRoleArn" in INFRA


def test_container_is_pinned_local_and_holds_no_secrets():
    service = COMPOSE["services"]["grafana"]
    assert re.fullmatch(r"grafana/grafana:\d+\.\d+\.\d+", service["image"])
    assert all(port.startswith("127.0.0.1:") for port in service["ports"])
    assert service["security_opt"] == ["no-new-privileges:true"]
    assert service["cap_drop"] == ["ALL"]
    environment = service["environment"]
    assert environment["GF_SECURITY_ADMIN_PASSWORD"].startswith("${GRAFANA_ADMIN_PASSWORD:?")
    assert environment["GF_AUTH_ANONYMOUS_ORG_ROLE"] == "Viewer"
    assert environment["GF_USERS_ALLOW_SIGN_UP"] == "false"
    aws = next(volume for volume in service["volumes"] if volume.endswith(":/aws:ro"))
    assert aws.startswith("${AWS_DIR:-")
    versioned = [MONITORING / "docker-compose.yml", MONITORING / ".env.example"]
    versioned += [path for path in GRAFANA.rglob("*") if path.is_file()]
    for path in versioned:
        text = path.read_text(encoding="utf-8")
        assert not re.search(r"AKIA[0-9A-Z]{16}|aws_secret_access_key", text), path
        assert not re.search(r"arn:aws:iam::(?!123456789012|000000000000)\d{12}", text), path
