# Feature Specification: Manual Transaction Entry

**Feature Branch**: `[001-manual-transaction-entry]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Allow a logged-in user to manually register a new income or expense transaction from the frontend, as a complementary entry path alongside the project's planned NLP chatbot logging (per constitution.md). The user fills a form with: amount, transaction type (income or expense), category (from their existing categories), date, and an optional description/source. On save, the transaction is persisted and reflected in the user's transaction history and dashboard totals. Categories, source, and description map to the TRANSACTIONS/CATEGORIES entities already defined in constitution.md's data schema. Inspired by manual 'Add transaction' flows in apps like Monarch Money, Copilot, and Kuanto, but scoped ONLY to manual entry (no bank sync, no auto-categorization, no receipt/photo import)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register an expense in under a minute (Priority: P1)

A logged-in user just paid for something (e.g. groceries) and wants to log it before they forget. They open the "Add transaction" form, pick "Expense", type the amount, pick a category, leave today's date, optionally add a short note, and save.

**Why this priority**: This is the core value of the feature — without it, nothing else (history, dashboard) has any data to show. It is the MVP slice.

**Independent Test**: Can be fully tested by submitting the form with the minimum required fields (amount, type, category, date) and verifying a new transaction row exists and is retrievable afterward.

**Acceptance Scenarios**:

1. **Given** a logged-in user with at least one expense category, **When** they submit the form with a positive amount, type "expense", a category, and a date, **Then** a new transaction is created and a success confirmation is shown.
2. **Given** a logged-in user, **When** they submit the form without filling amount, type, category, or date, **Then** the form blocks submission and shows which fields are missing.
3. **Given** a logged-in user, **When** they leave the description/source field empty, **Then** the transaction still saves successfully (the field is optional).

---

### User Story 2 - Register an income (Priority: P1)

The same form supports logging money coming in (e.g. salary, a refund), using the same fields but with type "income" and an income-type category.

**Why this priority**: Income tracking is required for the dashboard/net balance to be meaningful; without it the app only shows spending, not the full picture the project's objective describes.

**Independent Test**: Can be fully tested by submitting the form with type "income" and verifying the transaction is stored and distinguished from expenses.

**Acceptance Scenarios**:

1. **Given** a logged-in user with at least one income category, **When** they select type "income" and submit valid data, **Then** the transaction is saved and flagged as income, not expense.
2. **Given** a user switches the type from "expense" to "income" mid-form, **When** the category they had selected doesn't match the new type, **Then** the category selection is cleared or filtered to only show income categories, preventing a mismatched category/type pair.

---

### User Story 3 - Correct a mistake right after saving (Priority: P2)

A user notices they entered the wrong amount or category right after saving and wants to fix it without deleting and re-creating the entry from scratch.

**Why this priority**: Reduces friction and data-quality risk from manual entry (the primary risk of forms vs. automated capture), but the app is still usable without it (user could delete and re-add).

**Independent Test**: Can be fully tested by editing an existing transaction's amount/category/date/description and confirming the stored record reflects the update.

**Acceptance Scenarios**:

1. **Given** an existing transaction owned by the logged-in user, **When** they edit any field and save, **Then** the transaction is updated in place and the previous values are no longer shown.
2. **Given** a transaction owned by another user, **When** the current user attempts to access its edit form directly, **Then** the system denies access.

---

### Edge Cases

- What happens when the user enters a zero or negative amount? The form MUST reject it with a clear inline message (amounts are always entered as positive; sign/direction is carried by the type field).
- What happens when the user has no categories yet (new account)? The form MUST guide the user to create a category first (see Category Management feature) rather than allowing an uncategorized transaction.
- What happens when the user selects a future date? The form MUST allow it (e.g. logging a scheduled/expected transaction) but MAY visually flag it as future-dated.
- How does the system handle a very large amount (e.g. typo with extra digits)? The form MUST enforce a sane upper bound and reject values above it with a clear message.
- What happens if the network/save fails? The form MUST preserve the user's entered values and show a retry-able error, not silently discard the input.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a form that lets a logged-in user create a transaction with: amount, type (income or expense), category, date, and an optional description/source.
- **FR-002**: The system MUST require amount, type, category, and date before allowing submission; description/source is optional.
- **FR-003**: The system MUST only allow the user to select categories that belong to them and match the chosen transaction type.
- **FR-004**: The system MUST reject non-positive amounts and amounts above a defined sane maximum, with a clear, field-level error message.
- **FR-005**: The system MUST persist a successfully submitted transaction and make it immediately visible in the user's transaction history and reflected in dashboard totals.
- **FR-006**: The system MUST let a user edit the amount, type, category, date, and description/source of a transaction they own.
- **FR-007**: The system MUST prevent a user from viewing or editing another user's transaction.
- **FR-008**: The system MUST show a clear success confirmation after a transaction is created or updated, and a clear, retry-able error if the save fails.
- **FR-009**: The system MUST default the date field to the current date, while still allowing the user to pick a different date (past or future).

### Non-Functional Requirements

- **NFR-001**: Submitting the form must give the user a save confirmation or error in under 2 seconds under normal conditions.
- **NFR-002**: All transaction data entered MUST be transmitted and stored in a way that keeps it private to the owning user.
- **NFR-003**: The form MUST be usable on both desktop and mobile-width screens, consistent with the rest of the application (Constitution Principle III).
- **NFR-004**: Form fields and errors MUST be operable via keyboard and readable by screen readers (labels, error announcements).

### Key Entities

- **Transaction**: A single money movement owned by a user. Attributes: amount, type (income/expense), category, date, optional description/source. Belongs to one user and one category.
- **Category**: A user-defined or default grouping (e.g. "Groceries", "Salary") used to classify a transaction; each category has a type (income/expense) that constrains which transactions can use it. Managed by the separate Category Management feature (see `specs/003-category-management`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can log a new transaction (from opening the form to seeing the confirmation) in under 60 seconds on first attempt.
- **SC-002**: 95% of transaction-creation attempts with valid data succeed without the user needing to retry.
- **SC-003**: 100% of newly created or edited transactions appear correctly in the transaction history and in dashboard totals without requiring a manual page refresh initiated more than once.
- **SC-004**: Users attempting to submit invalid data (missing/negative amount, mismatched category) receive an understandable error on their first attempt, without needing to guess what went wrong.

## Assumptions

- The user is already authenticated; login/signup is out of scope for this spec.
- The user has at least one category available before using this form (category creation is covered by the Category Management feature, `specs/003-category-management`).
- "Source" refers to a free-text merchant/payer note (e.g. "Lyft", "Employer"), stored in the same field as or alongside the description, not a bank/payment-method integration.
- This manual form is additive: it does not replace or block the project's planned NLP-chatbot entry path described in `constitution.md`; both are expected to write to the same underlying data.
- Currency is single-currency per user (no multi-currency conversion) for this iteration.

## Out of Scope

- Automatic bank/wallet synchronization or import (e.g. Yape/Plin scraping mentioned in the constitution's roadmap) is not included.
- Automatic categorization or AI-suggested categories is not included; the user always picks the category manually.
- Receipt/photo capture or attachment upload is not included.
- Recurring/scheduled transactions (auto-creating future entries) are not included.
- Bulk import (CSV, etc.) of transactions is not included.
- The NLP chatbot entry path itself is a separate feature/backend concern and is not covered by this spec.
