# MisiOps: final DevOps report plan

## Purpose and delivery

Produce an **accumulative final report** about MisiOps, covering the previous DevOps work and the new DevSecOps work below. The final-project brief asks for delivery and presentation in **week 16**, a PDF, and accessible links to the code and pipeline, the STRIDE draw.io diagram, and the STRIDE spreadsheet. It says the report is worth 30% of the final grade. The partial-project brief instead says 40% for the final: **confirm the grading weight and exact deadline with the instructor**. Do not assume a calendar date.

This is a proposed work plan, not evidence that scans, vulnerabilities, integrations, or fixes have already been completed. Assigned names and the relative schedule can be changed by the team.

## Starting point

The repository already contains a LaTeX partial report in [`inform/`](../inform/main.tex), its figures and bibliography, a FastAPI backend, a Next.js frontend, a PostgreSQL Docker Compose configuration, and test files. The existing GitHub Actions configuration includes backend lint, tests and `pip-audit`; frontend lint, tests and build; and a Docker integration workflow. These are **configuration observations**, not proof that the latest runs passed. Check actual runs and keep their links.

The sample [`STRIDE app.drawio`](STRIDE%20app.drawio) and [`STRIDE_Plantilla.xlsx`](STRIDE_Plantilla.xlsx) describe a different application involving AWS, Facebook and Expo. Adapt copies to MisiOps; do not report those examples as MisiOps findings. The spreadsheet has separate risk, control and matrix sheets, lookup ranges and formulas: retain them and verify that all adapted rows calculate correctly.

[`gitlab-ci.yml`](gitlab-ci.yml) is an illustrative pipeline with placeholder `echo` commands. It does not demonstrate real tests, security scans or deployment. The security and DefectDojo guides use a different demo application and GitLab; adapt their concepts and commands to this repository and GitHub Actions.

## Requirement-to-deliverable map

| Final brief | Work and evidence to deliver | Owner |
|---|---|---|
| 2a. Title and project description | Update the business problem, scope, solution and team in the existing report. | Jeffrey |
| 2b. STRIDE diagram | MisiOps data-flow diagram with trust boundaries, flows, threat IDs and a working draw.io link. | Gabriel |
| 2c. Five main STRIDE vulnerabilities | Explain five prioritized threat scenarios, affected component, impact, existing control and proposed mitigation; cross-reference spreadsheet IDs. | Gabriel |
| 2d. SAST and DAST | Semgrep and OWASP ZAP integrated into CI, actual run links, machine-readable reports and screenshots. | Jeffrey (SAST), Yared (DAST) |
| 2e. Secret scanning and SCA | Gitleaks and Trivy integrated into CI, actual run links and reports; verify both backend and frontend dependency coverage. | Jeffrey |
| 2f. Centralization | DefectDojo product/engagement, imported scanner reports, and screenshots showing findings and their status. | Yared |
| 2g. Mitigations | At least five real, prioritized scanner findings with ID, description, severity, detecting tool and mitigation. | Gabriel, reviewed by Yared |
| 2h. Before and after | Comparable baseline and repeat scans; show counts and individual status changes, including unresolved issues. | Yared |
| 2i. Complete CI/CD pipeline | Pipeline diagram, actual workflow files, run evidence and clear explanation of gates and deployment scope. | Jeffrey |
| 2j–k. Lessons and recommendations | Business problem, initial limits, changes, measured advantages, limitations and practical recommendations. | All; Jeffrey integrates |
| Submission and presentation | Repository, draw.io and spreadsheet links, final PDF and presentation. | All |

The final brief's five STRIDE scenarios and its five scanner findings are **separate requirements**. Link them where evidence supports a relationship; a modeled threat alone is not a scanner finding.

## Work sequence

### 1. Establish scope and preserve the baseline

1. Agree on the app version and baseline commit SHA. Record date, environment, scanner versions/configuration, inspected paths, and the GitHub Actions run URL. Keep the baseline reports before any fixes.
2. Review the existing partial report and preserve its useful content: problem, GitFlow and commits, tests, automation and Docker. Refresh screenshots or claims where they no longer match the repository.
3. Start MisiOps with `docker/docker-compose.yaml` in an isolated test environment using test data. Verify frontend and backend are reachable before DAST. Record the actual URLs, reachable routes and test account, if used.
4. Check the existing backend, frontend, Docker and SDD workflows on GitHub. Record their current outcomes and understand path filters: a documentation-only change may not trigger the application workflows.
5. Choose one shared evidence location with controlled access for raw reports. Record each report's scanner, target, version, commit and run. Redact credentials, tokens, personal financial data and sensitive evidence before sharing screenshots or report excerpts.

**Done when:** the baseline commit and existing workflow outcomes are recorded, the application is reachable in the test environment, and the team can reproduce the baseline.

### 2. Model threats with STRIDE

1. Make MisiOps-specific copies of the draw.io diagram and Excel workbook. Draw the actual system: user/browser, Next.js frontend, FastAPI backend, PostgreSQL, developer/GitHub Actions, and connections that really exist. Mark external actors, processes, data stores, data flows and trust boundaries. Confirm deployment and any external integrations before adding them.
2. Walk through each component and flow using all six STRIDE categories. Candidate scenarios to investigate include stolen user credentials or tokens, transaction tampering, lack of traceability, disclosure of financial data or secrets, API resource exhaustion, and cross-user access. These are **hypotheses**, not established vulnerabilities.
3. For each threat, fill a unique ID, category, component/flow, scenario, probability, impact, inherent risk, current controls supported by evidence, proposed control, residual risk and priority. Use the workbook's risk and control tables; extend their lookup values for MisiOps as necessary and verify formulas and matrix totals in a spreadsheet application.
4. Select the five highest-priority scenarios using the workbook's method. Explain likelihood and business impact, and distinguish verified controls from suggested controls. Mark each ID on the diagram and refer to the same IDs in the report.
5. Store the resulting draw.io and spreadsheet files where the instructor can access them; put tested links in the final PDF. Export the diagram as a legible image for the report.

**Done when:** the MisiOps diagram, spreadsheet and five explanations agree on threat IDs, components and risk ratings.

### 3. Run and integrate security scans

Use GitHub Actions, which is already present. Create actual jobs and preserve report artifacts even if a scanner detects a finding. Record errors separately from findings; a failed tool or an empty report is not proof of a clean system.

| Type | Proposed tool | Target and required output | Owner |
|---|---|---|---|
| SAST | Semgrep | Analyze `backend/` Python and `frontend/` TypeScript with suitable rules. Save native JSON and retain the run and relevant finding details. | Jeffrey |
| Secrets | Gitleaks | Scan the agreed repository scope, including history if configured; save its native report. Verify the scope and protect any sensitive report. | Jeffrey |
| SCA | Trivy | Scan `backend/uv.lock` and the frontend lockfile used by CI (`frontend/pnpm-lock.yaml`); save JSON and record detected targets/packages. The repository also has `package-lock.json`: avoid counting both lockfiles as independent proof of coverage without checking which one is authoritative. Keep existing `pip-audit` as complementary evidence. | Jeffrey |
| DAST | OWASP ZAP | Run against the isolated running MisiOps app, with an explicit target, discovered URLs, authentication scope and HTML/JSON reports. A baseline scan is passive and does not establish coverage of authenticated pages or active attacks. | Yared |

Trivy's [language coverage documentation](https://github.com/aquasecurity/trivy/blob/main/docs/guide/coverage/language/index.md) lists `uv.lock` and `pnpm-lock.yaml` for filesystem scanning. Verify the selected version actually recognizes both targets and document whether development dependencies are included. The local Trivy guide's npm lockfile instructions concern its example, not necessarily this monorepo.

For ZAP, ensure the scanner can reach the test app across container/network boundaries, wait for readiness, and capture the tested target and crawl coverage. Use only disposable test data. If the team adds an active scan, run it only in an authorized isolated environment and document its scope and results separately. The example guide explains baseline warnings and exit codes; configure and explain the actual gate instead of treating every nonzero result as a scanner failure.

Proposed flow: checkout and setup; lint/tests and build; SAST, SCA and secrets; start an isolated application and perform DAST; retain reports and import them into DefectDojo; evaluate the security gate; deploy only if an actual deployment environment exists and the gate passes. Jobs may run in parallel where dependencies permit. Ensure report collection and import can still run after a finding or failing scan; do not silently ignore scanner execution errors. If there is no real deployment, state that the pipeline validates a disposable environment and leave release deployment as future work rather than claiming continuous deployment.

**Done when:** each of the four scan types runs for MisiOps in CI, produces a usable report, has an inspectable run, and its scope, gate behavior and limitations are documented.

### 4. Centralize and triage findings

1. Set up a reachable DefectDojo instance for the team. Create the MisiOps asset/product and an engagement for the baseline. Document instance version and access method; a hosted GitHub runner cannot reach a teammate's `localhost` directly.
2. Import the actual Semgrep, Trivy, Gitleaks and ZAP reports using the compatible parser for each report format. Check parser names in the running instance. Confirm the imported tests and findings in the UI; record counts per tool and severity.
3. Automate CI import if feasible using a runner that can reach DefectDojo and protected GitHub secrets for the token. Restrict access and avoid exposing a local instance with default credentials. If automation cannot be completed, retain the CI artifacts, import manually and explicitly state the limitation; the brief requires scan integration and centralization, but does not explicitly require automatic import.
4. Check duplicates, false positives and scope before assigning severity. Select at least five **actual** findings across the available reports, prioritized by severity and business impact. Assign an owner and record status; do not invent findings or claim five exist before scanning.
5. For each selected finding capture: stable finding ID, description and affected component, severity, detecting tool, recommended mitigation, owner, current state, and report or DefectDojo reference. Explain when a finding is accepted or is a false positive.

**Done when:** imported results can be traced to their source reports and the report contains at least five substantiated findings, or clearly identifies the limitation if the real scans produce fewer.

### 5. Mitigate and compare before versus after

1. Agree on feasible high-priority fixes and assign each one. Any source-code changes must follow the repository's SDD prerequisites, review and tests. Track each fix with its finding ID and commit/PR.
2. Rerun the **same scanner versions, rules, paths, target, authentication and severity settings** against the updated commit where possible. Record any differences in scope. Reimport using a stable test/engagement strategy so status changes can be checked without misrepresenting duplicates or closing unrelated findings.
3. Compare the baseline and final results: dates and SHAs, findings by tool/severity, number open/fixed/accepted/false positive, and selected findings with before/after evidence. Explain whether differences reflect real fixes, changed coverage or triage. If no fixes are completed, report the original results and proposed mitigations honestly.
4. Capture a DefectDojo overview and individual finding details before and after, along with the corresponding scanner report and pipeline run links. Avoid presenting fewer warnings as a security improvement without comparable coverage.

**Done when:** each claimed fix has a change reference and repeat-scan evidence, and unresolved findings remain visible in the report.

### 6. Write the cumulative PDF and rehearse

Extend the existing LaTeX report under `inform/`; update its table of contents and references as needed. Suggested order:

1. Title, team, repository link, business problem and MisiOps scope.
2. Prior DevOps work: GitFlow/PRs and commits, unit tests, automation and Docker; update the partial-report evidence.
3. STRIDE data-flow diagram, trust boundaries, spreadsheet link and five prioritized threat scenarios.
4. CI/CD architecture diagram and actual workflow configuration links, triggers, gates and deployment scope.
5. SAST, DAST, secrets and SCA: selection rationale, integration, scope, reports and pipeline evidence.
6. DefectDojo setup and centralization, with screenshots and source-report traceability.
7. Prioritized mitigation table with at least five real findings and their status.
8. Initial state versus final state with comparable evidence and limitations.
9. Lessons learned: business problem, initial limitations, DevOps changes and demonstrated advantages.
10. Recommendations, references and appendices with exact workflow links, reports and supporting screenshots.

Compile the PDF, visually inspect every page and check that figures, tables, references and all three required links are legible and accessible to the instructor. Prepare slides or use the PDF, as permitted by the final brief. The partial brief mentions 20 minutes plus 5 minutes of questions, but the final brief does not specify a duration; confirm the final presentation time with the instructor.

**Done when:** all requirements in the map above have a specific section and evidence, the PDF opens correctly, the links work outside the team's accounts, and all three members have rehearsed.

## Suggested division of work

| Member | Primary responsibility | Concrete handoff | Report and presentation |
|---|---|---|---|
| Jeffrey Monja Castro | Coordinate GitHub Actions; integrate SAST, SCA and secret scanning; document pipeline and existing DevOps work. | Working jobs, baseline/final artifacts and run links; CI/CD diagram; workflow excerpts; scanner scopes and gate behavior. | Project/context, previous DevOps work and CI/CD. Integrate the final LaTeX report. |
| Gabriel Espinoza | Lead STRIDE and risk assessment; organize prioritization and mitigation follow-up. | MisiOps-specific draw.io and workbook, five threat explanations, and a five-finding mitigation table based on actual reports. | Threat model, prioritized threats and mitigations. Independently review Jeffrey's workflow evidence. |
| Yared Riveros Rodriguez | Lead ZAP DAST, DefectDojo and before/after comparison. | DAST pipeline job and reports; DefectDojo setup and import evidence; baseline/final comparison and finding status. | DAST, centralization, results and limitations. Independently review Gabriel's risk/evidence mapping. |

All three: agree on the threat-model scope, help fix and validate assigned findings, peer-review the complete report, and rehearse. Jeffrey reviews Yared's pipeline and comparison. Each person captures evidence for their own work rather than leaving all documentation to the final editor.

## Relative schedule

Use the confirmed week-16 deadline as **D**; these are suggested milestones, not calendar dates or estimates of completed work.

| When | Parallel work | Checkpoint |
|---|---|---|
| D-10 to D-8 | Jeffrey checks existing CI and SAST/SCA/secrets; Gabriel maps architecture and adapts STRIDE; Yared prepares test environment, ZAP and DefectDojo. | Baseline SHA, running app, initial diagram and agreed evidence location. |
| D-7 to D-6 | Finish all four scans and produce reports; complete threat scoring; import baseline into DefectDojo. | All types have run evidence; five threats selected; actual findings available for triage. |
| D-5 to D-4 | Implement feasible approved fixes; rerun equivalent scans; update DefectDojo and mitigation table. | Before/after results and outstanding risks recorded. |
| D-3 to D-2 | Write assigned report sections, create pipeline diagram, integrate figures and links. | Complete draft PDF with all minimum requirements. |
| D-1 | Cross-review, compile and inspect PDF, test access to links, rehearse and allocate speaking time. | Submission-ready PDF and presentation. |
| D | Submit and present according to instructor instructions. | Repository, draw.io, spreadsheet and PDF accessible. |

If the remaining time is shorter, preserve the dependency order: baseline and threat model first, scanners and import next, then fix/retest and report integration.

## Final submission checklist

- [ ] Final PDF includes all brief sections 2a–2k and incorporates the partial report.
- [ ] Repository link opens the actual code and GitHub Actions workflow configurations and run evidence.
- [ ] Draw.io link opens the MisiOps diagram, with named flows, trust boundaries and matching threat IDs.
- [ ] Spreadsheet link opens the adapted STRIDE workbook; formulas and risk matrix have been checked.
- [ ] Five STRIDE threats are explained and prioritized; five actual scanner findings have the required mitigation-table columns.
- [ ] SAST, DAST, secret scanning and SCA have pipeline runs and reports; scan scope and limitations are stated.
- [ ] DefectDojo contains the imported results and screenshots identify the MisiOps asset and findings.
- [ ] Baseline and final results use comparable settings and cite commits, reports and fixes.
- [ ] Actual pipeline diagram, configuration and security-gate behavior are documented; any deployment claim is evidenced.
- [ ] The business problem, initial limitations, DevOps benefits, lessons and recommendations are supported by evidence.
- [ ] PDF, figures, citations and links are readable; presentation is rehearsed; exact deadline, grade weight and speaking time have been confirmed.

## Source material

- [`Proyecto Informe final.pdf`](Proyecto%20Informe%20final.pdf), pages 1–3: final requirements and deliverables.
- [`Proyecto Informe Parcial.pdf`](Proyecto%20Informe%20Parcial.pdf), pages 1–4: prior deliverables and cumulative-report instruction.
- [`STRIDE app.drawio`](STRIDE%20app.drawio) and [`STRIDE_Plantilla.xlsx`](STRIDE_Plantilla.xlsx): example diagram, threat register and scoring template.
- [`guia_secret_scanning_sca_sast.md`](guia_secret_scanning_sca_sast.md): Semgrep, Trivy and secret-scanning examples.
- [`ejemplo_intro_dast.md`](ejemplo_intro_dast.md): ZAP baseline, active scan, report and gate examples.
- [`guia_defect_dojo.md`](guia_defect_dojo.md): DefectDojo setup, report import and finding management.
- [`gitlab-ci.yml`](gitlab-ci.yml): illustrative pipeline structure; its jobs are placeholders.
- [Existing partial report](../inform/main.tex), [backend CI](../.github/workflows/backend-ci.yml), [frontend CI](../.github/workflows/frontend-ci.yml), [Docker integration CI](../.github/workflows/docker-integration.yml), and [Compose configuration](../docker/docker-compose.yaml): current repository starting point.
