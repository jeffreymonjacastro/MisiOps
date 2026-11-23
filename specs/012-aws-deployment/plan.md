# Implementation Plan: AWS Deployment for MisiOps

**Branch**: `feature/aws-deployment` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-aws-deployment/spec.md`

## Summary

Describe two MisiOps environments (`dev`, `prod`) as AWS CDK TypeScript code under `infra/`: a VPC without NAT, two ECS Fargate services on ARM64 (FastAPI backend, Next.js frontend) behind one ALB with path routing, CloudFront in front for HTTPS on a generated domain, Aurora Serverless v2 PostgreSQL 16 scaling to zero in isolated subnets with a generated secret, Secrets Manager values injected as ECS secrets, ECR repositories, CloudWatch log groups and a monthly budget. A one-time `MisiOps-Foundation` stack holds the GitHub OIDC provider, the least-privilege deploy role and the ECR repositories. A new `deploy.yml` workflow fires when `devsecops` completes for a push to `develop` (→ `dev`, automatic) or `main` (→ `prod`, approval-gated), downloads that run's scanned `images` artifact, pushes it to ECR by commit SHA, runs `cdk deploy` and a smoke test. Rollback is ECS's deployment circuit breaker. Only `dev` is deployed within this feature. Two small application changes make one image serve both environments: a Dockerfile build argument defaulting the API base URL to same-origin, and a runtime `APP_ENV` non-production label in the frontend. Decisions and pinned versions: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 on Node 20 (`infra/`), YAML (GitHub Actions), Bash (smoke script); touches TypeScript/Next.js 16 (`frontend/`), Dockerfile, Docker Compose

**Primary Dependencies**: `aws-cdk-lib` 2.273.0, `constructs` 10.x, `aws-cdk` CLI (matching), `tsx` 4.x, `typescript` 5.x; GitHub Actions `aws-actions/configure-aws-credentials@v6.3.0`, `actions/download-artifact@v8`, `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`, `aws-actions/amazon-ecr-login@v2` — all pinned (NFR-005, R1, R9, R11)

**Storage**: Aurora Serverless v2 PostgreSQL 16, 0–1 ACU with auto-pause (fallback `db.t4g.micro` instance), encrypted, 7-day backups (R6); Secrets Manager for DB credentials and `SECRET_KEY` (R7); ECR for images (R10); CloudWatch Logs 30 days (R13)

**Testing**: `node:test` + `tsx` + `aws-cdk-lib/assertions` for the stacks (R12); Bash test with a `curl` stub for `smoke.sh` (R15); existing `pytest` and `node:test` suites must stay green; `node:test` for the frontend label change

**Target Platform**: AWS `us-east-1`, ECS Fargate Linux/ARM64 (Graviton), CloudFront; GitHub-hosted `ubuntu-latest` runners plus `ubuntu-24.04-arm` for the image build and DAST jobs

**Project Type**: Infrastructure as code + CI/CD deployment workflow over an existing monorepo web application

**Performance Goals**: `dev` deployment ≤ 15 min from pipeline completion (NFR-001); `cdk synth` in CI ≤ 5 min (NFR-002); home page and `/openapi.json` ≤ 2 s p95 at idle (NFR-009)

**Constraints**: ≤ 60 USD/month per environment at idle (NFR-003, no free tier assumed; public IPv4 charges included) → no NAT, smallest ARM Fargate tasks, serverless database scaling to zero, free-tier CloudFront; security simplified by team decision (ALB open on HTTP 80, database still private); version pinning rule: GitHub Actions by major tag (repository practice, Dependabot-friendly) except `configure-aws-credentials` pinned exact, everything else (CDK lib/CLI, Node, pnpm, container images, scanner images) by exact version; no secrets or cloud keys in repo or CI (FR-006, FR-011); exact scanned images, no rebuild (FR-009); existing gates untouched (NFR-006); only `dev` deployed in this feature (FR-002 clarified)

**Scale/Scope**: 2 services × 1 task each, 1 serverless DB cluster, 1 distribution per environment; 2 stack classes, ~400 lines of CDK, ~10 assertion tests, 2 new workflows (`deploy.yml`, `infra-ci.yml`) + runner change in `devsecops.yml`, 1 smoke script + test, 2 application files changed, 1 docs page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / clause | Check | Status |
| --- | --- | --- |
| I. Code Quality | Two stack classes, one environment stack parameterized by `env`; every version pinned; no console-made resources; no context lookups (synth is offline); `infra/` documented in `docs/deployment/README.md` | PASS |
| II. Testing (non-negotiable) | Assertion tests for every security property (R12) and a Bash test for `smoke.sh` run in `infra-ci.yml`; frontend label change covered by a `node:test`; existing 158 tests stay green; no coverage decrease | PASS |
| III. UX Consistency | Only user-visible change is the `dev` label (title suffix + banner), one consistent element, absent in `prod`; API behaviour unchanged (same origin, relative paths) | PASS |
| IV. Performance | NFR-001/002/009 measured by the workflow (smoke p95) and CI timing; CloudFront caches hashed static assets; `deregistrationDelay` 30 s shortens deploys | PASS |
| Additional Constraints | Production deploys only after passing scans (`main`, blocking mode) — `deploy.yml` requires `conclusion == success` and `prod` requires approval | PASS |
| Deployment Environments | `dev` from `develop` after pipeline completion (report-only, EX-001); `prod` from `main` with approval; same scanned images (artifact download by run id); OIDC short-lived credentials; circuit-breaker rollback; `dev` labelled, no real data | PASS |
| Development Workflow | Work on `feature/aws-deployment`, PR to `develop`; `infra-ci` becomes a required check; SDD enforcer extended to `infra/` | PASS |

**Post-design re-check (after Phase 1)**: PASS. Post-implementation note (T048, 2026-11-12): the deploy role trusts both the plain and the immutable-subject form of the repository's OIDC `sub` (research R9). One accepted risk recorded in R9 (CDK bootstrap execution role keeps CDK's default administrator policy); no principle conflict. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-aws-deployment/
├── spec.md
├── plan.md                  # this file
├── research.md              # Phase 0 (R1–R16)
├── data-model.md            # Phase 1
├── quickstart.md            # Phase 1
├── contracts/
│   ├── cdk-stacks.md        # stack names, context, outputs, resource inventory, runtime config
│   └── deploy-workflow.md   # triggers, jobs, inputs, outputs, failure modes of deploy.yml / infra-ci.yml
├── checklists/
├── evaluations/
└── tasks.md                 # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
infra/                                  # NEW — AWS CDK app (TypeScript, pnpm)
├── bin/
│   └── misiops.ts                      # App: FoundationStack + EnvironmentStack(env from context)
├── lib/
│   ├── foundation-stack.ts             # OIDC provider, deploy role, 2 ECR repositories
│   ├── environment-stack.ts            # VPC, RDS + secrets, cluster, ALB + rules, 2 services, CloudFront, logs, budget
│   └── config.ts                       # per-env parameters (sizing, removal policies, label), context readers
├── test/
│   ├── foundation-stack.test.ts        # trust policy, ECR immutability
│   └── environment-stack.test.ts       # NFR-007 security assertions (R12)
├── scripts/
│   └── smoke.sh                        # FR-017 / NFR-009 checks against the public URL
├── scripts/tests/
│   └── test_smoke.sh                   # curl stub test
├── cdk.json                            # app command, feature flags
├── package.json / pnpm-lock.yaml / tsconfig.json
└── README.md                           # points to docs/deployment/README.md

.github/workflows/
├── deploy.yml                          # NEW — workflow_run(devsecops) → resolve env → ECR push → cdk deploy → smoke
├── infra-ci.yml                        # NEW — PR/push touching infra/: test + synth
├── devsecops.yml                       # MODIFIED — build and dast jobs on ubuntu-24.04-arm (ARM64 images)
└── sdd-enforcer.yml                    # MODIFIED — infra/ counts as implementation code

.githooks/pre-push                      # MODIFIED — infra/ counts as implementation code

frontend/
├── Dockerfile                          # MODIFIED — ARG/ENV NEXT_PUBLIC_API_BASE_URL="" (R8)
├── app/layout.tsx                      # MODIFIED — APP_ENV title suffix + banner (FR-020)
├── app/components/env-banner.tsx       # NEW — fixed non-production banner
└── test/env-label.test.ts              # NEW — label present when APP_ENV=dev, absent for prod/undefined

docker/docker-compose.yaml              # MODIFIED — frontend build.args NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

docs/deployment/README.md               # NEW — FR-019 runbook (bootstrap, OIDC, first deploy, approve prod, rollback, logs)
README.md, AGENTS.md, .specify/memory/constitution.md   # MODIFIED — structure trees + link
.gitignore                              # MODIFIED — infra/cdk.out/, infra/node_modules/
```

**Structure Decision**: Infrastructure lives in its own top-level `infra/` package (FR-001) alongside `backend/` and `frontend/`, with the same package manager and test runner as `frontend/` (R1). Account-wide resources (`FoundationStack`) are separated from per-environment resources (`EnvironmentStack`) so `prod` can be created later by a single `cdk deploy MisiOps-prod` with no code change (FR-002). Workflows stay one file per concern, mirroring the existing `backend-ci` / `frontend-ci` / `devsecops` split; the only change to `devsecops.yml` is the runner label of the `build` and `dast` jobs (ARM64), every stage and gate stays as is (NFR-006).

## Complexity Tracking

No constitution violations to justify.
