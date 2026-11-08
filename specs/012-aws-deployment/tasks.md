# Tasks: AWS Deployment for MisiOps

**Input**: Design documents from `/specs/012-aws-deployment/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R16), data-model.md, contracts/cdk-stacks.md, contracts/deploy-workflow.md, quickstart.md

**Tests**: Included. Constitution II and spec NFR-007 require automated tests for the infrastructure definition and for every new script; the frontend change gets a `node:test`.

**Organization**: Tasks are grouped by user story. Infrastructure that a story needs in order to be independently testable lives in that story's phase; account-wide prerequisites live in Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Include exact file paths in descriptions

## Path Conventions

- Infrastructure: `infra/` (CDK TypeScript, pnpm 9.6.0, Node 20, tests in `infra/test/`, scripts in `infra/scripts/`)
- Workflows: `.github/workflows/`
- Application changes: `frontend/`, `docker/`
- Documentation: `docs/deployment/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `infra/` package with pinned tooling so every later task has a compilable, testable home.

- [X] T001 Create `infra/package.json` with `"packageManager": "pnpm@9.6.0+sha1.65cd48c20dd329b7f455088b6dd17d4d5b6d02e3"`, dependencies `aws-cdk-lib@2.273.0`, `constructs@^10.4.2`, devDependencies `aws-cdk@^2.1100.0` (CLI release matching lib 2.273.0 at implementation time; pin exact), `typescript@^5`, `tsx@^4.23.13`, `@types/node@^20`; scripts `test` = `node --import tsx --test test/*.test.ts && bash scripts/tests/test_smoke.sh`, `synth` = `cdk synth --all`, `cdk` = `cdk`; then run `pnpm install` and commit `infra/pnpm-lock.yaml`
- [X] T002 [P] Create `infra/tsconfig.json` (target ES2022, module NodeNext, strict, `include: ["bin", "lib", "test"]`, `noEmit: true`) and `infra/cdk.json` with `"app": "npx tsx bin/misiops.ts"` and feature flags `@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker: true`, `@aws-cdk/aws-cloudfront:defaultViewerProtocolPolicyRedirectToHttps: true`, `@aws-cdk/aws-iam:minimizePolicies: true`
- [X] T003 [P] Add `infra/cdk.out/` and `infra/node_modules/` to `.gitignore`; create `infra/README.md` with two lines pointing to `docs/deployment/README.md` and `specs/012-aws-deployment/contracts/cdk-stacks.md`
- [X] T004 [P] Create `infra/lib/config.ts` exporting `type EnvName = 'dev' | 'prod'`, `readContext(app)` that throws a clear error when `env` (not in `['dev','prod']`), `imageTag` or `alertEmail` context is missing, and `envConfig(name)` returning per-environment constants from data-model.md §Environment: `taskCpu: 256`, `taskMemoryMiB: 512`, `desiredCount: 1`, `dbMinAcu: 0`, `dbMaxAcu: 1`, `dbAutoPauseMinutes: 10`, `budgetUsd: 60`, `labelVisible: name === 'dev'`, `dbRemovalPolicy: DESTROY | SNAPSHOT`, `dbDeletionProtection: name === 'prod'`, `logRetention: ONE_MONTH`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Account-wide resources every environment and the deploy workflow depend on, plus the CDK app entry point.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create `infra/lib/foundation-stack.ts` with `FoundationStack` containing two `ecr.Repository`s named `misiops-backend` and `misiops-frontend` (`imageTagMutability: IMMUTABLE`, `imageScanOnPush: true`, lifecycle rule `maxImageCount: 20`, `removalPolicy: RETAIN`) and outputs `BackendRepositoryUri`, `FrontendRepositoryUri` (R10; OIDC provider and deploy role are added in Phase 7 / US5)
- [X] T006 Create `infra/bin/misiops.ts`: `new App()`, `env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }`, always instantiate `FoundationStack(app, 'MisiOps-Foundation')`; when context `env` is present, read context via `readContext` and instantiate `EnvironmentStack(app, \`MisiOps-${env}\`, { envName, imageTag, alertEmail, repositories })` (R14) — the `EnvironmentStack` import target is created in T008
- [X] T007 [P] Create `infra/test/foundation-stack.test.ts` (`node:test` + `aws-cdk-lib/assertions`) asserting both `AWS::ECR::Repository` resources exist with `ImageTagMutability: IMMUTABLE`, `ImageScanningConfiguration.ScanOnPush: true` and `DeletionPolicy: Retain`

**Checkpoint**: `pnpm test` runs the foundation test green; `CDK_DEFAULT_ACCOUNT=123456789012 pnpm synth` produces `cdk.out/MisiOps-Foundation.template.json`.

---

## Phase 3: User Story 1 - The whole platform is reproducible from the repository (Priority: P1) 🎯 MVP

**Goal**: `MisiOps-<env>` defines network, serverless database with generated credentials, secrets injection, cluster, two ARM64 services, ALB path routing, CloudFront HTTPS entry, budget and outputs, parameterized only by `env`; synth is a required CI gate; the DevSecOps pipeline produces ARM64 images.

**Independent Test**: Quickstart §1 (tests + synth with no account, zero `SecretString` in the template) and §2–§3 steps 3–5 after a manual `cdk deploy MisiOps-dev` (app and API on one HTTPS address, data persists).

### Tests for User Story 1

- [X] T008 [P] [US1] Create `infra/test/environment-stack.test.ts` with a shared `synth(envName)` helper (App with context `env`, `imageTag: 'test'`, `alertEmail: 'test@example.com'`, a `FoundationStack`, and `EnvironmentStack`) and assertions: `AWS::EC2::NatGateway` count 0; `AWS::RDS::DBCluster` has `Engine: aurora-postgresql`, `StorageEncrypted: true`, `BackupRetentionPeriod: 7`, `ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: 1 }`, and its `AWS::RDS::DBInstance` has `DBInstanceClass: db.serverless`, `PubliclyAccessible: false`; both `AWS::ECS::TaskDefinition`s have `RuntimePlatform: { CpuArchitecture: ARM64, OperatingSystemFamily: LINUX }`; `AWS::ElasticLoadBalancingV2::ListenerRule` with `Priority: 10` whose `PathPatternConfig.Values` equals `['/api/*', '/openapi.json', '/docs', '/redoc']`; `AWS::CloudFront::Distribution` default behaviour `CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad`, `ViewerProtocolPolicy: redirect-to-https`, `OriginRequestPolicyId: b689b0a8-53d0-40ab-baf2-68738e2966ac`; an additional behaviour `PathPattern: /_next/static/*`; `AWS::Budgets::Budget` with `BudgetLimit.Amount: 60` and a subscriber `Address: test@example.com`; the ALB `AWS::EC2::SecurityGroup` has exactly one ingress rule (`IpProtocol: tcp`, `FromPort: 80`, `ToPort: 80`) and the database `AWS::EC2::SecurityGroup` ingress references only the backend security group (no `CidrIp`); `dev` cluster has `DeletionProtection: false` and `DeletionPolicy: Delete`. Tests fail until T009–T016 exist.

### Implementation for User Story 1

- [X] T009 [US1] Create `infra/lib/environment-stack.ts` with `EnvironmentStack` props `{ envName, imageTag, alertEmail, repositories }` and the network section (R3): `ec2.Vpc` `maxAzs: 2`, `natGateways: 0`, subnet configuration `PUBLIC /24` named `public` and `PRIVATE_ISOLATED /24` named `isolated`; security groups `albSg` (ingress TCP 80 from `ec2.Peer.anyIpv4()`; demo simplification, NFR-008), `backendSg` (ingress 8000 from `albSg`), `frontendSg` (ingress 3000 from `albSg`), `dbSg` (ingress 5432 from `backendSg`); no other ingress rules
- [X] T010 [US1] Add the database section to `infra/lib/environment-stack.ts` (R6): `secretsmanager.Secret` `misiops/<env>/app` (`generateSecretString: { passwordLength: 64, excludePunctuation: true }`); `rds.DatabaseCluster` with `engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_x })` (latest 16.x constant ≥ 16.3 in the installed `aws-cdk-lib`), `writer: rds.ClusterInstance.serverlessV2('writer')`, no `readers`, `serverlessV2MinCapacity: envConfig.dbMinAcu` (0), `serverlessV2MaxCapacity: envConfig.dbMaxAcu` (1), `serverlessV2AutoPauseDuration: Duration.minutes(envConfig.dbAutoPauseMinutes)`, `storageEncrypted: true`, `backup: { retention: Duration.days(7) }`, `defaultDatabaseName: 'misiops'`, `credentials: rds.Credentials.fromGeneratedSecret('misiops', { secretName: 'misiops/<env>/db', excludeCharacters: '/@":%+ ' })`, `vpc`, `vpcSubnets: isolated`, `securityGroups: [dbSg]`, `removalPolicy` and `deletionProtection` from `envConfig`. First confirm with Context7 (`/aws/aws-cdk`) that `serverlessV2AutoPauseDuration` and `serverlessV2MinCapacity: 0` exist in the installed version; if not, apply the R6 fallback (`rds.DatabaseInstance`, `db.t4g.micro`) and adjust T008
- [X] T011 [US1] Add the logging and cluster section to `infra/lib/environment-stack.ts`: two `logs.LogGroup`s `/misiops/<env>/backend` and `/misiops/<env>/frontend` (`retention: ONE_MONTH`, `removalPolicy: DESTROY`); `ecs.Cluster` with `containerInsightsV2: ecs.ContainerInsights.DISABLED` (R13)
- [X] T012 [US1] Add the backend task definition and service to `infra/lib/environment-stack.ts` (R2, R7): `ecs.FargateTaskDefinition` 256/512, `runtimePlatform: { operatingSystemFamily: ecs.OperatingSystemFamily.LINUX, cpuArchitecture: ecs.CpuArchitecture.ARM64 }`; container image `ecs.ContainerImage.fromEcrRepository(repositories.backend, imageTag)`, port 8000, `logging: awsLogs({ logGroup: backendLogGroup, streamPrefix: 'backend' })`, `environment: { ACCESS_TOKEN_EXPIRE_MINUTES: '1440' }`, `secrets: { POSTGRES_USER: ecs.Secret.fromSecretsManager(db.secret, 'username'), POSTGRES_PASSWORD: (…, 'password'), POSTGRES_SERVER: (…, 'host'), POSTGRES_DB: (…, 'dbname'), SECRET_KEY: ecs.Secret.fromSecretsManager(appSecret) }`; `ecs.FargateService` `desiredCount: 1`, `assignPublicIp: true`, `vpcSubnets: public`, `securityGroups: [backendSg]`, `minHealthyPercent: 100`, `maxHealthyPercent: 200`
- [X] T013 [US1] Add the frontend task definition and service to `infra/lib/environment-stack.ts`: 256/512 LINUX/ARM64 (same `runtimePlatform` as T012), image from `repositories.frontend` tag `imageTag`, port 3000, `environment: { APP_ENV: envName }`, awslogs to the frontend log group; `ecs.FargateService` with the same service settings as T012 using `frontendSg`
- [X] T014 [US1] Add the load balancer section to `infra/lib/environment-stack.ts` (R5): `elbv2.ApplicationLoadBalancer` internet-facing in `public` subnets with `albSg`; listener HTTP 80; `frontendTg` (`port: 3000`, HTTP, `healthCheck: { path: '/', interval: 30 s, healthyThresholdCount: 2 }`, `deregistrationDelay: 30 s`) as default action; `backendTg` (port 8000, same health check) attached by `ApplicationListenerRule` priority 10 with `ListenerCondition.pathPatterns(['/api/*', '/openapi.json', '/docs', '/redoc'])`; register both services with their target groups
- [X] T015 [US1] Add the CloudFront section to `infra/lib/environment-stack.ts` (R4): `origins.LoadBalancerV2Origin(alb, { protocolPolicy: HTTP_ONLY })`; `cloudfront.Distribution` default behaviour `cachePolicy: CACHING_DISABLED`, `originRequestPolicy: ALL_VIEWER_EXCEPT_HOST_HEADER`, `allowedMethods: ALLOW_ALL`, `viewerProtocolPolicy: REDIRECT_TO_HTTPS`; `additionalBehaviors['/_next/static/*']` with `CACHING_OPTIMIZED` and `REDIRECT_TO_HTTPS`; `priceClass: PRICE_CLASS_100`; `comment: 'MisiOps <env>'`
- [X] T016 [US1] Add the budget and outputs to `infra/lib/environment-stack.ts` (R13, R14): `budgets.CfnBudget` (`BudgetType: COST`, `TimeUnit: MONTHLY`, `BudgetLimit: { Amount: 60, Unit: USD }`, notifications `ACTUAL ≥ 80 PERCENTAGE` and `FORECASTED ≥ 100 PERCENTAGE`, subscriber EMAIL `alertEmail`); `CfnOutput`s `PublicUrl` (`https://${distribution.distributionDomainName}`), `AlbDnsName`, `BackendLogGroup`, `FrontendLogGroup`, `ClusterName`, `BackendServiceName`, `FrontendServiceName`
- [X] T017 [US1] Modify `.github/workflows/devsecops.yml`: set `runs-on: ubuntu-24.04-arm` on the `build` and `dast` jobs only (R2), so the `images` artifact contains `linux/arm64` images that Fargate ARM64 can run; leave every other job, step, gate, artifact name and the `deliver` job unchanged (NFR-006); verify locally that `docker build --platform linux/arm64 backend` and `frontend` succeed (the pinned `uv` digest is a multi-arch index)
- [X] T018 [US1] Create `.github/workflows/infra-ci.yml` per contracts/deploy-workflow.md: `on: pull_request` and `push` to `develop` with `paths: ["infra/**", ".github/workflows/infra-ci.yml"]`; steps `actions/checkout@v4`, `pnpm/action-setup@v4` (version 9.6.0), `actions/setup-node@v4` (node 20, cache pnpm, `cache-dependency-path: infra/pnpm-lock.yaml`), `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm synth -c env=dev -c imageTag=ci -c alertEmail=ci@example.com` (no AWS credentials, no account or region variables: the stacks have no context lookups and the region is fixed in `bin/misiops.ts`); `working-directory: infra`

**Checkpoint**: `pnpm test` green including T008; `pnpm synth` for `dev` and `prod` both succeed; `grep -c SecretString cdk.out/MisiOps-dev.template.json` is 0

---

## Phase 4: User Story 2 - Every merge into `develop` becomes a running `dev` environment, automatically (Priority: P1)

**Goal**: One image serves every environment (same-origin API base, runtime `dev` label); `deploy.yml` fires after `devsecops` completes on `develop`, pushes the scanned images to ECR by SHA and runs `cdk deploy MisiOps-dev`.

**Independent Test**: Quickstart §3 and §4 (merge → `deploy` run → `PublicUrl` shows the app with the dev banner; ECR digest equals the artifact's).

### Tests for User Story 2

- [X] T019 [P] [US2] Create `frontend/test/env-label.test.ts` (`node:test`) importing `envLabel` from `frontend/app/lib/env.ts`: returns `{ visible: true, name: 'dev' }` when `APP_ENV='dev'`, `{ visible: false }` when `APP_ENV='prod'`, and `{ visible: false }` when `APP_ENV` is undefined (local Docker and tests show no label — resolves checklist deployment CHK027)

### Implementation for User Story 2

- [X] T020 [P] [US2] Create `frontend/app/lib/env.ts` exporting `envLabel(env = process.env.APP_ENV)` per T019, and `frontend/app/components/env-banner.tsx` (server component) rendering a fixed top banner with text `Entorno de pruebas (dev) · sin datos reales` only when `envLabel().visible`, using existing Tailwind tokens from `frontend/app/globals.css`
- [X] T021 [US2] Modify `frontend/app/layout.tsx`: replace the static `metadata` export with `generateMetadata()` that appends ` · dev` to the title when `envLabel().visible`, and render `<EnvBanner />` as the first child of `<body>` before `<AppShell>` (FR-020, R8)
- [X] T022 [P] [US2] Modify `frontend/Dockerfile` builder stage: add `ARG NEXT_PUBLIC_API_BASE_URL=""` and `ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL` immediately before `RUN pnpm run build` (R8); verify `frontend/app/lib/api.ts` and `frontend/next.config.ts` need no change (empty string is not nullish → relative paths, CSP `connect-src 'self'`); add a comment in the Dockerfile noting the known DAST effect documented in research R8 (the `devsecops` build uses the default, the `dast` Compose stack therefore has a same-origin API base; accepted)
- [X] T023 [P] [US2] Modify `docker/docker-compose.yaml` frontend service: `build.args: { NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000" }` so the local stack keeps calling the host-published API (FR-004); run `bash automations/run_tests.sh` and the compose stack locally to confirm no behaviour change
- [X] T024 [US2] Create `.github/workflows/deploy.yml` per contracts/deploy-workflow.md: `on: workflow_run: { workflows: [devsecops], types: [completed], branches: [develop, main] }`; `permissions: { contents: read, actions: read, id-token: write }`; job `resolve` (outputs `env` from `head_branch` mapping `develop→dev`, `main→prod`, `deploy` = `conclusion == 'success' && event == 'push' && env != ''`, `sha` = `head_sha`, `run_id`); job `deploy` with `needs: resolve`, `if: needs.resolve.outputs.deploy == 'true'`, `environment: ${{ needs.resolve.outputs.env }}`, `concurrency: { group: deploy-${{ needs.resolve.outputs.env }}, cancel-in-progress: false }`, `timeout-minutes: 30` (NFR-001 first-creation ceiling), steps: `actions/checkout@v4` with `ref: sha`; `actions/download-artifact@v8` (`name: images`, `run-id`, `github-token: ${{ secrets.GITHUB_TOKEN }}`); `aws-actions/configure-aws-credentials@v6.3.0` (`role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}`, `aws-region: us-east-1`); `aws-actions/amazon-ecr-login@v2`; shell step `docker load` both tars, tag `misiops-<app>:latest` → `<registry>/misiops-<app>:<sha>`, push, capture digest from `docker inspect --format '{{index .RepoDigests 0}}'` into `$GITHUB_OUTPUT`; `pnpm/action-setup@v4` 9.6.0 + `actions/setup-node@v4` node 20; `pnpm install --frozen-lockfile` in `infra`; `pnpm cdk deploy MisiOps-<env> -c env=<env> -c imageTag=<sha> -c alertEmail=${{ vars.ALERT_EMAIL }} --require-approval never --outputs-file outputs.json`; final step writes env, sha, both digests, `PublicUrl` (from `outputs.json`) and the job duration in minutes (`$(( ($(date +%s) - START) / 60 ))` with `START` captured in the first step; SC-008 expects ≤ 15 for updates) to `$GITHUB_STEP_SUMMARY` (smoke step added in T033)
- [X] T025 [US2] Modify `.github/workflows/sdd-enforcer.yml` and `.githooks/pre-push`: change the implementation-code pattern from `^(frontend/|backend/)` to `^(frontend/|backend/|infra/)` in every grep (R16)

**Checkpoint**: `pnpm test` in `frontend/` green with the new test; `docker build frontend` succeeds with default arg; `deploy.yml` passes `actionlint` (run via `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7`)

---

## Phase 5: User Story 3 - Production deploys only from `main`, only after the gates, only with approval (Priority: P1)

**Goal**: `prod` is fully defined, synthesizable and tested, and the deploy workflow routes `main` to the approval-gated `prod` environment; no `prod` deployment is executed in this feature.

**Independent Test**: Quickstart §9 (`prod` synth shows `DeletionProtection: true`); in GitHub, a `prod` environment with a required reviewer exists and `deploy.yml`'s `resolve` job maps `main` → `prod` (verified by reading the workflow; no push to `main` in this feature).

### Tests for User Story 3

- [X] T026 [P] [US3] Extend `infra/test/environment-stack.test.ts` with a `prod` synth: `AWS::RDS::DBCluster` `DeletionProtection: true`, `DeletionPolicy: Snapshot`, `UpdateReplacePolicy: Snapshot`; frontend task definition `Environment` contains `{ Name: APP_ENV, Value: prod }`; both templates have the same set of resource types with the same counts (topology parity, FR-002)

### Implementation for User Story 3

- [X] T027 [US3] Verify `infra/lib/config.ts` `envConfig('prod')` yields `dbRemovalPolicy: SNAPSHOT`, `dbDeletionProtection: true`, `labelVisible: false`, and that `EnvironmentStack` applies them (adjust T010/T013 if T026 fails); ensure no other per-environment branch exists in `infra/lib/environment-stack.ts`
- [X] T028 [US3] Document the production path in `docs/deployment/README.md` section "Approving a production deployment": create GitHub Environment `prod` with required reviewer = repository owner and "Deployment branches" restricted to `main`, and `dev` with no reviewers and "Deployment branches" restricted to `develop` (FR-012: the OIDC `sub` of an environment carries no branch, so this rule is what binds it); the `deploy` job waits in `prod` until approved; the first approved run creates `MisiOps-prod`; include the owner's manual steps (Settings → Environments) since they cannot be automated from the repository

**Checkpoint**: `pnpm test` green with T026; `pnpm synth -c env=prod …` succeeds; no `cdk deploy MisiOps-prod` executed

---

## Phase 6: User Story 4 - A bad deployment heals itself (Priority: P2)

**Goal**: ECS circuit breaker rolls back unhealthy deployments; the workflow verifies the public address and response time after every deploy and fails visibly.

**Independent Test**: Quickstart §5 (broken task → rollback, public URL keeps answering) and `infra/scripts/smoke.sh https://<PublicUrl>` exits 0 on a healthy `dev`.

### Tests for User Story 4

- [X] T029 [P] [US4] Extend `infra/test/environment-stack.test.ts`: both `AWS::ECS::Service` resources have `DeploymentConfiguration.DeploymentCircuitBreaker: { Enable: true, Rollback: true }`, `MinimumHealthyPercent: 100`, `MaximumPercent: 200`; both target groups have `HealthCheckPath: /` and `deregistration_delay.timeout_seconds: 30`
- [X] T030 [P] [US4] Create `infra/scripts/tests/test_smoke.sh` (Bash, same stub pattern as `security/tests/test_upload_to_defectdojo.sh`): a `curl` stub on `PATH` driven by an env var scenario; cases: all-200-fast → exit 0; `/openapi.json` returns 500 → exit 1 naming the check; home body lacks `MisiOps` → exit 1; one slow response making p95 > 2.0 → exit 1; fewer than 20 samples collected → exit 1

### Implementation for User Story 4

- [X] T031 [US4] Add `circuitBreaker: { enable: true, rollback: true }` to both `ecs.FargateService`s in `infra/lib/environment-stack.ts` (R2) and confirm `minHealthyPercent: 100` / `maxHealthyPercent: 200` and target-group settings from T014 satisfy T029
- [X] T032 [US4] Create `infra/scripts/smoke.sh <public-url>` per contracts/deploy-workflow.md: `set -euo pipefail`; `GET <url>/` must return 200 and contain `MisiOps`; `GET <url>/openapi.json` must return 200 and contain `"openapi"`; then 20 sequential `curl -s -o /dev/null -w '%{time_total}\n'` for each path, p95 = 19th value of the sorted list, fail if `> 2.0`; print each check result; exit 1 on first failure with the failing check name (FR-017, NFR-009)
- [X] T033 [US4] Add the smoke step to `.github/workflows/deploy.yml` `deploy` job after `cdk deploy`: `bash infra/scripts/smoke.sh "$(jq -r '."MisiOps-<env>".PublicUrl' infra/outputs.json)"`; ensure the summary step runs `if: always()` and records the smoke outcome
- [X] T034 [US4] Document in `docs/deployment/README.md` sections "Automatic rollback" (circuit breaker semantics, how a rolled-back run looks, where ECS events are) and "Manual rollback" (re-run `deploy.yml` from the previous successful `devsecops` run via "Re-run all jobs", which redeploys that run's images; never rebuild) — resolves checklist deployment CHK021

**Checkpoint**: `pnpm test` green with T029 and T030; `bash infra/scripts/smoke.sh https://<dev-url>` exits 0 against the deployed `dev`

---

## Phase 7: User Story 5 - Secrets and credentials never live in the repository or in CI (Priority: P2)

**Goal**: GitHub OIDC provider and least-privilege deploy role exist in `MisiOps-Foundation`; the execution role can read exactly the two secrets; tests assert the trust policy and the absence of plaintext secrets.

**Independent Test**: Quickstart §6 (no keys in repo, only three repository variables, task definition `environment` has no secret) and §2 outputs `DeployRoleArn`.

### Tests for User Story 5

- [X] T035 [P] [US5] Extend `infra/test/foundation-stack.test.ts`: `AWS::IAM::OIDCProvider` with `Url: https://token.actions.githubusercontent.com` and `ClientIdList: [sts.amazonaws.com]`; `AWS::IAM::Role` trust policy action `sts:AssumeRoleWithWebIdentity` with `StringEquals token.actions.githubusercontent.com:aud = sts.amazonaws.com` and `StringLike token.actions.githubusercontent.com:sub` equal to exactly the four values `repo:jeffreymonjacastro/MisiOps:ref:refs/heads/develop`, `…:ref:refs/heads/main`, `…:environment:dev`, `…:environment:prod`; `MaxSessionDuration: 3600`; the role's policy contains no `iam:*`, `*:*` or `Resource: "*"` except for `ecr:GetAuthorizationToken` and `cloudformation:DescribeStacks`
- [X] T036 [P] [US5] Extend `infra/test/environment-stack.test.ts`: backend `AWS::ECS::TaskDefinition` `ContainerDefinitions[0].Secrets` names are exactly `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_SERVER`, `POSTGRES_DB`, `SECRET_KEY`; `Environment` contains neither `POSTGRES_PASSWORD` nor `SECRET_KEY`; the serialized template contains no `SecretString` key and no `Fn::GetAtt` of `.SecretString`; the task execution role policy grants `secretsmanager:GetSecretValue` on exactly two secret ARNs

### Implementation for User Story 5

- [X] T037 [US5] Add to `infra/lib/foundation-stack.ts` (R9): `iam.OidcProviderNative` (`url: 'https://token.actions.githubusercontent.com'`, `clientIds: ['sts.amazonaws.com']`); `githubRepo` from context default `jeffreymonjacastro/MisiOps`; `iam.Role` `MisiOpsGithubDeploy` assumed by `new iam.OpenIdConnectPrincipal(provider, { StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' }, StringLike: { 'token.actions.githubusercontent.com:sub': [four values from T035] } })`, `maxSessionDuration: Duration.hours(1)`; inline policy statements: `sts:AssumeRole` on `arn:aws:iam::${account}:role/cdk-hnb659fds-*-${account}-us-east-1` (deploy, file-publishing, image-publishing, lookup roles); `ecr:GetAuthorizationToken` on `*`; `ecr:BatchCheckLayerAvailability`, `ecr:CompleteLayerUpload`, `ecr:InitiateLayerUpload`, `ecr:PutImage`, `ecr:UploadLayerPart`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:DescribeImages` on the two repository ARNs; `cloudformation:DescribeStacks` on `*`; output `DeployRoleArn`
- [X] T038 [US5] In `infra/lib/environment-stack.ts`, confirm the backend task execution role receives read grants only through `ecs.Secret.fromSecretsManager` (CDK adds `secretsmanager:GetSecretValue` per secret) and that no `grantRead` to other principals exists; add a code comment referencing FR-006 and R7
- [X] T039 [US5] Add to `docs/deployment/README.md` section "One-time account preparation": `cdk bootstrap aws://<ACCOUNT_ID>/us-east-1`, `cdk deploy MisiOps-Foundation`, copying `DeployRoleArn` into repository variable `AWS_DEPLOY_ROLE_ARN`, setting `AWS_ACCOUNT_ID` and `ALERT_EMAIL`, the statement that no AWS secret is ever stored in GitHub, and the accepted risk of the bootstrap execution role (R9) with the `--cloudformation-execution-policies` follow-up

**Checkpoint**: `pnpm test` green with T035–T036; `git grep -nE 'AKIA[0-9A-Z]{16}|aws_secret_access_key' -- . ':!docs/**'` prints nothing

---

## Phase 8: User Story 6 - The team can see what the running system is doing (Priority: P3)

**Goal**: Both services log to per-environment, per-service CloudWatch log groups with 30-day retention, and the runbook tells the team how to read them.

**Independent Test**: Quickstart §7 (`aws logs tail /misiops/dev/backend --since 5m` shows the `/openapi.json` request within a minute).

### Tests for User Story 6

- [X] T040 [P] [US6] Extend `infra/test/environment-stack.test.ts`: two `AWS::Logs::LogGroup`s named `/misiops/dev/backend` and `/misiops/dev/frontend` with `RetentionInDays: 30` and `DeletionPolicy: Delete`; each task definition's `LogConfiguration.LogDriver` is `awslogs` referencing its log group

### Implementation for User Story 6

- [X] T041 [US6] Confirm T011–T013 satisfy T040 (adjust names/retention if not) and add outputs `BackendLogGroup`, `FrontendLogGroup` usage to `docs/deployment/README.md` section "Reading logs": `aws logs tail <group> --since 10m --follow`, console path, and the 30-day retention statement (FR-016)

**Checkpoint**: `pnpm test` fully green (T007, T008, T026, T029, T035, T036, T040, smoke test)

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, repository structure consistency, final validation against quickstart.

- [X] T042 [P] Complete `docs/deployment/README.md` (English, FR-019) with the remaining sections: overview diagram (text) of GitHub → OIDC → ECR/CDK → CloudFront → ALB → Fargate → RDS; "How a merge becomes a deployment" (develop → devsecops → deploy → dev); "Required status checks" (owner adds `infra-ci` to `develop`); "Costs and budget alerts" (60 USD ceiling, 80 %/100 % notifications, what "idle" means: zero user traffic, health checks only); "Tearing down dev"; "Creating prod later" (`cdk deploy MisiOps-prod` happens via the first approved `main` run); link from `README.md` "Get Started"
- [X] T043 [P] Update the repository-structure trees in `AGENTS.md` and `.specify/memory/constitution.md` (Technology Stack → Repository Structure) to add `infra/  # ☁️ AWS CDK infrastructure (TypeScript)`; no other constitution text changes (version unchanged: structure tree is reference material)
- [X] T044 Run the full local validation: `cd infra && pnpm test && pnpm synth -c env=dev …` and `-c env=prod …`; `cd backend && uv run pytest -q`; `cd frontend && pnpm lint && pnpm test && pnpm build`; `docker build frontend`; `actionlint` on `deploy.yml` and `infra-ci.yml`; record results in the PR description "Tests Performed"
- [ ] T045 Execute quickstart §2 (administrator: bootstrap + `MisiOps-Foundation`), set the three repository variables (`AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN`, `ALERT_EMAIL`), create the two GitHub Environments with their deployment-branch rules (`dev` → `develop`, `prod` → `main` + required reviewer), add `infra-ci` to the required status checks of `develop` (FR-007), then after merging to `develop` verify quickstart §3–§8 and paste the `deploy` run URL, `PublicUrl` and the smoke output into `docs/deployment/README.md` section "First deployment evidence"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies
- **Phase 2 (Foundational)**: depends on Phase 1; blocks every story
- **Phase 3 (US1)**: depends on Phase 2; T009→T010→T011→T012/T013→T014→T015→T016 are sequential edits of one file; T017 (devsecops ARM runners) and T018 are independent of the stack and need only T001–T004
- **Phase 4 (US2)**: depends on Phase 3 (deploys the stack) — T019–T023 (application changes) can start right after Phase 1
- **Phase 5 (US3)**: depends on Phase 3; independent of Phase 4
- **Phase 6 (US4)**: depends on Phase 3 (T031) and Phase 4 (T033 edits `deploy.yml`)
- **Phase 7 (US5)**: T035/T037 depend on Phase 2 only; T036/T038 depend on Phase 3
- **Phase 8 (US6)**: depends on Phase 3
- **Phase 9 (Polish)**: depends on all stories; T045 is the only task that touches the AWS account

### User Story Dependencies

- US1 (P1) is the MVP and the base for everything else
- US2 (P1) needs US1 deployed; its frontend/Dockerfile tasks are independent
- US3 (P1), US4 (P2), US6 (P3) need US1; they are independent of each other
- US5 (P2) Foundation half (OIDC role) must be finished before US2 can be exercised end to end (the workflow assumes the role); its EnvironmentStack half needs US1

### Within Each Story

- Tests first (they fail), then implementation in the listed order, then the checkpoint
- Every edit of `infra/lib/environment-stack.ts` is sequential; different files are parallel

### Parallel Opportunities

```text
Phase 1:   T002 ‖ T003 ‖ T004            (after T001)
Phase 2:   T007 ‖ T006                   (after T005)
Phase 3:   T008 ‖ T009; T017 ‖ T018 anytime after Phase 1
Phase 4:   T019 ‖ T020 ‖ T022 ‖ T023 ; T025 anytime
Phase 5:   T026 ‖ T028
Phase 6:   T029 ‖ T030 ; T032 ‖ T034
Phase 7:   T035 ‖ T036 ‖ T039 ; then T037 → T038
Phase 9:   T042 ‖ T043
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phases 1–2 (package, Foundation ECR, app entry)
2. Phase 3: full `EnvironmentStack` + tests + `infra-ci.yml`
3. **STOP and VALIDATE**: `pnpm test`, synth for both envs, zero `SecretString`; optional manual `cdk deploy MisiOps-dev` with a pre-pushed image to see the app on HTTPS
4. The MVP already proves FR-001–FR-007, FR-016, FR-018 and NFR-003/004/007/008 at the template level

### Incremental Delivery

1. MVP (US1) → infrastructure reviewable in the PR, CI gate active
2. US5 Foundation half (T035, T037, T039) → the account can trust GitHub
3. US2 → first automatic `dev` deployment after merge (the feature's headline outcome)
4. US4 → rollback and smoke verification harden the automatic path
5. US3 → `prod` readiness confirmed, approval documented, nothing deployed
6. US6 → logs documented
7. Polish → runbook, structure trees, full validation, first-deployment evidence

### Notes

- `infra/lib/environment-stack.ts` is one file edited by T009–T016, T031, T038; keep each task's section delimited by a comment header so `/speckit-converge` can audit them
- T045 is the only task that requires AWS credentials; everything else runs offline (no CDK context lookups)
- Versions to pin are listed in plan.md §Technical Context and research.md; do not introduce others
- Commit per task or per small group with Conventional Commits (`feat(infra): …`, `ci(deploy): …`, `test(infra): …`, `docs(deployment): …`, `fix(frontend): …`); no AI attribution

## Phase 10: Convergence

- [X] T046 Force request-time rendering of `frontend/app/layout.tsx` (`export const dynamic = "force-dynamic"`) so `generateMetadata` and `EnvBanner` read `APP_ENV` per request instead of being prerendered at `next build` with the variable unset; verify by running the built image with `APP_ENV=dev` and checking the HTML for the banner text and the ` · dev` title, and with no `APP_ENV` for their absence per FR-020 / US2 (partial)
- [X] T047 Record in `specs/012-aws-deployment/research.md` R12 and `docs/deployment/README.md` that `ec2.Vpc` performs an availability-zone context lookup when the account is resolved (deploy job, through the CDK lookup role), that `infra/cdk.context.json` is git-ignored, and that CI synth stays offline because no account is resolved per plan: R12 offline synth (partial)
