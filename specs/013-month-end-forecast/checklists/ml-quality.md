# Requirements Checklist: Model Quality and Operations

**Purpose**: Review the forecasting data, evaluation, release and monitoring requirements.
**Created**: 2026-11-22
**Feature**: [Specification](../spec.md) and [plan](../plan.md)

Reviewer-owned checklist. A check means the requirement is defined to the reviewer's satisfaction.

- [ ] CHK001 Are currency, calendar cutoff, sign and both exact error-band bounds unambiguous? [Spec FR-001–FR-002]
- [ ] CHK002 Are cases with insufficient histories, models, and closed-period labels distinguishable? [Spec FR-003, FR-010]
- [ ] CHK003 Do synthetic and legacy records have explicit timestamp provenance and a rule for corrections or deletions? [Spec FR-004–FR-006]
- [ ] CHK004 Are all cutoffs from the same calendar month assigned to one temporal partition, and are tuning and final testing separated? [Spec FR-006–FR-008]
- [ ] CHK005 Does each comparison use a fixed baseline, common partitions, observable metrics and a rejection rule for a failed candidate? [Spec FR-007–FR-008]
- [ ] CHK006 Are parity inputs, acceptable difference and output version defined? [Spec SC-003]
- [ ] CHK007 Do model loss and drift have separate inputs, thresholds, actions and insufficient-data results? [Spec FR-010, plan Phase 1]
- [ ] CHK008 Can each forecast and accepted artifact be traced to a version across replacement and rollback? [Spec FR-008–FR-010]
