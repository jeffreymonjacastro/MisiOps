# Feature Specification: AWS Deployment for MisiOps

**Feature Branch**: `feature/aws-deployment`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "AWS deployment for MisiOps: infrastructure as code with AWS CDK (TypeScript) under infra/, deploying backend and frontend container images to ECS Fargate behind a single ALB with path-based routing (/api/*, /openapi.json, /docs to backend; everything else to frontend), RDS PostgreSQL 16 in private subnets, credentials and SECRET_KEY in Secrets Manager injected as ECS secrets, images in ECR, logs in CloudWatch. GitHub Actions authenticates through OIDC (no long-lived keys). A new deploy workflow runs after the devsecops workflow completes on push to develop (dev environment) and main (prod environment, required reviewer), reusing the already-scanned image artifacts. Acceptance: cdk synth passes in CI, dev URL serves frontend and API on the same origin, rollback on failed deployment, no AWS credentials stored in GitHub secrets."

## Clarifications

### Session 2026-11-07

- Q: Should this feature deploy both environments now, or define `prod` in code but only deploy `dev` until the team is ready? → A: Define and test both (`synth`, infrastructure tests, approval-gated workflow); deploy only `dev` now. The `prod` environment is created on its first approved deployment, a later team decision.
- Q: How should users reach the environments over an encrypted connection (HTTPS) given the team owns no domain? → A: A content delivery layer with a provider-managed certificate in front of the load balancer, for both `dev` and `prod`; the public address is the provider-generated one. Same topology in both environments.
- Q: Should the `dev` environment be reachable by anyone on the internet, or restricted to the team? → A: Public, clearly labelled non-production, holding no real data (throwaway accounts only); no edge password or IP allow-list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The whole platform is reproducible from the repository (Priority: P1)

A team member with access to the cloud account can create, update or destroy a complete MisiOps environment (web app, API, database, networking, secrets, logging) from the code in this repository, without clicking through a console. Two environments exist, `dev` and `prod`, built from the same definition.

**Why this priority**: Everything else (automatic deployment, rollback, security gates in front of production) depends on the environment being described as code. Without it, deployments are manual and unrepeatable.

**Independent Test**: From a clean checkout, a team member synthesizes the infrastructure definition without errors, deploys the `dev` environment, opens its public address and sees the MisiOps home page; then destroys it and nothing of it remains in the account except the retained database backups and logs.

**Acceptance Scenarios**:

1. **Given** a clean checkout and cloud credentials, **When** the infrastructure definition is validated, **Then** it validates with zero errors and produces a deployable description of every resource.
2. **Given** a validated definition, **When** the `dev` environment is deployed, **Then** the web app and the API are reachable at one public address, and the API can read and write to its database.
3. **Given** a running environment, **When** the definition is destroyed, **Then** compute, networking and routing resources are removed; the database backups and the application logs are retained for their configured retention period.
4. **Given** the `dev` and `prod` environments, **When** their definitions are compared, **Then** they differ only in declared parameters (environment name, sizing, approval), never in topology.

---

### User Story 2 - Every merge into `develop` becomes a running `dev` environment, automatically (Priority: P1)

When a pull request is merged into `develop`, the security pipeline runs over the new code and, once it finishes, the exact container images it built and scanned are deployed to the `dev` environment. Nobody runs a command by hand.

**Why this priority**: This is the flow the team asked for: pull request → security analysis → deployment. It turns `develop` into a living environment the team can test against, and it is the rehearsal for every production deployment.

**Independent Test**: Merge a pull request that changes visible text on the home page; within the agreed time the `dev` address shows the new text, and the deployment run shows which pipeline run produced the images it deployed.

**Acceptance Scenarios**:

1. **Given** a pull request into `develop` whose tests and linting pass, **When** it is merged, **Then** the security pipeline runs and, on completion, a deployment to `dev` starts without human action.
2. **Given** the deployment to `dev`, **When** it publishes the images, **Then** they are byte-for-byte the images the security pipeline built and scanned for that commit; no image is rebuilt during deployment.
3. **Given** a pull request into `develop` (not yet merged), **When** its pipeline runs, **Then** no deployment happens.
4. **Given** the security pipeline on `develop` reports findings in report-only mode (EX-001), **When** it completes, **Then** the `dev` deployment still proceeds and the findings remain visible in the pipeline summary.

---

### User Story 3 - Production deploys only from `main`, only after the gates, only with approval (Priority: P1)

When code reaches `main`, the security pipeline runs in blocking mode. If every gate passes, a production deployment is prepared and waits for a named reviewer to approve it. Only then do the scanned images reach `prod`.

**Why this priority**: The constitution forbids production deployments without passing security scans and requires explicit approval. This story is what keeps a vulnerable build out of production.

**Independent Test**: Push to `main` a change the gates accept; the production deployment waits for approval, is approved, and `prod` serves the change. Push a change that fails a gate; no production deployment is offered.

**Acceptance Scenarios**:

1. **Given** a push to `main` where every security stage passes, **When** the pipeline completes, **Then** a production deployment is created in a waiting state and does not start until a reviewer approves it.
2. **Given** a push to `main` where any security stage fails, **When** the pipeline completes, **Then** no production deployment is created.
3. **Given** an approved production deployment, **When** it runs, **Then** `prod` serves the new version and the previous version stops receiving traffic only after the new one is healthy.

---

### User Story 4 - A bad deployment heals itself (Priority: P2)

If a new version fails to start or fails its health checks, the environment returns to the previous working version on its own, and the deployment run is marked failed so the team notices.

**Why this priority**: Automatic deployments without automatic rollback would turn every bad merge into an outage. P2 only because it depends on Stories 1-3 existing first.

**Independent Test**: Deploy a version whose API process exits immediately; users keep getting the previous version, and the deployment run ends as failed.

**Acceptance Scenarios**:

1. **Given** a healthy running version, **When** a new version is deployed that never becomes healthy, **Then** traffic keeps flowing to the previous version and the new one is discarded.
2. **Given** a rolled-back deployment, **When** the team looks at the deployment run, **Then** it is marked failed with the reason visible.
3. **Given** a healthy new version, **When** the deployment finishes, **Then** there was no moment during the deployment when the public address returned errors for every request.

---

### User Story 5 - Secrets and credentials never live in the repository or in CI (Priority: P2)

Database credentials and the token-signing secret exist only in the cloud secret store and reach the running application at start time. The CI platform proves its identity to the cloud account with short-lived, per-run credentials; no permanent cloud access key is stored anywhere.

**Why this priority**: The DevSecOps feature already scans for leaked secrets; this story makes sure the deployment path does not introduce new ones. It is P2 because it is a property of how Stories 1-3 are built, not a separate flow.

**Independent Test**: Inspect the repository, the CI secret store and the deployed task configuration: no plaintext database password, signing secret or cloud access key appears in any of them; the deployment run shows it obtained temporary credentials.

**Acceptance Scenarios**:

1. **Given** the repository and its CI configuration, **When** they are searched for cloud access keys, database passwords or signing secrets, **Then** none is found; only non-secret identifiers (account, region, role name) are present.
2. **Given** a deployment run, **When** it authenticates to the cloud account, **Then** it uses credentials valid only for that run and only for the deployment role's permissions.
3. **Given** a running API task, **When** its configuration is inspected, **Then** secret values are referenced from the secret store, not written inline.
4. **Given** the database password is rotated in the secret store, **When** the API restarts, **Then** it connects with the new password with no code or configuration change.

---

### User Story 6 - The team can see what the running system is doing (Priority: P3)

Application logs of both services are collected centrally per environment and retained long enough to investigate a problem reported days later.

**Why this priority**: Needed to debug the environments Stories 2-4 create, but the system works without it.

**Independent Test**: Trigger a request against `dev`; the resulting API log line is readable in the central log view within one minute.

**Acceptance Scenarios**:

1. **Given** a request to the `dev` API, **When** the team opens the central logs, **Then** the request's log line is there within one minute, tagged with the environment and service.
2. **Given** logs older than the retention period, **When** the team looks for them, **Then** they have been removed (no unbounded growth or cost).

---

### Edge Cases

- What happens when the security pipeline fails on `develop` for a reason other than a security gate (build error, runner outage)? No `dev` deployment MUST start; the images of a failed pipeline MUST never be deployed.
- What happens when the deployment run cannot find the image artifacts of the pipeline run that triggered it (expired, deleted)? The deployment MUST fail visibly rather than rebuilding the images.
- What happens when two merges into `develop` happen minutes apart? Deployments MUST run one at a time per environment, the later one superseding the earlier; the environment MUST never run a mix of versions.
- What happens when the database is unreachable while a new version starts? The new version MUST be considered unhealthy and the previous version MUST keep serving.
- What happens when the infrastructure definition changes but the application images do not (for example, a new log retention)? The deployment MUST apply the infrastructure change without restarting the application unnecessarily, and MUST still succeed with the already published images.
- What happens when the same commit is deployed twice (re-run)? The deployment MUST be idempotent: nothing changes and the run succeeds.
- What happens when the cloud account hits a quota or the monthly budget alarm fires? The budget alarm MUST notify the team; it MUST NOT silently destroy environments.
- What happens when the content delivery layer receives two API requests for the same path from different users? Each MUST reach the API and receive its own response; no API response MAY be served from a cache to another user.
- What happens on the first database-backed request after the database has paused for inactivity? The database resumes automatically; that request MAY take up to 30 seconds and MUST NOT fail; the health endpoints, which do not touch the database, MUST keep answering normally throughout.
- What happens when the security pipeline is started by hand (manual dispatch) or re-run for an older commit? A manually dispatched run MUST NOT deploy. A re-run of a push pipeline deploys that run's commit again; this is the manual rollback path.
- What happens when a production deployment waits for approval longer than the CI platform allows (30 days)? It expires as failed; a newer approved run supersedes it.
- What happens when the post-deployment check fails although the infrastructure update succeeded? The environment stays on the new version, the run ends as failed, and the team rolls back manually (FR-019).
- What happens when EX-001 expires? The `dev` deployment MUST then be blocked by failing security gates, matching the constitution's Deployment Environments section.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST describe every cloud resource of a MisiOps environment (networking, compute for the web app and the API, managed relational database, secret store entries, image registry, central logging, public entry point and request routing) as version-controlled code in this repository, under a dedicated top-level `infra/` directory.
- **FR-002**: The same infrastructure definition MUST produce the `dev` and `prod` environments, parameterized by environment name; the two MUST NOT diverge in topology. Within this feature only `dev` is deployed; `prod` MUST be fully defined, validated and tested, and is created by its first approved production deployment (a later team decision), with no further code change.
- **FR-003**: Each environment MUST expose the web app and the API under one public HTTPS address (same origin): requests whose path starts with `/api/`, plus the API's documentation and schema paths (`/openapi.json`, `/docs`, `/redoc`), MUST reach the API; every other path MUST reach the web app. The content delivery layer MUST NOT cache API responses and MUST forward request headers (including authorization) and cookies to the API unchanged.
- **FR-004**: The web app build for cloud environments MUST call the API through relative paths on the same origin; the existing local Docker Compose and local development flows MUST keep working unchanged.
- **FR-005**: The database MUST NOT be reachable from the public internet; only the API's compute MUST be able to open connections to it (security-group-to-security-group rule, no address ranges; the web app's compute is excluded). The compute tasks of both services MUST accept inbound connections only from the load balancer.
- **FR-006**: Database credentials and the API's token-signing secret MUST be stored only in the cloud secret store and injected into the API at start time; they MUST NOT appear in the repository, in CI secrets, in the infrastructure definition output (synthesized template), inline in the deployed task configuration, in stack outputs, or in workflow logs and job summaries. Generated database credentials MUST be usable verbatim in the API's connection string (no characters that require URL-encoding).
- **FR-007**: The infrastructure definition MUST be validated (synthesized) on every pull request that touches `infra/`, as a required quality gate, so a broken definition cannot be merged.
- **FR-008**: A deployment workflow MUST start automatically when the DevSecOps pipeline completes for a push to `develop` or `main`; it MUST NOT start for pull-request runs or for pipeline runs that did not complete successfully.
- **FR-009**: The deployment workflow MUST deploy the exact container images built and scanned by the DevSecOps pipeline run that triggered it, obtained from that run's stored artifacts, and MUST fail if those artifacts are unavailable; rebuilding images during deployment is forbidden (constitution, Deployment Environments). The image registry MUST reject overwriting an existing tag (immutable tags, tag = commit identifier) and MUST scan images on push; registry findings are informational for `dev` and are triaged through the DevSecOps process, never by rebuilding in the deploy path.
- **FR-010**: Pushes to `develop` MUST deploy to `dev` without human approval. Pushes to `main` MUST deploy to `prod` only after a designated human reviewer approves the deployment and only when every security gate passed in blocking mode. The approver is recorded by the CI platform; the `prod` environment SHOULD enable the platform's "prevent self-review" option so the commit author cannot approve their own deployment.
- **FR-011**: The deployment workflow MUST authenticate to the cloud account with short-lived, per-run federated credentials bound to this repository and branch; no long-lived cloud access key MAY be stored in the repository or in CI secrets (constitution, Deployment Environments). The federated session MUST be valid for at most one hour. The only CI configuration values are three non-secret repository variables (cloud account identifier, deployment role identifier, alert e-mail); no CI secret is added by this feature.
- **FR-012**: The deployment role used by CI MUST be limited to the permissions the deployment needs (publish images, update the environment's stacks) and MUST be assumable only from this repository's `develop` and `main` branches. Where the CI platform scopes the identity to a deployment environment rather than a branch, that environment MUST restrict deployments to its branch (`dev` → `develop`, `prod` → `main`).
- **FR-013**: A deployment whose new version does not become healthy MUST be rolled back automatically to the previous healthy version, and the deployment run MUST end as failed. "Healthy" means the service's health check (`GET /` on the container, HTTP 200, checked every 30 seconds, two consecutive successes) passes; a version whose tasks repeatedly fail to reach that state trips the rollback. Infrastructure changes that fail to apply MUST likewise be rolled back by the stack update mechanism.
- **FR-014**: Deployments of a new version MUST keep the previous version serving traffic until the new one passes health checks, so a healthy deployment causes no full outage.
- **FR-015**: Deployments to the same environment MUST NOT run concurrently; a newer deployment supersedes a queued older one.
- **FR-016**: Application logs of both services MUST be collected centrally per environment and service, with a retention period of 30 days. Logs contain the applications' existing output (access lines, errors); they MUST NOT include credential values.
- **FR-017**: After each deployment, the workflow MUST verify that the public address serves the web app home page (`/`, HTTP 200, body contains `MisiOps`) and the API schema endpoint (`/openapi.json`, HTTP 200; the API's own `/` is not reachable at the public address because `/` routes to the web app), and MUST fail the run if either check fails.
- **FR-018**: Each environment MUST have a monthly cost budget with an alert sent to a notification e-mail address supplied as a required deployment parameter (default: the repository owner's address) when actual spend reaches 80 % of it or forecast spend reaches 100 % of it. The budget only notifies; it MUST NOT act on resources.
- **FR-019**: The repository documentation MUST describe the one-time account preparation steps (bootstrap, identity federation, first deployment) and the day-to-day flow (how a merge becomes a deployment, how to approve `prod`, how to roll back manually by redeploying the previous commit through the same workflow, how to read logs), in English.
- **FR-020**: The `dev` environment is publicly reachable without an access restriction and MUST NOT hold real user data (throwaway test accounts only). The web app MUST display one visible non-production label (page title suffix ` · dev` and a fixed top banner on every page, using the existing design tokens with readable contrast) whenever the runtime environment name is `dev`; `prod` shows no label; when no environment name is provided (local runs, tests) no label is shown. This satisfies the constitution's Deployment Environments section.

### Non-Functional Requirements

- **NFR-001**: A `dev` deployment that updates an existing environment, from pipeline completion to the new version serving traffic, MUST finish within 15 minutes. The first creation of an environment (database and content delivery layer provisioning) MAY take up to 30 minutes; the deployment run MUST fail if it exceeds 30 minutes.
- **NFR-002**: The infrastructure validation step MUST finish within 5 minutes on the CI platform's standard runners.
- **NFR-003**: Each environment MUST cost at most 60 USD per month at idle (no user requests; only the load balancer's health checks every 30 seconds, database paused), using the smallest available sizes; the budget alert of FR-018 MUST be set to this ceiling.
- **NFR-004**: The database MUST have automated daily backups retained for at least 7 days, and MUST be encrypted at rest.
- **NFR-005**: Every tool, action and runtime image used by the deployment workflow MUST be pinned to a specific version, consistent with the DevSecOps pipeline's practice.
- **NFR-006**: The existing quality gates (lint, unit tests, build, integration test, SDD enforcer, DevSecOps stages) MUST keep passing; the deployment work MUST NOT disable or weaken them.
- **NFR-007**: The infrastructure definition MUST have automated tests that run in CI and assert the security-relevant properties: database not publicly reachable, secrets referenced from the secret store, deployment role restricted to this repository (Constitution II).
- **NFR-008**: Public traffic to both `dev` and `prod` MUST be served over an encrypted connection (HTTPS) on a provider-generated address, through a content delivery layer with a provider-managed certificate placed in front of the load balancer; plain HTTP requests MUST be redirected to HTTPS. The load balancer SHOULD accept traffic only from that layer; for this course demo it MAY accept plain HTTP from anywhere (team decision 2026-11-07: security hardening is not a priority, simplicity is), while the database stays unreachable from the internet (FR-005). Traffic inside the private network (load balancer to tasks, API to database) MAY be plaintext for this demo.
- **NFR-009**: On each environment at idle, with the database awake, the web app home page and the API health endpoint MUST respond within 2 seconds at the 95th percentile, measured from the public address, on the chosen smallest sizing (Constitution IV). The first database-backed request after the database has paused (see Edge Cases) is excluded from this measurement.

### Key Entities *(include if feature involves data)*

- **Environment**: One complete deployment of MisiOps. Attributes: name (`dev`, `prod`), public address, approval policy, sizing, budget ceiling.
- **Deployment**: One attempt to put a specific commit's images into an environment. Attributes: commit, triggering pipeline run, environment, outcome (succeeded / rolled back / failed / superseded), approver (prod only).
- **Image Artifact**: The container images built and scanned by one pipeline run. Attributes: commit, service (web app / API), digest, scan outcome.
- **Secret**: A credential the application needs at runtime. Attributes: name, owner service, rotation state. Values are never recorded in project artifacts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of merges into `develop` whose security pipeline completes result in a `dev` deployment with no manual step.
- **SC-002**: 100% of production deployments were preceded by a passing security pipeline on `main` and an explicit approval recorded in the deployment run.
- **SC-003**: 100% of deployed images match, by digest, an image scanned by the triggering pipeline run.
- **SC-004**: A deliberately broken version deployed to `dev` is rolled back automatically and the public address keeps answering successfully throughout (0 failed health probes from the outside, probing every 5 seconds during the attempt).
- **SC-005**: Zero cloud access keys, database passwords or signing secrets are present in the repository, its history, or the CI secret store at the end of the feature.
- **SC-006**: A new team member can bring up a complete `dev` environment from the repository documentation in under 60 minutes, including account preparation, with the prerequisites listed in the quickstart already installed.
- **SC-007**: Monthly idle cost per environment stays at or below 60 USD for the first full month (measured on `dev`, the only environment live at the end of this feature).
- **SC-008**: A merge into `develop` is visible at the `dev` address within 15 minutes of the pipeline finishing, in at least 9 of 10 consecutive deployments to an already existing `dev` environment.
- **SC-009**: Home page and API health endpoint of `dev` answer within 2 seconds at p95 over 20 consecutive sequential external requests each.

## Assumptions

- The cloud provider is AWS and the infrastructure language is the AWS CDK in TypeScript, as the team requested; the concrete service mapping (container orchestration, load balancing, managed PostgreSQL, secret store, image registry, logging, identity federation) is fixed in `plan.md`.
- The CI platform remains the project's existing GitHub Actions; the deployment workflow is a new workflow file that chains after the existing `devsecops` workflow instead of modifying its scan stages.
- Only `dev` is live when this feature is merged; `prod` is defined and tested but not deployed until the team approves its first production deployment.
- The team has one AWS account for both environments, with one person holding administrator access to run the one-time preparation steps; the two environments are isolated by resource naming and separate stacks, not by separate accounts.
- The team does not own a custom domain. Environments are reached through the provider-generated address of the content delivery layer, whose provider-managed certificate gives HTTPS to both environments at no recurring cost under the free tier. A custom domain can be added later without changing the topology.
- The API keeps creating its schema at start-up (current behaviour); formal database migrations are out of scope and will be a separate feature when a destructive schema change is needed.
- The 60 USD ceiling (NFR-003) needs no free tier: the database is serverless and scales to zero when idle, the compute runs on ARM processors (about 20 % cheaper), and the estimate already includes public IPv4 address charges (two load-balancer addresses and two task addresses, about 15 USD/month). Idle cost is about 48 USD/month; typical course usage adds a few USD of database time. The budget alert is the signal to revisit sizing.
- "Smallest available sizes" means one small task per service on ARM processors and a serverless database that scales between zero and one capacity unit, pausing after a few minutes without connections and resuming on the next connection (about 15 seconds); single writer, no replicas, in both environments; high availability is out of scope. A fixed-size managed database instance was the fallback if scaling to zero were unavailable (research R6).
- The `dev` database may be reset at any time; the `prod` database is retained on stack destruction.
- Production approval is done through the CI platform's environment protection rules by the repository owner or a designated reviewer.
- Documentation required by FR-019 lives under `docs/` in English; course deliverables in Spanish are a separate concern.

## Out of Scope

- A custom domain name and DNS management.
- Multi-region or multi-availability-zone high availability, autoscaling policies and performance tuning.
- Formal database migration tooling and data migration from any existing environment.
- Running the dynamic security scan against the deployed environments (it keeps running against the Compose stack inside the DevSecOps pipeline).
- Application monitoring beyond log collection (metrics dashboards, alerting on error rates or availability, tracing); the only alert is the cost budget.
- A staging environment beyond `dev` and `prod`, or preview environments per pull request.
- Access restrictions on `dev` (edge password, IP allow-list); it is public by team decision.
- Changes to the DevSecOps scan stages, gates or exemption EX-001.
- New product features or user-facing changes, other than (a) the web app reading the API from the same origin and (b) the non-production label of FR-020.
