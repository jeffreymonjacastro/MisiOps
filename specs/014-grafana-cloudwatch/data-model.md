# Data Model: Local Grafana View of Forecast Monitoring

No new persistent data. The dashboard reads entities that feature 013 already publishes.

## Monitor report (CloudWatch Logs, `event = "forecast_monitor"`)

| Field | Type | Notes |
| --- | --- | --- |
| `environment` | `dev` or `prod` | |
| `model_version` | string | First 16 characters of the model hash |
| `labels_finalized` | integer | Outcomes settled during this run |
| `window_start`, `window_end` | ISO timestamp | 120-day observation window |
| `by_cutoff.<cutoff>.decision` | `insufficient_sample`, `stable`, `investigate_drift` or `retrain_candidate` | `<cutoff>` is `early`, `middle` or `late` |
| `by_cutoff.<cutoff>.observations` | integer | One per owner, month and cutoff |
| `by_cutoff.<cutoff>.settled_observations` | integer | |
| `by_cutoff.<cutoff>.prediction_drift` | number or null | PSI |
| `by_cutoff.<cutoff>.input_drift.<feature>` | number or null | PSI for each of the 12 feature names |
| `by_cutoff.<cutoff>.mae`, `rmse`, `deficits`, `missed_deficits` | number or null | Present after settlement |

## Monitoring metrics (namespace `MisiOps/Forecast/<env>`)

| Metric | Dimensions | Source field | Alarm |
| --- | --- | --- | --- |
| `DriftDetected` | none | `forecast_metrics.drift` (0 or 1) | Maximum over 1 h ≥ 1 |
| `RetrainingRecommended` | none | `forecast_metrics.retrain` (0 or 1) | Maximum over 1 h ≥ 1 |
| `MeanAbsoluteErrorPEN` | `Cutoff` | `forecast_metrics.mae` | none |

## Grafana configuration entities

| Entity | Identifier | Validation |
| --- | --- | --- |
| Data source | `misiops-dev`, `misiops-prod` | Type `cloudwatch`, `authType: default`, `assumeRoleArn` from the environment, not editable |
| Dashboard | uid `misiops-forecast-monitoring` | Every panel uses data source uid `misiops-${env}` |
| Variable `env` | `dev`, `prod` | Default `dev` |
| Variable `cutoff` | `early`, `middle`, `late` | Default `early` |
