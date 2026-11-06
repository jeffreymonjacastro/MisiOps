---
description: "Task list for DevSecOps for MisiOps"
---

# Tasks: DevSecOps for MisiOps

**Input**: Design documents from `specs/011-devsecops/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Requested by NFR-006 (every new script has an automated CI test) and NFR-005 (existing suites stay green).

**Organization**: Grouped by user story. Manual steps M1-M5 (plan.md) are listed where they block a task.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1-US5 from spec.md

---

## Phase 1: Setup

**Purpose**: Folders and repository-level security configuration

- [X] T001 Create folders `security/scripts/`, `security/tests/`, `security/zap/`, `docs/devsecops/stride/`, `docs/devsecops/pipeline/`, `docs/devsecops/img/` (add a `.gitkeep` only where a folder would otherwise be empty)
- [X] T002 [P] Create `.semgrepignore` at repo root excluding `frontend/node_modules/`, `frontend/.next/`, `backend/.venv/`, `specs/`, `docs/`, `inform/`, `diagrams/` (tests stay scanned)
- [X] T003 [P] Create `.gitleaks.toml` at repo root: `[extend] useDefault = true` plus an `[allowlist]` whose every entry has a comment line `# id: <rule/finding> | justification: <why> | review: 2027-05-01` (FR-012b); start with the CI-only dummy values in `.github/workflows/docker-integration.yml` and `.github/workflows/backend-ci.yml` only after confirming they are test values (research R4)
- [X] T004 [P] Create `.pre-commit-config.yaml` with `gitleaks` hook (`https://github.com/gitleaks/gitleaks`, `rev: v8.30.1`) and `detect-private-key` from `https://github.com/pre-commit/pre-commit-hooks` pinned to a release tag (FR-009, NFR-002)
- [X] T005 [P] Create `security/zap/rules.conf` (tab-separated `<id>\t<IGNORE|WARN|FAIL>\t<name>`): default WARN; FAIL for high-risk rules (e.g. 40012, 40014, 40018, 90019, 90020, 6, 7); any IGNORE line carries `# justification | review date` (FR-012b)

**Checkpoint**: Configuration files exist; nothing runs yet

---

## Phase 2: Foundational (blocks US2-US4)

**Purpose**: Upload script and its test, used by CI and the fallback

- [X] T006 Write `security/tests/test_upload_to_defectdojo.sh` first (must fail before T007): puts a `curl` stub on `PATH` that records its arguments and returns a configurable HTTP status; asserts every row of `contracts/upload-script.md` (usage → exit 2; missing file → exit 0 + `skip:`; zero-finding report still uploaded; missing `DEFECTDOJO_URL`/`DEFECTDOJO_TOKEN` → exit 1 + `missing variable:`; 201 → `ok:`; 500 → exit 1 + `error 500`); asserts the request carries `scan_type`, `test_title`, `product_name=MisiOps`, `product_type_name=Aplicaciones Web`, `engagement_name`, `auto_create_context=true`, `close_old_findings=true`; asserts the token never appears on stdout/stderr; asserts TruffleHog input is filtered to `"SourceMetadata"` lines
- [X] T007 Implement `security/scripts/upload_to_defectdojo.sh` per `contracts/upload-script.md` (`set -euo pipefail`, `curl -sS -o body -w '%{http_code}' -X POST "$DEFECTDOJO_URL/api/v2/reimport-scan/"`, `Authorization: Token`, defaults for product/type/engagement, optional `build_id`/`commit_hash`/`branch_tag` from `GITHUB_RUN_ID`/`GITHUB_SHA`/`GITHUB_REF_NAME`) until T006 passes
- [X] T007a Create `security/scripts/reports.tsv` (tab-separated `<scan_type>\t<test_title>\t<report file>`, shared by CI and fallback): `Semgrep JSON Report / Semgrep - source / semgrep.json`, `Gitleaks Scan / Gitleaks - history / gitleaks.json`, `Trufflehog Scan / TruffleHog - history / trufflehog.json`, `Trivy Scan / Trivy - dependencies / trivy-deps.json`, `Trivy Scan / Trivy - image backend|frontend|postgres / trivy-image-*.json` (three rows), `Trivy Scan / Trivy - config / trivy-config.json`, `ZAP Scan / ZAP - frontend baseline / zap-frontend.xml`, `ZAP Scan / ZAP - API / zap-api.xml` (distinct titles, research R7)
- [X] T008 Implement `security/scripts/import_run.sh <run-id>`: `gh run download <run-id> -R jeffreymonjacastro/MisiOps -D <tmp>` then calls `upload_to_defectdojo.sh` for every row of `security/scripts/reports.tsv` (FR-011a, checklist CHK026)
- [X] T009 Extend `security/tests/test_upload_to_defectdojo.sh` with a `gh` stub that drops fixture reports, asserting `import_run.sh` calls the upload once per `reports.tsv` row (NFR-006)

**Checkpoint**: `bash security/tests/test_upload_to_defectdojo.sh` passes locally

---

## Phase 3: User Story 1 — Threat model (P1)

**Goal**: STRIDE diagram + spreadsheet + top-5 threats (items 2b, 2c)

**Independent Test**: Diagram shows every running component and trust boundary; spreadsheet has ≥1 threat per STRIDE category; top 5 ranked by likelihood × impact

- [X] T010 [US1] **Blocked by M1 (done 2026-11-05)** — confirm `docs/devsecops/stride/plantilla-stride-original.xlsx` and `diagrama-stride-original.drawio` exist (downloaded by the user); if missing, stop and ask the user to run M1
- [X] T011 [P] [US1] Build `docs/devsecops/stride/misiops-stride.drawio` from the course template: external entities (user browser, Telegram — only if present in code), processes (Next.js frontend, FastAPI backend), data store (Postgres), CI/CD (GitHub Actions, GHCR, DefectDojo), flows (HTTPS, JWT bearer, SQL on `private` network), trust boundaries (internet/`public` network, `private` network, CI) — components must match `docker/docker-compose.yaml` (FR-001)
- [X] T012 [US1] Export `docs/devsecops/stride/misiops-stride.png` from the drawio (drawio desktop/CLI or headless browser render)
- [X] T013 [US1] Fill `docs/devsecops/stride/plantilla-stride-misiops.xlsx` from the template (openpyxl, keep template columns): rows `T-NN`, all six categories, `component` present in the diagram, likelihood 1-5, impact 1-5, risk = likelihood × impact as a formula, mitigation, related finding IDs (data-model §Threat) (FR-002)
- [X] T014 [US1] Rank threats by risk (ties: credentials/financial data first) and record the top 5 with score, component, impact and mitigation for EVIDENCIAS §2c (FR-003)

**Checkpoint**: US1 artifacts complete; links pending M4

---

## Phase 4: User Story 2 — Security pipeline (P1)

**Goal**: One workflow running all six scan categories with reports and gates (items 2d, 2e, 2i)

**Independent Test**: PR to `develop` runs `build, sast, secrets, sca, container, iac, dast, scripts-test, summary`; each leaves an artifact

- [X] T015 [US2] Create `.github/workflows/devsecops.yml` skeleton: `on: pull_request/push` to `develop` and `main` + `workflow_dispatch`; workflow env `ENFORCE: ${{ github.base_ref == 'main' || github.ref == 'refs/heads/main' }}` — every gate step below exits 1 only when `ENFORCE == 'true'`, otherwise prints `::warning::` with the count and exits 0 (FR-012, constitution EX-001); `permissions: contents: read`; `concurrency` per ref with cancel-in-progress; env with pinned images (`semgrep/semgrep:1.183.0`, `zricethezav/gitleaks:v8.30.1`, `trufflesecurity/trufflehog:3.99.8`, `aquasec/trivy:0.76.1`, `ghcr.io/zaproxy/zaproxy:2.17.0`) (NFR-002); every `upload-artifact` uses `retention-days: 7` (NFR-003) and `if: always()`
- [X] T016 [US2] Job `build`: build `misiops-backend:ci` and `misiops-frontend:ci` from `backend/` and `frontend/`, `docker save` to `images.tar`, upload artifact `images` with `retention-days: 1`
- [X] T017 [P] [US2] Job `sast`: `semgrep scan --config p/default --config p/python --config p/typescript --json -o reports/semgrep.json` and `--text` copy, then a separate gate step failing on `ERROR` results (FR-004, FR-012 mapping); step-summary table by severity
- [X] T018 [P] [US2] Job `secrets`: checkout with `fetch-depth: 0`; `gitleaks git --config .gitleaks.toml --report-format json --report-path reports/gitleaks.json --exit-code 0`; `trufflehog git file:///repo --json --no-update > reports/trufflehog.json`; gate step fails on any Gitleaks finding or any TruffleHog line with `"SourceMetadata"` (FR-006)
- [X] T019 [P] [US2] Job `sca`: `trivy fs --scanners vuln --format json -o reports/trivy-deps.json .` (covers `backend/uv.lock`, `frontend/pnpm-lock.yaml`), table copy, `trivy fs --format cyclonedx -o reports/sbom.cdx.json .`; gate `--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1` honouring `.trivyignore` (FR-007, FR-012 mapping); cache Trivy DB with `actions/cache` keyed by date
- [X] T020 [US2] Job `container` (needs `build`): `docker load`, then `trivy image` JSON for `misiops-backend:ci`, `misiops-frontend:ci`, `postgres:16.3`; gate HIGH/CRITICAL `--ignore-unfixed` on all three images (unfixed ones reported, not gating) (FR-008)
- [X] T021 [P] [US2] Job `iac`: `trivy config --format json -o reports/trivy-config.json backend/Dockerfile frontend/Dockerfile docker/docker-compose.yaml`; gate HIGH/CRITICAL (FR-008a)
- [X] T022 [US2] Job `dast` (needs `build`): `docker load`; create `docker/.env.dev` and `docker/pg_password.txt` with `openssl rand -hex 24` values (never committed, FR-018); `docker compose -p misiops -f docker/docker-compose.yaml up -d --no-build` (images tagged `misiops-backend`/`misiops-frontend`); wait with `curl --retry` on `:8000/` and `:3000/`, fail visibly otherwise; register a run-scoped user via `POST /api/v1/auth/register` (random password), login via `POST /api/v1/auth/login`, `::add-mask::` the token; run `zap-baseline.py -t http://localhost:3000 -c rules.conf -x zap-frontend.xml -r zap-frontend.html -J zap-frontend.json -I` and `zap-api-scan.py -t http://localhost:8000/openapi.json -f openapi -c rules.conf -x zap-api.xml -r zap-api.html -J zap-api.json -I` with `ZAP_AUTH_HEADER_VALUE="Bearer $TOKEN"` and `ZAP_AUTH_HEADER_SITE=localhost:8000` (`--network host`); gate step fails on any FAIL-level alert parsed from the JSON; `docker compose down -v` with `if: always()` (FR-005)
- [X] T023 [P] [US2] Job `scripts-test`: `bash security/tests/test_upload_to_defectdojo.sh` (NFR-006)
- [X] T024 [US2] Job `summary` (needs all scanners, `if: always()`): download report artifacts, write one Markdown table tool × severity to `$GITHUB_STEP_SUMMARY` with `jq`; never fails
- [X] T025 [US2] Job `deliver` (needs `sast, secrets, sca, container, iac, dast, scripts-test`; `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`; `permissions: packages: write`): `docker load`, tag `ghcr.io/jeffreymonjacastro/misiops-{backend,frontend}:{sha,latest}`, login with `GITHUB_TOKEN`, push (FR-015a)
- [X] T026 [US2] Prove the pre-commit hook with the quickstart scenario 5 fake key and save the screenshot of the rejected commit to `docs/devsecops/img/precommit-bloqueo.png` (text goes in T042) (FR-009, SC-006)
- [x] T026a [US2] Amend `.specify/memory/constitution.md` to v1.2.0 with temporary exemption EX-001 (security gate on `main`, report-only on `develop`, expires 2026-12-31) — approval by the team lead is manual step M6

**Checkpoint**: Workflow green on syntax (`actionlint` via its pinned Docker image) and runnable

---

## Phase 5: User Story 3 — Centralization (P1)

**Goal**: Every tool's findings in DefectDojo (item 2f)

**Independent Test**: Product MisiOps shows one test per report with distinct titles; re-run adds no duplicates

- [X] T028 [US3] Job `defectdojo` in `.github/workflows/devsecops.yml` (needs scanners, `if: always()`, `continue-on-error: true`): if `secrets.DEFECTDOJO_URL` empty → echo `skipped: no DefectDojo configured`; else download artifacts and loop `reports.tsv` through `upload_to_defectdojo.sh` (FR-010, FR-011)
- [X] T029 [US3] **Blocked by M2** — start DefectDojo locally (quickstart scenario 1), get the API token, start `ngrok http --url=<static-domain> 8080`, confirm `https://<static-domain>/api/v2/` answers
- [ ] T030 [US3] **Blocked by M3** — confirm with `gh secret list -R jeffreymonjacastro/MisiOps` that `DEFECTDOJO_URL` and `DEFECTDOJO_TOKEN` exist; if not, use the fallback `security/scripts/import_run.sh <run-id>` and record that in EVIDENCIAS §2f

**Checkpoint**: Findings of every tool visible under Aplicaciones Web → MisiOps

---

## Phase 6: User Story 4 — Baseline, remediation, re-scan (P2)

**Goal**: Measurable reduction (items 2g, 2h)

**Independent Test**: Open counts by severity drop between baseline and re-scan; fixed findings show Mitigated

- [X] T031 [US4] Push the pipeline, open the PR `feature/devsecops` → `develop` (draft) so its first run is the baseline; import it; save the run ID, commit SHA and DefectDojo metrics screenshot to `docs/devsecops/img/` and keep the reports under `docs/devsecops/reports/baseline/` (durable copy beyond 7 days, checklist CHK018)
- [X] T032 [US4] Rank findings (severity, then STRIDE threats on credentials/financial data) and pick the remediation set (FR-014)
- [X] T033 [P] [US4] Remove stale `frontend/package-lock.json` (pnpm is the package manager) and confirm `frontend-ci.yml` does not use it
- [X] T034 [P] [US4] Pin `ghcr.io/astral-sh/uv:latest` in `backend/Dockerfile` to an exact version (and digest) (research R6)
- [X] T035 [P] [US4] Apply dependency/base-image bumps that close fixable HIGH/CRITICAL in `backend/uv.lock`, `frontend/pnpm-lock.yaml`, Dockerfiles, `docker/docker-compose.yaml` (`postgres:16.3` patch)
- [X] T035a [P] [US4] Write failing tests first (Constitution II): `backend/tests/test_security_headers.py` asserting `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` on `/` and an `/api/v1` route; `frontend/test/security-headers.test.ts` importing `next.config.ts` and asserting `headers()` returns the same set plus `Content-Security-Policy` and `Permissions-Policy` for `/:path*`
- [X] T036 [US4] Add the security headers flagged by ZAP until T035a passes: `headers()` in `frontend/next.config.ts` and a FastAPI middleware in `backend/main.py`. CSP must keep Next.js working (`script-src 'self' 'unsafe-inline'` only if the production build needs it; check with `pnpm build` + the running app that no UI changes) (Constitution III)
- [X] T037 [US4] Fix remaining prioritized Semgrep/Trivy-config findings in this repo; anything unfixable goes to `.gitleaks.toml` / `.trivyignore` / `rules.conf` with ID, justification, review date (FR-012b)
- [X] T038 [US4] Run existing suites locally: `cd backend && uv run pytest` and `cd frontend && node --import tsx --test test/*.test.ts`, plus `pnpm lint` and `pnpm build` (NFR-004, NFR-005)
- [X] T039 [US4] Push; re-scan; re-import; save run ID, metrics screenshot and reports under `docs/devsecops/reports/rescan/`; all security gates green (SC-003)

**Checkpoint**: Before/after evidence captured; PR ready for review

---

## Phase 7: User Story 5 — Evidence document (P2)

**Goal**: `docs/devsecops/EVIDENCIAS.md` in Spanish, Q&A for 2a-2k (FR-016)

**Independent Test**: Every item 2a-2k has an answer, a screenshot (or log with reason) and a repo path that opens

- [X] T040 [P] [US5] Write `docs/devsecops/pipeline/pipeline.md`: Mermaid diagram of `backend-ci`, `frontend-ci`, `docker-integration`, `sdd-enforcer`, `devsecops` with stages, gates, artifacts and delivery; render a PNG to `docs/devsecops/img/pipeline.png` (FR-015)
- [X] T041 [US5] Capture screenshots into `docs/devsecops/img/`: Actions run graph, each job's step summary, artifacts list, ZAP HTML report, DefectDojo product/engagement/tests/findings/metrics (baseline and re-scan), pre-commit rejection, GHCR packages (after merge)
- [X] T042 [US5] Write `docs/devsecops/EVIDENCIAS.md`: index with anchors per item; §2a título/descripción; §2b diagram + links (M4); §2c top-5; §2d SAST/DAST choice + evidence + reports; §2e secrets/SCA choice + evidence; §2f DefectDojo; §2g mitigation table ≥5 rows `ID | Descripción | Severidad | Herramienta | Mitigación | Estado` ordered by severity (`CRIT-001`, `HIGH-001`…) (FR-013); §2h before/after table by severity; §2i diagram + config file paths; §2j/§2k concise answers (FR-017); each answer ends with `Ubicación en el repo:`
- [X] T043 [US5] Add to EVIDENCIAS §política de gates: gate per tool (FR-012 mapping); report-only into `develop` vs blocking into `main` and exemption EX-001 with expiry; the "Protect main" required checks (screenshot after M5); steps to also require them on `develop` when EX-001 expires (Settings → Rules → Rulesets → Protect develop → Require status checks; only the owner) (FR-012a); accepted-risk register incl. DefectDojo `admin/admin` through the tunnel and every allow-list entry (FR-012b)
- [ ] T043a [US5] **Blocked by M5 and the merge into `develop`** — open a PR `develop` → `main`; screenshot the security checks as required and, if any gate trips, the disabled *Merge* button (quickstart scenario 6, SC-008)
- [ ] T044 [US5] **Blocked by M4** — paste the shareable drawio and xlsx links into EVIDENCIAS §2b

**Checkpoint**: Evaluator can walk 2a-2k in the document

---

## Phase 8: Polish & Cross-Cutting

- [ ] T045 Run gitleaks over the whole working tree and history one last time; confirm no DefectDojo URL/token or real credential is committed (FR-018, SC-007)
- [X] T046 [P] Measure the devsecops run duration from the Actions UI (≤ 20 min, NFR-001); record it in EVIDENCIAS §2i
- [ ] T047 Run `/speckit-converge`, then `/git-change-publisher` with `.github/pull_request_template.md` as the PR body, targeting `develop`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US2 (pipeline) → US3 (centralization) → US4 (baseline/remediation) → US5 (document) → Polish
- US1 (threat model) only depends on M1 and can run in parallel with Phases 2-5
- Manual blocks: T010 ← M1, T029 ← M2, T030 ← M3, T043a ← M5, T044 ← M4; M6 (team lead approves EX-001) gates the merge

## Parallel Opportunities

- Phase 1: T002-T005 together
- US2: T017, T018, T019, T021, T023 are independent jobs (same file, so author sequentially but they run in parallel in CI)
- US4: T033-T035a touch different files; T036 after T035a
- US1 entirely in parallel with US2/US3

## Implementation Strategy

1. MVP = Phases 1-2 + US2: every PR scanned with reports and gates
2. Add US3 (DefectDojo) → US4 (before/after) → US5 (document), US1 in parallel
3. Feature PR into `develop` runs report-only; the later `develop` → `main` PR is blocked by any red security check (FR-012, EX-001)
