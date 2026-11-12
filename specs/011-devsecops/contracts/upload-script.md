# Contract: `security/scripts/upload_to_defectdojo.sh`

Uploads one report to DefectDojo with `POST /api/v2/reimport-scan/`. Used by the CI `defectdojo` job and by the local fallback `import_run.sh`.

## Usage

```text
upload_to_defectdojo.sh <scan_type> <test_title> <report_file>
```

| Argument | Example |
| --- | --- |
| `scan_type` | `Trivy Scan`, `ZAP Scan`, `Semgrep JSON Report`, `Gitleaks Scan`, `Trufflehog Scan` |
| `test_title` | `Trivy - image backend` (must be unique per report, research R7) |
| `report_file` | `reports/trivy-image-backend.json` |

## Environment

| Variable | Required | Default |
| --- | --- | --- |
| `DEFECTDOJO_URL` | yes | — |
| `DEFECTDOJO_TOKEN` | yes | — |
| `DEFECTDOJO_PRODUCT` | no | `MisiOps` |
| `DEFECTDOJO_PRODUCT_TYPE` | no | `Aplicaciones Web` |
| `DEFECTDOJO_ENGAGEMENT` | no | `CI - ${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-local}}` |

## Request sent

Multipart form with `scan_type`, `test_title`, `file`, `product_name`, `product_type_name`, `engagement_name`, `auto_create_context=true`, `close_old_findings=true`, `active=true`, `verified=false`, plus `build_id`/`commit_hash`/`branch_tag` when the GitHub variables exist. Header `Authorization: Token <token>`. The token is never echoed.

## Behaviour (each is a test case, NFR-006)

| Situation | Exit | Output |
| --- | --- | --- |
| fewer than 3 arguments | 2 | usage |
| report missing | 0 | `skip: <file> not found` |
| report with zero findings (empty file, `[]`, TruffleHog without finding lines) | per HTTP status | still uploaded, so `close_old_findings` closes earlier findings (FR-010a) |
| `DEFECTDOJO_URL` or `DEFECTDOJO_TOKEN` unset | 1 | `missing variable: <name>` |
| HTTP 201 | 0 | `ok: <test_title>` |
| any other HTTP status | 1 | `error <status>: <body>` |

TruffleHog NDJSON is filtered to lines containing `"SourceMetadata"` before upload (course lab); an empty result is still uploaded. Only a **missing** file is skipped, because it means the scanner did not run.
