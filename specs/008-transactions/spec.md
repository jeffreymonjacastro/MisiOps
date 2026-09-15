# Feature Specification: Transactions

**Feature Branch**: `feature/transactions`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Backend: transactions GET (list a user's transactions with pagination and query filters type, category), transactions/summary GET (total incomes, total expenses, dashboard), transactions/ POST (create), transactions/{transaction_id} PATCH (update), transactions/{transaction_id} DELETE. All require bearer token. Base path api/v1/. Stack: FastAPI, Python, Postgres."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a transaction (Priority: P1)

A logged-in user registers an income or expense with amount, category, optional description and date, so it counts toward their monthly tracking.

**Why this priority**: Recording money movements is the whole point of the product. Everything else reads this data.

**Independent Test**: Create an expense, then list transactions and confirm it appears with the given values.

**Acceptance Scenarios**:

1. **Given** a valid token and an expense category "Food" owned by the user, **When** they create an expense of 25.50 in "Food" with description "Lunch", **Then** the transaction is created with source `manual`, today's date, and is returned with its new id.
2. **Given** a transaction whose `type` is expense but whose category is an income category (or vice versa), **When** submitted, **Then** it is rejected with a message explaining the type mismatch.
3. **Given** an amount of 0, a negative amount, or a category id the user does not own, **When** submitted, **Then** it is rejected with a validation or not-found message.
4. **Given** a transaction sent with an explicit past `transaction_date`, **When** created, **Then** that date is stored (users can back-fill).

---

### User Story 2 - Browse transaction history with filters (Priority: P1)

A logged-in user lists their transactions page by page, newest first, optionally filtered by type and/or category.

**Why this priority**: The dashboard ("last 5 transactions") and the history page both depend on this endpoint.

**Independent Test**: Create several transactions, request page 1 with a page size of 2, and verify ordering, count and pagination metadata.

**Acceptance Scenarios**:

1. **Given** a user with 12 transactions, **When** they request the list with `limit=5`, **Then** they receive the 5 most recent (by transaction date, then id, descending) plus `total=12`, `limit=5`, `offset=0`.
2. **Given** the same user, **When** they request `limit=5&offset=10`, **Then** they receive the remaining 2 and `total=12`.
3. **Given** filters `type=expense&category_id=3`, **When** listing, **Then** only expenses in category 3 are returned and `total` reflects the filtered count.
4. **Given** `limit` above 100 or below 1, or a negative `offset`, **When** listing, **Then** the request is rejected with a validation message.
5. **Given** two users, **When** each lists transactions, **Then** neither sees the other's rows, even when passing another `user_id` as a query parameter (the parameter is ignored; identity comes from the token).

---

### User Story 3 - See a monthly summary (Priority: P1)

A logged-in user sees total income, total expenses and balance for the current budget period, so the dashboard can show its cards.

**Why this priority**: This is the "am I on track this month?" view that makes the product useful; it is the dashboard's headline.

**Independent Test**: Create known incomes and expenses within the period, call the summary, and verify the totals and balance.

**Acceptance Scenarios**:

1. **Given** incomes of 1000 and 500 and expenses of 300 in the current period, **When** the user requests the summary, **Then** they receive `total_income=1500`, `total_expense=300`, `balance=1200`, the period start and end dates, and a per-category breakdown of expenses.
2. **Given** the user has `budget_start_day=15` and today is the 20th, **When** they request the summary, **Then** the period runs from the 15th of this month to the 14th of next month.
3. **Given** the user has `monthly_budget_limit=2000`, **When** they request the summary, **Then** the response includes the limit and the remaining amount (`limit - total_expense`).
4. **Given** the user passes explicit `from` and `to` dates, **When** they request the summary, **Then** totals are computed for that range instead of the current period.
5. **Given** a user with no transactions, **When** they request the summary, **Then** all totals are 0 and the breakdown is empty (not an error).

---

### User Story 4 - Edit a transaction (Priority: P2)

A logged-in user corrects a transaction (amount, category, description, date, type).

**Why this priority**: Mistakes happen, especially with chatbot-parsed entries, but users can delete and re-create as a workaround.

**Independent Test**: Update the amount of an existing transaction and confirm the new value on the next list.

**Acceptance Scenarios**:

1. **Given** a transaction owned by the user, **When** they send a partial update with a new amount, **Then** only the amount changes and the updated transaction is returned.
2. **Given** an update that sets a category whose type does not match the transaction's (possibly updated) type, **When** submitted, **Then** it is rejected with a type-mismatch message.
3. **Given** a transaction id owned by another user or that does not exist, **When** the user tries to update it, **Then** the response is "not found".

---

### User Story 5 - Delete a transaction (Priority: P2)

A logged-in user removes a transaction that should not count.

**Why this priority**: Needed for the history page's delete button.

**Independent Test**: Delete a transaction and confirm it disappears from the list and the summary totals drop accordingly.

**Acceptance Scenarios**:

1. **Given** a transaction owned by the user, **When** they delete it, **Then** it is removed and a success confirmation is returned.
2. **Given** a transaction id owned by another user or that does not exist, **When** the user tries to delete it, **Then** the response is "not found".

---

### Edge Cases

- Amounts are stored with 2 decimal places; a value with more decimals is rounded half-up before storage. Amounts above 1,000,000,000 are rejected.
- `transaction_date` in the future (beyond today) is rejected.
- Summary period boundaries when `budget_start_day` is 1: the period is the calendar month.
- Summary with `from` after `to` is rejected as a validation error.
- Listing with an unknown `type` value (anything other than `income`/`expense`) is rejected as a validation error.
- A `category_id` filter for a category the user does not own returns an empty list with `total=0` (not an error).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let an authenticated user create a transaction with `amount` (> 0, 2 decimals), `type` (`income` | `expense`), `category_id` (owned by the user), optional `description` (≤ 255 characters) and optional `transaction_date` (defaults to now; must not be in the future).
- **FR-002**: The transaction's `type` MUST match the referenced category's type.
- **FR-003**: Manually created transactions MUST have `source = manual`. Other sources (`telegram`, `gmail`) are reserved for future features and MUST NOT be settable through this API.
- **FR-004**: System MUST list the caller's transactions with offset pagination (`limit` 1-100, default 20; `offset` ≥ 0, default 0), ordered by `transaction_date` then `id`, descending.
- **FR-005**: The list MUST accept optional filters `type` and `category_id`, applied together with AND semantics.
- **FR-006**: The list response MUST include `items`, `total` (count after filters), `limit` and `offset`.
- **FR-007**: Each listed transaction MUST include its category's name and type so the frontend does not need a second request.
- **FR-008**: System MUST provide a summary with `total_income`, `total_expense`, `balance` (= income - expense), `period_start`, `period_end`, `monthly_budget_limit`, `remaining_budget` (= limit - total_expense, or null when limit is 0), and `by_category` (category id, name, type, total) for the period.
- **FR-009**: The default summary period MUST be the current budget period derived from the user's `budget_start_day`: from that day of the current month (or previous month if today is before it) to the day before the next occurrence.
- **FR-010**: The summary MUST accept optional `from` and `to` dates (inclusive) that override the default period.
- **FR-011**: System MUST let the owner partially update `amount`, `type`, `category_id`, `description` and `transaction_date`, re-validating FR-001 and FR-002 on the resulting row.
- **FR-012**: System MUST let the owner delete a transaction.
- **FR-013**: Any access to a transaction not owned by the caller MUST return "not found", identical to a non-existent id.
- **FR-014**: All endpoints MUST live under `api/v1/transactions` and require a bearer token. Identity comes only from the token; any `user_id` in query or body is ignored.

### Non-Functional Requirements

- **NFR-001**: Listing and summary respond in under 300 ms at the 95th percentile for users with up to 10,000 transactions.
- **NFR-002**: Ownership MUST be enforced in every query, never only in the API layer.
- **NFR-003**: Money is never stored or computed as binary floating point; totals must be exact to the cent.
- **NFR-004**: Every functional requirement MUST be covered by automated tests, per the constitution's Testing Standards.

### Key Entities *(include if feature involves data)*

- **Transaction**: One money movement. Attributes: id, user_id (owner), category_id, amount, type (income | expense), source (manual | telegram | gmail), description, transaction_date. Belongs to one User and one Category.
- **Transaction Summary**: A computed view (not stored) of totals for a date range, including a per-category breakdown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can record a manual expense in under 20 seconds from the form.
- **SC-002**: Summary totals match the sum of listed transactions for the same period to the cent, 100% of the time.
- **SC-003**: 100% of cross-user transaction accesses return "not found".
- **SC-004**: Page navigation on the history page never shows duplicate or skipped rows when no writes happen between requests.
- **SC-005**: Automated tests cover create (success, type mismatch, bad category), list (pagination, filters, isolation), summary (default period, custom range, empty), update and delete.

## Assumptions

- The planning document says "use pagination" for the summary too; the summary is an aggregate, so pagination there is read as "supports a date range". The per-category breakdown is small (≤ number of categories) and is not paginated.
- Offset pagination is sufficient for this project's scale; cursor pagination is not needed.
- The dashboard's "last 5 transactions" uses the list endpoint with `limit=5`.
- The summary's default period follows the user's `budget_start_day` from the user-auth feature. If that field is 1, the period is the calendar month.
- Dates are handled in UTC; the frontend converts for display.
- Depends on user-auth (bearer token, `budget_start_day`, `monthly_budget_limit`) and categories (`category_id`, category type).

## Out of Scope

- Transactions created by the Telegram bot or Gmail scraping (future features; they will reuse the same storage rules).
- Recurring or scheduled transactions.
- Multi-currency; all amounts are in a single implied currency.
- Attachments or receipts.
- Full-text search on description; the only filters are type and category.
- Exporting transactions (CSV, PDF).
