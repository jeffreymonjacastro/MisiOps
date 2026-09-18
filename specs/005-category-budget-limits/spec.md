# Feature Specification: Category Budget Limits

**Feature Branch**: `[005-category-budget-limits]`

**Created**: 2026-09-14

**Status**: Draft (stretch — optional, lowest priority of the mapped features)

**Input**: User description: "Let a logged-in user optionally set a monthly budget limit on an expense category (the `budget` field on CATEGORIES and `monthly_budget_limit`/`budget_start_day` on USERS already defined in constitution.md's data schema) and see, on the dashboard (feature 004), how much of that limit has been used this month from their manually entered transactions. Inspired by the budget rings/'$X left' cards in Monarch Money and Copilot, trimmed to a simple limit-vs-spent comparison with no rollover, no auto-adjustment, and no multi-category envelope budgeting system."

> **Scope note**: This feature is the one that goes furthest beyond "manual income/expense entry." It is included only because the budget fields already exist in the project's data schema (`constitution.md`), so it is explicitly flagged as optional/stretch — build it last, or drop it, without affecting features 001-004.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set a limit on a category I overspend on (Priority: P1 within this feature)

A user who keeps overspending on "Restaurants" sets a monthly limit for that category so they have something concrete to compare against.

**Why this priority**: This is the minimum needed for the feature to exist at all — without setting a limit, there is nothing to track against.

**Independent Test**: Can be fully tested by setting a limit amount on a category and confirming it is stored and retrievable for that category.

**Acceptance Scenarios**:

1. **Given** an existing expense category, **When** the user sets a monthly limit amount on it, **Then** the limit is saved and shown when viewing that category's settings.
2. **Given** a category, **When** the user clears/removes its limit, **Then** the category reverts to having no limit and disappears from any "budget" view that requires one.
3. **Given** a user, **When** they attempt to set a negative or zero limit, **Then** the system rejects it with a clear error.

---

### User Story 2 - See if I'm over or under, at a glance (Priority: P2 within this feature)

On the dashboard, the user sees each budgeted category with how much of its limit has been used this month, and whether they're under or over.

**Why this priority**: This is the payoff of User Story 1 — setting a limit is only useful once progress against it is visible — but it is still a step beyond the base dashboard (feature 004), which works without it.

**Independent Test**: Can be fully tested by setting a limit on a category, logging expenses under it, and verifying the displayed "used / limit" figure and over/under state match the actual sum of that category's transactions this month.

**Acceptance Scenarios**:

1. **Given** a category with a monthly limit and some expenses logged this month, **When** the user views the dashboard, **Then** they see the amount spent, the limit, and whether they are under or over.
2. **Given** a category's spend exceeds its limit, **When** shown on the dashboard, **Then** it is visually distinguished as over-limit (not just numerically implied).
3. **Given** a category with no limit set, **When** the user views the dashboard, **Then** it is not shown in the budget-progress view (it still appears in the plain category breakdown from feature 004).

---

### Edge Cases

- What happens at the start of a new month? Progress against each limit MUST reset to zero spent for the new month; the limit amount itself carries forward unchanged unless the user edits it.
- What happens if a category with a limit is deleted (feature 003)? Its limit MUST be removed along with it, with no orphaned budget record.
- What happens if the user changes the limit mid-month, after some spending has already occurred? The over/under comparison MUST immediately reflect the new limit against the same month's already-logged spending.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user set a monthly limit amount on any expense category they own.
- **FR-002**: The system MUST let a user update or remove a category's limit at any time.
- **FR-003**: The system MUST reject non-positive limit amounts with a clear error.
- **FR-004**: The system MUST compute, per budgeted category and per calendar month, the total spent against that category from the user's manually entered transactions.
- **FR-005**: The system MUST clearly distinguish, for each budgeted category, whether the user is currently under or over its limit for the selected month.
- **FR-006**: The system MUST remove a category's limit when that category is deleted (feature 003), without leaving an orphaned limit record.
- **FR-007**: The system MUST only show and let a user manage limits on their own categories.

### Non-Functional Requirements

- **NFR-001**: Budget progress figures must update in under 2 seconds after a relevant transaction is added, edited, or deleted.
- **NFR-002**: Budget setting and the dashboard's budget-progress view MUST be usable on both desktop and mobile-width screens, consistent with the rest of the application (Constitution Principle III).
- **NFR-003**: Over-limit status MUST be conveyed with more than color alone (e.g. text/icon), so it is legible for users with color-vision deficiencies.

### Key Entities

- **Category budget limit**: A monthly amount attached to one expense Category (maps to the existing `budget` field on CATEGORIES in `constitution.md`'s schema). Optional — a category may have none.
- **Category** and **Transaction**: As defined in `specs/003-category-management` and `specs/001-manual-transaction-entry` respectively; this feature only reads transaction sums per category and month.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can set a limit on a category in under 20 seconds.
- **SC-002**: The displayed "spent vs. limit" figure matches the actual sum of that category's transactions for the month with 100% accuracy.
- **SC-003**: A user can identify which of their budgeted categories are currently over-limit within 5 seconds of viewing the dashboard.

## Assumptions

- Only expense categories can carry a limit; income categories are out of scope for budgeting.
- Limits do not roll over unused amounts month to month (no "rollover" balance, unlike some reference apps) — each month starts fresh against the same limit amount.
- The month used for budget tracking follows the same calendar-month period as `specs/004-dashboard-summary`, not a custom `budget_start_day`-anchored cycle, even though `monthly_budget_limit`/`budget_start_day` exist on USERS in the schema; reconciling a custom budget-cycle start day is left for `/speckit-clarify` if the team wants this feature pursued.

## Out of Scope

- Rollover of unused budget into the next month.
- A user-level overall monthly budget (the `monthly_budget_limit` field on USERS) is not covered here — this spec is category-level only; a user-level total limit would be a separate, later spec if needed.
- Envelope-style budgeting, multi-category budget groups, or automatic budget suggestions.
- Notifications/alerts when approaching or exceeding a limit.
- Custom budget-cycle start days (`budget_start_day`); this iteration assumes calendar-month cycles.
