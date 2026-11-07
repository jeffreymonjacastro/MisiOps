# Feature Specification: DevSecOps for MisiOps

**Feature Branch**: `feature/devsecops`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "DevSecOps for MisiOps, covering the course's final-report minimum content (items 2a-2k of 'Proyecto - Informe final'): STRIDE threat model (draw.io diagram + course spreadsheet template) and the five main threats; SAST and DAST in the existing CI with reports; secret scanning and SCA in CI with reports, plus container and IaC/Dockerfile scanning and local pre-commit secret hooks; centralization of findings in DefectDojo; a prioritized mitigation table of at least five findings; a before/after comparison (baseline scan, remediation of top findings, re-scan); a complete CI/CD pipeline diagram and its configuration; lessons learned and recommendations. Everything organized in one Markdown evidence document in question-answer format per item, with screenshots (logs only where a screenshot is impossible) and the repository path of each artifact. No new product features."

## Clarifications

### Session 2026-11-03

- Q: How does the cloud-hosted pipeline reach the locally hosted DefectDojo to upload findings? → A: Both: a pipeline upload job that runs through a public ngrok tunnel when its URL and token are configured as CI secrets, plus a local fallback script that downloads the run's report artifacts and imports them, for when the tunnel is down. A self-hosted runner was rejected because the repository is public.
- Q: Should security scans be able to block a pull request from merging, or only report? → A: Phased: report first, then block on CRITICAL/HIGH findings and on any secret, with the policy and the steps to make the checks mandatory documented. **Amended after `/speckit-evaluate`**: letting code merge into `develop` with failing scans contradicts the constitution ("Code MUST NOT be merged until all … security scans have passed"), so the report phase happens inside this feature's own pull request — baseline, remediation and re-scan — and the stages arrive in `develop` already enforcing. Unfixable findings go to documented, justified suppressions.
- Q: Should DefectDojo use non-default credentials when exposed through the public tunnel? → A: No. It keeps the default `admin/admin`, because it is a controlled, temporary test environment. Recorded as an accepted risk.

### Session 2026-11-05

- Q: Where must the security gates block merges? → A: Team lead decision: any security alert in `develop` MUST block the merge into `main`; pull requests into `develop` run the same scans in report-only mode. This supersedes the 2026-11-03 amendment above and is made possible by the temporary constitution exemption EX-001 (constitution v1.2.0, expires 2026-12-31).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know what can go wrong before scanning anything (Priority: P1)

The team (and the course evaluator) can see how an attacker could abuse MisiOps: which components exist, where data crosses trust boundaries, and which threats matter most, classified with STRIDE.

**Why this priority**: The threat model decides what the security tooling must look for and is the first evaluated item (2b, 2c). Every later finding is easier to prioritize when it maps to a modelled threat.

**Independent Test**: Open the diagram and the filled spreadsheet: every component of the running system appears, each STRIDE category has at least one threat, and the five main threats are explained with component, impact and mitigation.

**Acceptance Scenarios**:

1. **Given** the deployed architecture (browser, frontend, backend, database, CI/CD), **When** the evaluator opens the threat-model diagram, **Then** every component, data flow and trust boundary of the real system is present and the diagram is editable in draw.io.
2. **Given** the course's STRIDE spreadsheet template, **When** it is filled in, **Then** it lists threats for all six STRIDE categories using the template's own columns.
3. **Given** the full threat list, **When** the evidence document is read, **Then** the five main threats are explained in plain language with the affected component and why they rank highest.

---

### User Story 2 - Every change is checked for security automatically (Priority: P1)

Whenever code is proposed or merged, the pipeline analyses the code, its dependencies, its container images, its infrastructure configuration and the running application, and stores downloadable reports — without anyone running tools by hand.

**Why this priority**: This is the core DevSecOps practice the project is graded on (2d, 2e, 2i). Manual, occasional scanning is exactly the limitation the course asks to overcome.

**Independent Test**: Open a pull request and confirm the pipeline runs static analysis, dynamic analysis, secret scanning, dependency analysis, container scanning and configuration scanning, each leaving a downloadable report.

**Acceptance Scenarios**:

1. **Given** a pull request to `develop`, **When** the pipeline runs, **Then** static code analysis covers both the backend and frontend source and produces a report.
2. **Given** the application started as the project normally deploys it, **When** the pipeline's dynamic stage runs, **Then** the running web app and the documented API are both exercised and a report is produced.
3. **Given** the repository history and the dependency lockfiles, **When** the pipeline runs, **Then** exposed secrets and vulnerable dependencies are reported, and a software bill of materials is produced.
4. **Given** the container images and their build files, **When** the pipeline runs, **Then** image vulnerabilities and configuration weaknesses are reported.
5. **Given** a developer about to commit a credential, **When** they commit locally, **Then** the commit is blocked before it reaches the repository.

---

### User Story 3 - All findings in one place (Priority: P1)

The team sees every finding from every tool in one vulnerability-management platform, de-duplicated and tracked over time, instead of reading a dozen separate report files.

**Why this priority**: Required by the course (2f) and the basis of the before/after comparison (2h). Without centralization, findings from different tools cannot be prioritized against each other.

**Independent Test**: After a pipeline run, the vulnerability-management platform shows findings from each tool under the MisiOps product, with severities and source tool.

**Acceptance Scenarios**:

1. **Given** a pipeline run with reports from every tool, **When** the upload stage runs, **Then** each report is imported into the platform under the MisiOps product with its tool identified.
2. **Given** two consecutive runs where nothing changed, **When** both are imported, **Then** findings are not duplicated.
3. **Given** a finding fixed between two runs, **When** the second run is imported, **Then** the finding is shown as closed.

---

### User Story 4 - Show measurable improvement (Priority: P2)

The team takes a baseline, fixes the highest-priority findings, re-scans, and shows the difference — turning the scanning effort into a measurable security improvement.

**Why this priority**: Required by items 2g and 2h. It is P2 because it depends on Stories 2 and 3 being in place first.

**Independent Test**: Compare the platform's open-finding counts by severity before and after remediation; the prioritized findings appear as closed.

**Acceptance Scenarios**:

1. **Given** the baseline import, **When** findings are prioritized, **Then** a mitigation table lists at least five of them with identifier, description, severity, detecting tool and mitigation.
2. **Given** the prioritized findings selected for remediation, **When** fixes are pushed to this feature's pull request and the pipeline re-runs, **Then** those findings are closed and the open count at their severity drops.
3. **Given** the re-scan after remediation, **When** the pull request is ready to merge, **Then** every security stage passes, with any remaining finding either fixed or recorded as a justified suppression.

---

### User Story 5 - A single document the evaluator can grade (Priority: P2)

The evaluator reads one document that answers every required item of the course brief, in question-and-answer order, with visual evidence and the exact place in the repository where each artifact lives.

**Why this priority**: It is the deliverable the grade is read from. P2 because its content depends on Stories 1-4.

**Independent Test**: Walk the course's item list 2a-2k; every item has an answer, evidence, and a repository path that opens.

**Acceptance Scenarios**:

1. **Given** the course's minimum-content list, **When** the evidence document is read top to bottom, **Then** every item 2a-2k appears as a question with its answer.
2. **Given** any piece of evidence, **When** it is shown, **Then** it is a screenshot, or a log only where a screenshot is impossible, and the repository path of the artifact is given.
3. **Given** the narrative items (lessons learned, recommendations), **When** they are read, **Then** each sub-question is answered in at most a short paragraph.

---

### Edge Cases

- What happens when the vulnerability-management platform is unreachable from the pipeline? Scans and their reports MUST still complete and remain downloadable; only the upload step is skipped or fails, without failing the security scans.
- What happens when a tool finds nothing? An empty result MUST still be reported as a successful scan, not mistaken for a skipped one.
- What happens when a reported secret is a deliberate, non-secret test value (for example the CI-only signing key)? It MUST be reviewed and either removed or explicitly allow-listed with a justification, never silently ignored.
- What happens when a vulnerable dependency has no fixed version? It MUST appear in the mitigation table with a compensating measure or an accepted risk, not be dropped.
- What happens when dynamic analysis cannot reach the application because it failed to start? The stage MUST fail visibly rather than report "no findings".
- What happens when the pull request comes from a fork or lacks access to pipeline secrets? Scans MUST still run; only steps needing secrets are skipped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST include a STRIDE threat model of the deployed system as an editable data-flow diagram, covering components, data flows and trust boundaries.
- **FR-002**: The project MUST include the course's STRIDE spreadsheet template filled in with threats for all six STRIDE categories.
- **FR-003**: The evidence document MUST explain the five highest-ranked threats, ranked by risk = likelihood × impact as scored in the spreadsheet, stating each threat's score.
- **FR-004**: The pipeline MUST run static application security testing over the backend and frontend source on every pull request to `develop` or `main` and every push to `develop` or `main`, producing a downloadable report.
- **FR-005**: The pipeline MUST run dynamic application security testing against the application started as the project deploys it, covering both the web frontend and the documented backend API, producing a downloadable report.
- **FR-006**: The pipeline MUST scan the repository, including history, for exposed secrets using two independent detectors, producing downloadable reports.
- **FR-007**: The pipeline MUST analyse third-party dependencies of both the backend and frontend for known vulnerabilities and produce a software bill of materials.
- **FR-008**: The pipeline MUST scan the built container images for known vulnerabilities.
- **FR-008a**: The pipeline MUST scan the container build files and the orchestration file for misconfigurations.
- **FR-009**: Developers MUST be able to install a local pre-commit check that blocks commits containing secrets.
- **FR-010**: The pipeline MUST import every tool's report into a centralized vulnerability-management platform under a MisiOps product, identifying the tool that produced each finding.
- **FR-010a**: Re-importing a run MUST NOT duplicate unchanged findings, and findings absent from a newer run MUST be shown as closed.
- **FR-011**: The pipeline MUST upload reports to the vulnerability-management platform through a public tunnel whenever the tunnel's address and credentials are configured as CI secrets, and MUST skip the upload, without failing any scan, when they are not. Scans MUST complete and keep their reports regardless of the platform's availability.
- **FR-011a**: A local fallback MUST be able to download the reports of any pipeline run and import them into the platform without the tunnel.
- **FR-012**: On pull requests into `main` and pushes to `main`, security stages MUST fail on any CRITICAL or HIGH finding and on any detected secret, so that nothing with an open security alert reaches `main`. On pull requests into `develop` and pushes to `develop`, the same stages run in report-only mode: they produce reports and a visible warning, but do not fail (constitution exemption EX-001). The baseline and the remediation iterate inside this feature's own pull request. CRITICAL/HIGH maps per tool as: Trivy CRITICAL or HIGH with a fixed version available (unfixed ones are reported but do not gate, see the no-fixed-version edge case); Semgrep `ERROR`; ZAP High-risk alerts; any Gitleaks or TruffleHog finding not allow-listed.
- **FR-012a**: The security stages MUST be required status checks on `main` (repository ruleset "Protect main", changeable only by the repository owner), so a failing stage prohibits the merge. The evidence document MUST describe the gate policy, the exemption EX-001, and the steps to also make the checks required on `develop` when the exemption expires.
- **FR-012b**: A finding that cannot be fixed in this repository MUST be suppressed only through the tool's own allow-list mechanism, each entry carrying the finding identifier, a justification and a review date, and listed as an accepted risk in the evidence document.
- **FR-013**: The evidence document MUST contain a mitigation table of at least five findings ordered by severity, each with identifier, description, severity, detecting tool and recommended mitigation.
- **FR-014**: The team MUST record a baseline of open findings, remediate the highest-priority findings that do not require product changes, and record a re-scan showing those findings closed. Priority is severity first; within a severity, findings tied to the STRIDE threats on user credentials and financial data come first.
- **FR-015**: The project MUST include a diagram of the complete CI/CD pipeline and the pipeline's configuration files.
- **FR-015a**: The pipeline MUST include a delivery stage, run on pushes to `main`, that publishes the application's container images only after every security stage has passed (Constitution, Additional Constraints).
- **FR-016**: The evidence document MUST answer items 2a-2k in question-answer format, each with screenshots (logs only where a screenshot is impossible) and the repository path of every referenced artifact, and MUST include the shareable links of the STRIDE diagram and spreadsheet.
- **FR-017**: The evidence document MUST answer the lessons-learned sub-questions (business problem, prior limitations, what changed, concrete advantages) and the recommendations concisely.
- **FR-018**: No credential used by the pipeline MAY be stored in the repository; all such values MUST come from the CI platform's secret store.

### Non-Functional Requirements

- **NFR-001**: The full security pipeline MUST finish within 20 minutes on the CI platform's standard runners, so it stays usable on every pull request.
- **NFR-002**: Every scanning tool MUST be pinned to a specific version, so results do not change between runs because of an unannounced tool upgrade.
- **NFR-003**: Reports MUST be retained by the CI platform long enough to be reviewed (at least 7 days).
- **NFR-004**: The existing quality gates (lint, unit tests, build, integration test, SDD enforcer) MUST keep passing; security work MUST NOT disable or weaken them.
- **NFR-005**: Remediation changes MUST keep the existing automated tests green (Constitution II).
- **NFR-006**: Every script added by this feature (report upload, local fallback import) MUST have an automated test that runs in CI (Constitution II).

### Key Entities *(include if feature involves data)*

- **Threat**: A STRIDE-classified way the system could be attacked. Attributes: category, component, description, impact, likelihood, mitigation.
- **Finding**: One issue reported by a scanning tool. Attributes: identifier, tool, severity, location, description, status (open / closed / accepted / false positive).
- **Scan Report**: The output of one tool on one pipeline run. Attributes: tool, run, format, retention.
- **Mitigation**: The planned or applied fix for a finding. Attributes: finding, action, owner, status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pull requests to `develop` and `main` trigger all six scan categories (static, dynamic, secrets, dependencies, container, configuration) without manual action.
- **SC-002**: 100% of tools used have their findings visible in the centralized platform after a single pipeline run.
- **SC-003**: The open findings of the remediated severities drop between the baseline and the re-scan, and every remediated finding appears as closed.
- **SC-004**: The mitigation table contains at least five findings, ordered by severity.
- **SC-005**: An evaluator can locate the answer, the evidence and the repository artifact of any item 2a-2k in under one minute using the evidence document.
- **SC-006**: A commit containing a test credential is blocked locally 100% of the time once the pre-commit check is installed.
- **SC-007**: Zero real credentials are present in the repository or its history at the end of the feature.
- **SC-008**: 100% of pull requests into `main` with a failing security stage cannot be merged.

## Assumptions

- The CI platform is the project's existing GitHub Actions, which the course brief accepts ("u otra plataforma de CI/CD"); the course labs use GitLab, but moving platforms would add risk without adding grade.
- Tool choice follows the course labs and the team's own working lab implementation: Semgrep (SAST), OWASP ZAP (DAST), Gitleaks and TruffleHog (secret scanning), Trivy (SCA, SBOM, container and configuration scanning), DefectDojo (centralization). Final versions are fixed in `plan.md`.
- DefectDojo runs locally via Docker Compose, as in the course lab; the team already has a working checkout.
- "Remediation of the top findings" means fixes inside this repository (dependency upgrades, configuration hardening, code fixes, removing secrets). Findings that would need product changes or third-party fixes are recorded with an accepted risk or compensating control.
- Shareable links for the draw.io diagram and the spreadsheet (required by the brief's delivery section) are produced by the team uploading the repository files to their cloud drive.
- The PDF version of the final report is a later step; this feature delivers the Markdown evidence document that the PDF will be built from.
- The evidence document is written in Spanish, the language of the course and of the graded report. AGENTS.md's English-only rule covers specs, plans, tasks, checklists, commits, PRs and issues — all of which stay in English — not course deliverables addressed to the evaluator.
- Making checks required for merging is a repository ruleset only the repository owner can change; adding the security stages to the existing "Protect main" ruleset is therefore a manual step for the owner, done after the stages have run once.
- **Accepted risk (team decision)**: DefectDojo runs with its default `admin/admin` credentials, including while exposed through the tunnel. Justification: a controlled, temporary lab instance holding only scan results of this public repository. The tunnel uses a fixed ngrok dev domain but is only up while the team runs it, which limits exposure time. This risk is listed in the evidence document's risk register.

## Out of Scope

- New product features or changes to user-facing behaviour, other than security fixes required by remediation.
- Migrating the CI from GitHub Actions to another platform.
- Hosting DefectDojo on a permanent public server.
- Fixing every finding: only the prioritized subset is remediated; the rest is documented.
- The final PDF report and the oral presentation.
- MLOps items of the course brief.
