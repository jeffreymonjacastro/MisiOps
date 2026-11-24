# Requirements Checklist: Observability Coverage

**Purpose**: Review whether the dashboard requirements cover every signal the forecast monitor publishes.
**Created**: 2026-11-23
**Feature**: [Specification](../spec.md) and [data model](../data-model.md)

- [x] CHK001 Are both binary flags (drift, retraining) and the MAE by cutoff required? [Spec FR-003]
- [x] CHK002 Is the alarm state defined with the same rule as the CloudWatch alarm (window, statistic, threshold, missing data)? [Spec FR-004, Research R6]
- [x] CHK003 Are decisions, observation counts and settled counts per cutoff required from the reports? [Spec FR-005, Data model]
- [x] CHK004 Is the drift index per feature and for the prediction required? [Spec US2 scenario 2, Data model]
- [x] CHK005 Is the "no data yet" state distinguished from zero values and errors? [Spec US1 scenario 2, Edge cases]
- [x] CHK006 Is the number of listed reports bounded? [Plan Design 3: last 20]
- [x] CHK007 Does every query follow the selected environment? [Spec FR-006, Data model variables]
- [x] CHK008 Is drift explicitly kept apart from observed error, as feature 013 requires? [Spec FR-009, Data model metrics]
- [x] CHK009 Is a contract test required to detect renamed metrics, namespaces, log groups or report fields? [Spec FR-007, Contract]
