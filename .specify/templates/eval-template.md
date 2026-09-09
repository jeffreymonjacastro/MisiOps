# Requirements Evaluation Report

## 0. Readiness and extracted baselines

| Input | Required usable content | Status |
| --- | --- | --- |
| Constitution | Core principles and constraints | [PASS/FAIL] |
| Spec Goal | Explicit objective | [PASS/FAIL] |
| Personas | Target users and their needs | [PASS/FAIL] |
| Requirements | FR and NFR tables with IDs | [PASS/FAIL] |

**Extracted Baselines:**
1. Core Principles: [List]
2. Goal & Out-of-Scope: [List]
3. Personas: [List]

**Hygiene Findings:** [List missing IDs, duplicates, etc.]
**Readiness:** `[READY TO EVALUATE / NOT EVALUABLE]`

## 1. Persona-needs coverage

| Role | Need | Requirement(s) | Coverage |
| --- | --- | --- | --- |
| [Role] | [Literal need or summary] | [FR-XX, NFR-YY or none] | [Full / Partial / Not covered] |

## 2. Reverse traceability and scope

| Requirement | Serves | Constitution / Goal Alignment | Status |
| --- | --- | --- | --- |
| [FR-XX / NFR-YY] | [Need, flow, problem] | [Principle or Goal] | [Justified / Orphan / Out of scope / Contradictory] |

## 3. Block A — Persona satisfaction

| Role | Need | Requirement(s) | Score / 5 | Evidence quote(s) | Path to maximum |
| --- | --- | --- | --- | --- | --- |
| [Role] | [Need] | [FR-XX] | [X/5] | "[Quote max 15 words]" | [Minimum textual change] |

## 4. Block B — Critical problems & Constitution

| Principle / Goal | Sub-question | Score / 2 | Requirement(s) and evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| [e.g. Performance] | [Are latency goals met?] | [X/2] | [NFR-YY: "Quote"] | [Correction] |

**Mandatory Invariants (Constitution):**
- [Invariant 1]: [PASS/FAIL] - Evidence

## 5. Block C — Backlog quality

| Requirement | Score / 5 | Failed criteria | Evidence | Path to maximum |
| --- | --- | --- | --- | --- |
| [FR-XX] | [X/5] | [e.g. Atomic, Clear] | "[Quote]" | [Correction] |

## 6. Block D — Quality attributes and feasibility

| Scenario | Score / 2 | Requirement(s) and evidence | Missing or degraded behavior | Path to maximum |
| --- | --- | --- | --- | --- |
| [e.g. Edge Cases] | [X/2] | [FR-XX] | [Description] | [Correction] |

## 7. Score summary

| Dimension | Arithmetic | Score |
| --- | --- | ---: |
| Block A — Persona satisfaction | mean of role scores | X.XX |
| Block B — Critical problems & Constitution | obtained / 10 × 10 | X.XX |
| Block C — Backlog quality | obtained / applicable maximum × 10 | X.XX |
| Block D — Quality attributes | obtained / 10 × 10 | X.XX |
| **Overall** | **weighted formula** | **X.XX** |
| **Verdict** | **gates passed / failed** | **ACCEPTABLE / NOT ACCEPTABLE** |

## 8. Critical gaps

- `[ID or need] — [Role/problem/flow] — [Evidence] — [Why it fails] — [Minimum correction]`

## 9. Recommendation
[Maximum three lines indicating next steps or corrections required before proceeding to implementation planning.]
