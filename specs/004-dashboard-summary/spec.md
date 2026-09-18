# Feature Specification: Dashboard Summary

**Feature Branch**: `[004-dashboard-summary]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Give a logged-in user a dashboard/home screen that summarizes their manually entered transactions (feature 001) for a selected period: total income, total expenses, net balance, and a simple breakdown of expenses by category. This is the 'track your money throughout the month via a dashboard' objective from constitution.md, built entirely from manually entered data (no bank-fed net worth, no investments, no AI insights). Inspired by the summary cards and spending-by-category views in Monarch Money and Copilot, trimmed to totals and a category breakdown only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where I stand this month (Priority: P1)

A user opens the app and, without any extra clicks, sees how much they've earned, spent, and have left over for the current month, based on what they've logged.

**Why this priority**: This is the constitution's explicit "track your money via a dashboard" objective — the payoff that makes ongoing manual entry (feature 001) worthwhile.

**Independent Test**: Can be fully tested by logging a known set of income and expense transactions within the current month and verifying the displayed totals and net balance match the expected sums.

**Acceptance Scenarios**:

1. **Given** a user with income and expense transactions logged this month, **When** they open the dashboard, **Then** they see total income, total expenses, and net balance (income minus expenses) for the current month.
2. **Given** a user with no transactions yet this month, **When** they open the dashboard, **Then** totals show as zero with an empty/starter state rather than an error, and guidance to log their first transaction.
3. **Given** new transactions are added or edited, **When** the user returns to the dashboard, **Then** the totals reflect the change without requiring more than one manual refresh.

---

### User Story 2 - See where the money is going (Priority: P2)

Beyond the raw totals, the user wants to know which categories are consuming most of their spending this month.

**Why this priority**: Directly answers the constitution's problem statement ("lack traceability of where their money actually goes"), but the dashboard is still valuable with just the P1 totals if this isn't available yet.

**Independent Test**: Can be fully tested by logging expenses across multiple categories and verifying the breakdown lists each category with its correct share of total spending for the period.

**Acceptance Scenarios**:

1. **Given** expense transactions across 3 categories this month, **When** the user views the dashboard, **Then** each category is listed with its total amount, ordered from highest to lowest spend.
2. **Given** a category with zero expenses this period, **When** the user views the breakdown, **Then** that category is simply omitted rather than shown with a confusing zero row.

---

### User Story 3 - Change the period I'm looking at (Priority: P3)

A user wants to check last month's totals instead of the current month, to compare.

**Why this priority**: Useful for reflection but not required for the dashboard's core "where do I stand right now" value (P1/P2 default to the current month).

**Independent Test**: Can be fully tested by switching the selected period and verifying totals and the category breakdown recompute for that period only.

**Acceptance Scenarios**:

1. **Given** transactions exist in both the current and previous month, **When** the user switches the period selector to "last month", **Then** totals and breakdown update to reflect only that month's transactions.
2. **Given** a period with no transactions, **When** selected, **Then** the dashboard shows the same zero/empty state as User Story 1's empty case, scoped to that period.

---

### Edge Cases

- What happens when a transaction is edited to move it into or out of the selected period (e.g. date changed)? The dashboard MUST reflect the transaction under its current date/period, not where it originally was.
- What happens when a user has only income or only expenses this period (never both)? Totals and net balance MUST still compute correctly (net balance can be fully positive or fully negative).
- How does the system handle a period boundary (e.g. a transaction dated exactly on the first or last day of the month)? It MUST be included in that month's totals, not excluded due to an off-by-one boundary error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display, for a selected period (defaulting to the current month), the user's total income, total expenses, and net balance, computed from their manually entered transactions.
- **FR-002**: The system MUST display a breakdown of expense totals by category for the selected period, ordered from highest to lowest amount, omitting categories with no spend in that period.
- **FR-003**: The system MUST let the user change the selected period (at minimum: current month, previous month) and recompute all dashboard figures accordingly.
- **FR-004**: The system MUST show a clear empty/starter state (not an error) when the selected period has no transactions.
- **FR-005**: The system MUST only compute and display totals from the logged-in user's own transactions.
- **FR-006**: The system MUST keep dashboard figures consistent with the transaction history list (feature 002) and manual entry form (feature 001) — the same transaction MUST count identically across all three.

### Non-Functional Requirements

- **NFR-001**: The dashboard's initial totals must be visible to the user in under 2 seconds under normal conditions.
- **NFR-002**: Changing the selected period must update the displayed figures in under 1.5 seconds under normal conditions.
- **NFR-003**: The dashboard MUST be usable on both desktop and mobile-width screens, consistent with the rest of the application (Constitution Principle III).
- **NFR-004**: Numeric summaries and the category breakdown MUST be readable by screen readers (e.g. accessible labels for chart/graphic elements, not color-only encoding).

### Key Entities

- **Transaction**: Same entity as `specs/001-manual-transaction-entry`; this feature only aggregates existing records, it does not create or store new fields.
- **Category**: Used as the grouping dimension for the spending breakdown; managed by `specs/003-category-management`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine their current net balance within 5 seconds of opening the dashboard, with no additional clicks.
- **SC-002**: The displayed totals match the sum of the user's transactions for the period with 100% accuracy (verified against the transaction list, feature 002).
- **SC-003**: A user can identify their single largest spending category for the current month within 10 seconds of opening the dashboard.
- **SC-004**: Switching between the current and previous month updates all figures correctly 100% of the time, including at month boundaries.

## Assumptions

- "Period" for v1 means calendar month (current/previous); custom date-range selection is a possible future enhancement, not required now.
- The dashboard is read-only: it surfaces totals derived from features 001-003 and does not itself let the user create/edit transactions or categories (those actions live on their respective screens, reachable from the dashboard).
- No comparison to a budget/limit is shown here, since per-category or per-user budget limits are out of this spec's scope (see `specs/005-category-budget-limits`).

## Out of Scope

- Net worth, account balances, or investment tracking (no bank/account-linking exists in this project's current scope).
- Multi-month trend charts, forecasts, or AI-generated insights/advice.
- Budget vs. actual comparisons or "left to spend" indicators (see `specs/005-category-budget-limits` if pursued separately).
- Cash-flow / Sankey-style visualizations of income sources vs. expense destinations.
- Custom/arbitrary date-range filtering beyond current/previous month.
