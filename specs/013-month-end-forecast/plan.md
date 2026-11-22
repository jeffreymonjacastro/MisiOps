# Implementation Plan: Month-End Forecast PoC

**Branch**: `feature/mlops` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

## Summary

Train and document a versioned monthly net forecast from simulated MisiOps transactions. Serve the approved model from the existing FastAPI backend, add a forecast card to the dashboard, and monitor the model in the existing dev environment. Adapt the quality controls of the course's CRISP-ML(Q) labs to chronological regression.

## Technical Context

**Language/Version**: Python 3.13 using uv locks, and the existing TypeScript/Next.js/CDK stack.

**Primary Dependencies**: scikit-learn for estimation, MLflow for tracking, FastAPI and SQLAlchemy for serving, and AWS CDK.

**Storage**: Aurora PostgreSQL per environment; versioned synthetic snapshots; MLflow DB and artifact volume locally; promotion manifests and reviewed small synthetic bundles in source control; CI reports and evidence as GitHub artifacts.

**Testing**: pytest, frontend tests, CDK tests and synth, Docker Compose inference parity and deployment smoke.

**Target Platform**: Local Docker, GitHub Actions, and Linux ARM64 ECS services in `us-east-1`.

**Project Type**: MLOps workspace integrated into the existing authenticated web application.

**Performance Goals**: Forecast p95 under 2 seconds in warm seeded dev. Query a bounded lookback by the existing owner/date index. Load one model per process and pin compatible dependencies.

**Constraints**: Synthetic training only; protected dev/prod release paths; avoid publishing private observations. Current dev and prod environments and CDK routing are reused.

**Scale/Scope**: One global regression with user-level financial features per cutoff. Default to deterministic 42-month profiles after the pilot rejection, so the final test can use six previously unseen months. Support at least 12 months and configurable counts and seed.

## Constitution Check

| Required control | Design and post-design assessment |
| --- | --- |
| Code quality | Shared deterministic feature builder and single source for chronological defaults; approved schema and model manifest. Pass. |
| Testing | Regression tests for legacy and new PostgreSQL schemas, authorization, cutoff semantics, intervals, packaged inference and maintenance. Pass by design, implementation evidence pending. |
| UX | Dashboard uses existing components, authenticated client and PEN format. Forecast states separate from selected budget period. Pass. |
| Performance | Bounded owner query, no training on service requests and measured warm latency. Pass by design, performance pending. |
| Deployment | Existing security workflow builds and scans exact images. OIDC, dev from develop and approved prod from main. ECS readiness checks model health. No live history in dev. Pass. |

## Project Structure

```text
specs/013-month-end-forecast/
  spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
  contracts/, checklists/, evaluations/
mlops/
  README.md, pyproject.toml, uv.lock
  configs/, docs/, simulation/, src/, tests/, scripts/, monitoring/
  data/, reports/       # generated and ignored
backend/
  api/v1/, models/, schemas/, core/, tests/
  Dockerfile            # includes shared feature logic and approved release bundle
frontend/
  authenticated dashboard and forecast client
infra/
  existing CDK stacks, smoke verification and monitor task definition
.github/workflows/
  model training and monitoring workflows, existing CI and DevSecOps image build
```

**Structure Decision**: Keep software serving in the application. Organize the experimental workspace like the laboratory without copying its independent app, Terraform state, provider credentials or monitoring stack.

## Phase 0: Outline and Research

See [research.md](research.md) for availability timestamps, chronology, dependency parity, experiment storage, release custody and durable monitoring.

## Phase 1: Design and Contracts

1. **Business and data**: Document the intended recommendation and risk controls in the CRISP-ML(Q) sheet. Train only from seeded synthetic cash flows with recurring, lumpy and delayed data. Version generator settings and snapshots, and validate input with a blocking job.
2. **Preparation**: Produce examples at repeatable monthly cutoffs from transactions visible at that time. Add calendar, current and recent flows and previous closed periods from a bounded history. Fit preprocessing only with training folds. Incorporate the same deterministic aggregation when serving.
3. **Modeling**: Use a same-cut historical remaining-flow rule, multiple linear regression, Ridge, bounded Random Forest and Gradient Boosting. Select by validation MAE, and use observed validation errors for cutoff-specific bands. Log configuration, versions, metrics and artifacts to MLflow. Store one accepted candidate or produce a rejection report.
4. **Evaluation**: Freeze the held-out months before tuning. Recompute MAE, RMSE, sign errors, deficit recall, coverage and sample counts on the same test set. For publication require a finite holdout MAE strictly better than the baseline and a documented, configured tolerated deficit miss rate with minimum label support. Save the model card either way. Subsequent candidates must also pass a comparison against the approved model on fresh, common data under the same policy.
5. **Deployment**: Preserve a reviewed, hash-pinned synthetic release bundle. Prefer a format with a narrow set of allowed model types. Package the accepted bundle before the DevSecOps build, pin runtime dependency versions, and run real API parity in the built image. Keep the existing ECR and CDK path. Extend the ECS health path or startup validation for required model releases. Compare served and packaged versions after deploy. The migration is forward additive so the previous healthy image can still run.
6. **Monitoring**: Persist owner-scoped prediction observations. Evaluate outcomes after month end plus the grace period, and log only aggregates. Measure input/output distributions by cohort and forecast error after settlement without treating drift alone as observed error. Demonstrate steady, unlabeled shift and labeled degradation. Reuse CloudWatch for alarms and reports. Use an authorized one-off ECS task for cloud DB access. Monitoring can dispatch a candidate run when labeled data is new. The reviewed release manifest owns promotion.

See the [data model](data-model.md), [interface and release contract](contracts/forecast-and-release.md), and [validation quickstart](quickstart.md).

## Manual setup and handoff

- Existing `AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN`, and `ALERT_EMAIL` remain valid inputs for the application deployment. The current GitHub environment branch rules and the required production reviewer were verified at planning time.
- Expose environment and phase in Actions job names and summaries. Branch-independent PR checks use synthetic fixtures. The staging path runs on protected `develop`, performs candidate training or verification, and demonstrates the pinned release in `dev`. The production path runs on `main`, checks provenance, digest and parity of the staging-tested bundle, and waits for the existing `prod` approval. No candidate is fitted on the production path. The model artifact is unchanged across environments. Each branch still builds and scans the exact app image for its own commit as required by the constitution.
- Preserve the caller ref by replacing the standalone `workflow_run` deployment trigger with a reusable deployment called from the gated DevSecOps push workflow. Reuse the scanned image artifact from that run. Keep the existing environment policies and production reviewer. [R6](research.md#r6-deployment-branch-context) documents the observed rejection and the rationale.
- Schedule cloud monitoring per environment from AWS, or invoke it manually from the allowed branch. Keep any GitHub cron for the credential-free synthetic monitoring path.
- The monitor needs permissions to start and inspect only its task. Reuse the GitHub OIDC provider with a dedicated monitor role and environment-specific `AWS_MLOPS_MONITOR_ROLE_ARN` variable populated from the CDK output. No new static AWS keys.
- Local Docker supports the full synthetic demo with a durable MLflow volume, no AWS variables and a seeded account. A shared MLflow instance can be configured by supplying its URI and credentials if the team chooses to use one. No Prometheus or Grafana requirement.
