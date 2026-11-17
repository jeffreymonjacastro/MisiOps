# Requirements Evaluation Report

**Feature**: DevSecOps for MisiOps (`specs/011-devsecops/spec.md`)
**Evaluated**: 2026-11-03 (iteration 2)
**Sources**: `spec.md` (with Clarifications session 2026-11-03, amended after iteration 1), `.specify/memory/constitution.md` v1.1.0

> **Iteration history.** Iteration 1 scored **8.27 — NOT ACCEPTABLE**: FR-012 let code merge into `develop` while a security scan failed, contradicting the constitution's Development Workflow; Block B scored 6.67. The user approved the corrections below (except non-default DefectDojo credentials, recorded as an accepted risk), and this iteration evaluates the corrected spec.
>
> | Iteration 1 gap | Correction in the spec |
> | --- | --- |
> | FR-012 contradicts Development Workflow | FR-012 rewritten (enforcing in `develop`; baseline inside the feature PR) + FR-012b (justified suppressions) |
> | No tests for new scripts (Constitution II) | NFR-006 |
> | No delivery stage gated by scans (Additional Constraints) | FR-015a |
> | Tunnel exposes DefectDojo with default credentials | Accepted risk, documented in Assumptions and Clarifications |
> | Evaluator links not required | FR-016 extended |
> | Ranking / priority undefined (FR-003, FR-014) | Rules added to both |
> | Non-atomic FR-008, FR-010, FR-011 | Split into FR-008a, FR-010a, FR-011a |

## 0. Readiness and extracted baselines

| Input | Required usable content | Status |
| --- | --- | --- |
| Constitution | Core principles and constraints | PASS |
| Spec Goal | Explicit objective | PASS |
| Personas | Target users and their needs | PASS with note (roles inside user stories) |
| Requirements | FR and NFR tables with IDs | PASS (24 FR, 6 NFR) |

**Extracted Baselines:**
1. Core Principles: I. Code Quality; II. Testing Standards (non-negotiable); III. UX Consistency; IV. Performance. Additional Constraints: "Deployments MUST NOT occur without passing automated security scans"; dependencies audited for known vulnerabilities. Development Workflow: "Code MUST NOT be merged until all automated Continuous Integration (CI) quality gates (tests, linting, security scans) have passed".
2. Goal & Out-of-Scope: cover the course brief items 2a-2k (threat model, security scanning in CI, centralization, prioritized remediation, evidence document). Out of scope: product features, CI migration, permanent public DefectDojo, fixing every finding, PDF report and presentation, MLOps.
3. Personas: the team, the course evaluator, the end user "Iare" (via the constitution).

**Hygiene Findings:** Sub-IDs (`a`, `b`) are deliberate splits. No duplicates, no conflicting statements remain (checked for "merge is not blocked", "fixes are merged").
**Readiness:** `READY TO EVALUATE`

## 1. Persona-needs coverage

| Role | Need | Requirement(s) | Coverage |
| --- | --- | --- | --- |
| Evaluator | Answer and evidence for every item 2a-2k | FR-016, FR-017 | Full |
| Evaluator | Shareable links to diagram and spreadsheet | FR-016 | Full |
| Team | Every change checked automatically | FR-004..FR-009 | Full |
| Team | All findings in one place, no duplicates | FR-010, FR-010a, FR-011, FR-011a | Full |
| Team | Clear, predictable merge policy | FR-012, FR-012a, FR-012b | Full |
| End user (Iare) | Their data protected by what gets fixed first | FR-014 | Full (tie-break within severity) |

## 2. Reverse traceability and scope

| Requirement | Serves | Constitution / Goal Alignment | Status |
| --- | --- | --- | --- |
| FR-001..FR-003 | Items 2b, 2c | Goal | Justified |
| FR-004, FR-005 | Item 2d | Goal | Justified |
| FR-006..FR-009, FR-008a | Item 2e | Goal; dependency auditing | Justified |
| FR-010, FR-010a, FR-011, FR-011a | Item 2f | Goal | Justified |
| FR-012, FR-012a, FR-012b | Merge policy | Development Workflow | Justified |
| FR-013, FR-014 | Items 2g, 2h | Goal | Justified |
| FR-015, FR-015a | Item 2i | Goal; Additional Constraints | Justified |
| FR-016, FR-017 | Items 2a-2k | Goal | Justified |
| FR-018 | Secret hygiene | Additional Constraints | Justified |
| NFR-001..NFR-006 | CI usability, reproducibility, retention, regressions, script tests | Principles I, II, IV | Justified |

Zero orphan, out-of-scope or contradictory requirements.

## 3. Block A — Persona satisfaction

| Role | Need | Requirement(s) | Score / 5 | Evidence quote(s) | Path to maximum |
| --- | --- | --- | --- | --- | --- |
| Evaluator | Items 2a-2k answered with evidence | FR-016 | 5/5 | "MUST answer items 2a-2k in question-answer format" | — |
| Evaluator | Links to diagram and spreadsheet | FR-016 | 5/5 | "MUST include the shareable links of the STRIDE diagram and spreadsheet" | — |
| Team | Automatic checks on every change | FR-004 | 5/5 | "on every pull request to `develop` and every push" | — |
| Team | Findings centralized | FR-010, FR-010a | 5/5 | "findings absent from a newer run MUST be shown as closed" | — |
| Team | Clear merge policy | FR-012, FR-012a | 5/5 | "the security stages arrive in `develop` already enforcing" | — |
| End user | Data protected first | FR-014 | 4/5 | "findings tied to the STRIDE threats on user credentials and financial data come first" | Only a tie-breaker within a severity; would need a severity uplift rule to reach 5 |

## 4. Block B — Critical problems & Constitution

| Principle / Goal | Sub-question | Score / 2 | Requirement(s) and evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| Goal | Are items 2a-2k all covered? | 2/2 | FR-001..FR-017 | — |
| I. Code Quality | Reproducible tools, explicit policy? | 2/2 | NFR-002: "pinned to a specific version" | — |
| II. Testing (non-negotiable) | Do new artefacts come with tests? | 2/2 | NFR-006: "MUST have an automated test that runs in CI" | — |
| IV. Performance | Is CI time bounded? | 2/2 | NFR-001: "finish within 20 minutes" | — |
| Development Workflow | Does code merge only after scans pass? | 2/2 | FR-012: "code reaching `develop` has passed them" | — |
| Additional Constraints | Do deployments require passing scans? | 2/2 | FR-015a: "publishes … only after every security stage has passed" | — |

**Mandatory Invariants (Constitution):**
- Development Workflow (merge only after security scans pass): PASS — FR-012.
- Testing Standards: PASS — NFR-005, NFR-006.
- Additional Constraints (deploy only after scans; dependencies audited): PASS — FR-015a, FR-007.

## 5. Block C — Backlog quality

| Requirement | Score / 5 | Failed criteria | Evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| 21 FRs (all except FR-012, FR-014, FR-016) | 5/5 each | — | — | — |
| FR-012 | 4/5 | Atomic | Enforcement rule and the location of the baseline in one requirement | Optionally split the baseline location into its own requirement |
| FR-014 | 4/5 | Atomic | Baseline, remediation, re-scan and priority rule together | Optionally split the priority rule |
| FR-016 | 4/5 | Atomic | Content, format, evidence, paths and links together | Acceptable for a document requirement |
| NFR-001..NFR-006 | 5/5 each | — | — | — |

Total: 21×5 + 3×4 + 6×5 = 105 + 12 + 30 = **147 / 150**.

## 6. Block D — Quality attributes and feasibility

| Scenario | Score / 2 | Requirement(s) and evidence | Missing or degraded behavior | Path to maximum |
| --- | --- | --- | --- | --- |
| Edge cases | 2/2 | Six edge cases incl. unreachable platform, empty results, unfixable deps, forks | — | — |
| Performance | 2/2 | NFR-001 | — | — |
| Security of the pipeline itself | 1/2 | FR-018, NFR-002; Assumptions: accepted risk | DefectDojo exposed through the tunnel with default credentials — accepted by the team, not mitigated | Mitigation would be non-default credentials; accepted risk is documented and justified |
| Error handling | 2/2 | FR-011, Edge Cases | — | — |
| Observability / retention | 2/2 | NFR-003 | — | — |

## 7. Score summary

| Dimension | Arithmetic | Score |
| --- | --- | ---: |
| Block A — Persona satisfaction | (5+5+5+5+5+4) / 30 × 10 | 9.67 |
| Block B — Critical problems & Constitution | 12 / 12 × 10 | 10.00 |
| Block C — Backlog quality | 147 / 150 × 10 | 9.80 |
| Block D — Quality attributes | 9 / 10 × 10 | 9.00 |
| **Overall** | 9.67×0.30 + 10.00×0.30 + 9.80×0.20 + 9.00×0.20 = 2.90 + 3.00 + 1.96 + 1.80 | **9.66** |
| **Verdict** | Overall ≥ 8.00 ✔ · all blocks ≥ 7.00 ✔ · 0 out-of-scope / contradictory ✔ | **ACCEPTABLE** |

## 8. Critical gaps

None blocking. One accepted risk (DefectDojo default credentials over the tunnel) is recorded with justification and must appear in the evidence document's risk register.

## 9. Recommendation

ACCEPTABLE. Proceed to `/speckit-plan`.

---

## Iteration 3 — 2026-11-05 (re-check after team-lead gate decision)

**Change evaluated**: FR-004, FR-012, FR-012a, FR-015a, SC-001, new SC-008 and Clarifications session 2026-11-05. Security gates now block merges into `main` (required checks on the "Protect main" ruleset). Pull requests into `develop` run the same scans as report-only.

**Constitution check (Block B)**: Report-only merges into `develop` would contradict Development Workflow ("Code MUST NOT be merged until … security scans have passed"). Constitution v1.2.0 adds the temporary exemption **EX-001**. It has a defined scope (security scans, merges into `develop` only), a justification, team-lead approval (manual step M6) and an expiry date (2026-12-31). The contradiction is therefore covered by a governed exemption, not ignored. Additional Constraints ("Deployments MUST NOT occur without passing automated security scans") stays satisfied, because FR-015a now delivers only from `main` after every gate passes. Block B stays at 12/12.

**Block C**: SC-008 is new, measurable and atomic. FR-012 and FR-012a stay single-purpose. No score change.

**Verdict**: Unchanged — **9.66, ACCEPTABLE**. EX-001 becomes effective once M6 is done.

**Addendum 2026-11-11 (post-merge gate finding)**: the first `develop` → `main` pull request after the AWS deployment feature was blocked by the `container` gate (2 fixable HIGH CVEs in `zlib1g` of `python:3.13-slim`). FR-012 behaved as specified; the remediation (build-time OS upgrade, T050) is recorded in the plan's remediation approach. No score change.
