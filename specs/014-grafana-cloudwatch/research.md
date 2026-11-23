# Research: Local Grafana View of Forecast Monitoring

Context7 was not available in this session (the server needs authorization). Sources: the official Grafana CloudWatch documentation (configure, query editor, variables) and a local prototype of `grafana/grafana:13.2.6` queried through its HTTP API on 2026-11-23.

## R1 — Grafana version

- **Decision**: `grafana/grafana:13.2.6`.
- **Rationale**: Latest stable patch on Docker Hub (published 2026-11-10). The CloudWatch data source is built in, so no plugin is installed.
- **Alternatives considered**: `latest` (rejected by NFR-004), 12.4.x (older line).

## R2 — Authentication

- **Decision**: `authType: default` with `assumeRoleArn`, using the AWS SDK default chain over a read-only mount of `~/.aws`.
- **Rationale**:
  - Docs: with Assume Role, the "primary credentials only need permission to perform `sts:AssumeRole`".
  - `default,keys,credentials` are allowed by default, and `assume_role_enabled` defaults to true.
  - Prototype: `default` auth with the mounted folder passed the health check ("Successfully queried the CloudWatch metrics API" and "… logs API").
- **Alternatives considered**: Access keys in `.env` (stores long-lived keys locally in plain text and grants full user permissions). Amazon Managed Grafana (out of scope).

## R3 — Minimal permissions

- **Decision**: `GetMetricData` and `ListMetrics`; `DescribeLogGroups`, `StartQuery`, `StopQuery` and `GetQueryResults`; plus `GetLogGroupFields` and `GetLogEvents` for field discovery.
- **Rationale**: The docs list these as required (metrics) and required or optional (logs). Alarm permissions are only "needed if you display alarm data" through annotations. The dashboard reproduces the alarm rule from the metric instead, so they are omitted.
- **Alternatives considered**: AWS-managed `CloudWatchReadOnlyAccess` (broader than needed).

## R4 — Query formats (verified in the prototype)

- **Metric target**: `queryMode: "Metrics"`, `metricQueryType: 0`, `metricEditorMode: 0`, `namespace`, `metricName`, `dimensions` as `{ "Cutoff": ["*"] }`, `statistic`, `period`, `region: "default"`, `matchExact: true`.
  - The prototype executed `SEARCH('{"MisiOps/Forecast/dev","Cutoff"} MetricName="MeanAbsoluteErrorPEN"', 'Maximum', 3600)`.
  - A scalar `"*"` dimension value failed to parse; the array form works.
- **Logs target**: `queryMode: "Logs"`, `logGroupNames`, `expression` and `region`.
  - The front end turns a panel's `expression` into the `StartQuery`/`GetQueryResults` actions.
  - A direct `/api/ds/query` call needs `type: "logAction"`, `subtype: "StartQuery"` and `queryString`, which confirms the backend path and the log group access.

## R5 — Environment switch

- **Decision**: A custom `env` variable, with panel data source uid `misiops-${env}`.
- **Rationale**: Keeps namespace (`MisiOps/Forecast/${env}`), log group (`/misiops/${env}/forecast-monitor`) and data source on one selector. The docs do not cover variable interpolation in a data source uid. It must be verified in a browser (task T012).
- **Fallback**: If interpolation fails, use a `datasource` variable named `env` whose data source names are `dev` and `prod`, and reference `${env:text}` in queries.

## R6 — Alarm state panel

- **Decision**: Stat panels with a relative time of `1h`, `Maximum` with a 3600 s period, threshold 1, and the value mappings 0 → OK and ≥ 1 → ALARM. No value shows OK.
- **Rationale**: This reproduces the alarm definition in `infra/lib/forecast-monitor.ts`: Maximum over one hour, threshold 1, one evaluation period, missing data not breaching. It needs no alarm permissions.

## R7 — Container hardening

- **Decision**: `security_opt: no-new-privileges:true`, `cap_drop: [ALL]`, port bound to `127.0.0.1`, a named volume for `/var/lib/grafana`, provisioning and dashboards mounted read-only.
- **Rationale**: Matches the Semgrep docker-compose rules used by DevSecOps (`no-new-privileges`, no privileged mode) and NFR-001.
- **Alternatives considered**: `read_only: true` root filesystem. Grafana 13 writes under `/var/lib/grafana` and `/tmp`; adopt it if the prototype runs with a `tmpfs` at `/tmp`.
