# Quickstart: Local Grafana View of Forecast Monitoring

Prerequisites:

- Docker Desktop.
- The AWS CLI configured for the MisiOps account in `us-east-1`, with permission to call `sts:AssumeRole`.
- `MisiOps-dev` deployed with `ForecastDashboardRoleArn`.

From the repository root, in PowerShell:

```powershell
Copy-Item mlops/monitoring/.env.example mlops/monitoring/.env
$role = aws cloudformation describe-stacks --stack-name MisiOps-dev --query "Stacks[0].Outputs[?OutputKey=='ForecastDashboardRoleArn'].OutputValue" --output text
(Get-Content mlops/monitoring/.env) -replace '^GRAFANA_DEV_ROLE_ARN=.*', "GRAFANA_DEV_ROLE_ARN=$role" -replace '^GRAFANA_ADMIN_PASSWORD=.*', "GRAFANA_ADMIN_PASSWORD=$([guid]::NewGuid().ToString('N'))" | Set-Content mlops/monitoring/.env
docker compose -f mlops/monitoring/docker-compose.yml up -d
```

Open <http://127.0.0.1:3001/d/misiops-forecast-monitoring>.

Expected result:

- Connections → Data sources → `misiops-dev` → Save & test reports success for metrics and logs.
- Panels show values after the first daily monitor run (07:25 Lima); before that, they show "No data".
- `misiops-prod` fails its health check until `GRAFANA_PROD_ROLE_ARN` is set from `MisiOps-prod`.

Stop it:

```powershell
docker compose -f mlops/monitoring/docker-compose.yml down
```
