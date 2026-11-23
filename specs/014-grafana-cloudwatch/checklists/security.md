# Requirements Checklist: Security and Access

**Purpose**: Review the credential, permission and exposure requirements of the local dashboard.
**Created**: 2026-11-23
**Feature**: [Specification](../spec.md), [plan](../plan.md) and [contract](../contracts/dashboard-contract.md)

A check means the requirement is defined and traceable. Implementation verification is recorded in `tasks.md`.

- [x] CHK001 Is cloud access limited to an assumed read-only role per environment, with no fallback to the operator's own permissions? [Spec FR-008, Plan Design 1–2]
- [x] CHK002 Are the allowed actions enumerated, and are write actions explicitly excluded? [Contract: role permissions, Spec NFR-003]
- [x] CHK003 Are log permissions scoped to the monitor log group wherever AWS supports resource-level permissions? [Plan Design 1]
- [x] CHK004 Is it specified that no credentials, keys or passwords are versioned or baked into the image? [Spec NFR-002, Plan Design 4]
- [x] CHK005 Is the admin password sourced from an untracked file, with the tracked example containing only placeholders? [Spec FR-010, Plan Structure]
- [x] CHK006 Is network exposure limited to the local machine? [Spec NFR-001, Plan Design 4]
- [x] CHK007 Is anonymous access limited to a viewer role, with sign-up disabled? [Spec FR-010, Plan Design 4]
- [x] CHK008 Are third-party images pinned and is container privilege escalation disabled? [Spec NFR-004, Research R7]
- [x] CHK009 Does the role trust policy define who may assume it and for how long? [Contract: trust, Plan Design 1]
- [x] CHK010 Is outbound telemetry from the local tool (usage analytics, update checks) disabled? [Plan Design 4]
