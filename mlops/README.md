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

View the reports under `/misiops/<environment>/forecast-monitor` in CloudWatch Logs and the drift and retraining alarms under the matching forecast namespace. Prometheus and Grafana are optional local tools. The cloud monitors and alarms use CloudWatch. The GitHub workflow also offers scheduled synthetic verification, and its manual mode can request a new synthetic candidate from a qualifying staging run with newly matured outcomes. It never promotes directly.

## Manual setup

- Local deployment uses the existing `docker/.env.dev` and `docker/pg_password.txt`. The MLflow demo and synthetic pipelines need no AWS keys or other secrets.
- Leave existing `AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN` and `ALERT_EMAIL` in place. CDK creates the new monitor task, managed database password, log group and IAM role during the environment deployment. Production retains the required GitHub reviewer.
- To run the cloud monitor manually from Actions, set `AWS_MLOPS_MONITOR_ROLE_ARN` in each GitHub environment to that stack's `ForecastMonitorRoleArn` output. Use `develop` for `dev` and `main` for `prod`. Daily EventBridge tasks do not need this GitHub variable.
- The forecast model is bundled before image scanning. An AWS deployment requires the normal reviewed merge, followed by the existing protected promotion path. The repository stores no persistent AWS access keys.

## Implementation checkpoint

### Implemented and verified locally

- The approved plan is in [the feature specification](../specs/013-month-end-forecast/spec.md). The implementation is on `feature/mlops`. All synthetic history, demo seeding and monitoring scenario code lives in [simulation/](simulation/).
- The initial synthetic release, `41eb6ef57dc015eb`, is pinned in [backend/forecast_release/](../backend/forecast_release/). The manifest and evaluation record the dataset checksum, the model checksum, comparison with the historical rule and the held-out results. Training artifacts remain in the ignored local data, reports and tracking directories.
- Backend, frontend, MLOps and CDK tests passed locally. Docker and PostgreSQL verified the additive migration, restricted monitor privileges and authenticated parity within PEN 0.01. Warm API p95 was 161 ms in the seeded run. A test container with a missing bundle returned HTTP 503 while the healthy release stayed available. MLflow stored and returned a completed run, its metric and its artifact over HTTP. Playwright verified the forecast card with a synthetic account.
- Synthetic monitoring reproduced steady behavior, drift without settled outcomes and degradation after settlement. The monitor also ran against the local PostgreSQL instance and returned insufficient sample size after the disposable demo account was removed.
- [PR #199](https://github.com/jeffreymonjacastro/MisiOps/pull/199) targets `develop`. Its [implementation CI run](https://github.com/jeffreymonjacastro/MisiOps/actions/runs/45080768549) passed the image build, artifact checks, forecast parity and security scans. The existing [DefectDojo report upload](https://github.com/jeffreymonjacastro/MisiOps/actions/runs/45080768549/job/137389420323) failed because its ngrok endpoint was offline (`ERR_NGROK_3200`). The same upload job also failed on the preceding `develop` push.

### Remaining verification

- Review PR #199. To restore report imports, bring the configured DefectDojo endpoint back online and re-run the upload job. MLOps test reports and scan artifacts are available in GitHub Actions.
- After the approved merge to `develop`, verify that the staged API serves the pinned version, the staging receipt is available and the ECS forecast monitor logs an aggregate run. ECS rollback has a local readiness test and CDK configuration coverage. Its behavior in AWS remains to be verified.
- Production uses the separate protected `prod` environment on `main`. Promotion requires the matching staging receipt and a production reviewer. Follow the staging and production instructions above before promotion.
