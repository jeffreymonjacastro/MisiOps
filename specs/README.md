# Frontend Feature Roadmap — Manual Income/Expense Tracking

This document maps the frontend features proposed for MisiOps's current build phase. It was produced with `/speckit-specify` (see each feature's `spec.md`), following the SDD pipeline described in [`AGENTS.md`](../AGENTS.md). **No implementation has started** — this is the mapping/specification stage only (pipeline step 3 of 13). Nothing here is a plan (`/speckit-plan`) or task breakdown (`/speckit-tasks`) yet.

## Scope decision

Per the project owner's request, this roadmap is restricted to features that either:

1. Let the user **manually enter, view, and manage income or expense transactions**, or
2. Are **explicitly contemplated in the repo's own instructions** (i.e. entities/fields already present in `.specify/memory/constitution.md`'s data schema or `README.md`).

⚠️ **Note for the team**: `constitution.md`'s Product Context states the project's objective is to let users register transactions "via a natural-language-processing chatbot" and explicitly frames this as a low-friction alternative "over manual data entry forms." The features below add a manual/web entry path as a **complement** to that planned chatbot, not a replacement — every spec's Assumptions section says so explicitly. Worth confirming with the team before implementation that a manual UI is still wanted alongside the chatbot, since the constitution frames the chatbot as the primary channel.

## Inspiration sources

UI/UX patterns were adapted (not copied) from screenshots of Monarch Money, Copilot, and Kuanto shared by the project owner: dashboard summary cards, a date-grouped transaction list with category tags and filters, category-based spending breakdowns, and budget-progress indicators. Patterns tied to capabilities this project doesn't have yet — bank/account sync, net worth, investments, cash-flow Sankey charts, AI auto-categorization, recurring-bill detection — were deliberately **left out** of every spec's requirements and called out in each "Out of Scope" section, since the backend has no accounts/investments entities and the constitution scopes those out.

## Features (in build priority order)

| # | Feature | Priority | Spec | Depends on |
|---|---------|----------|------|------------|
| 1 | Manual Transaction Entry | P1 | [`001-manual-transaction-entry/spec.md`](001-manual-transaction-entry/spec.md) | Categories must exist (→ 3) |
| 2 | Transaction History List | P1 | [`002-transaction-history-list/spec.md`](002-transaction-history-list/spec.md) | 1, 3 |
| 3 | Category Management | P1 | [`003-category-management/spec.md`](003-category-management/spec.md) | none |
| 4 | Dashboard Summary | P2 | [`004-dashboard-summary/spec.md`](004-dashboard-summary/spec.md) | 1, 3 |
| 5 | Category Budget Limits | P3 — optional/stretch | [`005-category-budget-limits/spec.md`](005-category-budget-limits/spec.md) | 3, 4 |

Suggested build order: **3 → 1 → 2 → 4 → 5** (categories must exist before a transaction can be logged; the dashboard and budget views are read-side aggregations built on top of 1–3). Feature 5 is explicitly flagged in its own spec as the one feature that goes beyond pure manual entry (it uses the `budget` field already defined in the constitution's schema) — it can be dropped without affecting 1–4.

## Data model alignment

All five features work entirely within the entities already defined in `constitution.md`'s schema: `USERS`, `CATEGORIES`, `TRANSACTIONS`. None introduce new entities. `BOT_INTERACTIONS` (the chatbot's own data) is untouched by these specs.

## Next steps (not yet executed)

Per `AGENTS.md`'s pipeline, the next steps — only when the team decides to proceed — would be, per feature: `/speckit-clarify` → `/speckit-evaluate` → `/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze` → **user approval gate** → `/speckit-implement`. None of these have been run; each spec's own checklist (`checklists/requirements.md`) already passed the `/speckit-specify` quality gate.
