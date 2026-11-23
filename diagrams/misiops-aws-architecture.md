# MisiOps — AWS Solution Architecture

Diagram: [misiops-aws-architecture.drawio](misiops-aws-architecture.drawio) (open with draw.io / diagrams.net).
Source of truth: [infra/](../infra) (AWS CDK, TypeScript). Region `us-east-1`.

## Stacks

| Stack | Scope | Deployed by |
|---|---|---|
| `MisiOps-Foundation` | Account-wide: ECR repositories, GitHub OIDC provider, deploy role | Administrator, once |
| `MisiOps-dev` / `MisiOps-prod` | One full environment, identical topology (only removal policy, deletion protection and the environment label differ) | GitHub Actions (`develop` → dev, `main` → prod) |

## Request flow (solid lines)

1. **Users → CloudFront** over HTTPS (HTTP is redirected). Dynamic responses are not cached; `/_next/static/*` uses `CACHING_OPTIMIZED`.
2. **CloudFront → Application Load Balancer** over HTTP (single origin).
3. **ALB routing**: `/api/*`, `/openapi.json`, `/docs`, `/redoc` → **Backend Service** (FastAPI, :8000); everything else → **Frontend Service** (Next.js, :3000).
4. **Backend → Aurora PostgreSQL** on 5432, only allowed from the backend security group.

## Operations and MLOps flow (dashed lines)

- **Secrets Manager** injects `misiops/{env}/db`, `misiops/{env}/app` (SECRET_KEY) and `misiops/{env}/forecast-monitor` into the tasks through the task execution role.
- All tasks ship logs to **CloudWatch Logs** (`/misiops/{env}/backend|frontend|forecast-monitor`).
- **EventBridge Rule** (cron 12:25 UTC daily) runs the **Forecast Monitor Task** (`python -m core.monitor_job`, backend image) on Fargate; it reads Aurora on 5432.
- Metric filters on the monitor log group publish `RetrainingRecommended`, `DriftDetected` and `MeanAbsoluteErrorPEN` to namespace `MisiOps/Forecast/{env}`; two **CloudWatch Alarms** fire on drift or retraining.
- **Forecast Monitor Role**: assumed by GitHub Actions (OIDC, environment `dev`/`prod`) to `ecs:RunTask` the monitor on demand and read its logs.
- **Forecast Dashboard Role**: read-only role that operators assume to feed the local **Grafana** dashboard from CloudWatch metrics and Logs Insights.
- **AWS Budgets**: USD 60/month, e-mails `alertEmail` at 80 % actual and 100 % forecasted spend.

## Delivery pipeline

1. GitHub Actions gets an OIDC token from `token.actions.githubusercontent.com`.
2. It assumes `MisiOpsGithubDeploy` (1 h sessions, restricted to `develop`/`main` and the `dev`/`prod` GitHub environments).
3. It pushes images tagged with the commit SHA to **ECR** (`misiops-backend`, `misiops-frontend`; immutable tags, scan on push, last 20 kept).
4. `cdk deploy MisiOps-{env} -c imageTag=<sha>` (via the CDK bootstrap roles) rolls the Fargate services, which pull `:<sha>` from ECR.

## Services

| Service | Purpose |
|---|---|
| CloudFront | Public HTTPS entry point, static asset caching |
| Application Load Balancer | Path-based routing to frontend and backend |
| ECS on Fargate (ARM64, 0.25 vCPU / 512 MiB) | Runs frontend, backend and the scheduled forecast monitor |
| Aurora PostgreSQL 16 Serverless v2 | Application database, 0–1 ACU with 10 min auto-pause, encrypted, 7-day backups |
| Secrets Manager | DB credentials, token-signing key, monitor DB password |
| CloudWatch | Logs, forecast metric filters and alarms |
| EventBridge | Daily schedule for the forecast monitor |
| ECR | Container image registry |
| IAM + GitHub OIDC | Keyless CI/CD and scoped operator roles |
| AWS Budgets | Monthly cost guardrail |

## Key design decisions

- **No NAT gateway**: tasks run in public subnets with public IPs (ingress only from the ALB security group); the database lives in isolated subnets with no internet route. This keeps the monthly cost low.
- **Same topology for dev and prod** (`infra/lib/config.ts`): only removal policy, deletion protection and the environment label differ.
- **Safe deploys**: ECS circuit breaker with automatic rollback, 100 % min / 200 % max healthy.
- **Keyless CI/CD**: GitHub OIDC with short-lived credentials; no long-lived access keys.
- **Known upgrade paths** (marked `ponytail` in code): the ALB listener is open on :80 (could be restricted to the CloudFront prefix list), and the budget covers the whole account (could filter on the `Environment` tag).
