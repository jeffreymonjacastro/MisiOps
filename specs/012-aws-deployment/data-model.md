# Data Model: AWS Deployment for MisiOps

**Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No application data changes. The entities below are operational: they exist as CDK constructs, GitHub Actions runs and AWS resources, not as database tables.

## Environment

One complete deployment of MisiOps, produced by `EnvironmentStack` (`MisiOps-<name>`).

| Field | Type | Values / rules |
| --- | --- | --- |
| `name` | enum | `dev`, `prod` (CDK context `env`; anything else fails synth) |
| `publicUrl` | string | `https://<distribution>.cloudfront.net` (stack output `PublicUrl`) |
| `approval` | enum | `none` (`dev`), `required-reviewer` (`prod`) — GitHub Environment protection rule |
| `labelVisible` | boolean | `true` for `dev` (frontend `APP_ENV`), `false` for `prod` |
| `dbRemovalPolicy` | enum | `DESTROY` (`dev`), `SNAPSHOT` + deletion protection (`prod`) |
| `budgetUsd` | integer | 60 for both |
| `alertEmail` | string | CDK context `alertEmail`, required |
| `taskSize` | fixed | 256 CPU / 512 MiB per service, ARM64, desired count 1 |
| `dbCapacity` | fixed | Aurora Serverless v2, 0–1 ACU, auto-pause after 10 min idle, single writer |

Relationships: owns exactly one Deployment at a time (the running one); references Image Artifacts by tag; owns two Secrets.

State: `absent` → `deploying` → `healthy` | `rolled-back`. Within this feature `prod` stays `absent`.

## Deployment

One attempt to put one commit's images into one Environment: one run of `deploy.yml`.

| Field | Type | Values / rules |
| --- | --- | --- |
| `commit` | sha | `github.event.workflow_run.head_sha` |
| `triggeringRun` | id | `github.event.workflow_run.id` (DevSecOps run) |
| `environment` | ref | derived from `head_branch`: `develop` → `dev`, `main` → `prod` |
| `imageDigests` | map | `backend`, `frontend` → ECR digest after push (job summary) |
| `outcome` | enum | `skipped` (not push / not success), `waiting-approval` (`prod`), `succeeded`, `rolled-back` (circuit breaker), `failed` (artifact missing, synth/deploy error, smoke failure), `superseded` (pending run replaced by a newer one) |
| `approver` | login | `prod` only, recorded by GitHub Environments |

Transitions: `queued` → `skipped` | `waiting-approval` → `running` → `succeeded` | `rolled-back` | `failed`; `queued` → `superseded` when a newer run enters the same concurrency group.

Invariants: at most one `running` Deployment per Environment (concurrency group `deploy-<env>`); a `rolled-back` or `failed` Deployment leaves the Environment serving the previous `succeeded` commit.

## Image Artifact

The two container images built and scanned by one DevSecOps run.

| Field | Type | Values / rules |
| --- | --- | --- |
| `commit` | sha | same as the DevSecOps run's `GITHUB_SHA` |
| `artifactName` | string | `images` (files `backend.tar`, `frontend.tar`, retention 1 day) |
| `localTag` | string | `misiops-backend:latest`, `misiops-frontend:latest` inside the tar |
| `ecrTag` | string | `<commit>` in `misiops-backend` / `misiops-frontend` (immutable) |
| `digest` | sha256 | returned by `docker push`; must equal the loaded image's digest |

Rules: never rebuilt by the deploy workflow; unavailable artifact → Deployment `failed`.

## Secret

A runtime credential the application needs.

| Name (Secrets Manager) | Produced by | Consumer env vars | Rotation |
| --- | --- | --- | --- |
| `misiops/<env>/db` (cluster-generated JSON: `username`, `password`, `host` (cluster endpoint), `port`, `dbname`) | `rds.Credentials.fromGeneratedSecret` on the `DatabaseCluster` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_SERVER`, `POSTGRES_DB` | manual rotation picked up on task restart |
| `misiops/<env>/app` (64-char string) | `secretsmanager.Secret` generated | `SECRET_KEY` | manual; rotating invalidates all sessions |

Rules: values never appear in templates, CI or repository; the task execution role may read exactly these two secrets.

## Runtime configuration (non-secret)

| Container | Variable | Source | Value |
| --- | --- | --- | --- |
| backend | `ACCESS_TOKEN_EXPIRE_MINUTES` | environment | `1440` |
| backend | `CORS_ORIGINS` | not set | default (`http://localhost:3000`); unused because same origin |
| frontend | `APP_ENV` | environment | `dev` / `prod` |
| frontend | `PORT`, `HOSTNAME` | image defaults | `3000`, `0.0.0.0` |
| frontend (build time) | `NEXT_PUBLIC_API_BASE_URL` | Dockerfile `ARG` default | `""` (relative); Compose overrides with `http://localhost:8000` |

## Stack parameters (CDK context)

| Key | Required | Used by | Notes |
| --- | --- | --- | --- |
| `env` | yes (environment stack) | `MisiOps-<env>` | `dev` or `prod` |
| `imageTag` | yes | `MisiOps-<env>` | commit SHA; `ci` in `infra-ci` synth |
| `alertEmail` | yes | `MisiOps-<env>` | budget notifications |
| `githubRepo` | no | `MisiOps-Foundation` | default `jeffreymonjacastro/MisiOps` |
