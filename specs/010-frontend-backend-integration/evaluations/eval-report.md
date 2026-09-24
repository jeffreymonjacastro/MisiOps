# Requirements Evaluation Report

**Feature**: Frontend-Backend Integration (`specs/010-frontend-backend-integration/spec.md`)
**Evaluated**: 2026-09-18
**Sources**: `spec.md` (with Clarifications session 2026-09-18), `.specify/memory/constitution.md` v1.1.0, upstream contracts in `specs/006-user-auth`, `specs/007-categories`, `specs/008-transactions`

## 0. Readiness and extracted baselines

| Input | Required usable content | Status |
| --- | --- | --- |
| Constitution | Core principles and constraints | PASS |
| Spec Goal | Explicit objective | PASS (Input line + User Stories 1-5) |
| Personas | Target users and their needs | PASS (constitution persona "Iare") |
| Requirements | FR and NFR tables with IDs | PASS (FR-001..FR-013, NFR-001..NFR-005) |
| Upstream contracts | API surface this feature consumes | PASS (3 OpenAPI contracts, implemented in `develop`) |

**Extracted Baselines:**

1. Core Principles: I. Code Quality; II. Testing Standards (non-negotiable); III. UX Consistency; IV. Performance. Additional: security and maintainability; feature branches, PR review, CI gates.
2. Goal & Out-of-Scope: Goal: make the existing frontend read and write real per-account data from the backend, replacing the browser-local ledger. Out of scope: any backend change, password reset, profile editing, data migration, offline support, the chatbot path.
3. Personas: "Iare" — time-poor, wants low-friction logging and a clear view of where money goes.

**Hygiene Findings:**

- No missing or duplicate IDs.
- FR-012 ("MUST NOT persist ledger data in the browser") and the Assumptions entry that keeps the *session token* in browser storage are not contradictory: the first concerns ledger data, the second a credential. Wording checked to make the distinction explicit.
- This spec consumes upstream requirements rather than restating them; no requirement here duplicates one in 006-008.

**Readiness:** `READY TO EVALUATE`

## 1. Persona-needs coverage

| Role | Need | Requirement(s) | Coverage |
| --- | --- | --- | --- |
| Iare | Keep his data when he changes browser or device | FR-001, FR-007, FR-012, SC-001 | Full |
| Iare | Log an expense fast, without setup | FR-007, US2, SC-005 | Full |
| Iare | Trust the dashboard numbers | FR-009, SC-002 | Full |
| Iare | Never see another person's money | FR-003, SC-003 | Full |
| Iare | Not be confused when the network fails | FR-010, FR-011, SC-004 | Full |
| Iare | Fix a category without losing history | FR-006 (surfacing the 409 guards) | Full |

## 2. Reverse traceability and scope

| Requirement | Serves | Constitution / Goal Alignment | Status |
| --- | --- | --- | --- |
| FR-001, FR-002, FR-004 | US1 sign-in loop | Goal (per-account data) | Justified |
| FR-003, FR-005 | US1 isolation and expiry | Security constraint | Justified |
| FR-006 | US4 categories | Goal | Justified |
| FR-007, FR-008 | US2 transactions and history | Goal, Principle IV (paging) | Justified |
| FR-009 | US3 dashboard | Goal, Principle IV | Justified |
| FR-010, FR-011, FR-013 | US5 network states | Principle III (UX consistency) | Justified |
| FR-012 | US1/US2 single source of truth | Goal | Justified |
| NFR-001 | Perceived performance | Principle IV | Justified |
| NFR-002 | Credential hygiene | Security constraint | Justified |
| NFR-003, NFR-004 | Mobile + a11y | Principle III | Justified |
| NFR-005 | Test coverage | Principle II (non-negotiable) | Justified |

No requirement lacks a serving story; no story lacks a requirement. Zero out-of-scope requirements.

## 3. Block A — Persona satisfaction

| Criterion | Max | Score | Note |
| --- | ---: | ---: | --- |
| Primary need addressed | 5 | 5 | Data becomes real and portable across devices |
| Friction removed | 5 | 4 | Login adds a step the local-only app did not have; unavoidable for multi-user |
| Trust in the numbers | 5 | 5 | Totals come from the server, removing browser/server drift |
| Failure comprehension | 5 | 5 | US5 forbids "empty state" masquerading as failure |
| Fit with existing UI | 5 | 4 | Screens keep their shape; loading/error states are new furniture |
| **Total** | **25** | **23** | |

## 4. Block B — Critical problems & Constitution

| Check | Status | Note |
| --- | --- | --- |
| Contradictory requirements | PASS | Ledger-vs-credential storage distinction verified (see Hygiene) |
| Violates a core principle | PASS | Testing required by NFR-005; a11y by NFR-004 |
| Unbounded scope | PASS | Out of Scope lists 7 exclusions, including any backend change |
| Security regression | PASS with note | Token in browser storage is a documented, accepted trade-off with a named future revisit |
| Untestable requirement | PASS | Each FR has an observable outcome |
| **Score** | **10 / 10** | |

## 5. Block C — Backlog quality

| Criterion | Max | Score | Note |
| --- | ---: | ---: | --- |
| Stories independently testable | 15 | 14 | US2-US5 depend on US1 for a session; unavoidable and stated |
| Priorities justified | 10 | 10 | P1 on the auth/record/dashboard loop, P2 on refinement |
| Acceptance scenarios concrete | 15 | 14 | Given/When/Then throughout; a few lean on server behaviour defined upstream |
| Edge cases identified | 10 | 10 | 6 cases including token rejection and cross-tab deletion |
| Success criteria measurable | 15 | 14 | SC-001..SC-006 measurable; SC-005 depends on tester speed |
| **Total** | **65** | **62** | |

## 6. Block D — Quality attributes and feasibility

| Criterion | Max | Score | Note |
| --- | ---: | ---: | --- |
| Performance stated | 3 | 3 | NFR-001, plus server-side paging in FR-008 |
| Security stated | 3 | 2 | Trade-off accepted rather than eliminated |
| Accessibility stated | 2 | 2 | NFR-003, NFR-004 |
| Feasible with current stack | 2 | 2 | Backend already implemented and reachable in `develop` |
| **Total** | **10** | **9** | |

## 7. Score summary

| Dimension | Arithmetic | Score |
| --- | --- | ---: |
| Block A — Persona satisfaction | 23 / 25 × 10 | 9.20 |
| Block B — Critical problems & Constitution | 10 / 10 × 10 | 10.00 |
| Block C — Backlog quality | 62 / 65 × 10 | 9.54 |
| Block D — Quality attributes | 9 / 10 × 10 | 9.00 |
| **Overall** | 9.20×0.30 + 10.00×0.30 + 9.54×0.20 + 9.00×0.20 = 2.76 + 3.00 + 1.91 + 1.80 | **9.47** |
| **Verdict** | Overall ≥ 8.00 ✔, all blocks ≥ 7.00 ✔, 0 out-of-scope / contradictory ✔ | **ACCEPTABLE** |

## 8. Critical gaps

None blocking. One item for the reviewer's attention: the session credential lives in browser storage (Clarifications Q1). This is accepted here because the app has no server session layer, and it is recorded so a later feature can move to an HTTP-only cookie behind a backend-for-frontend.

## 9. Recommendation

ACCEPTABLE. Proceed to `/speckit-plan`.
