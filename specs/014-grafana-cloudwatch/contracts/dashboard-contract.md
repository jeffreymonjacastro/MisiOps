# Contract: Dashboard ↔ Infrastructure ↔ Monitor

`mlops/tests/test_grafana_contract.py` enforces this contract (FR-007).

| Item | Producer | Consumer | Rule |
| --- | --- | --- | --- |
| Namespace | `infra/lib/forecast-monitor.ts` (`MisiOps/Forecast/${environment}`) | Dashboard metric targets | `MisiOps/Forecast/${env}` |
| Metric names | Metric filters `DriftDetected`, `RetrainingRecommended`, `MeanAbsoluteErrorPEN` | Dashboard metric targets | Every dashboard metric name is published; every published metric is used |
| Dimension | `Cutoff` on `MeanAbsoluteErrorPEN` | MAE panel | Same key |
| Log group | `/misiops/${environment}/forecast-monitor` | Logs Insights targets | `/misiops/${env}/forecast-monitor` |
| Events | `backend/core/monitor_job.py` prints `forecast_monitor` and `forecast_metrics` | Logs queries filter `event = "forecast_monitor"` | Event name exists in the monitor |
| Report fields | `summarize()` keys and `FEATURE_NAMES` | Logs Insights field lists | Every `by_cutoff.*` field queried exists |
| Data source uids | `provisioning/datasources/cloudwatch.yml` | Dashboard panels and targets | `misiops-${env}`, with `misiops-dev` and `misiops-prod` provisioned |
| Role output | `ForecastDashboardRoleArn` stack output | Operator's `.env` (`GRAFANA_<ENV>_ROLE_ARN`) | Output exists in both environment stacks |

## Role permissions (infrastructure test)

- **Allowed actions**: `cloudwatch:GetMetricData`, `cloudwatch:ListMetrics`, `logs:DescribeLogGroups`, `logs:StartQuery`, `logs:StopQuery`, `logs:GetQueryResults`, `logs:GetLogGroupFields`, `logs:GetLogEvents`.
- **Not allowed**: `Put*`, `Delete*`, `Create*` or `Update*` actions, and no `*` action.
- **Trust**: The account root principal, with `sts:AssumeRole`.
