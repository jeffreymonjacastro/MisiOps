# Data Model: Transactions

Source of truth: `.specify/memory/constitution.md` ERD (`TRANSACTIONS {id, user_id, category_id, amount, type, source, description, transaction_date}`).

## Entity: Transaction (`transactions` table)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, autoincrement | |
| `user_id` | integer | NOT NULL, FK `users.id` ON DELETE CASCADE | owner |
| `category_id` | integer | NOT NULL, FK `categories.id` (NO ACTION) | must belong to the same user; type must match. NO ACTION rather than RESTRICT so a user delete can cascade through categories and transactions in one statement |
| `amount` | numeric(12,2) | NOT NULL, CHECK `amount > 0` | ≤ 1,000,000,000 (schema) |
| `type` | varchar(10) | NOT NULL, CHECK in (`income`, `expense`) | equals the category type |
| `source` | varchar(10) | NOT NULL, CHECK in (`manual`, `telegram`, `gmail`), default `manual` | API always writes `manual` |
| `description` | varchar(255) | NULL | |
| `transaction_date` | timestamp with tz | NOT NULL, default now() | stored in UTC |

Indexes: `ix_transactions_user_date` on `(user_id, transaction_date, id)`; `ix_transactions_user_category` on `(user_id, category_id)`.

Relationships: belongs to one User and one Category (`relationship(Category, lazy="joined")`).

## Validation rules (`backend/schemas/transaction.py`)

| Schema | Fields | Rules |
|---|---|---|
| `TransactionCreate` | `amount`, `type`, `category_id`, `description?`, `transaction_date?` | `amount` Decimal > 0, ≤ 1e9, ≤ 2 decimal places; `type` literal; `category_id` int > 0; `description` ≤ 255 after strip, empty → null; `transaction_date` datetime or date (→ 00:00 UTC), default now, ≤ now UTC |
| `TransactionUpdate` | same fields, all optional | `exclude_unset`; the resulting row is re-validated for category ownership and type match |
| `CategoryRef` | `id`, `name`, `type` | nested in `TransactionOut` |
| `TransactionOut` | `id`, `amount` (float), `type`, `source`, `description`, `transaction_date`, `category: CategoryRef` | `from_attributes` |
| `TransactionPage` | `items: list[TransactionOut]`, `total`, `limit`, `offset` | |
| `CategoryTotal` | `category_id`, `name`, `type`, `budget` (float \| null), `total` (float) | one per category with movements |
| `SummaryOut` | `period_start`, `period_end` (dates), `total_income`, `total_expense`, `balance`, `monthly_budget_limit`, `remaining_budget` (float \| null), `by_category: list[CategoryTotal]` | |

## Derived values

- `balance = total_income - total_expense`
- `remaining_budget = monthly_budget_limit - total_expense`, or null when the limit is 0
- Default period: from `budget_start_day` of the current month (or previous month if today is earlier) to the day before the next occurrence, inclusive.

## State transitions

None. Created → updated → deleted (physical). Deleting the user cascades; deleting a category with transactions is refused (409 by the API, FK NO ACTION as backstop).
