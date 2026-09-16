# Requirements Evaluation Report

**Feature**: User Authentication & Profile (`specs/006-user-auth/spec.md`)
**Evaluated**: 2026-09-16
**Sources**: `spec.md` (with Clarifications session 2026-09-16), `.specify/memory/constitution.md` v1.1.0

## 0. Readiness and extracted baselines

| Input | Required usable content | Status |
| --- | --- | --- |
| Constitution | Core principles and constraints | PASS |
| Spec Goal | Explicit objective | PASS (derived from Input + User Stories; no dedicated "Goal" heading) |
| Personas | Target users and their needs | PASS (inherited from constitution: "Iare") |
| Requirements | FR and NFR tables with IDs | PASS (FR-001..FR-015, NFR-001..NFR-004) |

**Extracted Baselines:**

1. Core Principles: I. Code Quality; II. Testing Standards (NON-NEGOTIABLE); III. User Experience Consistency; IV. Performance Requirements. Additional: security and maintainability prioritised; feature branches + PR review.
2. Goal & Out-of-Scope: Goal: let a visitor register, log in and receive a bearer token, and let an authenticated user read, update and delete their own profile, all under `api/v1/`. Out of scope: password reset, email verification, changing email/password, refresh tokens/logout/revocation, third-party login, admin roles, rate limiting/lockout.
3. Personas: "Iare" — full-time job, medium earnings, heavy debt, near-zero savings, no time for end-of-day logging; needs low-friction, fast interaction.

**Hygiene Findings:**

- No missing or duplicate requirement IDs.
- Spec has no explicit "Goal" heading; the objective is stated in the Input line and User Stories. Not a scoring defect.
- FR-012 references tables (categories, transactions, bot interactions) that this feature does not create (Assumptions, Clarification Q4). Consistent, but the cascade can only be verified once those tables exist.

**Readiness:** `READY TO EVALUATE`

## 1. Persona-needs coverage

| Role | Need | Requirement(s) | Coverage |
| --- | --- | --- | --- |
| Iare | Create an account and get in fast, with minimal friction | FR-001, FR-003, FR-005, SC-001 | Full |
| Iare | Link the account to the Telegram bot for low-friction logging | FR-001, FR-002 | Full |
| Iare | Configure how the month is tracked (budget limit, period start) | FR-010, FR-011, FR-013 | Full |
| Iare | Only they can see and change their money data | FR-008, FR-009, FR-012, NFR-003 | Full |
| Iare | Not be forced to re-authenticate constantly | FR-007 (24 h token) | Partial (no refresh; daily re-login by design, Out of Scope) |

## 2. Reverse traceability and scope

| Requirement | Serves | Constitution / Goal Alignment | Status |
| --- | --- | --- | --- |
| FR-001 | Account creation | Goal | Justified |
| FR-002 | Identity uniqueness | Goal, Security | Justified |
| FR-003 | Input validation at trust boundary | Security | Justified |
| FR-004 | Credential protection | Security | Justified |
| FR-005 | Login / token issuance | Goal | Justified |
| FR-006 | No user enumeration | Security | Justified |
| FR-007 | Bounded credential lifetime | Security | Justified |
| FR-008 | Data ownership | Security, III (consistent auth across features) | Justified |
| FR-009 | Profile read for dashboard | Goal | Justified |
| FR-010 | Profile update | Goal | Justified |
| FR-011 | Budget field validation | Goal (month tracking) | Justified |
| FR-012 | Account deletion, data ownership | Goal | Justified |
| FR-013 | Sensible defaults | Goal, III | Justified |
| FR-014 | API base path / JSON | III (consistency with team API doc) | Justified |
| FR-015 | Uniform error shape | III | Justified |
| NFR-001 | Latency | IV | Justified |
| NFR-002 | Hashing strength | Security | Justified |
| NFR-003 | Secret handling | Security | Justified |
| NFR-004 | Tests | II | Justified |

Orphan: 0. Out of scope: 0. Contradictory: 0.

## 3. Block A — Persona satisfaction

| Role | Need | Requirement(s) | Score / 5 | Evidence quote(s) | Path to maximum |
| --- | --- | --- | --- | --- | --- |
| Iare | Fast, low-friction sign-up and login | FR-001, FR-005, SC-001 | 5/5 | "register and log in in under 1 minute end to end" | — |
| Iare | Telegram bot linkage | FR-001, FR-002 | 5/5 | "optional `telegram_chat_id`" ; "already linked to another account" | — |
| Iare | Month-tracking settings | FR-010, FR-011, FR-013 | 5/5 | "`budget_start_day` MUST be an integer between 1 and 28" | — |
| Iare | Data ownership and privacy | FR-008, FR-012 | 5/5 | "identify the caller exclusively from the bearer token" | — |
| Iare | Not re-authenticate constantly | FR-007 | 3/5 | "Default lifetime: 24 hours" | Acceptable for v1; if daily re-login proves annoying, add a refresh-token feature (already listed Out of Scope). |

Block A = mean(5, 5, 5, 5, 3) = 23 / 25 = **9.20 / 10**

## 4. Block B — Critical problems & Constitution

| Principle / Goal | Sub-question | Score / 2 | Requirement(s) and evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| Goal (core problem) | Can a user get an identity and manage it? | 2/2 | FR-001, FR-005, FR-009, FR-010, FR-012 | — |
| I. Code Quality | Does the spec keep scope bounded to avoid accidental complexity? | 1/2 | Out of Scope lists 7 exclusions; Clarifications Q3/Q4 remove custom envelope and cross-feature seeding | Nothing further at spec level; migrations vs `create_all` and module layout belong in `plan.md`. |
| II. Testing Standards | Are tests mandated and enumerated? | 2/2 | NFR-004: "Every functional requirement MUST be covered by automated tests"; SC-005 | — |
| III. UX Consistency | Are contracts uniform for the frontend? | 2/2 | FR-014, FR-015: "single shape across the API"; FR-006 | — |
| IV. Performance | Are latency targets stated and measurable? | 2/2 | NFR-001: "under 500 ms at the 95th percentile" | — |

**Mandatory Invariants (Constitution):**

- Tests accompany every feature (II): PASS — NFR-004, SC-005.
- Security prioritised (Additional Constraints): PASS — FR-004, FR-006, NFR-002, NFR-003.
- Work on feature branch, PR to develop: PASS — `Feature Branch: feature/user-auth`.
- Schema follows constitution ERD: PASS with documented addition — Assumptions add `hashed_password`, which the ERD omits; the spec flags it explicitly.

Block B = 9 / 10 = **9.00 / 10**

## 5. Block C — Backlog quality

Criteria per requirement: Clear, Atomic, Unique, Traceable, Testable (1 point each).

| Requirement | Score / 5 | Failed criteria | Evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| FR-001..FR-007 | 5/5 each | — | Each names one behaviour with concrete values (8 chars, 24 h, JSON body) | — |
| FR-008 | 4/5 | Atomic | "and by extension categories and transactions" reaches into other features | Drop the parenthetical; keep "every private endpoint". |
| FR-009..FR-011 | 5/5 each | — | Field lists and ranges are explicit | — |
| FR-012 | 4/5 | Testable (now) | Cascade targets "categories, transactions and bot interactions" do not exist in this feature | Add: "Cascade is enforced by foreign-key `ON DELETE CASCADE` declared by each owning feature." |
| FR-013..FR-015 | 5/5 each | — | Defaults, base path and error shape are exact | — |
| NFR-001 | 4/5 | Clear | "under normal load" is unquantified | State a load, e.g. "with 10 concurrent logins". |
| NFR-002..NFR-004 | 5/5 each | — | Named algorithm class, env-sourced secret, test mandate | — |

Block C = 92 / 95 × 10 = **9.68 / 10**

## 6. Block D — Quality attributes and feasibility

| Scenario | Score / 2 | Requirement(s) and evidence | Missing or degraded behavior | Path to maximum |
| --- | --- | --- | --- | --- |
| Edge cases | 2/2 | Edge Cases: case-insensitive email, whitespace, wrong scheme, concurrent registration, in-flight delete | — | — |
| Performance | 2/2 | NFR-001 | — | — |
| Security | 2/2 | FR-004, FR-006, FR-007, NFR-002, NFR-003 | — | — |
| Error handling | 2/2 | FR-015, FR-006, User Story scenarios for 401/409/422 | — | — |
| Observability | 1/2 | FR-004 "never persisted or logged" (only a negative constraint) | No statement on what auth events are logged | Add one NFR: "Failed logins and account deletions are logged with user id or email, never with credentials." Optional for v1. |

Block D = 9 / 10 = **9.00 / 10**

## 7. Score summary

| Dimension | Arithmetic | Score |
| --- | --- | ---: |
| Block A — Persona satisfaction | 23 / 25 × 10 | 9.20 |
| Block B — Critical problems & Constitution | 9 / 10 × 10 | 9.00 |
| Block C — Backlog quality | 92 / 95 × 10 | 9.68 |
| Block D — Quality attributes | 9 / 10 × 10 | 9.00 |
| **Overall** | 9.20×0.30 + 9.00×0.30 + 9.68×0.20 + 9.00×0.20 = 2.76 + 2.70 + 1.94 + 1.80 | **9.20** |
| **Verdict** | Overall ≥ 8.00 ✔, all blocks ≥ 7.00 ✔, 0 out-of-scope / contradictory ✔ | **ACCEPTABLE** |

## 8. Critical gaps

None blocking. Minor, non-blocking:

- `FR-012 — data ownership — cascade targets outside this feature — verifiable only after categories/transactions land — add FK-cascade wording (see Block C).`
- `NFR-001 — performance — "normal load" — unquantified — name a concurrency figure.`
- `Observability — operations — no positive logging requirement — add one NFR or defer to plan.`

## 9. Recommendation

ACCEPTABLE. Proceed to `/speckit-plan`. Optionally apply the three one-line edits above first; none changes scope or the frontend contract.
