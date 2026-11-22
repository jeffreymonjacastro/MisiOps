# Feature Specification: Month-End Forecast PoC

**Feature Branch**: `feature/mlops`
**Created**: 2026-11-22
**Status**: Approved for implementation on 2026-11-22. The reviewer authorized starting with the custom review checklists open.
**Input**: Implement and document an end-to-end CRISP-ML(Q) proof of concept for a month-end net forecast.

## User Scenarios & Testing

MisiOps users can see their net movements recorded so far, but cannot estimate how the month might close. The goal is to help an authenticated user anticipate a projected surplus, deficit, or tight close from their recorded activity. An ML operator needs evidence to judge each candidate and detect degradation. A release reviewer needs to identify exactly what would be served and how to recover the previous approved version.

### User Story 1 - See the month-end forecast (Priority: P1)

**Why this priority**: The forecast gives users time to reconsider upcoming spending.

**Independent Test**: Open the dashboard as a seeded user and verify the displayed amount, period, and status using three approved fixture predictions.

**Acceptance Scenarios**:

1. **Given** an eligible user and a forecast of +250 with an observed error band of 100, **When** they open the dashboard, **Then** they see a projected net of +250 and an expected surplus.
2. **Given** the same band, **When** the forecast is -250, **Then** they see an expected deficit, and **When** it is -100, 0, or +100, **Then** they see a tight close.
3. **Given** insufficient history or a missing or invalid approved model, **When** the dashboard loads, **Then** it explains the applicable unavailable state and the transaction summary continues working.
4. **Given** two authenticated users with different ledgers, **When** either requests a forecast, **Then** only their own activity informs it and only their own result is returned.

### User Story 2 - Compare and qualify candidates (Priority: P2)

**Why this priority**: A useful demonstration needs evidence that a model adds value over a simple forecast.

**Independent Test**: Run the training workflow with a fixed synthetic snapshot and inspect the versioned comparison, decision, and model card.

**Acceptance Scenarios**:

1. **Given** dated synthetic transactions that include a late registration and a valid large expense, **When** the preparation workflow runs, **Then** the late record is excluded from earlier cuts and the valid expense is retained.
2. **Given** invalid source data, **When** validation runs, **Then** it rejects the run with an actionable report before training.
3. **Given** several regressors and a historical baseline, **When** fitting and selection finish, **Then** the operator sees comparable chronological results and an independent evaluation of the selected candidate.
4. **Given** a candidate that fails the quality gate, **When** promotion is attempted, **Then** the active version remains unchanged.

### User Story 3 - Release and monitor a known model (Priority: P3)

**Why this priority**: A deployed forecast must match the evaluated behavior and remain measurable as new periods close.

**Independent Test**: Exercise the release and monitoring flows in the non-production environment with controlled snapshots and a known simulated shift.

**Acceptance Scenarios**:

1. **Given** an accepted candidate and the corresponding source fixtures, **When** the release verifies the packaged model, **Then** the running API and offline forecast match within one cent and report the same model version.
2. **Given** a deployment that fails readiness, **When** replacement fails, **Then** the preceding healthy release is restored. **Given** a healthy release with poor forecast quality, **When** a reviewer rolls back, **Then** the previous approved model is served.
3. **Given** open and closed months, **When** monitoring runs, **Then** it reports drift separately from error and computes error only for closed months whose outcomes are available.
4. **Given** a reproducible degradation scenario, **When** a quality threshold is breached, **Then** the operator sees a report and a retraining recommendation or candidate. Production promotion still needs review.
5. **Given** a staging run and a production release, **When** their workflow summaries are inspected, **Then** staging trains and verifies a candidate or verifies the pinned release, while production shows approval and verification of the already evaluated version.

### Edge Cases

- Legacy records without a trustworthy recording timestamp remain available in the ledger and are excluded from strict historical replay unless a valid dated snapshot proves availability.
- Corrections and deletions after a cutoff do not rewrite a previously captured forecast snapshot. Date and currency conventions are documented and preserved across offline and live calculations.
- A month with incomplete ingestion or an insufficient sample reports insufficient evidence. A lack of observed deficits prevents claims about deficit recall.
- An outlier that passes the financial data contract remains eligible. Duplicate transaction identifiers, impossible amounts, and invalid date ordering fail validation.
- An abstention near zero is reported separately and is not counted as a detected deficit.

## Requirements

### Functional Requirements

- **FR-001**: The dashboard MUST show the current calendar month's projected net of recorded income minus recorded expenses, using the signed amount and forecast cutoff.
- **FR-002**: An eligible forecast MUST show tight close when the absolute amount is within the inclusive observed error band, surplus above it, and deficit below its negative. The band MUST be estimated from past validation errors by cutoff bucket and stored with the model version.
- **FR-003**: The forecast MUST use the authenticated user's data and display an explicit unavailable reason for insufficient history or an unavailable model.
- **FR-004**: Newly recorded transactions MUST receive a server-controlled creation timestamp distinct from their occurrence date. Existing rows MUST keep unknown creation times unless there is trustworthy provenance.
- **FR-005**: Each training snapshot MUST identify its origin, time coverage and version. Validation MUST check the agreed transaction contract before preparation.
- **FR-006**: Preparation MUST reproduce what was available at each cutoff, use only earlier or current observations for inputs, and derive labels from settled month outcomes. Each user-month's cutoffs MUST remain in one partition.
- **FR-007**: Operators MUST be able to reproduce and compare a historical-rule baseline, multiple linear regression, Ridge, Random Forest regression and Gradient Boosting regression on shared temporal partitions. Candidate selection MUST use validation periods and keep the final test periods reserved.
- **FR-008**: Experiment history MUST link parameters, model, dataset, feature contract, metrics, code revision and decision. The independent evaluator MUST report absolute and squared-error summaries, missed deficits and sample counts by cutoff, apply a documented quality gate and retain the previous approval on failure.
- **FR-009**: Release evidence MUST identify the approved model, its fingerprint and the exact application image built and scanned for the release. A parity test MUST exercise the real forecast path with matching historical and live inputs before release.
- **FR-010**: Prediction observations MUST survive application replacement and identify forecast version, user, period and cutoff so that an observed close can be matched later. Monitoring MUST report operation and shifts in data and forecasts separately from delayed quality metrics, and provide a supported path to retraining a candidate without bypassing release gates.
- **FR-011**: The PoC MUST include a runnable, documented workspace organized around the six CRISP-ML(Q) phases, with setup, data assumptions, gates, deployment, monitoring, rollback and required manual configuration.
- **FR-012**: The MLOps pipeline MUST distinguish staging and production runs. Staging MUST train and verify candidates with synthetic data. Production MUST verify and serve the approved version without retraining it. Monitoring evidence and access MUST identify the environment.
- **FR-013**: One `mlops.yml` run MUST expose exactly the nine Guide 12 jobs, with the guide's names and order. The seven common jobs lead to the two named deployment jobs. A qualifying `develop` release runs all seven common jobs and staging. Production is skipped in that run. MLOps MUST orchestrate its own artifacts and shared security controls without waiting for another workflow.

### Non-Functional Requirements

- **NFR-001**: Forecast handling MUST preserve existing dashboard behavior when unavailable. On the seeded dev workload, the forecast endpoint MUST respond within 2 seconds at p95 after warm-up.
- **NFR-002**: Development and public CI artifacts MUST use synthetic financial data. Only authorized components may access private forecast observations. Logs and public reports MUST omit account identifiers and transaction detail. Account deletion MUST remove associated online observations.
- **NFR-003**: The standard tests, peer review, and applicable security gates MUST remain in effect. Cloud credentials MUST be short-lived. Production MUST use the existing protected release process with explicit reviewer approval and the exact scanned image. Failed readiness MUST revert to the previous healthy release.
- **NFR-004**: UI terminology MUST fit the existing dashboard and indicate that the amount is a forecast from registered transactions.

### Key Entities

- **Transaction**: A recorded income or expense, its owner, occurrence time and, for new records, its creation time.
- **Forecast snapshot**: A versioned input or reproducible reference to the features available at a cutoff and to the policy used to compute them.
- **Model candidate**: A regression pipeline with a version, fitted preprocessing, training snapshot, evaluation report, error band and gate result.
- **Forecast observation**: A served estimate with owner, cutoff, period, version and eventually a matching closed-period outcome.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On scripted fixtures the dashboard correctly distinguishes surplus, deficit, tight close and unavailable in all cases, and no test user receives another user's forecast.
- **SC-002**: Each evaluation report compares five approaches over the same chronological partitions, describes every rejection and shows the error and sample size at each evaluated cutoff.
- **SC-003**: The selected candidate can be uniquely traced to its inputs, evaluation and release. Every release parity fixture agrees within one cent.
- **SC-004**: Synthetic monitoring demonstrates one steady run, one shift report without a final label and one closed-month degradation report that can start candidate retraining.
- **SC-005**: Using the PoC instructions, a reviewer can reproduce the training and inspect the forecast, monitoring output and rollback procedure.

## Assumptions

- The PoC uses at least 12 complete synthetic months across multiple financial profiles. The simulator can generate additional windows for stable validation.
- The financial target is recorded monthly income less recorded monthly expenses. The first release uses calendar months in America/Lima and PEN, including for users whose budgeting period starts on another date.
- The observed error band is a historically measured typical error, not a calibrated probability. Release data and quality gates are measurable on synthetic scenarios. Real-world accuracy is outside the evidence provided by this PoC.
- Existing application authentication, dashboard, and AWS development and production environments are the integration points. Dev is the cloud demonstration target.
- The existing `dev` environment is MLOps staging and the existing `prod` environment is MLOps production.

## Out of Scope

- Forecasting actual cash or bank-account balances, multi-currency conversion and other products that require opening balances.
- An external inference service, per-user model fleet and migration to a new infrastructure framework.
- Importing live customer history into development or training the PoC on actual customer financial data.
