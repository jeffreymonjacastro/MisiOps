# Research: DevSecOps for MisiOps

**Feature**: `specs/011-devsecops/spec.md` · **Date**: 2026-11-03

Each decision lists what was chosen, why, and what was rejected. Versions were read from each project's latest GitHub release on 2026-11-03; lockfile support was checked against the Trivy v0.76.1 docs via Context7.

## R1. CI platform

- **Decision**: GitHub Actions, in a new workflow `.github/workflows/devsecops.yml` next to the existing ones.
- **Rationale**: The project already runs its quality gates there; the course brief accepts "otra plataforma de CI/CD". The course labs use GitLab, but migrating CI adds risk and grades nothing.
- **Alternatives**: GitLab CI mirror (the team's working lab) — rejected: would duplicate the repository and every existing gate.

## R2. How tools run in CI

- **Decision**: Every scanner runs from its **official Docker image pinned to a version tag**, invoked with `docker run`. No third-party GitHub Actions for scanners.
- **Rationale**: Same commands as the course labs (portable to GitLab), versions fixed (NFR-002), and smaller supply-chain surface: a third-party action can change code under a moving tag, which is itself a DevSecOps lesson worth showing.
- **Alternatives**: `aquasecurity/trivy-action`, `zaproxy/action-*`, `gitleaks/gitleaks-action` — rejected for the reason above (the Gitleaks action also needs a licence key for organisations).

| Tool | Purpose | Pinned image / version |
| --- | --- | --- |
| Semgrep | SAST | `semgrep/semgrep:1.183.0` |
| OWASP ZAP | DAST (baseline + API scan) | `ghcr.io/zaproxy/zaproxy:2.17.0` |
| Gitleaks | Secret scanning (history) | `zricethezav/gitleaks:v8.30.1` |
| TruffleHog | Secret scanning (history, verification) | `trufflesecurity/trufflehog:3.99.8` |
| Trivy | SCA, SBOM, image scan, config scan | `aquasec/trivy:0.76.1` |
| DefectDojo | Centralization | local checkout `3.4.202` (latest 3.5.0 not needed) |
| pre-commit | Local secret hooks | `pre-commit` 4.7.0 + Gitleaks hook `v8.30.1` |

Exact image tags are re-verified when the workflow is written; a tag that does not exist fails the job loudly rather than drifting.

## R3. SCA coverage of the lockfiles

- **Decision**: `trivy fs --scanners vuln` over the repository root.
- **Rationale**: Trivy v0.76.1 reads `uv.lock` (backend) and `pnpm-lock.yaml` (frontend), both with transitive dependencies; dev dependencies are excluded by default, which matches production exposure.
- **Finding during research**: `frontend/package-lock.json` is a stale npm lockfile left from before the team moved to pnpm. Trivy would also scan it and report versions that are not what ships. Expected baseline finding; removal is a remediation candidate.

## R4. Secret scanning over history

- **Decision**: Gitleaks `detect` (history by default) and TruffleHog in `git` mode with `--results=verified,unknown`. Checkout with `fetch-depth: 0`.
- **Rationale**: FR-006 requires history, not only the working tree. Two detectors with different engines (regex + entropy vs. regex + live verification) reduce false negatives, as the course lab argues.
- **Suppressions**: `.gitleaks.toml` allow-list entries carry a comment with finding ID, justification and review date (FR-012b). Known candidates: the CI-only `SECRET_KEY` in `backend-ci.yml` and the dummy values generated in `docker-integration.yml`.

## R5. DAST target and authentication

- **Decision**: The DAST job starts the real stack with `docker compose` using the **same images built and scanned earlier in the run** (`--no-build`), then runs:
  1. `zap-baseline.py` (passive) against the frontend `http://localhost:3000`;
  2. `zap-api-scan.py -f openapi` (active) against the backend's `http://localhost:8000/openapi.json`, authenticated: the job registers a throw-away CI user, logs in, and passes `Bearer <token>` through `ZAP_AUTH_HEADER_VALUE` scoped by `ZAP_AUTH_HEADER_SITE=localhost:8000` (ZAP docs, "Authentication Env Vars").
- **Rationale**: Testing the exact images that would be published closes the "scanned something else" gap. Without the token, every protected endpoint answers 401 and the active scan never reaches the business logic.
- **Safety**: The active scan only ever targets the throw-away stack inside the runner.
- **Alternatives**: Scanning a deployed environment — none exists. Nuclei — the team used it in the lab, but ZAP alone satisfies item 2d and keeps CI time within NFR-001.

## R6. Container images and configuration

- **Decision**: One build job builds `misiops-backend` and `misiops-frontend` once, tags them with the names Compose expects, and saves them as a short-lived artifact (`retention-days: 1`). Trivy scans them with `trivy image --input`. Trivy also scans `postgres:16.3`, the third image the system deploys. `trivy config` scans `backend/Dockerfile`, `frontend/Dockerfile` and `docker/docker-compose.yaml`.
- **Rationale**: Build once, scan, test and publish the same bytes. Postgres is part of the attack surface even though it is not built here.
- **Expected findings**: OS CVEs in base images; `ghcr.io/astral-sh/uv:latest` unpinned in `backend/Dockerfile`; no `HEALTHCHECK` instructions.

## R7. Centralization in DefectDojo

- **Decision**: `reimport-scan` with `auto_create_context=true`, `product_type_name`, `product_name=MisiOps`, `engagement_name="CI - <branch>"`, and a **distinct `test_title` per report**.
- **Rationale**: Re-import gives de-duplication and `close_old_findings` closes fixed findings (FR-010a), which is exactly what the before/after comparison needs.
- **Pitfall found**: the course script uses `test_title=$SCAN_TYPE`. MisiOps produces several reports of the same type (three Trivy reports, two ZAP reports); with one shared test title, each import would close the previous report's findings. Each report gets its own title (e.g. `Trivy - dependencies`, `Trivy - image backend`).
- **Scan types**: `Semgrep JSON Report`, `Gitleaks Scan`, `Trufflehog Scan`, `Trivy Scan` (JSON with vulns, misconfigs and secrets), `ZAP Scan` (XML only).

## R8. Reaching a local DefectDojo from cloud runners

- **Decision (clarified)**: ngrok tunnel + CI secrets, with a local fallback script. Use the **free static ngrok domain** so the URL does not change between sessions.
- **Constraint found**: the user's account has `push` but not `admin` on this user-owned repository; on user-owned repositories only the owner can create Actions secrets. The owner (Jeffrey) sets `DEFECTDOJO_URL` and `DEFECTDOJO_TOKEN` once; a static domain keeps them valid. The URL is never committed: with the accepted default credentials, a public URL in the repo would grant anyone admin access.
- **Fallback**: `gh run download <run-id>` + the same upload script run locally against `http://localhost:8080`.

## R9. Delivery stage gated by security

- **Decision**: A `deliver` job, only on `push` to `develop`, `needs` every security job, loads the saved images and pushes them to GitHub Container Registry (`ghcr.io/jeffreymonjacastro/misiops-*`) with `GITHUB_TOKEN` and `permissions: packages: write`.
- **Rationale**: Satisfies "Deployments MUST NOT occur without passing automated security scans" with the images that were scanned. No cloud environment exists to deploy to; publishing the release artefact is the delivery step available today.
- **Note**: it runs after the merge, so its evidence is captured once the PR is merged.

## R10. Gate semantics

- **Decision**: Each scanner job writes its report first (always uploaded with `if: always()`), then runs a **separate gate step** that exits 1 on CRITICAL/HIGH or on any secret. The upload-to-DefectDojo job runs with `if: always()`.
- **Rationale**: Reports and centralization must exist even when the gate fails (the course lab's §4.4 pattern), and the baseline run inside the feature PR is precisely a failing run whose reports we keep.
- **ZAP**: `rules.conf` sets FAIL only for rules mapped to HIGH risk; medium and low are WARN, so they are reported without blocking.

## R11. Tests for new scripts (NFR-006)

- **Decision**: Scripts in Bash (parity with the course), tested by a plain Bash test file that puts a stub `curl` first on `PATH` and asserts the arguments sent. Runs in a `scripts-test` CI job.
- **Rationale**: No new dependency (no `bats`, no Python packages), fast, and it checks what matters: correct scan type, distinct test titles, skip on empty or missing report, failure on a non-201 response.

## R12. STRIDE deliverables

- **Decision**: Threat model drawn as a draw.io data-flow diagram stored in the repository (`.drawio` + exported PNG), and the course spreadsheet template filled in.
- **Constraint found**: both course templates are behind UTEC Google sign-in (HTTP 401 / sign-in page when fetched anonymously). **Manual step**: the user downloads both templates into the repository folder named in `quickstart.md`.
- **Ranking**: risk = likelihood (1-5) × impact (1-5), as FR-003 requires.

## R13. Evidence capture

- **Decision**: Screenshots taken with headless Chrome (an isolated, throw-away profile) for public GitHub pages and the local DefectDojo UI, and from a real terminal window for CLI runs, as in the first report. Each job also writes a findings table to `$GITHUB_STEP_SUMMARY`, which is visible on the public run page without signing in (logs are not).
- **Rationale**: Real captures, reproducible, no access to the user's personal browser profile.
