# Feature Specification: Local Grafana View of Forecast Monitoring

**Feature Branch**: `feature/grafana-cloudwatch`
**Created**: 2026-11-23
**Status**: Approved for implementation on 2026-11-23
**Input**: Implement and integrate a local Grafana instance, run with Docker, that connects to CloudWatch so the month-end forecast monitoring state can be reviewed without opening the AWS console.

## Clarifications

### Session 2026-11-23

- Q: Which credentials should the local dashboard use to read cloud monitoring data? → A: A dedicated read-only role per environment, defined in the infrastructure code and assumed with the operator's local CLI credentials. It requires redeploying the environment.
- Q: Should the drift and retraining flags be split per cutoff? → A: No. Keep the published metrics aggregated and show per-cutoff decisions from the monitor reports.
- Q: How should people access the local dashboard? → A: Anonymous read-only viewing on the local machine. Administration requires a sign-in with a password from an untracked local file.

## User Scenarios & Testing

Feature 013 publishes the month-end forecast monitor results to the cloud monitoring service: a daily aggregate report, drift and retraining flags, mean absolute error by month cutoff, and two alarms. Today an ML operator has to open several pages of the AWS console to read them. The goal is one local dashboard that shows the model's monitoring state at a glance and can be shown during the course demonstration.

### User Story 1 - See the model monitoring state at a glance (Priority: P1)

An ML operator starts the local dashboard with one command and opens it in a browser. For the selected environment, the dashboard shows whether drift was detected, whether retraining is recommended, the mean absolute error by cutoff and the state of the two forecast alarms.

**Why this priority**: This replaces the manual console navigation, which is the reason for the feature.

**Independent Test**: Start the dashboard with valid read-only cloud credentials and open it. The data source health check passes and every panel either shows values or states that no data exists for the selected time range.

**Acceptance Scenarios**:

1. **Given** valid read-only credentials and at least one completed monitor run, **When** the operator opens the dashboard for `dev`, **Then** it shows the drift flag, the retraining flag and the mean absolute error by cutoff for the chosen time range.
2. **Given** the monitor has not run yet, **When** the operator opens the dashboard, **Then** each panel shows that no data is available instead of an error.
3. **Given** the forecast alarms exist, **When** the operator opens the dashboard, **Then** the current state of the drift and retraining alarms is visible.

---

### User Story 2 - Inspect the latest monitor report (Priority: P2)

The operator reads the latest aggregate monitor reports in the same dashboard: model version, decision per cutoff, number of observations and settled observations, and the drift index per feature.

**Why this priority**: The flags say that something changed. The report says which cutoff and which feature changed, and whether the sample was large enough.

**Independent Test**: With at least one monitor report in the selected range, the dashboard lists it with its decision per cutoff, including `insufficient_sample`.

**Acceptance Scenarios**:

1. **Given** a report with `insufficient_sample`, **When** the operator opens the report panel, **Then** the decision and the observation counts for each cutoff are visible.
2. **Given** a report with drift indices, **When** the operator opens the report panel, **Then** the drift index per feature and the prediction drift are visible for each cutoff.

---

### User Story 3 - Switch between environments (Priority: P3)

The operator selects `dev` or `prod` in the dashboard, and every panel reads the monitoring data of the selected environment.

**Why this priority**: The same view should serve staging now and production after promotion.

**Independent Test**: Switch the environment selector and confirm that every panel query uses the selected environment's metric namespace, log group and alarms.

**Acceptance Scenarios**:

1. **Given** `prod` has no monitoring data yet, **When** the operator selects `prod`, **Then** the panels show that no data is available.

### Edge Cases

- Credentials are missing, expired or lack permission: the data source health check fails with the provider's message, and no panel shows stale values as current.
- The local port is already in use: the operator can choose another host port through configuration without editing provisioned files.
- The dashboard is edited in the browser: provisioned files remain the source of truth, so a restart restores the versioned dashboard.
- A month cutoff has no observations: its panel shows no data rather than zero.

## Requirements

### Functional Requirements

- **FR-001**: Operators MUST be able to start and stop the local dashboard with one documented command each, with no manual steps in the dashboard user interface.
- **FR-002**: The data source, its connection settings and the dashboard MUST be defined as versioned files and loaded at startup.
- **FR-003**: The dashboard MUST show, for the selected environment and time range, the drift flag, the retraining flag and the mean absolute error for each cutoff (early, middle, late).
- **FR-004**: The dashboard MUST show the current state of the forecast drift and retraining alarms of the selected environment.
- **FR-005**: The dashboard MUST list the recent aggregate monitor reports with model version, decision, observation counts and drift indices per cutoff.
- **FR-006**: The dashboard MUST offer an environment selector with `dev` and `prod`, and every query MUST follow it.
- **FR-007**: The metric names, namespace and log group used by the dashboard MUST match those that the infrastructure definition publishes. An automated test MUST fail when they diverge.
- **FR-008**: Each environment's infrastructure MUST define a dedicated read-only role for the dashboard and publish its identifier. The dashboard MUST read cloud data only by assuming that role, using the operator's local cloud CLI credentials as the source identity. If the role of an environment is not configured, that environment MUST fail its health check instead of falling back to the operator's own permissions.
- **FR-009**: The drift and retraining flags MUST be shown aggregated across cutoffs, as published today. The per-cutoff decisions MUST come from the monitor reports (FR-005). The published metrics MUST NOT change.
- **FR-010**: The local dashboard MUST open read-only without sign-in. Administration MUST require a sign-in whose password comes from an untracked local file.

### Non-Functional Requirements

- **NFR-001**: The local dashboard MUST be reachable only from the operator's machine.
- **NFR-002**: No credentials, keys or passwords MUST be stored in the repository or in the container image. Cloud credentials MUST be mounted read-only at runtime.
- **NFR-003**: Cloud permissions used by the dashboard MUST be read-only and limited to the monitoring metrics, alarms and the forecast monitor logs.
- **NFR-004**: Third-party images MUST be pinned to an explicit version.
- **NFR-005**: After startup, the dashboard MUST render its panels within 10 seconds for a 7-day range on the monitoring data volume of the PoC.

### Key Entities

- **Monitor report**: Aggregate record written by the daily forecast monitor: environment, model version, time window and, per cutoff, decision, observations, settled observations, drift indices and error metrics.
- **Monitoring metric**: Numeric series derived from the reports: drift flag, retraining flag and mean absolute error by cutoff.
- **Forecast alarm**: Alarm state for drift and for recommended retraining.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An operator goes from a clean checkout to a populated dashboard in under 5 minutes using only the documented steps.
- **SC-002**: All monitoring signals listed in FR-003 to FR-005 are visible on one screen without opening the cloud console.
- **SC-003**: Zero secrets are present in the repository changes, as confirmed by the existing secret scans.
- **SC-004**: The automated contract test catches any rename of a published metric, namespace or log group.

## Assumptions

- The `dev` environment from feature 013 already publishes the monitor logs, metrics and alarms. The first scheduled monitor run may not have happened yet, so empty panels are expected until it does.
- The operator has the cloud command-line tools configured for the MisiOps account in `us-east-1`.
- The dashboard runs only on a developer machine with Docker. It is a local tool and is not deployed to `dev` or `prod`.
- Prometheus is not needed, because the dashboard reads the cloud monitoring service directly.

## Out of Scope

- Deploying Grafana to AWS, Amazon Managed Grafana or Grafana Cloud.
- Prometheus, Pushgateway or new application metrics.
- Changing the monitor's drift, error or decision logic.
- Alert notification channels configured in Grafana. Alarms remain in CloudWatch.
- Dashboards for application, database or infrastructure health outside forecast monitoring.
