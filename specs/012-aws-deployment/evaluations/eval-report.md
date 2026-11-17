# Requirements Evaluation Report

**Feature**: AWS Deployment for MisiOps (`specs/012-aws-deployment/spec.md`)
**Evaluated**: 2026-11-07 (iteration 1)
**Sources**: `spec.md` (with Clarifications session 2026-11-07), `.specify/memory/constitution.md` v1.3.0

## 0. Readiness and extracted baselines

| Input | Required usable content | Status |
| --- | --- | --- |
| Constitution | Core principles and constraints | PASS |
| Spec Goal | Explicit objective | PASS (Input + User Story 1-3) |
| Personas | Target users and their needs | PASS with note (roles inside user stories, no Personas section) |
| Requirements | FR and NFR tables with IDs | PASS (20 FR, 8 NFR) |

**Extracted Baselines:**

1. Core Principles: I. Code Quality; II. Testing Standards (non-negotiable: "Changes MUST NOT be merged if they decrease overall test coverage or if any tests fail"); III. User Experience Consistency; IV. Performance Requirements. Additional Constraints: "Production deployments MUST NOT occur without passing automated security scans". Deployment Environments (new in v1.3.0): `dev` deployed from `develop` after the pipeline completes in report-only mode; `prod` only from `main` after every gate, with explicit approval; "exact container images that the DevSecOps pipeline built and scanned"; "short-lived (OIDC federation)"; "A failed deployment MUST roll back automatically". EX-001 expires 2026-12-31.
2. Goal: describe both environments as code, deploy `dev` automatically after the DevSecOps pipeline on `develop`, gate `prod` on `main` behind passing scans and approval, roll back on failure, keep every secret out of the repository and CI. Out of scope: custom domain, HA/autoscaling, migrations, DAST against deployed environments, monitoring beyond logs, staging/preview environments, changes to scan stages or EX-001, product features, access restrictions on `dev`.
3. Personas (inferred from user stories): team member operating the cloud account (US1, US6), developer merging into `develop` (US2), production approver / repository owner (US3), new team member onboarding (SC-006), tester using `dev` (FR-020), end user "Iare" (constitution) whose data must be protected in `prod` (US3-US5).

**Hygiene Findings:** IDs sequential, no duplicates. One internal tension: FR-020 allows the non-production label "in the address or title", but the Assumptions fix a provider-generated address (cannot carry an environment name), so the label must appear in the web app title, which the Out of Scope section excludes ("New product features or user-facing changes, other than the web app reading the API from the same origin"). Not a constitution conflict; scored once in Block C.
**Readiness:** `READY TO EVALUATE`

## 1. Persona-needs coverage

| Role | Need | Requirement(s) | Coverage |
| --- | --- | --- | --- |
| Operator | Create/update/destroy a whole environment from code | FR-001, FR-002, FR-007, FR-019 | Full |
| Operator | Both environments identical in shape, `prod` creatable later without code change | FR-002 (clarified), FR-010 | Full |
| Developer | Merge into `develop` becomes a running `dev` with no manual step | FR-008, FR-009, FR-010, FR-015, FR-017, NFR-001 | Full |
| Developer | Know which pipeline run produced what is deployed | FR-009, Key Entity Deployment | Full |
| Approver | Production only after gates, only with my approval | FR-010, FR-011, FR-012 | Full |
| Operator | Bad version heals itself, no full outage | FR-013, FR-014, FR-017 | Full |
| Operator | No secret or cloud key in repo or CI | FR-006, FR-011, FR-012, NFR-007 | Full |
| Operator | Investigate a problem days later | FR-016 | Full |
| Operator | Not surprised by cost | FR-018, NFR-003 | Partial (alert recipient undefined) |
| New team member | Bring up `dev` from docs in under an hour | FR-019, SC-006 | Full |
| Tester | Reach `dev` over HTTPS, know it is non-production | FR-003, FR-020, NFR-008 | Partial (label placement, see Hygiene) |
| End user (Iare) | Credentials and finances protected in `prod` | FR-005, FR-006, FR-010, NFR-004, NFR-008 | Full |
| End user (Iare) | App stays responsive on the smallest sizing | none | Not covered (no runtime latency target) |

## 2. Reverse traceability and scope

| Requirement | Serves | Constitution / Goal Alignment | Status |
| --- | --- | --- | --- |
| FR-001, FR-002 | Operator: reproducible environments | Goal; Deployment Environments ("same infrastructure-as-code definition") | Justified |
| FR-003, FR-004 | Same-origin app, local flows intact | Goal; Principle III (behaviour unchanged) | Justified |
| FR-005, FR-006 | Protect data and secrets | Additional Constraints; Deployment Environments | Justified |
| FR-007 | Broken definition cannot merge | Development Workflow (CI gates) | Justified |
| FR-008, FR-009, FR-010 | PR → pipeline → deploy; prod gated | Deployment Environments (both environments, exact images, approval) | Justified |
| FR-011, FR-012 | Short-lived, least-privilege CI identity | Deployment Environments ("OIDC federation") | Justified |
| FR-013, FR-014, FR-015 | Rollback, no outage, one deployment at a time | Deployment Environments ("roll back automatically") | Justified |
| FR-016 | Debuggability | Goal (US6) | Justified |
| FR-017 | Deployment verified | Principle II (verification) | Justified |
| FR-018 | Cost control | Goal (student budget, Assumptions) | Justified |
| FR-019 | Onboarding, operations | Principle I (maintainability) | Justified |
| FR-020 | `dev` non-production | Deployment Environments ("MUST NOT hold real user data") | Justified (placement tension, Block C) |
| NFR-001, NFR-002 | Fast feedback | Principle IV | Justified |
| NFR-003 | Budget ceiling | Goal | Justified |
| NFR-004 | Data durability, encryption at rest | Additional Constraints (security) | Justified |
| NFR-005 | Reproducible pipeline | Consistent with 011 NFR-002 | Justified |
| NFR-006 | Existing gates untouched | Development Workflow | Justified |
| NFR-007 | Tests for infrastructure | Principle II | Justified |
| NFR-008 | HTTPS everywhere | Additional Constraints (security) | Justified |

No requirement is Orphan, Out of scope or Contradictory.

## 3. Block A — Persona satisfaction

| Role | Need | Requirement(s) | Score / 5 | Evidence quote(s) | Path to maximum |
| --- | --- | --- | --- | --- | --- |
| Operator | Reproducible, destroyable environments; cost known | FR-001, FR-002, FR-018, FR-019 | 5/5 | "describe every cloud resource of a MisiOps environment … as version-controlled code" | — |
| Developer | Merge becomes `dev` automatically with traceability | FR-008, FR-009, FR-015, FR-017 | 5/5 | "deploy the exact container images built and scanned by the DevSecOps pipeline run" | — |
| Approver | Prod only after gates + approval | FR-010, FR-011, FR-012 | 5/5 | "only after a designated reviewer approves the deployment" | — |
| New team member | Onboard in under an hour | FR-019, SC-006 | 5/5 | "one-time account preparation steps … and the day-to-day flow" | — |
| Tester | HTTPS `dev`, clearly non-production | FR-003, FR-020, NFR-008 | 4/5 | "labelled as non-production in its public-facing identifiers" | FR-020: state where the label lives (web app title/banner when environment is `dev`) and carve that exception into Out of Scope |
| End user (Iare) | Data protected; app responsive | FR-005, FR-006, NFR-004, NFR-008 | 4/5 | "database MUST NOT be reachable from the public internet" | Add an NFR with a user-facing responsiveness target on the chosen sizing (e.g., home page and API health answer within 2 s at p95 at idle) |

Mean: 28/30 → **9.33/10**.

## 4. Block B — Critical problems & Constitution

| Principle / Goal | Sub-question | Score / 2 | Requirement(s) and evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| I. Code Quality | Is the infrastructure maintainable, pinned, documented? | 2/2 | FR-001, FR-019, NFR-005: "pinned to a specific version" | — |
| II. Testing Standards | Are infrastructure and deployment verified by automated tests in CI? | 2/2 | FR-007, FR-017, NFR-007: "automated tests that run in CI and assert the security-relevant properties" | — |
| III. UX Consistency | Does the deployment leave user-facing behaviour consistent? | 1/2 | FR-003, FR-004 keep behaviour; FR-020's label placement is undefined and may add UI without a stated pattern | Define the `dev` label as a single, consistent element (title suffix or banner) in FR-020 |
| IV. Performance | Are performance expectations stated? | 1/2 | NFR-001, NFR-002 cover pipeline time only; no runtime target on "smallest available sizes" | Add runtime responsiveness NFR (see Block A, end user) |
| Additional Constraints + Deployment Environments | Prod gated on scans and approval; exact images; OIDC; rollback; `dev` non-production | 2/2 | FR-008..FR-013, FR-020: "rebuilding images during deployment is forbidden" | — |

Total: 8/10 → **8.00/10**.

**Mandatory Invariants (Constitution):**

- Production deployments only after passing security scans: PASS — FR-010 "only when every security gate passed in blocking mode".
- Explicit approval before `prod`: PASS — FR-010, SC-002.
- Same scanned images, no rebuild: PASS — FR-009.
- Short-lived OIDC credentials, no long-lived keys: PASS — FR-011, SC-005.
- Automatic rollback: PASS — FR-013.
- `dev` holds no real data, non-production: PASS — FR-020.
- Existing CI gates not weakened: PASS — NFR-006.
- Tests accompany the change (Principle II): PASS — NFR-007.
- Development on feature branch + PR to `develop`: PASS — branch `feature/aws-deployment` (process, outside spec text).
- EX-001 expiry handled: PASS — Edge case "What happens when EX-001 expires?".

## 5. Block C — Backlog quality

Criteria: Clear, Atomic, Unique, Traceable, Testable (1 point each).

| Requirement | Score / 5 | Failed criteria | Evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| FR-001, FR-002 | 5/5 | — | — | — |
| FR-003 | 4/5 | Clear | "documentation and schema paths (`/openapi.json`, `/docs`)" — the API also serves `/redoc`; and nothing states that API responses must not be cached or that authorization headers must be forwarded by the content delivery layer | Add `/redoc` and: "the content delivery layer MUST NOT cache API responses and MUST forward request headers and cookies to the API" |
| FR-004..FR-014 | 5/5 | — | — | — |
| FR-015 | 4/5 | Clear | "a newer deployment supersedes a queued older one" — behaviour for an *in-flight* older deployment is unstated | State: in-flight deployments finish or roll back; only queued ones are superseded |
| FR-016, FR-017 | 5/5 | — | — | — |
| FR-018 | 4/5 | Testable | "notifies the team" — recipient undefined | Name the recipient (repository owner's email) or make it a deployment parameter |
| FR-019 | 5/5 | — | — | — |
| FR-020 | 3/5 | Clear, Testable | "environment name in the address or title" — address is provider-generated (Assumptions), so only the title is feasible, which Out of Scope excludes | Rewrite: "the web app MUST display a visible non-production label when the environment is `dev`"; add that exception to Out of Scope |
| NFR-001..NFR-008 | 5/5 | — | — | — |

Total: 135/140 → **9.64/10**.

## 6. Block D — Quality attributes and feasibility

| Scenario | Score / 2 | Requirement(s) and evidence | Missing or degraded behavior | Path to maximum |
| --- | --- | --- | --- | --- |
| Edge cases & failure handling | 1/2 | 8 edge cases; FR-009 "MUST fail if those artifacts are unavailable" | Content delivery layer in front of the API (NFR-008) introduces a new failure mode absent from Edge Cases: cached or stripped API responses serving stale or wrong-user data | Add edge case + FR-003 addendum on no-cache / header forwarding for `/api/*` |
| Performance | 2/2 | NFR-001 15 min, NFR-002 5 min, SC-008 | — | — |
| Security | 2/2 | FR-005, FR-006, FR-011, FR-012, NFR-004, NFR-008 | — | — |
| Error handling & recovery | 2/2 | FR-013, FR-014, FR-017, SC-004 | — | — |
| Cost & feasibility | 2/2 | NFR-003 60 USD at idle, FR-018, Assumptions (smallest sizes, single AZ) | Tight but attainable with one small task per service, smallest burstable database and free-tier content delivery | — |

Total: 9/10 → **9.00/10**.

## 7. Score summary

| Dimension | Arithmetic | Score |
| --- | --- | ---: |
| Block A — Persona satisfaction | 28 / 30 × 10 | 9.33 |
| Block B — Critical problems & Constitution | 8 / 10 × 10 | 8.00 |
| Block C — Backlog quality | 135 / 140 × 10 | 9.64 |
| Block D — Quality attributes | 9 / 10 × 10 | 9.00 |
| **Overall** | **9.33 × 0.30 + 8.00 × 0.30 + 9.64 × 0.20 + 9.00 × 0.20 = 2.80 + 2.40 + 1.93 + 1.80** | **8.93** |
| **Verdict** | **Overall ≥ 8.00; all blocks ≥ 7.00; 0 out-of-scope / contradictory** | **ACCEPTABLE** |

## 8. Critical gaps

- `FR-003 / Edge Cases — Developer, End user — "content delivery layer … in front of the load balancer" (NFR-008) — API responses could be cached or lose authorization headers, serving stale or another user's data — Add to FR-003: "the content delivery layer MUST NOT cache API responses and MUST forward headers and cookies"; add the matching edge case; add `/redoc`.`
- `FR-020 — Tester — "environment name in the address or title" — address is provider-generated; title change is excluded by Out of Scope — Rewrite FR-020 to require a visible non-production label in the web app for `dev` and list it as the second user-facing exception in Out of Scope.`
- `Performance (Principle IV) — End user — no runtime target — "smallest available sizes" may be too small for acceptable response time — Add NFR-009: home page and API health respond within 2 s at p95 at idle on each environment.`
- `FR-018 — Operator — "notifies the team" — recipient unverifiable — Name the recipient or make it a required deployment parameter.`

## 9. Recommendation

ACCEPTABLE at 8.93. The four textual corrections in section 8 were approved by the user and applied to `spec.md` on 2026-11-07 (FR-003 no-cache/header forwarding + `/redoc` + new edge case; FR-020 label in the web app + Out of Scope exception; NFR-009 and SC-009 runtime responsiveness; FR-018 notification address as a required parameter). No scope change; proceed to `/speckit-plan`.
