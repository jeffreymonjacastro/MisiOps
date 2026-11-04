# Quickstart: DevSecOps for MisiOps

Validation guide. It proves the feature works end to end; implementation details live in `tasks.md`.

## Prerequisites

- Docker Desktop running, with at least 8 GB assigned (DefectDojo).
- The DefectDojo checkout at `C:\Users\yared\Documents\devops\repos\sca-secrets\django-DefectDojo` (version 3.4.202).
- ngrok installed through WinGet and logged in (`ngrok config check` reports a valid file).
- `gh` authenticated with access to `jeffreymonjacastro/MisiOps`.

## Manual steps (one-off)

**M1 — STRIDE templates (user).** Sign in with the UTEC Google account and download:
- Spreadsheet: `https://docs.google.com/spreadsheets/d/1iskz8fkTkJ6Z6IWmrWX0-OdWK1SlamIc` → *File → Download → Microsoft Excel (.xlsx)* → save as `docs/devsecops/stride/plantilla-stride-original.xlsx`.
- Diagram: `https://drive.google.com/file/d/1SfWeAYCC5aCxkOklHlhfLXbQMFXXU9ah` → *Download* → save as `docs/devsecops/stride/diagrama-stride-original.drawio` (keep whatever extension Drive gives).

**M2 — ngrok static domain (user).** dashboard.ngrok.com → *Universal Gateway → Domains* → claim the free static domain (e.g. `xxxx.ngrok-free.app`).

**M3 — Repository secrets (owner only).** On user-owned repositories only the owner can create Actions secrets. Jeffrey runs once:

```bash
gh secret set DEFECTDOJO_URL   -R jeffreymonjacastro/MisiOps --body "https://<static-domain>"
gh secret set DEFECTDOJO_TOKEN -R jeffreymonjacastro/MisiOps --body "<token>"
```

or *Settings → Secrets and variables → Actions → New repository secret* for each.

**M4 — Shareable links (user).** Upload `misiops-stride.drawio` and `plantilla-stride-misiops.xlsx` to the cloud drive, share as "anyone with the link can view", and paste both links where `EVIDENCIAS.md` asks for them.

**M5 — Required checks (owner, optional).** *Settings → Branches → develop → Require status checks to pass* → add the `devsecops` jobs. Full instructions in `EVIDENCIAS.md` (FR-012a).

## Scenario 1 — DefectDojo up and reachable

```bash
cd C:/Users/yared/Documents/devops/repos/sca-secrets/django-DefectDojo
docker compose -f docker-compose.yml -f docker-compose.override.dev.yml -f docker-compose.override.lab.yml up -d
curl -s -X POST http://localhost:8080/api/v2/api-token-auth/ -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}'
ngrok http --url=<static-domain> 8080
```

Expected: the UI opens at `http://localhost:8080` (admin/admin); the token endpoint returns `{"token": "..."}`; `https://<static-domain>/api/v2/` answers through the tunnel.

## Scenario 2 — Pipeline runs every scan

Open or update the PR from `feature/devsecops` to `develop`.

Expected in *Actions → devsecops*: jobs `build`, `sast`, `secrets`, `sca`, `container`, `iac`, `dast`, `scripts-test`, `summary`, `defectdojo`; each scanner job lists its report under *Artifacts*; the run summary shows a findings table per tool.

## Scenario 3 — Findings centralized

Expected in DefectDojo → *Assets → MisiOps → Engagement "CI - feature/devsecops"*: one test per report (distinct titles) with findings from every tool. Re-running the same commit adds no duplicate findings.

Fallback without tunnel:

```bash
DEFECTDOJO_URL=http://localhost:8080 DEFECTDOJO_TOKEN=<token> security/scripts/import_run.sh <run-id>
```

## Scenario 4 — Before / after

1. Note open findings by severity after the baseline run (DefectDojo product metrics).
2. Push the remediation commits; re-run.
3. Expected: fixed findings show as *Mitigated*; open counts at their severities drop; all gates green.

## Scenario 5 — Local secret blocking

```bash
pip install pre-commit==4.7.0 && pre-commit install
echo 'AWS_ACCESS_KEY_ID=AKIAQ3ZX7YT2LMNOPQ4R' >> docker/test-secret.txt
git add docker/test-secret.txt && git commit -m "test: secret hook"
```

Expected: the commit is rejected by the `gitleaks` hook. Clean up with `git reset docker/test-secret.txt && rm docker/test-secret.txt`.

## Scenario 6 — Delivery gated by security (after merge)

Expected on the push run to `develop`: `deliver` runs only when every security job is green and publishes `ghcr.io/jeffreymonjacastro/misiops-backend` and `misiops-frontend`.

## Scenario 7 — Script tests

```bash
bash security/tests/test_upload_to_defectdojo.sh
```

Expected: every case in `contracts/upload-script.md` passes.
