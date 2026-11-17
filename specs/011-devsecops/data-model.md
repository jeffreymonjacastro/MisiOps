# Data Model: DevSecOps for MisiOps

This feature adds no application tables. Its "data" is the threat model, the scan outputs and their lifecycle in DefectDojo.

## Threat (STRIDE spreadsheet row)

| Field | Type | Rule |
| --- | --- | --- |
| id | string `T-NN` | unique |
| category | enum Spoofing / Tampering / Repudiation / Information Disclosure / Denial of Service / Elevation of Privilege | all six present across the sheet (FR-002) |
| component | string | must exist in the data-flow diagram |
| description | string | attacker action + asset |
| likelihood | int 1-5 | |
| impact | int 1-5 | |
| risk | int = likelihood × impact | top five by risk are explained (FR-003) |
| mitigation | string | |
| related_findings | list of finding IDs | optional; links threat → scan evidence |

Columns follow the course template once downloaded (manual step M1); extra fields above are added only if the template lacks them.

## Scan Report (CI artifact)

| Field | Rule |
| --- | --- |
| tool | one of Semgrep, Gitleaks, TruffleHog, Trivy, ZAP |
| scope | e.g. `dependencies`, `image backend`, `config`, `frontend baseline`, `api` |
| format | JSON (Semgrep, Gitleaks, Trivy), NDJSON (TruffleHog), XML + HTML (ZAP), CycloneDX (SBOM) |
| run | GitHub Actions run ID |
| retention | 7 days (NFR-003); built images 1 day |

## DefectDojo hierarchy

```text
Product Type "Aplicaciones Web"
└── Product "MisiOps"
    └── Engagement "CI - <branch>"          (one per branch; feature/devsecops holds the baseline)
        └── Test "<tool> - <scope>"          (one per report; distinct titles, R7)
            └── Finding                      (de-duplicated by DefectDojo hash)
```

### Finding lifecycle

```text
          import (new)            re-import, absent from report
 ──────▶  Active ───────────────────────────────▶  Mitigated (closed)
             │
             ├── triaged as false positive ──▶  False Positive
             └── suppressed with justification ──▶ Risk Accepted (mirrors the repo allow-list entry)
```

## Finding ID convention (mitigation table, FR-013)

`<SEV>-<NNN>` — `CRIT-001`, `HIGH-001`, `MED-001` — ordered by severity, then by the FR-014 priority rule. Each row: ID, description, severity, tool, mitigation, status (fixed / accepted / open), DefectDojo finding link or ID.

## Suppression entry (FR-012b)

Every allow-list entry (`.gitleaks.toml`, `.trivyignore`, ZAP `rules.conf` IGNORE line) carries: finding identifier, justification, review date. The same entry appears in the evidence document's accepted-risk register.
