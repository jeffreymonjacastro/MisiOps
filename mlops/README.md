# MisiOps month-end forecast

This proof of concept estimates the income minus expenses recorded for a calendar month in PEN and America/Lima. The dashboard displays the signed estimate and the date of the data used. When the absolute estimate is within the error band, it shows **Cierre ajustado**. Above and below the band it shows **Superávit esperado** and **Déficit esperado**, respectively.

All model evidence here comes from synthetic activity. The initial Random Forest release was assessed on January–June 2026 in the simulator. Its MAE was PEN 509.12 versus PEN 621.89 for the historical rule. The status missed 467 of 772 deficit observations. A tight close counts as a miss if the observed net was negative. Assess real-user forecasts separately before relying on them.

## Run the demo

Run the existing local application with Docker Compose and its usual development credential files. The backend image includes the pinned synthetic model. On PowerShell, start the application and load a synthetic demo ledger as follows. Use an unused demo address and choose a temporary password.

```powershell
docker compose -f docker/docker-compose.yaml up --build -d
$forecastDemoPassword = [guid]::NewGuid().ToString("N")
Get-Content -Raw mlops/simulation/demo.py | docker compose -f docker/docker-compose.yaml exec -T -e FORECAST_DEMO_KEEP=1 -e FORECAST_DEMO_EMAIL=forecast-demo@example.com -e "FORECAST_DEMO_PASSWORD=$forecastDemoPassword" backend python -
```

Open the app at [localhost:3000](http://localhost:3000) and sign in with the demo credentials. The seed also checks API versus offline prediction parity and measures warm API latency. Leave out the environment arguments to use a disposable account that is removed after verification. The seed connects to the local backend and should only be used on a development database.

## Run the six phases locally

Run the following from the repository root. Start the tracking container to save runs in a persistent volume and view them at [localhost:5000](http://localhost:5000). If the port is already used, change the host port in the Compose mapping and in `MLFLOW_TRACKING_URI`. Without a tracking URI, the scripts use a persistent SQLite store and artifact directory at `mlops/.tracking/`.

```powershell
docker compose -f mlops/docker-compose.yml up --build -d
Set-Location mlops
$env:MLFLOW_TRACKING_URI = 'http://127.0.0.1:5000'
$env:PYTHONPATH = '../backend'
$env:PYTHONUTF8 = '1'
uv sync --locked
uv run --locked python -m simulation.generate
uv run --locked python -m src.validate_data
uv run --locked python -m src.data_prep
uv run --locked python -m src.train
uv run --locked python -m src.evaluate_and_register
uv run --locked pytest -q
```

The configuration uses 80 synthetic users and 42 months by default. All generation and demo seeding lives in `simulation/`. The simulator has an independent seeded stream per user, allowing later months to be appended without changing previous transactions. Raw snapshots and reports stay out of Git. The snapshot and prepared files are linked by SHA-256.

The initial bundle was trained from the implementation working tree. Its revision identifies the Git base at training time and its recipe records the contributing source checksums. GitHub Actions runs record the checked-out revision.

Subsequent promotions must compare against the approved release on fresh months. For the initial release, use at least 48 months and pass `--champion ../backend/forecast_release` to evaluation. A failed gate stops the candidate run and leaves the deployed bundle intact. Inspect every candidate and the baseline in MLflow, together with the independent evaluation and model card. [CRISP-ML(Q) decisions and controls](docs/crisp-mlq.md).

## Staging and production

| Path | Trigger | Evidence |
| --- | --- | --- |
| PR | To `develop` or `main` | MLOps Tests plus the regular DevSecOps PR checks, without AWS credentials |
| Staging training | Manually run `MLOps Pipeline - Month-End Forecast` on `develop` | Train and evaluate a synthetic candidate. The `deploy_candidate` input controls whether an accepted candidate is deployed to staging. Monitoring requests training only. |
| Staging deployment | Push to `develop` or manually qualify a candidate with staging enabled | The pipeline checks and deploys the exact images built in Smoke Test to `dev`. A successful API smoke test uploads a staging receipt. |
| Production | Push to `main`, using environment `prod` | Verify the pinned model against a matching staging receipt, enforce shared security gates, and wait for the production reviewer. Production performs no training. |

To promote an accepted candidate, review its report and commit the three files from `reports/evaluation/accepted/` to `backend/forecast_release/` through a PR to `develop`. Only this small synthetic model and its aggregate evidence are versioned. The application checks the manifest, evaluation checksum, model checksum, feature contract and allowed estimator types before serving. MLflow remains independent of serving.

The first `develop` push can deploy the pinned model. GitHub enables manual dispatch after the workflow exists on the default branch. A rejected candidate stops its run before packaging.

The nine job names match Guide 12. The graph is Tests → Data Validation → Data Preparation → Modeling → Evaluation → Smoke Test → Build and Publish, followed by Deploy · Staging and Deploy · Production. The workflow runs its own checks using the same security actions as DevSecOps. Only MLOps deploys to AWS.

The existing CDK, ECR, CloudFront, ALB, ECS and Aurora stacks are reused. The deployment job inherits the push ref, which lets GitHub apply the existing staging and production branch rules. A failed startup with a bad bundle trips ECS readiness. For a quality rollback, restore the three files from a prior accepted version via the normal PR and release flow. If the prior staging receipt expired, verify that version again in staging before promoting it.

## Monitor and maintain

From `mlops/`, with `PYTHONPATH=../backend`, run `uv run --locked python -m src.monitor --scenario <name>`:

| Scenario | Expected result |
| --- | --- |
| `steady` | Comparable feature and prediction distributions |
| `input_shift` | Investigate drift, with no observed error for unsettled labels |
| `degraded_close` | Observed error exceeds the reference and recommends a new candidate |

ECS runs a daily task per environment at 07:25 Lima time. It uses a restricted database login. It measures aggregate input and prediction drift, and calculates MAE, RMSE, missed deficits and counts after the label settles seven days after month end. Report comparisons are per model version and time-of-month bucket. At most one prediction per owner, month and bucket enters each report. A small cohort is insufficient evidence. Observations live in Aurora and are deleted on account deletion. CloudWatch receives aggregates only.

The first monitoring run after settlement freezes available outcomes. A deletion or edit before that run can change the observed outcome. An owner-month with unknown creation timestamps is excluded from maturity metrics. Full replay of earlier real edits requires a historical event log, which is outside this synthetic PoC.

View the reports under `/misiops/<environment>/forecast-monitor` in CloudWatch Logs and the drift and retraining alarms under the matching forecast namespace. The cloud monitors and alarms use CloudWatch. [Local Grafana](#local-grafana) shows the same data in one dashboard; Prometheus is not used. The GitHub workflow also offers scheduled synthetic verification, and its manual mode can request a new synthetic candidate from a qualifying staging run with newly matured outcomes. It never promotes directly.

## Local Grafana

`monitoring/` runs Grafana locally and reads the same CloudWatch metrics and monitor reports, so the console is not needed. It shows four things:

- The drift and retraining alarm state for the last hour.
- The latest run's flags.
- MAE by cutoff.
- The last 20 reports with their per-cutoff decisions and feature PSI.

Grafana assumes each stack's read-only `ForecastDashboardRoleArn`, using your local AWS CLI credentials. It never uses your own permissions for queries. The role exists after `MisiOps-dev` is deployed from `develop`. See [the spec](../specs/014-grafana-cloudwatch/spec.md).

From the repository root, in PowerShell:

```powershell
Copy-Item mlops/monitoring/.env.example mlops/monitoring/.env
$role = aws cloudformation describe-stacks --stack-name MisiOps-dev --query "Stacks[0].Outputs[?OutputKey=='ForecastDashboardRoleArn'].OutputValue" --output text
(Get-Content mlops/monitoring/.env) -replace '^GRAFANA_DEV_ROLE_ARN=.*', "GRAFANA_DEV_ROLE_ARN=$role" -replace '^GRAFANA_ADMIN_PASSWORD=.*', "GRAFANA_ADMIN_PASSWORD=$([guid]::NewGuid().ToString('N'))" | Set-Content mlops/monitoring/.env
docker compose -f mlops/monitoring/docker-compose.yml up -d
```

Open [127.0.0.1:3001](http://127.0.0.1:3001). The dashboard opens read-only without signing in. The admin password is in your local `.env`, which Git ignores.

To stop Grafana, run `docker compose -f mlops/monitoring/docker-compose.yml down`. Add `-v` to also delete its local state.

Troubleshooting:

- **Panels show "No data" or "No run in range".** The monitor has not reported in the selected range. It runs daily at 07:25 Lima.
- **Save & test fails on `MisiOps prod`.** This stays the case until you set `GRAFANA_PROD_ROLE_ARN` from the `MisiOps-prod` output. There is no fallback to your own credentials.
- **`AccessDenied` on `sts:AssumeRole`.** Your CLI identity needs permission to assume roles in the account. If you use another profile, set `AWS_PROFILE` in `.env`.
- **Port 3001 is in use.** Change `GRAFANA_PORT` in `.env`.

`mlops/tests/test_grafana_contract.py` checks that the dashboard matches the metric filters, the log group and the report fields.

## Manual setup

- Local deployment uses the existing `docker/.env.dev` and `docker/pg_password.txt`. The MLflow demo and synthetic pipelines need no AWS keys or other secrets.
- Leave existing `AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN` and `ALERT_EMAIL` in place. CDK creates the new monitor task, managed database password, log group and IAM role during the environment deployment. Production retains the required GitHub reviewer.
- To run the cloud monitor manually from Actions, set `AWS_MLOPS_MONITOR_ROLE_ARN` in each GitHub environment to that stack's `ForecastMonitorRoleArn` output. Use `develop` for `dev` and `main` for `prod`. Daily EventBridge tasks do not need this GitHub variable.
- The forecast model is bundled before image scanning. An AWS deployment requires the normal reviewed merge, followed by the existing protected promotion path. The repository stores no persistent AWS access keys.

## Implementation checkpoint

### Implemented and verified locally

- The approved plan is in [the feature specification](../specs/013-month-end-forecast/spec.md). The implementation is merged into `develop`. All synthetic history, demo seeding and monitoring scenario code lives in [simulation/](simulation/).
- The initial synthetic release, `41eb6ef57dc015eb`, is pinned in [backend/forecast_release/](../backend/forecast_release/). The manifest and evaluation record the dataset checksum, the model checksum, comparison with the historical rule and the held-out results. Training artifacts remain in the ignored local data, reports and tracking directories.
- Backend, frontend, MLOps and CDK tests passed locally. Docker and PostgreSQL verified the additive migration, restricted monitor privileges and authenticated parity within PEN 0.01. Warm API p95 was 161 ms in the seeded run. A test container with a missing bundle returned HTTP 503 while the healthy release stayed available. MLflow stored and returned a completed run, its metric and its artifact over HTTP. Playwright verified the forecast card with a synthetic account.
- Synthetic monitoring reproduced steady behavior, drift without settled outcomes and degradation after settlement. The monitor also ran against the local PostgreSQL instance and returned insufficient sample size after the disposable demo account was removed.
- MLflow lists five finished runs for the `MisiOps month-end net` experiment on the local server. Compare the regressors under Model training → Experiments → MisiOps month-end net → Runs → Compare using `validation_mae`. The Random Forest run also records `test_mae` and `test_rmse`. The GenAI → Dashboard view stays empty because it shows traces and tokens.

### Merged into `develop`

- [PR #199](https://github.com/jeffreymonjacastro/MisiOps/pull/199) added the PoC and the Guide 12 job graph. Its `develop` push failed in Modeling, which looked for `recipe` in `manifest.json`.
- [PR #200](https://github.com/jeffreymonjacastro/MisiOps/pull/200) reads `recipe` from `evaluation.json`. Its [`develop` push run](https://github.com/jeffreymonjacastro/MisiOps/actions/runs/45092862391) passed the seven common jobs and Deploy · Staging. Deploy · Production was skipped by design. The run uploaded the staging receipt `forecast-staging-41eb6ef57dc015eb`.
- An earlier staging attempt failed because the `dev` environment's `ALERT_EMAIL` differed from the recipient of the existing `misiops-dev` budget. CloudFormation replaces the budget when its recipient changes, and AWS returned `AlreadyExists` for the same budget name. Aligning the `dev` value with the existing budget fixed the deployment.

### Verified in staging (`dev`, `us-east-1`)

Checked on 2026-11-23:

- ECS ran the backend and frontend services in `MisiOps-dev` with 1 of 1 tasks each.
- The [front end](https://d2n2ap8z1x33no.cloudfront.net/movimientos), the [API docs](https://d2n2ap8z1x33no.cloudfront.net/docs#/predictions/month_end_api_v1_predictions_month_end_get) and the [prediction health endpoint](https://d2n2ap8z1x33no.cloudfront.net/api/v1/predictions/health) returned HTTP 200. Health returned `{"model_version":"41eb6ef57dc015eb"}`.
- The stack exposes `PublicUrl`, `ClusterName`, `ForecastMonitorRoleArn`, `ForecastMonitorTaskArn` and `ForecastMonitorNetwork`. The `dev` GitHub environment holds `AWS_MLOPS_MONITOR_ROLE_ARN`.
- The EventBridge rule for the daily monitor is enabled with `cron(25 12 * * ? *)`, which is 07:25 in Lima. The drift and retraining alarms exist and were `OK`.

### Remaining verification

- **Cloud monitor run.** At 07:34 UTC on 2026-11-23, `/misiops/dev/forecast-monitor` had no log streams. The stack was deployed after the previous scheduled time, so the first daily run is due at 12:25 UTC. Check the log group for a stream before claiming that the monitor ran. An `insufficient_sample` report shows that the task ran and found too few settled observations. For an earlier demo, start the ECS task manually or schedule a one-time EventBridge Scheduler run. Either way leaves the daily schedule unchanged.
- **DefectDojo.** The report upload still fails on `develop` pushes, most recently in the [PR #200 merge run](https://github.com/jeffreymonjacastro/MisiOps/actions/runs/45092862388). Its ngrok endpoint returned an offline error page. Bring the endpoint back online and re-run the job. The other DevSecOps jobs passed, and the scan reports are available as Actions artifacts.
- **Manual monitor workflow.** `.github/workflows/model-monitoring.yml` is not on `main` yet, so GitHub does not show Run workflow for it. Monitoring `dev` in AWS does not require promotion to `main`.
- **ECS rollback.** Rollback has a local readiness test and CDK configuration coverage. Its behavior in AWS remains unverified.
- **Production.** Nothing has been verified in production. `mlops.yml` is not on `main`. Promotion goes through a PR from `develop` to `main` and runs in the protected `prod` environment. It requires the matching staging receipt and a production reviewer, and it reuses the approved model without retraining.
