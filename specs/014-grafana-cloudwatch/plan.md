# Implementation Plan: Local Grafana View of Forecast Monitoring

**Branch**: `feature/grafana-cloudwatch` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/014-grafana-cloudwatch/spec.md`

## Summary

Run Grafana locally with Docker Compose and read the forecast monitoring data that feature 013 already publishes to CloudWatch. Provision one CloudWatch data source per environment and one dashboard as versioned files. Each environment stack gets a read-only IAM role that Grafana assumes with the operator's local AWS CLI credentials. A contract test keeps the dashboard aligned with the CDK metric filters, log group and monitor log fields.

## Technical Context

**Language/Version**: TypeScript 5 (CDK), Python 3.12 (contract test), Grafana provisioning YAML and dashboard JSON
**Primary Dependencies**: `grafana/grafana:13.2.6` with its built-in CloudWatch data source, `aws-cdk-lib` (existing), `pyyaml` and `pytest` (existing in `mlops`)
**Storage**: A named Docker volume for Grafana state. Dashboards and data sources come from read-only provisioned files.
**Testing**: `pytest` in `mlops/tests` (contract test, run by the MLOps Tests job). `node --test` in `infra/test` (role and output). Manual check of the dashboard in a browser against `dev`.
**Target Platform**: Developer machine with Docker Desktop. AWS `us-east-1`.
**Project Type**: Local operations tool plus an infrastructure change.
**Performance Goals**: Panels render within 10 s for a 7-day range. The reference volume is 90 daily monitor runs (the log group keeps three months), that is 90 `forecast_monitor` events and 270 `forecast_metrics` events.
**Constraints**: Bind to `127.0.0.1` only. No credentials in the repository or image. Read-only cloud access through an assumed role. No change to the published metrics or the monitor logic.
**Scale/Scope**: One operator at a time, two environments, one dashboard with 9 panels.

## Constitution Check

| Gate | Status | Evidence |
| --- | --- | --- |
| Code Quality | PASS | Configuration as versioned provisioning files; no custom code in Grafana. |
| Testing Standards | PASS | New contract test (Python) and CDK assertions (TypeScript). Existing suites stay green. |
| User Experience Consistency | PASS | Panel titles reuse the monitor's decisions (`stable`, `investigate_drift`, `retrain_candidate`, `insufficient_sample`) and cutoffs (`early`, `middle`, `late`). |
| Performance | PASS | Logs Insights queries are limited to 20 rows and one log group; metric queries use a 1-hour period. |
| Security: no long-lived keys in repo or CI | PASS | Credentials are mounted read-only at runtime. `.env` is git-ignored; only `.env.example` is versioned. |
| Deployment Environments | PASS | The role is deployed by the existing MLOps pipeline. Nothing new is deployed to AWS outside it. |

Re-check after Phase 1: PASS. No violations, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/014-grafana-cloudwatch/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/dashboard-contract.md
├── checklists/
├── evaluations/eval-report.md
└── tasks.md
```

### Source Code (repository root)

```text
infra/
├── lib/forecast-monitor.ts                 # + ForecastDashboardRole and ForecastDashboardRoleArn output
└── test/environment-stack.test.ts          # + role and output assertions
mlops/
├── monitoring/
│   ├── docker-compose.yml                  # Grafana service, 127.0.0.1 only, hardened
│   ├── .env.example                        # Placeholders; the real .env is git-ignored
│   └── grafana/
│       ├── provisioning/datasources/cloudwatch.yml
│       ├── provisioning/dashboards/forecast.yml
│       └── dashboards/forecast-monitoring.json
├── tests/test_grafana_contract.py
└── README.md                               # + "Local Grafana" section
.gitignore                                  # + mlops/monitoring/.env
```

**Structure Decision**: Keep the tool under `mlops/monitoring/`, mirroring the optional `monitoring/` folder of Guide 12, and next to the existing MLflow Compose file. The IAM role lives beside the monitor it reads in `infra/lib/forecast-monitor.ts`.

## Design

1. **Role per environment (FR-008, NFR-003)**: `ForecastDashboardRole` is trusted by the account root principal, so any principal in the account with `sts:AssumeRole` permission can assume it. Maximum session is 1 hour. It allows:
   - `cloudwatch:GetMetricData` and `cloudwatch:ListMetrics` on `*` (CloudWatch metrics have no resource-level permissions);
   - `logs:StartQuery`, `logs:GetLogGroupFields` and `logs:GetLogEvents` on the monitor log group only;
   - `logs:DescribeLogGroups` (used by the data source health check), `logs:StopQuery` and `logs:GetQueryResults` on `*`. They have no resource-level scope; the IAM policy simulator denied `DescribeLogGroups` on a log-group ARN.

   Output `ForecastDashboardRoleArn`.
2. **Data sources (FR-002, FR-006, FR-008)**: `misiops-dev` and `misiops-prod`, `authType: default`, `defaultRegion: us-east-1`, and `assumeRoleArn` from `GRAFANA_DEV_ROLE_ARN` or `GRAFANA_PROD_ROLE_ARN`.
   - The dev variable is required by Compose.
   - The prod variable defaults to a non-existent role ARN, so an unconfigured prod fails its health check instead of using the operator's own permissions.
   - Both data sources are not editable in the UI.
3. **Dashboard (FR-003–FR-006)**: The dashboard has two variables: `env` (dev, prod) and `cutoff` (early, middle, late). Every panel's data source uid is `misiops-${env}`. Panels:
   - Drift alarm and Retraining alarm: `Maximum` with a 1-hour period over the last hour. This reproduces the alarm rule (≥ 1 → ALARM; missing data → OK).
   - Drift flag and Retraining flag for the latest run in the range.
   - MAE by cutoff, using the `Cutoff` dimension.
   - Flags over time.
   - Monitor reports: Logs Insights, the last 20 `forecast_monitor` events, with decision, observations and settled observations per cutoff.
   - Feature drift (PSI) for `$cutoff`: prediction drift and the 12 input drifts from the last 20 reports.
4. **Container (NFR-001, NFR-002, NFR-004)**:
   - Image `grafana/grafana:13.2.6`, port `127.0.0.1:${GRAFANA_PORT:-3001}:3000`.
   - `no-new-privileges`, all capabilities dropped.
   - `~/.aws` mounted read-only at `/aws`, with `AWS_SHARED_CREDENTIALS_FILE`, `AWS_CONFIG_FILE` and `AWS_PROFILE`.
   - Anonymous `Viewer` access in the main org (FR-010); sign-up disabled.
   - Admin password from `GRAFANA_ADMIN_PASSWORD`, required by Compose.
   - Analytics and update checks disabled.
5. **Contract test (FR-007)**: It parses `infra/lib/forecast-monitor.ts`, `backend/core/monitor_job.py`, `backend/core/forecast_monitor.py`, `backend/core/forecast_features.py` and the Grafana files. It asserts:
   - metric names, namespace, dimension and log group;
   - event names and report fields;
   - data source uids used by the dashboard;
   - the pinned image tag;
   - the localhost binding;
   - the absence of literal secrets in versioned Grafana files.

## Complexity Tracking

None.
