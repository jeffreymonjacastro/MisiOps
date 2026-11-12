# Implementation Plan: DevSecOps for MisiOps

**Branch**: `feature/devsecops` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-devsecops/spec.md`

## Summary

Add a security pipeline to MisiOps and produce the course's final-report evidence. A new GitHub Actions workflow builds the backend and frontend images once, then runs SAST (Semgrep), secret scanning (Gitleaks, TruffleHog), SCA + SBOM (Trivy over `uv.lock`/`pnpm-lock.yaml`), container and configuration scanning (Trivy) and DAST (ZAP baseline on the frontend + authenticated ZAP API scan from FastAPI's OpenAPI) against those same images. Every report is kept as an artifact and imported into DefectDojo through an ngrok tunnel, with a local fallback. On push to `develop`, a delivery job publishes the scanned images only if every security job passed. A STRIDE model, a baseline → remediation → re-scan cycle inside this feature's PR, and a Spanish Q&A evidence document complete items 2a-2k. Technical choices are in [research.md](./research.md).

## Technical Context

**Language/Version**: Bash (scripts), YAML (GitHub Actions); remediation may touch Python 3.13 (backend), TypeScript/Next.js 16 (frontend), Dockerfiles

**Primary Dependencies**: Semgrep 1.183.0, OWASP ZAP 2.17.0, Gitleaks 8.30.1, TruffleHog 3.99.8, Trivy 0.76.1, DefectDojo 3.4.202 (local), pre-commit 4.7.0, ngrok (static domain) — all pinned (R2)

**Storage**: DefectDojo's own Postgres (local Docker Compose); reports as CI artifacts (7 days)

**Testing**: Bash test with a `curl` stub for the new scripts (R11); existing `pytest` (119) and `node:test` (39) suites must stay green

**Target Platform**: GitHub-hosted `ubuntu-latest` runners; DefectDojo on the developer's Windows machine via Docker Desktop

**Project Type**: CI/CD security pipeline + documentation over an existing web application (monorepo)

**Performance Goals**: Whole security workflow ≤ 20 min (NFR-001); jobs in parallel where they do not depend on each other

**Constraints**: No credentials in the repository (FR-018); scanners pinned (NFR-002); existing workflows untouched except where remediation requires it (NFR-004); repository secrets can only be set by the owner (R8)

**Scale/Scope**: 2 application images + 1 third-party image, 1 compose file, ~5 k LOC; 6 scan categories, ~10 reports per run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| --- | --- | --- |
| I. Code Quality | One workflow, one upload script reused by CI and the fallback; pinned versions; suppressions carry a justification | PASS |
| II. Testing (non-negotiable) | New scripts tested in CI (R11); remediation keeps the 158 existing tests green | PASS |
| III. UX Consistency | No UI change; security headers added during remediation must not alter visible behaviour | PASS |
| IV. Performance | Parallel jobs, ≤ 20 min budget, Trivy DB cached between jobs | PASS |
| Additional Constraints | Deps audited (Trivy SCA); delivery gated by every security job (R9) | PASS |
| Development Workflow | Security scans block merges into `main` (required checks); report-only into `develop` under temporary exemption EX-001 (constitution v1.2.0, expires 2026-12-31) | PASS (with EX-001) |

**Post-design re-check (after Phase 1)**: PASS — no new principle conflicts; the only deviation is the accepted risk of DefectDojo default credentials, recorded in the spec.

## Project Structure

### Documentation (this feature)

```text
specs/011-devsecops/
├── spec.md
├── plan.md                 # this file
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── pipeline-jobs.md    # jobs, inputs, outputs, gate per job
│   └── upload-script.md    # CLI contract of the DefectDojo upload script
├── checklists/
├── evaluations/
└── tasks.md                # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
.github/workflows/
└── devsecops.yml               # NEW: build → scans → DAST → summary → DefectDojo → deliver

security/                       # NEW
├── scripts/
│   ├── upload_to_defectdojo.sh # one report → DefectDojo reimport-scan (used by CI and fallback)
│   └── import_run.sh           # fallback: gh run download <id> + upload every report
├── tests/
│   └── test_upload_to_defectdojo.sh   # curl stub, asserts request arguments
└── zap/
    └── rules.conf              # ZAP rule levels: FAIL only for high-risk rules

.gitleaks.toml                  # NEW: allow-list with ID + justification + review date
.trivyignore                    # NEW (only if needed): accepted CVEs with justification
.semgrepignore                  # NEW: exclude tests, generated and vendored files
.pre-commit-config.yaml         # NEW: gitleaks + detect-private-key hooks

docs/devsecops/                 # NEW: evidence for the course (Spanish)
├── EVIDENCIAS.md               # Q&A per item 2a-2k with screenshots and repo paths
├── stride/
│   ├── misiops-stride.drawio
│   ├── misiops-stride.png
│   └── plantilla-stride-misiops.xlsx
├── pipeline/
│   └── pipeline.md             # Mermaid diagram of all workflows
└── img/                        # screenshots

frontend/package-lock.json      # REMOVE (stale npm lockfile, R3) — remediation candidate
security/scripts/reports.tsv    # NEW: scan type / test title / report file, shared by CI and fallback
docs/devsecops/reports/         # NEW: durable copies of baseline and re-scan reports
.specify/memory/constitution.md # AMENDED: v1.2.0, temporary exemption EX-001
backend/, frontend/, docker/    # TOUCHED only by remediation of prioritized findings
```

**Structure Decision**: Security tooling lives in a dedicated `security/` folder and one workflow, so it can be reviewed and reused without touching the application folders. Course evidence lives in `docs/devsecops/`, beside the docs the team already moved there. Existing workflows stay as they are.

## Pipeline design

```text
                         ┌─ sast (Semgrep) ────────────────┐
                         ├─ secrets (Gitleaks, TruffleHog) ─┤
checkout ─┬─ build ──────┼─ sca (Trivy fs + SBOM) ──────────┤
          │  (images)    ├─ container (Trivy image ×3) ─────┼─ summary ─┬─ defectdojo (if secrets set)
          │              ├─ iac (Trivy config) ─────────────┤           └─ deliver (push to develop only,
          │              └─ dast (compose + ZAP ×2) ────────┘              needs all security jobs)
          └─ scripts-test (upload script tests)
```

- Triggers: `pull_request` and `push` to `develop` and `main`, `workflow_dispatch`.
- Gate mode: `ENFORCE=true` when the PR base or the pushed branch is `main`; otherwise gate steps emit `::warning::` and exit 0 (EX-001).
- Every scanner job: write report → upload artifact (`if: always()`) → gate step → `$GITHUB_STEP_SUMMARY` table.
- `summary` (`if: always()`) aggregates counts per tool into one table — the "security-summary" stage of the course template.
- `defectdojo` (`if: always()`) skips cleanly when `DEFECTDOJO_URL` is empty (forks, sessions without tunnel).
- `deliver` runs only on `push` to `main` and only if every security job succeeded.

Per-job inputs, outputs and gates: [contracts/pipeline-jobs.md](./contracts/pipeline-jobs.md).

## Remediation approach (FR-014)

1. Open the PR early; its first run is the **baseline**. Import it into DefectDojo and capture "situación inicial".
2. Rank findings: severity first; within a severity, threats on credentials and financial data first.
3. Fix the top findings that live in this repository (expected: stale lockfile, unpinned `uv:latest`, base-image patch bumps, missing security headers, dependency bumps, CI secrets in plain text).
4. Findings that cannot be fixed here → `.gitleaks.toml` / `.trivyignore` / ZAP `IGNORE` with ID, justification and review date; listed as accepted risks.
5. Re-run; re-import closes fixed findings; capture "resultados después". The aim is every gate green before merging to `develop`, so the later `develop` → `main` PR passes the enforcing gates.

Base-image drift (added 2026-11-11, T050): Debian and Alpine publish fixes for base-image packages after the pinned image was built, so both Dockerfiles upgrade OS packages at build time (`apt-get upgrade` in the backend, `apk upgrade` in the frontend). A fixable HIGH/CRITICAL that survives the upgrade means the base image itself needs bumping.

## Manual steps the user (or the repo owner) must perform

| # | Who | Step | Needed for |
| --- | --- | --- | --- |
| M1 | User | Download the course's STRIDE spreadsheet and draw.io templates (UTEC sign-in) into `docs/devsecops/stride/` | FR-001, FR-002 |
| M2 | User | Claim the free static domain in the ngrok dashboard | FR-011 |
| M3 | Owner (Jeffrey) | Create repository secrets `DEFECTDOJO_URL` and `DEFECTDOJO_TOKEN` (exact steps in quickstart) | FR-011 |
| M4 | User | Upload the `.drawio` and `.xlsx` to the cloud drive and share the links | FR-016 |
| M5 | Owner (Jeffrey) | Required: add the security jobs as required status checks to the "Protect main" ruleset, empty bypass list | FR-012a, SC-008 |
| M6 | Team lead | Approve the PR that adds constitution exemption EX-001 | Governance |

Without M3 the pipeline still scans and the fallback import (FR-011a) covers centralization.

## Complexity Tracking

| Choice | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Images built once and passed as an artifact | DAST, image scan and delivery must use identical bytes | Rebuilding per job means scanning something other than what ships |
| Distinct DefectDojo test title per report | Several reports share a scan type | The course script's shared title would close one report's findings with another's import |
| Dockerised scanners instead of marketplace actions | Version pinning and supply-chain control | Actions can change under a moving tag |
