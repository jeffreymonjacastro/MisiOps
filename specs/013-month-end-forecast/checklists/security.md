# Requirements Checklist: Security and Deployment

**Purpose**: Review the privacy, artifact integrity and cloud release requirements.
**Created**: 2026-11-22
**Feature**: [Specification](../spec.md) and [release contract](../contracts/forecast-and-release.md)

Reviewer-owned checklist. A check means the requirement is defined to the reviewer's satisfaction.

- [ ] CHK001 Do the requirements specify user isolation, account deletion and non-cacheable responses? [Spec FR-003, NFR-002, API contract]
- [ ] CHK002 Are public artifacts and shared logs prevented from exposing real financial records and identifiers? [Spec NFR-002]
- [ ] CHK003 Do release rules require artifact checksums, matched feature contracts and a passing report? [Spec FR-009, build contract]
- [ ] CHK004 Does the deployment path preserve the scanned image, dev/prod branch boundaries and production approval? [Spec NFR-003]
- [ ] CHK005 Are OIDC and the distinct deployment, monitoring and application privileges defined? [Plan Manual setup, monitor contract]
- [ ] CHK006 Do readiness and rollback conditions distinguish failed startup from post-release quality regression? [Spec Story 3, build contract]
- [ ] CHK007 Are staging candidate training, production promotion, environment access and per-environment monitoring evidence clearly distinct? [Spec FR-012, build contract]
- [ ] CHK008 Does the deploy job keep the protected caller ref when consuming the scanned artifact, and does manual cloud monitoring require the selected environment's allowed ref? [Plan Manual setup, R6]
