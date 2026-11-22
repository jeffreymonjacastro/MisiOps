# Tasks: Month-End Forecast PoC

**Input**: [specification](spec.md), [plan](plan.md), [data model](data-model.md), [forecast and release contract](contracts/forecast-and-release.md), [quickstart](quickstart.md).

Task IDs are sequential within the feature and use the 13 prefix to distinguish them from existing repository issues.

## Phase 1: Setup

- [X] T1301 Scaffold the laboratory-style workspace and locked training tools in mlops/pyproject.toml, mlops/configs/forecast.yaml, and mlops/.gitignore. Configure reproducible synthetic settings and local MLflow persistence in mlops/docker-compose.yml. (FR-007, FR-008, FR-011)

## Phase 2: Foundation

- [X] T1302 Add transaction creation time, the additive legacy PostgreSQL migration, and database coverage in backend/models/transaction.py, backend/core/, backend/main.py, and backend/tests/. The field is “Set by the database for new records. Legacy records with unknown provenance remain null.” (FR-004, NFR-003)
- [X] T1303 Define the fixture clock, recorded transaction format, shared cutoff and feature functions, and temporal tests in backend/core/forecast_features.py and mlops/tests/. Require “All features computed from known inputs” and test late registration, no leakage, calendar boundaries and ordinary large expenses. (FR-001, FR-005, FR-006)

## Phase 3: User Story 1 - See the month-end forecast (P1)

**Independent verification**: Supply a trusted fixture forecast and test dashboard rendering, API authorization and all unavailable or boundary states without needing fresh training.

- [X] T1304 [US1] Implement authenticated forecast and observation persistence with contract tests in backend/api/v1/predictions.py, backend/models/prediction.py, backend/schemas/prediction.py and backend/tests/. Enforce “Owner scoped, timestamped, append-only forecast values” and “User deletion cascades.” Test missing history/model, exclusive lookup, no caching and inclusive monetary error bounds. (FR-001–FR-003, FR-010, NFR-001, NFR-002)
- [X] T1305 [US1] Add a month-end forecast card and authenticated client with state coverage in frontend/. Present PEN, cutoff and forecast label using the existing dashboard's design. (FR-001–FR-003, NFR-001, NFR-004)

## Phase 4: User Story 2 - Compare and qualify candidates (P2)

**Independent verification**: Generate valid and invalid synthetic snapshots and verify independent model comparison, tracking, and rejection without the web application.

- [X] T1306 [US2] Build seeded simulation, validation and chronological preparation in mlops/simulation/, mlops/src/validate_data.py, mlops/src/data_prep.py and mlops/tests/. Require “Numeric positive amounts, explicit income/expense types, unique IDs, chronological occurrence/recording timestamps, at least 12 completed months.” (FR-005, FR-006)
- [X] T1307 [US2] Train and compare the baseline, multiple linear, Ridge, Random Forest and Gradient Boosting candidates with temporal folds in mlops/src/train.py. Capture fitted preprocessing, validation bands and MLflow runs with reproducibility tests in mlops/tests/. (FR-002, FR-007, FR-008)
- [X] T1308 [US2] Add independent held-out evaluation, a rejection gate, champion comparison when fresh common periods exist, a model card and deterministic bundle materialization in mlops/src/evaluate_and_register.py and mlops/tests/. Enforce “Only an accepted and explicitly selected manifest can be packaged.” (FR-007–FR-009)

## Phase 5: User Story 3 - Release and monitor a known model (P3)

**Independent verification**: Deploy a known approved version in staging, inspect its health and version, and verify monitoring with both unlabeled and labeled scenarios.

- [X] T1309 [US3] Add the staging training workflow in .github/workflows/mlops.yml and the production verification lane in .github/workflows/devsecops.yml. Pass model and evidence through appropriate jobs. Use `develop` for staging and `main` for protected pinned promotion. Prove production fits no candidate. (FR-008, FR-009, FR-012, NFR-003)
- [X] T1310 [US3] Package and verify the approved bundle in backend/Dockerfile and the existing DevSecOps build before scans. In .github/workflows/deploy.yml and .github/workflows/devsecops.yml, call the reusable deployment from the gated push run so the environment sees the correct caller ref and the existing scanned artifact. Add fixture parity, readiness, deployed-version smoke and staging evidence in backend/tests/, infra/lib/environment-stack.ts, and infra/scripts/smoke.sh. Verify dev and prod protection rules and prior release recovery in the designated test environment. (FR-009, FR-012, NFR-001, NFR-003)
- [X] T1311 [US3] Implement reproducible drift and matured-label evaluation in mlops/src/monitor.py, backend/core/, mlops/tests/ and mlops/monitoring/. Finalize eligible observations once after the grace period. Emit aggregate reports, thresholds for degradation or insufficient evidence and candidate retraining decision. (FR-010, NFR-002)
- [X] T1312 [US3] Add the authorized AWS monitor task, scoped OIDC role, per-environment scheduling, CloudWatch metrics and environment-aware workflow in infra/lib/, infra/test/, and .github/workflows/model-monitoring.yml. Ensure synthetic scenario runs require no AWS credentials and manual cloud runs use the protected ref for the selected environment. (FR-010, FR-012, NFR-002, NFR-003)

## Phase 6: Cross-Cutting

- [X] T1313 Write mlops/README.md and mlops/docs/crisp-mlq.md covering all decisions, local Docker execution, credential and environment setup, reproducibility, optional observability tooling and rollback. (FR-011, FR-012)
- [ ] T1314 Run the full local and CI validation paths, record forecast timing and drift evidence, audit remaining work, then prepare the pull request evidence using .github/pull_request_template.md. (SC-001–SC-005, NFR-001–NFR-004)

## Dependencies and execution order

- T1301 → T1302/T1303. T1304 needs T1302/T1303, then T1305 uses the endpoint contract.
- T1306 needs T1303. T1307 needs T1306. T1308 needs T1307.
- T1309 needs T1308. T1310 needs T1304, T1308 and T1309.
- T1311 needs T1304 and T1308. T1312 needs T1311 and the packaged release path.
- T1313 needs the resulting behavior and configuration. T1314 verifies every prior phase.
