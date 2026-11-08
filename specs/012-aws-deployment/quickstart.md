# Quickstart: AWS Deployment for MisiOps

Validation guide for the feature. Contracts: [cdk-stacks.md](./contracts/cdk-stacks.md), [deploy-workflow.md](./contracts/deploy-workflow.md). Runbook for the team: `docs/deployment/README.md` (written during implementation).

## Prerequisites

- Node 20, pnpm 9.6.0, Docker, AWS CLI v2, `jq`.
- An AWS account; an administrator profile for the one-time steps only.
- Repository owner access to set GitHub variables, environments and required checks.

## 1. Infrastructure tests and synth (no AWS account needed)

```bash
cd infra && pnpm install --frozen-lockfile
pnpm test                 # node:test assertions + smoke.sh stub test → all pass
pnpm synth -c env=dev -c imageTag=ci -c alertEmail=ci@example.com   # no credentials, no account needed
ls cdk.out/MisiOps-dev.template.json cdk.out/MisiOps-Foundation.template.json
```

Expected: tests green; both templates exist; `grep -c '"SecretString"' cdk.out/MisiOps-dev.template.json` prints 0 (no plaintext secret).

## 2. One-time account preparation (administrator, local)

```bash
cd infra
AWS_PROFILE=admin pnpm cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
AWS_PROFILE=admin pnpm cdk deploy MisiOps-Foundation --require-approval never --outputs-file foundation.json
jq . foundation.json   # DeployRoleArn, BackendRepositoryUri, FrontendRepositoryUri
```

Then in GitHub: repository variables `AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN`, `ALERT_EMAIL`; environments `dev` (deployment branches: `develop` only, no reviewers) and `prod` (deployment branches: `main` only, required reviewer); add `infra-ci` to the required checks of `develop`.

## 3. First `dev` deployment (automatic)

1. Merge this feature's pull request into `develop`.
2. Watch `devsecops` finish, then `deploy` start (Actions tab). Expected `deploy` job summary: env `dev`, commit SHA, two image digests, `PublicUrl`.
3. Open `PublicUrl`: the home page shows the MisiOps app with the **dev** banner and the tab title ends in `· dev`.
4. `curl -s https://<PublicUrl>/openapi.json | jq .info.title` → `"MisiOps API"`.
5. Register a throwaway user, create a category and a transaction; reload: data persists (API reaches the database). If the database was paused, the first request may take up to 30 s.
6. Request timing: `infra/scripts/smoke.sh https://<PublicUrl>` exits 0.

## 4. Traceability and no-rebuild check

```bash
aws ecr describe-images --repository-name misiops-backend --image-ids imageTag=<sha> --query 'imageDetails[0].imageDigest'
```

Equals the backend digest printed in the `deploy` summary and the digest of `backend.tar` from the DevSecOps run's `images` artifact.

## 5. Rollback check (US4)

1. Open a pull request that makes the backend exit at start-up (for example, make `SECRET_KEY` shorter than 32 chars by overriding the task secret in a scratch branch) and merge to `develop` — or, cheaper, `aws ecs update-service --force-new-deployment` with a broken task definition revision created by hand.
2. Expected: ECS events show the circuit breaker tripping and rolling back; `cdk deploy` fails; the `deploy` run is red; `PublicUrl` keeps answering 200 throughout (`while true; do curl -so /dev/null -w '%{http_code}\n' https://<PublicUrl>/; sleep 2; done`).

## 6. Secrets hygiene (US5)

```bash
git grep -nE 'AKIA[0-9A-Z]{16}|aws_secret_access_key' -- . ':!docs/**'     # no output
gh variable list                                                               # only AWS_ACCOUNT_ID, AWS_DEPLOY_ROLE_ARN, ALERT_EMAIL
aws ecs describe-task-definition --task-definition <backend-td> --query 'taskDefinition.containerDefinitions[0].environment'   # no POSTGRES_PASSWORD / SECRET_KEY
```

## 7. Logs (US6)

```bash
aws logs tail /misiops/dev/backend --since 5m
```

The `/openapi.json` request from step 3 appears within a minute.

## 8. Local flows unchanged (FR-004)

```bash
bash automations/run_docker.sh      # frontend on :3000 still calls http://localhost:8000
cd backend && uv run pytest -q      # green
cd frontend && pnpm test            # green, including the new env-label test
```

## 9. `prod` readiness without deploying it

```bash
cd infra && pnpm synth -c env=prod -c imageTag=ci -c alertEmail=ci@example.com
grep -c '"DeletionProtection": true' cdk.out/MisiOps-prod.template.json   # 1
```

No `cdk deploy MisiOps-prod` is run in this feature.

## 10. Teardown of `dev` (optional)

```bash
cd infra && pnpm cdk destroy MisiOps-dev -c env=dev -c imageTag=<sha> -c alertEmail=<email>
```

Expected: stack deleted; ECR repositories and the Foundation stack remain.
