# Tasks: Local Grafana View of Forecast Monitoring

**Input**: [specification](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [contract](contracts/dashboard-contract.md), [quickstart](quickstart.md).

Task IDs use the 14 prefix to distinguish them from other features' tasks and repository issues.

## Phase 1: Setup

- [X] T1401 Ignore the local secrets file `mlops/monitoring/.env` (already covered by the root `.gitignore` rule `.env`, verified with `git check-ignore`). Add `mlops/monitoring/.env.example` with placeholders for `GRAFANA_ADMIN_PASSWORD`, `GRAFANA_DEV_ROLE_ARN`, `GRAFANA_PROD_ROLE_ARN`, `GRAFANA_PORT`, `AWS_PROFILE` and `AWS_DIR`. (NFR-002, FR-010)

## Phase 2: Foundation

- [X] T1402 Write the contract test `mlops/tests/test_grafana_contract.py` first. It must fail until the Grafana files exist. It covers the metric names, namespace, `Cutoff` dimension and log group from `infra/lib/forecast-monitor.ts`; the event names and report fields from the backend monitor; the data source uids; the pinned image; the localhost binding; and the absence of literal secrets. (FR-007, NFR-001, NFR-002, NFR-004)
- [X] T1403 Add `ForecastDashboardRole` and the `ForecastDashboardRoleArn` output in `infra/lib/forecast-monitor.ts`. Add assertions in `infra/test/environment-stack.test.ts` for the allowed read-only actions, the log group scope, the trust policy and the 1-hour session, in both `dev` and `prod`. (FR-008, NFR-003)

## Phase 3: User Story 1 - See the model monitoring state at a glance (P1)

**Independent verification**: Start Compose with valid credentials, pass Save & test on `misiops-dev` and open the dashboard. Every panel shows values or "No data".

- [X] T1404 [US1] Add `mlops/monitoring/docker-compose.yml`. It runs `grafana/grafana:13.2.6` on `127.0.0.1:${GRAFANA_PORT:-3001}`, with `no-new-privileges`, all capabilities dropped, a named data volume, read-only mounts for provisioning, dashboards and `~/.aws`, anonymous Viewer access, sign-up disabled, a required admin password, and analytics and update checks disabled. (FR-001, FR-010, NFR-001, NFR-002, NFR-004)
- [X] T1405 [US1] Provision the `misiops-dev` and `misiops-prod` CloudWatch data sources in `mlops/monitoring/grafana/provisioning/datasources/cloudwatch.yml`. They use `authType: default`, `assumeRoleArn` from the environment and `defaultRegion: us-east-1`, and are not editable. The prod role defaults to a non-existent ARN. Add the dashboard provider in `provisioning/dashboards/forecast.yml`. (FR-002, FR-008)
- [X] T1406 [US1] Create `mlops/monitoring/grafana/dashboards/forecast-monitoring.json` with the alarm panels (last hour, Maximum, threshold 1, OK/ALARM mappings), the latest-run flag panels, MAE by cutoff and the flags over time. (FR-003, FR-004, FR-009)

## Phase 4: User Story 2 - Inspect the latest monitor report (P2)

**Independent verification**: With a report in range, the reports table lists its decision per cutoff and the PSI table lists the feature drifts for the selected cutoff.

- [X] T1407 [US2] Add the "Monitor reports" Logs Insights table (last 20 `forecast_monitor` events, with decision, observations and settled observations per cutoff). Add the "Feature drift (PSI) — $cutoff" table (prediction drift and 12 input drifts) with the `cutoff` variable. (FR-005)

## Phase 5: User Story 3 - Switch between environments (P3)

**Independent verification**: Switching `env` changes the data source, namespace and log group of every panel.

- [X] T1408 [US3] Add the `env` variable (`dev`, `prod`) and use data source uid `misiops-${env}`, namespace `MisiOps/Forecast/${env}` and log group `/misiops/${env}/forecast-monitor` in every panel. Use the R5 fallback if interpolation fails in the browser. (FR-006)

## Phase 6: Polish and verification

- [X] T1409 Document starting, configuring, stopping and troubleshooting the dashboard in `mlops/README.md`. Update the quickstart if commands change. (FR-001, SC-001)
- [X] T1410 Run `uv run --locked pytest -q` in `mlops/` and `pnpm test` in `infra/`. Run `docker compose config` with the example file, and validate the role policy with the IAM policy simulator. Start the stack locally and verify the dashboard in a browser with real CloudWatch data in read-only mode. (SC-001–SC-004, NFR-005)

## Phase 7: Post-merge verification (converge)

- [ ] T1411 After the merge to `develop` deploys `MisiOps-dev`, fill `GRAFANA_DEV_ROLE_ARN` from `ForecastDashboardRoleArn`, pass Save & test through the assumed role and capture the dashboard once a monitor report exists, and time the 7-day render against NFR-005 (not measured with data yet). This needs the deployed role and cannot run before the merge. (FR-008, SC-001)

## Verification evidence (2026-11-23)

- `mlops`: `uv run --locked pytest -q` → 13 passed, including the 6 contract tests (written first; they failed until the Grafana files existed).
- `infra`: `pnpm test` → 24 passed, including the dashboard role test for `dev` and `prod`. `tsc --noEmit` is clean.
- `docker compose config` passes with values and stops with the documented message when `GRAFANA_DEV_ROLE_ARN` is missing.
- IAM policy simulator, on the synthesized dev policy: metric reads, Logs Insights on the monitor log group and `DescribeLogGroups` on `*` are allowed. `StartQuery` on another log group, `PutMetricData`, `PutLogEvents`, `DeleteLogGroup` and `DeleteAlarms` are implicitly denied. `DescribeLogGroups` on a log-group ARN was denied, so it moved to `*`.
- Local run of `grafana/grafana:13.2.6` (temporary override without the role, real `dev` account, read-only queries):
  - `misiops-dev` passed Save & test for metrics and logs.
  - `misiops-prod` failed with `AccessDenied` on `sts:AssumeRole` (no fallback).
  - The dashboard loaded anonymously.
  - `misiops-${env}` interpolation worked, so the R5 fallback was not needed.
  - All 8 metric and logs requests returned HTTP 200 and the panels showed the "no data" states.

## Dependencies

- T1401 → T1404.
- T1402 precedes T1404–T1408 (test first).
- T1403 is independent of T1404–T1408.
- T1405 → T1406 → T1407 → T1408.
- T1409 and T1410 come last.
