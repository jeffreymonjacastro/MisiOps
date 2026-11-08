# Contract: Deployment Workflows

## `.github/workflows/deploy.yml`

**Trigger**: `workflow_run` of `devsecops`, `types: [completed]`, `branches: [develop, main]`.

**Permissions**: `contents: read`, `actions: read` (artifact download), `id-token: write` (OIDC).

**Jobs**

| Job | Condition | Does | Outputs / fails when |
| --- | --- | --- | --- |
| `resolve` | always | Maps `head_branch` → `env` (`develop`→`dev`, `main`→`prod`); sets `deploy=true` only if `workflow_run.conclusion == 'success'` and `workflow_run.event == 'push'` | outputs `env`, `deploy`, `sha` (= `head_sha`), `run_id` |
| `deploy` | `needs.resolve.outputs.deploy == 'true'`; `environment: ${{ env }}`; `concurrency: deploy-${{ env }}`, `cancel-in-progress: false`; `timeout-minutes: 30` (NFR-001 first-creation ceiling); the summary records the job duration so updates can be checked against 15 min (SC-008) | 1. checkout `sha`; 2. `actions/download-artifact@v8` name `images`, `run-id`, `github-token: GITHUB_TOKEN`; 3. `configure-aws-credentials@v6.3.0` with `role-to-assume: vars.AWS_DEPLOY_ROLE_ARN`, region `us-east-1`; 4. `amazon-ecr-login@v2`; 5. `docker load` both tars, tag `<sha>`, push, capture digests; 6. `pnpm install --frozen-lockfile` in `infra/`; 7. `cdk deploy MisiOps-<env> -c env -c imageTag=<sha> -c alertEmail=vars.ALERT_EMAIL --require-approval never --outputs-file outputs.json`; 8. `infra/scripts/smoke.sh $(jq -r PublicUrl)`; 9. job summary: env, sha, digests, URL | Fails on: artifact missing/expired (FR-009), ECR push error, CloudFormation failure (ECS circuit breaker rolled back → stack `UPDATE_ROLLBACK_COMPLETE` → `cdk deploy` exits non-zero, FR-013), smoke failure (FR-017, NFR-009) |

**GitHub Environments**: `dev` (deployment branches: `develop` only; no reviewers), `prod` (deployment branches: `main` only; required reviewer: repository owner). Environment-scoped OIDC `sub` is `repo:<owner>/<repo>:environment:<env>`; the branch rule is what binds that `sub` to a branch (FR-012).

**Repository variables** (non-secret): `AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN`, `ALERT_EMAIL`. **Secrets**: none added.

**Idempotency**: re-running for the same `sha` pushes the same digest to an immutable tag (ECR accepts identical content; different content under an existing tag is rejected with `ImageTagAlreadyExistsException`, which fails the run) and `cdk deploy` reports no changes.

## `.github/workflows/infra-ci.yml`

**Trigger**: `pull_request` and `push` to `develop`, `paths: ["infra/**", ".github/workflows/infra-ci.yml"]`.

**Steps**: checkout → pnpm 9.6.0 → Node 20 → `pnpm install --frozen-lockfile` → `pnpm test` (`node --import tsx --test test/*.test.ts` + `bash scripts/tests/test_smoke.sh`) → `pnpm synth` (`cdk synth --all -c env=dev -c imageTag=ci -c alertEmail=ci@example.com`), no AWS credentials, no account variable, region fixed in code.

**Gate**: required status check on `develop` (owner action, executed in T045 and documented in the runbook).

## `infra/scripts/smoke.sh <public-url>`

| Check | Expectation |
| --- | --- |
| `GET <url>/` | HTTP 200, body contains `MisiOps` |
| `GET <url>/openapi.json` | HTTP 200, body contains `"openapi"` |
| 20 × `GET /` and 20 × `GET /openapi.json` | p95 of `time_total` ≤ 2.0 s each |
| exit code | 0 all pass; 1 otherwise, printing the failing check |

Tested by `infra/scripts/tests/test_smoke.sh` with a `curl` stub (success, 500, slow responses).

## Modified gates

- `.github/workflows/sdd-enforcer.yml` and `.githooks/pre-push`: implementation-code regex becomes `^(frontend/|backend/|infra/)`.
- `.github/workflows/devsecops.yml`: jobs `build` and `dast` get `runs-on: ubuntu-24.04-arm` so the scanned images are `linux/arm64` (R2). No stage, gate or artifact name changes.
