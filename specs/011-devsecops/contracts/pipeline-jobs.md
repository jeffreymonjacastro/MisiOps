# Contract: `devsecops.yml` jobs

Triggers: `pull_request` and `push` → `develop` or `main`, `workflow_dispatch`.

Gate mode: when the PR base or pushed branch is `main`, a gate that trips exits 1 (blocks the merge through the required checks of "Protect main"). Otherwise it emits `::warning::` and exits 0 (report-only, constitution EX-001). Permissions default to `contents: read`; only `deliver` adds `packages: write`.

| Job | Needs | Produces (artifact) | Gate (exit 1 when…) | Course stage |
| --- | --- | --- | --- | --- |
| `build` | — | `images` (backend, frontend tar; 1 day) | build fails | build |
| `sast` | — | `semgrep-report.json`, `.txt` | any ERROR-severity finding | security-sast |
| `secrets` | — | `gitleaks-report.json`, `trufflehog-report.json` | any non-allow-listed secret | security-secret |
| `sca` | — | `trivy-deps.json`, `trivy-deps.txt`, `sbom.cdx.json` | any HIGH/CRITICAL vulnerability not in `.trivyignore` | security-dependency |
| `container` | `build` | `trivy-image-{backend,frontend,postgres}.json` | any HIGH/CRITICAL with a fix available, in any of the three images | security-container |
| `iac` | — | `trivy-config.json` | any HIGH/CRITICAL misconfiguration | security-iac |
| `dast` | `build` | `zap-frontend.{xml,html,json}`, `zap-api.{xml,html,json}` | any rule set to FAIL in `rules.conf`; stack fails to start | security-dast |
| `scripts-test` | — | — | any assertion fails | test |
| `summary` | all scanners (`if: always()`) | step summary table | never (informational) | security |
| `defectdojo` | all scanners (`if: always()`) | — | an upload returns non-201 (`continue-on-error` so it never masks scan results) | security (centralization) |
| `deliver` | all scanners + `scripts-test` | images in `ghcr.io/jeffreymonjacastro/misiops-{backend,frontend}` | push fails | deploy |

Rules common to every scanner job:

1. The report is written **before** the gate runs, and uploaded with `if: always()`.
2. The gate is a separate step, so the job's red/green state reflects only the gate.
3. A findings table is appended to `$GITHUB_STEP_SUMMARY`.
4. Each tool runs from its pinned image (research R2).

`deliver` condition: `github.event_name == 'push' && github.ref == 'refs/heads/main'`.
`defectdojo` condition: runs when `secrets.DEFECTDOJO_URL` is non-empty; otherwise logs "skipped: no DefectDojo configured" and succeeds.
