# Implementation Plan: Transactions

**Branch**: `feature/transactions` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-transactions/spec.md`

## Summary

Add the `transactions` table and five bearer-protected endpoints under `api/v1/transactions`: create, paginated list with `type`/`category_id` filters, summary for the current budget period or an explicit range, patch and delete. Add the two category guards deferred by the categories feature (no type change, no delete while transactions exist). Money stays `Numeric`/`Decimal` end to end; JSON emits numbers.

## Technical Context

**Language/Version**: Python 3.13, `uv`

**Primary Dependencies**: FastAPI, SQLAlchemy 2 async, Pydantic v2. No new dependencies.

**Storage**: PostgreSQL `transactions` table, FKs to `users` (CASCADE) and `categories` (default NO ACTION as a backstop behind the 409 guard; RESTRICT would block the user-delete cascade because it is checked immediately). Tests on SQLite in-memory with FK enforcement (already on).

**Testing**: pytest + httpx `ASGITransport`, fixtures from `conftest.py`.

**Target Platform**: Linux server (uvicorn)

**Project Type**: web-service (backend)

**Performance Goals**: NFR-001: list and summary p95 < 300 ms with 10,000 transactions per user. Composite index `(user_id, transaction_date desc, id desc)` serves both the ordered page and the period range; `(user_id, category_id)` serves the filter and the guards.

**Constraints**: Ownership in every `WHERE` (NFR-002). Money never as float in storage or aggregation (NFR-003). Error shape `{"detail": ...}`. No service/repository layers.

**Scale/Scope**: 5 new endpoints, 2 guarded existing endpoints, 1 table, 1 test file plus additions to `test_categories.py`.

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I. Code Quality | Router + model + schema; summary is one aggregate query plus one grouped query; period maths in a 6-line helper. | PASS |
| II. Testing Standards | Every FR has a test, including exact-cent totals and both category guards. | PASS |
| III. UX Consistency | Same auth, error shape, 201/200/204/404/409/422, money validation identical to profile and categories. | PASS |
| IV. Performance | Indexed queries, count and page in two statements, target stated. | PASS |
| Security & maintainability | Ownership in queries; FKs with explicit `ondelete`; check constraints. | PASS |
| Development Workflow | `feature/transactions` → PR to `develop`; CI applies. | PASS |

Post-design re-check: PASS. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-transactions/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/transactions.openapi.yaml
├── evaluations/eval-report.md
├── checklists/requirements.md, security.md, api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── core/
│   └── periods.py           # budget_period(today, start_day) helper
├── models/
│   └── transaction.py       # Transaction model, relationship to Category (lazy="joined")
├── schemas/
│   └── transaction.py       # TransactionCreate/Update/Out, TransactionPage, Summary, CategoryRef
├── api/v1/
│   ├── transactions.py      # 5 endpoints + period helper
│   ├── categories.py        # + transaction-count guards on PATCH type and DELETE
│   └── router.py            # include transactions.router
├── main.py                  # import models.transaction
└── tests/
    ├── test_periods.py
    ├── test_transactions.py
    └── test_categories.py   # guard tests appended
```

**Structure Decision**: Same flat layout. One model, one schema module, one router, one test file; two small edits to `categories.py`.

## Complexity Tracking

None.

## Implementation notes carried into tasks

- Model: `amount Numeric(12,2)` with `CheckConstraint("amount > 0")`; `type` and `source` `String(10)` with check constraints; `description String(255)` nullable; `transaction_date DateTime(timezone=True)` NOT NULL, `server_default=func.now()`. `category = relationship(Category, lazy="joined")` so list rows carry the category without N+1 (FR-007).
- Indexes: `ix_transactions_user_date` on `(user_id, transaction_date, id)`; `ix_transactions_user_category` on `(user_id, category_id)`.
- Category resolution on create/patch: `select(Category).where(Category.id == category_id, Category.user_id == user.id)`; miss → 404 `Category not found`; `category.type != type` → 422 `{"detail": "Transaction type does not match category type"}` (business validation, string detail per FR-015 of user-auth).
- `transaction_date` schema type is `datetime`; Pydantic parses `YYYY-MM-DD` as midnight. Validator: naive → assume UTC; aware → convert to UTC; must be ≤ `datetime.now(UTC)`.
- List: `limit: int = Query(20, ge=1, le=100)`, `offset: int = Query(0, ge=0)`, `type: Literal["income","expense"] | None`, `category_id: int | None = Query(None, gt=0)`. Two statements with the same filters: `count(*)` and the ordered page (`transaction_date desc, id desc`). Response `{"items", "total", "limit", "offset"}`.
- Period helper `budget_period(today: date, start_day: int) -> tuple[date, date]`: start = `date(y, m, start_day)` if `today.day >= start_day` else the same day of the previous month; end = next start minus one day. Query bounds: `transaction_date >= start 00:00 UTC` and `< end + 1 day 00:00 UTC`.
- Summary totals: one `select(func.coalesce(func.sum(case((type=='income', amount), else_=0)), 0), same for expense)`; breakdown: `select(Category.id, Category.name, Category.type, Category.budget, func.sum(Transaction.amount)).join(...).group_by(...)`, ordered by type then total desc. `remaining_budget = limit - total_expense` or null when limit is 0. Totals computed as `Decimal`, serialised as floats in `SummaryOut`.
- `from`/`to` query params (`date`, inclusive); `from > to` → 422 string detail.
- Guards in `categories.py`: `count = select(func.count()).select_from(Transaction).where(Transaction.category_id == id)`; on PATCH with `type` in the payload and `type != category.type` and count > 0 → 409 `Category has N transactions`; on DELETE with count > 0 → same 409. `test_patch_type_change_allowed` in `test_categories.py` stays valid (no transactions) and is renamed to say so.
- `SQLite` returns naive datetimes for `DateTime(timezone=True)`; tests compare dates, not tz suffixes. Postgres returns aware values (verified in the smoke test).
- Logging: `misiops.transactions` logger, info on create and delete with user id and transaction id.
