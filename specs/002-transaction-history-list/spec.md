# Feature Specification: Transaction History List

**Feature Branch**: `[002-transaction-history-list]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Let a logged-in user view, search, filter and manage the list of transactions they have manually entered (feature 001). Show transactions grouped/sorted by date with amount, type, category and description, allow filtering by type (income/expense), category and date range, and allow editing or deleting an entry directly from the list. Inspired by the transaction-list screens of Monarch Money, Copilot and Kuanto (date grouping, category tags, quick filters), trimmed to exclude anything not backed by manually entered data (no bank-fed 'to review' queue, no AI tagging, no recurrence badges)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See all my transactions at a glance (Priority: P1)

A user wants to look back at what they've spent and earned recently. They open the "Transactions" screen and see every transaction they've logged, most recent first, grouped by day, showing the amount, category, and type at a glance.

**Why this priority**: Without a way to see entered data, manual entry (feature 001) has no visible payoff — this is the direct, minimal read-side complement to it and forms the MVP together with 001.

**Independent Test**: Can be fully tested by creating a few transactions via feature 001 and confirming they all appear in the list with correct amount, type, category, and date, ordered newest-first.

**Acceptance Scenarios**:

1. **Given** a user with existing transactions, **When** they open the transaction list, **Then** all of their transactions are shown ordered by date descending, grouped by day.
2. **Given** a user with no transactions yet, **When** they open the list, **Then** an empty state is shown that guides them to add their first transaction.
3. **Given** a list with many transactions, **When** the user scrolls, **Then** older transactions load progressively rather than all being fetched at once.

---

### User Story 2 - Narrow down the list (Priority: P2)

A user wants to answer a specific question, e.g. "how much did I spend on groceries last month?" They filter the list by category "Groceries", type "Expense", and a date range.

**Why this priority**: High value for review/analysis, but the list is still useful unfiltered (P1 covers baseline usability), so this is an enhancement rather than a blocker.

**Independent Test**: Can be fully tested by applying a filter combination and verifying only matching transactions are shown, and that clearing filters restores the full list.

**Acceptance Scenarios**:

1. **Given** a user with mixed income/expense transactions across several categories, **When** they filter by type "Expense" and category "Groceries", **Then** only expense transactions in that category are shown.
2. **Given** an applied date range filter, **When** the user selects "This month", **Then** only transactions within the current calendar month are shown.
3. **Given** active filters, **When** the user clears them, **Then** the full unfiltered list returns.

---

### User Story 3 - Fix or remove an entry from the list (Priority: P2)

A user spots a mistake while browsing (wrong amount, wrong category) or wants to remove a duplicate entry, and does so directly from the list without navigating elsewhere.

**Why this priority**: Builds on feature 001's edit capability by surfacing it in-context; valuable for data quality but the list is still functional for viewing without it.

**Independent Test**: Can be fully tested by triggering edit/delete from a list row and confirming the list reflects the change immediately.

**Acceptance Scenarios**:

1. **Given** a transaction row in the list, **When** the user chooses to edit it, **Then** they can update its fields and the row updates in place on save.
2. **Given** a transaction row in the list, **When** the user chooses to delete it and confirms, **Then** the row is removed from the list and excluded from dashboard totals.
3. **Given** a delete action, **When** the user has not yet confirmed, **Then** the system asks for confirmation before permanently removing the transaction.

---

### Edge Cases

- What happens when a filter combination matches zero transactions? The list MUST show a clear "no results" state distinct from the "no transactions at all" empty state.
- What happens when a transaction's category was deleted after the transaction was created? The list MUST still show the transaction with a clear "uncategorized" fallback label rather than erroring.
- How does the system handle very large histories (hundreds/thousands of transactions)? The list MUST paginate or lazy-load rather than degrade performance.
- What happens when two transactions share the exact same date and amount? Both MUST be shown as distinct rows (no accidental de-duplication).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display the logged-in user's transactions ordered by date, most recent first, grouped by day.
- **FR-002**: Each transaction row MUST show, at minimum: amount, type (income/expense), category, and date; description/source MUST be visible or accessible from the row.
- **FR-003**: The system MUST let the user filter the list by transaction type (income/expense), by category, and by a date range.
- **FR-004**: The system MUST let the user combine multiple filters at once and clear all filters back to the unfiltered view.
- **FR-005**: The system MUST let the user edit a transaction directly from the list, reusing the same validation rules as transaction creation (feature 001).
- **FR-006**: The system MUST let the user delete a transaction from the list after an explicit confirmation step.
- **FR-007**: The system MUST only show transactions owned by the logged-in user.
- **FR-008**: The system MUST show a distinct empty state when the user has no transactions at all, and a distinct "no results" state when a filter matches nothing.
- **FR-009**: The system MUST load large histories incrementally (e.g. pagination or infinite scroll) rather than requiring the full history to load at once.

### Non-Functional Requirements

- **NFR-001**: The initial transaction list view must be visible to the user in under 2 seconds under normal conditions for a typical history size.
- **NFR-002**: Applying or changing a filter must update the visible results in under 1 second under normal conditions.
- **NFR-003**: The list and its filters MUST be usable on both desktop and mobile-width screens, consistent with the rest of the application (Constitution Principle III).
- **NFR-004**: List rows, filters and destructive actions (delete) MUST be operable via keyboard and readable by screen readers, including a confirmation step for delete.

### Key Entities

- **Transaction**: Same entity as defined in `specs/001-manual-transaction-entry`; this feature only reads, filters, edits, and deletes existing records — it does not change the schema.
- **Category**: Used here only as a filter dimension and display label; managed by `specs/003-category-management`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find a specific transaction they logged within the last 30 days in under 30 seconds using filters.
- **SC-002**: 100% of transactions created or edited via feature 001 are reflected in this list without requiring more than one manual refresh.
- **SC-003**: A user can delete an unwanted entry, with confirmation, in 2 interactions or fewer (e.g. one tap to trigger, one to confirm).
- **SC-004**: The list remains usable (loads and scrolls smoothly) for users with at least 1,000 historical transactions.

## Assumptions

- This feature depends on `specs/001-manual-transaction-entry` for transaction creation/edit logic and on `specs/003-category-management` for category names/labels; it does not duplicate that logic.
- "Date range" filtering uses simple presets (e.g. this week, this month, custom range) rather than a full custom query/report builder — advanced reporting is covered separately by `specs/004-dashboard-summary` at a summary level, not by this list.
- Sorting is fixed to date-descending for this iteration; user-configurable sort (by amount, by category, etc.) is a possible future enhancement, not required now.

## Out of Scope

- A bank-fed "transactions to review" queue (as seen in Monarch/Copilot) is not included — there is no bank connection in this project's current scope.
- AI-based auto-tagging or category suggestions are not included.
- Recurrence badges/automatic recurring-transaction detection are not included.
- Bulk multi-select editing (e.g. "edit multiple" as in some reference apps) is not included in this iteration.
- Exporting the list (CSV, PDF) is not included.
