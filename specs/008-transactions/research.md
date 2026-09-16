# Research: Transactions

No NEEDS CLARIFICATION items. Reuses user-auth R3-R9 and categories R1-R7. Feature-specific decisions:

## R1. Pagination strategy

- **Decision**: Offset pagination with `limit` (1-100, default 20), `offset` (≥ 0) and a `total` count, ordered by `transaction_date desc, id desc`.
- **Rationale**: The frontend history table needs page numbers and a total; the dashboard needs "last 5" (`limit=5`). Volume per user is small; the composite index keeps deep offsets cheap enough.
- **Alternatives considered**: Keyset/cursor pagination (no page numbers, more client complexity, not needed at this scale).

## R2. Carrying the category on each row (FR-007)

- **Decision**: `relationship(Category, lazy="joined")` on `Transaction`; `TransactionOut.category` is a nested `{id, name, type}`.
- **Rationale**: One query per page, no N+1, no second frontend request. Nested object is clearer than `category_name`/`category_type` flat fields and extends naturally.
- **Alternatives considered**: Flat denormalised fields; `selectinload` (second query per page for no benefit).

## R3. Summary computation

- **Decision**: Two SQL statements: an aggregate for income/expense totals (`sum(case ...)`) and a grouped join for the per-category breakdown. All arithmetic in SQL over `Numeric`, results as `Decimal`, serialised to JSON numbers at the schema boundary.
- **Rationale**: Exact to the cent (NFR-003) and index-friendly; no Python loops over rows.
- **Alternatives considered**: Load the period's rows and aggregate in Python (correct but O(n) transfer); a single statement with window functions (harder to read for two numbers).

## R4. Budget period

- **Decision**: `budget_period(today, start_day)` helper returning inclusive `(start, end)` dates; `start_day` is 1-28 so the date always exists. Query bounds are half-open datetimes in UTC.
- **Rationale**: One definition shared with the category budget semantics (categories Q4). Half-open bounds avoid off-by-one on the last day.
- **Alternatives considered**: Calendar month only (ignores `budget_start_day`).

## R5. Date input

- **Decision**: `transaction_date: datetime | None`; Pydantic accepts `YYYY-MM-DD` as midnight; naive values are treated as UTC, aware values converted to UTC; must be ≤ now (UTC).
- **Rationale**: The frontend's date input sends a bare date (Clarification Q2). One field, one validator.
- **Alternatives considered**: Separate `date` and `time` fields; client-side timezone handling.

## R6. Category guards (FR-015)

- **Decision**: Count transactions for the category inside `categories.py` on PATCH (only when `type` changes) and DELETE; 409 `Category has N transactions`. FK `category_id` keeps the default NO ACTION as a database backstop. RESTRICT was tried first and rejected: it is checked immediately, so deleting a user (which cascades to categories and transactions in one statement) would fail; NO ACTION is checked at the end of the statement and lets the cascade complete.
- **Rationale**: The guard needs the transactions table, which this feature creates (categories Q2). The API message carries the count the spec asks for; the FK guarantees integrity even if a future code path forgets the check.
- **Alternatives considered**: `ondelete="SET NULL"` (spec forbids orphan transactions); cascade delete of transactions (silent data loss).

## R7. Type mismatch status code

- **Decision**: 422 with a string `detail` (`Transaction type does not match category type`).
- **Rationale**: It is a validation failure of the request against the user's data, not a state conflict (409) and not a missing resource (404). String `detail` follows user-auth FR-015 for business errors.
- **Alternatives considered**: 400 (less specific); 409 (misleading).
