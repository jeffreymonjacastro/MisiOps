# Tasks: Transactions

**Input**: Design documents from `/specs/008-transactions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/transactions.openapi.yaml, quickstart.md. Branch `feature/transactions` already contains user-auth and categories.

**Tests**: Included (NFR-004). Tests first, watch them fail, then implement.

**Organization**: Five user stories share `api/v1/transactions.py` and `tests/test_transactions.py`, so they run sequentially. The category guards (FR-015) are a separate phase touching `categories.py` and `test_categories.py`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 create, US2 list, US3 summary, US4 update, US5 delete
- Paths relative to the repository root

## Path Conventions

Backend-only. `backend/` flat layout. Run from `backend/` with `uv run`.

---

## Phase 1: Setup

No new dependencies. Nothing to do.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Model, schemas, period helper, router registration

- [X] T001 [P] Create `backend/models/transaction.py`: `Transaction` with `id` Integer PK; `user_id` Integer `ForeignKey("users.id", ondelete="CASCADE")` NOT NULL; `category_id` Integer `ForeignKey("categories.id")` NOT NULL (default NO ACTION, see research R6); `amount` Numeric(12, 2) NOT NULL; `type` String(10) NOT NULL; `source` String(10) NOT NULL `server_default="manual"`; `description` String(255) nullable; `transaction_date` DateTime(timezone=True) NOT NULL `server_default=func.now()`; `category = relationship("Category", lazy="joined")`; `__table_args__`: `CheckConstraint("amount > 0", name="ck_transactions_amount_positive")`, `CheckConstraint("type IN ('income', 'expense')", name="ck_transactions_type")`, `CheckConstraint("source IN ('manual', 'telegram', 'gmail')", name="ck_transactions_source")`, `Index("ix_transactions_user_date", "user_id", "transaction_date", "id")`, `Index("ix_transactions_user_category", "user_id", "category_id")`
- [X] T002 [P] Create `backend/schemas/transaction.py`: `TxType = Literal["income", "expense"]`; `Amount = Annotated[Decimal, Field(gt=0, le=1_000_000_000, decimal_places=2)]`; `Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]` with a before-validator turning `""` into `None`; `_to_utc(value: datetime) -> datetime` (naive → `replace(tzinfo=UTC)`, aware → `astimezone(UTC)`) and a validator rejecting values later than `datetime.now(UTC)` with message `transaction_date must not be in the future`; `TransactionCreate` (`amount: Amount`, `type: TxType`, `category_id: int = Field(gt=0)`, `description: Description | None = None`, `transaction_date: datetime | None = None`, with a before-validator that turns a `YYYY-MM-DD` string into `datetime(y, m, d)` if Pydantic does not already accept the date-only form); `TransactionUpdate` (all optional, `extra="ignore"`); `CategoryRef` (`id`, `name`, `type`; `from_attributes`); `TransactionOut` (`id`, `amount: float`, `type`, `source`, `description`, `transaction_date: datetime`, `category: CategoryRef`; `from_attributes`); `TransactionPage` (`items`, `total`, `limit`, `offset`); `CategoryTotal` (`category_id`, `name`, `type`, `budget: float | None`, `total: float`); `SummaryOut` (`period_start: date`, `period_end: date`, `total_income: float`, `total_expense: float`, `balance: float`, `monthly_budget_limit: float`, `remaining_budget: float | None`, `by_category: list[CategoryTotal]`)
- [X] T003 [P] Create `backend/core/periods.py` with `budget_period(today: date, start_day: int) -> tuple[date, date]`: start is `today.replace(day=start_day)` when `today.day >= start_day`, else the same day of the previous month; end is the next period start minus one day. Add `backend/tests/test_periods.py` with cases: start_day 1 → calendar month; start_day 15 on the 20th → 15th..14th next month; on the 10th → previous 15th..14th; December/January rollover; start_day 28 in February
- [X] T004 Create `backend/api/v1/transactions.py` with `router = APIRouter(prefix="/transactions", tags=["transactions"])` and `logger = logging.getLogger("misiops.transactions")`; include it in `backend/api/v1/router.py`; add `import models.transaction  # noqa: F401` in `backend/main.py` (depends on T001)

**Checkpoint**: `uv run pytest` green (64 + period tests), `/docs` shows the empty `transactions` tag

---

## Phase 3: User Story 1 - Record a transaction (Priority: P1) 🎯 MVP

**Goal**: `POST /api/v1/transactions` creates a manual transaction owned by the caller

**Independent Test**: `uv run pytest tests/test_transactions.py -k create` passes

### Tests for User Story 1

- [X] T005 [US1] Create `backend/tests/test_transactions.py` with helpers: `TX = "/api/v1/transactions"`, `async def _cat_id(client, h, name)` (from `GET /category/`), `async def _create(client, h, **body)` defaulting to `{"amount": 25.5, "type": "expense", "category_id": <Comida>}`; tests: `test_create_ok` (201; `amount == 25.5`, `source == "manual"`, `description is None`, `transaction_date` present, `category == {"id", "name": "Comida", "type": "expense"}`); `test_create_with_date_only` (`"2026-01-15"` → `transaction_date` starts with `"2026-01-15T00:00:00"`); `test_create_with_aware_datetime_converted_to_utc` (`"2026-01-15T10:00:00-05:00"` → starts with `"2026-01-15T15:00:00"`); `test_create_type_mismatch_422` (income with Comida → 422 `{"detail": "Transaction type does not match category type"}`); `test_create_validation` parametrised: `amount=0`, `amount=-1`, `amount=1000000001`, `amount=1.005`, `description="x"*256`, `transaction_date` = tomorrow, `category_id=0` → 422 with list detail naming the field; `test_create_category_not_owned_404` (other user's category and id 99999 → 404 `{"detail": "Category not found"}`); `test_create_empty_description_is_null`

### Implementation for User Story 1

- [X] T006 [US1] Implement in `backend/api/v1/transactions.py`: helper `async def _owned_category(db, user, category_id) -> Category` (404 `Category not found`); helper `def _check_type(category, tx_type)` raising 422 string detail on mismatch; `@router.post("", status_code=201, response_model=TransactionOut)`: resolve category, check type, build `Transaction(user_id=user.id, source="manual", **body.model_dump(exclude_none=True))`, `db.add`, `db.commit`, `db.refresh(tx)` then re-select with the joined category (or `await db.refresh(tx, ["category"])`), `logger.info("transaction created user=%s id=%s", ...)`, return (depends on T005)

**Checkpoint**: US1 green

---

## Phase 4: User Story 2 - Browse history with filters (Priority: P1)

**Goal**: `GET /api/v1/transactions` returns a filtered, paginated page newest first

**Independent Test**: `uv run pytest tests/test_transactions.py -k list` passes

### Tests for User Story 2

- [X] T007 [US2] Append: fixture-like helper `_seed(client, h, n)` creating `n` transactions with distinct dates; `test_list_pagination` (12 rows; `limit=5` → 5 items, `total == 12`, `limit == 5`, `offset == 0`, first item is the newest; `limit=5&offset=10` → 2 items); `test_list_default_limit_20`; `test_list_filters_and` (`type=expense&category_id=<Comida>` only those, `total` reflects the filter); `test_list_filter_type_invalid_422`; `test_list_foreign_category_filter_empty` (other user's category id → `items == []`, `total == 0`); `test_list_limit_offset_validation` parametrised `limit=0`, `limit=101`, `offset=-1` → 422; `test_list_isolation_and_user_id_ignored` (two users; `?user_id=<other>` returns caller's rows); `test_list_unauthenticated` (401)

### Implementation for User Story 2

- [X] T008 [US2] Implement `list_transactions` in `backend/api/v1/transactions.py`: `@router.get("", response_model=TransactionPage)` with `type: TxType | None = None`, `category_id: int | None = Query(None, gt=0)`, `limit: int = Query(20, ge=1, le=100)`, `offset: int = Query(0, ge=0)`; build `filters = [Transaction.user_id == user.id]` plus optional type/category; `total = (await db.execute(select(func.count()).select_from(Transaction).where(*filters))).scalar_one()`; page `select(Transaction).where(*filters).order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).limit(limit).offset(offset)`; return `TransactionPage(items=..., total=total, limit=limit, offset=offset)` (depends on T006)

**Checkpoint**: US1-US2 green

---

## Phase 5: User Story 3 - Monthly summary (Priority: P1)

**Goal**: `GET /api/v1/transactions/summary` returns totals, balance, budget and per-category breakdown for the period

**Independent Test**: `uv run pytest tests/test_transactions.py -k summary` passes

### Tests for User Story 3

- [X] T009 [US3] Append: `test_summary_default_period` (incomes 1000 + 500 in Sueldo, expense 300 in Comida, all dated today → `total_income == 1500`, `total_expense == 300`, `balance == 1200`, `by_category` has 2 rows with `budget` key and `type`, ordered income rows then expense rows by total desc); `test_summary_period_from_budget_start_day` (patch profile `budget_start_day=15`; monkeypatch `api.v1.transactions.today` (or `_today()` helper) to the 20th and to the 10th; assert `period_start`/`period_end`); `test_summary_remaining_budget` (limit 2000 → 1700; limit 0 → `None`); `test_summary_explicit_range` (`from`/`to` cover only some rows); `test_summary_range_validation` (`from > to` → 422 `{"detail": "from must not be after to"}`; only `from` → 422); `test_summary_empty` (all zeros, `by_category == []`); `test_summary_exact_cents` (0.10 + 0.20 → `total_expense == 0.3`); `test_summary_boundaries` (transactions at `period_start 00:00:00` and `period_end 23:59:59` included, one second after excluded); `test_summary_isolation`

### Implementation for User Story 3

- [X] T010 [US3] Implement `summary` in `backend/api/v1/transactions.py` **above** the `/{transaction_id}` routes: `@router.get("/summary", response_model=SummaryOut)` with `from_: date | None = Query(None, alias="from")`, `to: date | None = None`; module-level `def _today() -> date: return datetime.now(UTC).date()` (monkeypatchable); if exactly one of from/to → 422 `from and to must be given together`; if `from_ > to` → 422 `from must not be after to`; else default `budget_period(_today(), user.budget_start_day)`; bounds `start_dt = datetime.combine(start, time.min, tzinfo=UTC)`, `end_dt = datetime.combine(end + timedelta(days=1), time.min, tzinfo=UTC)`; totals via `select(func.coalesce(func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)), 0), ...expense...)`; breakdown via `select(Category.id, Category.name, Category.type, Category.budget, func.sum(Transaction.amount)).join(Transaction, Transaction.category_id == Category.id).where(Transaction.user_id == user.id, bounds).group_by(Category.id).order_by(Category.type, func.sum(Transaction.amount).desc())`; `remaining = None if user.monthly_budget_limit == 0 else limit - expense` (depends on T008)

**Checkpoint**: US1-US3 green

---

## Phase 6: User Story 4 - Edit a transaction (Priority: P2)

**Goal**: `PATCH /api/v1/transactions/{id}` partially updates and re-validates

**Independent Test**: `uv run pytest tests/test_transactions.py -k patch` passes

### Tests for User Story 4

- [X] T011 [US4] Append: `test_patch_amount_only` (other fields unchanged, response full row); `test_patch_category_mismatch_422` (set `category_id` to Sueldo while type stays expense → 422); `test_patch_type_and_category_together_200`; `test_patch_category_not_owned_404`; `test_patch_empty_body_unchanged`; `test_patch_other_users_404` (`{"detail": "Transaction not found"}`); `test_patch_unknown_404`; `test_patch_id_zero_422`; `test_patch_future_date_422`

### Implementation for User Story 4

- [X] T012 [US4] Implement `update_transaction`: `@router.patch("/{transaction_id}", response_model=TransactionOut)` with `transaction_id: int = Path(gt=0)`; helper `_owned_transaction(db, user, id)` (404 `Transaction not found`); `data = body.model_dump(exclude_unset=True)`; resolve `new_type = data.get("type", tx.type)` and `new_category_id = data.get("category_id", tx.category_id)`; if either changed, `_owned_category` + `_check_type`; apply `setattr`s; commit; refresh with category; return (depends on T010)

**Checkpoint**: US1-US4 green

---

## Phase 7: User Story 5 - Delete a transaction (Priority: P2)

**Goal**: `DELETE /api/v1/transactions/{id}` removes the row

**Independent Test**: `uv run pytest tests/test_transactions.py -k delete` passes

### Tests for User Story 5

- [X] T013 [US5] Append: `test_delete_ok` (204, empty body; summary total drops; list total drops); `test_delete_other_users_404`; `test_delete_unknown_404`; `test_delete_unauthenticated`; `test_user_delete_cascades_transactions` (register, create, `DELETE /user/`, count rows via `db_session` → 0)

### Implementation for User Story 5

- [X] T014 [US5] Implement `delete_transaction`: `@router.delete("/{transaction_id}", status_code=204, response_class=Response)`; `_owned_transaction`; `db.delete`, `db.commit`; `logger.info("transaction deleted user=%s id=%s", ...)` (depends on T012)

**Checkpoint**: All five stories green

---

## Phase 8: Category guards (FR-015)

**Goal**: `PATCH /category/{id}` refuses a type change and `DELETE /category/{id}` refuses deletion while transactions exist

- [X] T015 Append to `backend/tests/test_categories.py`: rename `test_patch_type_change_allowed` to `test_patch_type_change_allowed_without_transactions`; add `test_patch_type_change_blocked_with_transactions` (create a transaction in the category, PATCH `type` → 409 `{"detail": "Category has 1 transactions"}`; PATCH `name` only → 200); `test_delete_blocked_with_transactions` (2 transactions → 409 `Category has 2 transactions`; delete both transactions → DELETE → 204)
- [X] T016 Implement guards in `backend/api/v1/categories.py`: helper `async def _transaction_count(db, category_id) -> int` using `select(func.count()).select_from(Transaction).where(Transaction.category_id == category_id)`; in `update_category`, when `"type" in data and data["type"] != category.type`, count > 0 → 409 `Category has {n} transactions`; in `delete_category`, count > 0 → same 409 (depends on T015)

**Checkpoint**: Whole suite green

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T017 [P] Add the transaction endpoints and the summary semantics to `backend/README.md`
- [X] T018 Run `uv run pytest -q`, `uvx ruff check .`, `uvx ruff format --check .` (all clean) and the quickstart.md curl smoke test against a local Postgres 16 (drop the old database once); record list and summary p95 with 10 concurrent clients in the PR description (NFR-001: < 300 ms)

---

## Dependencies & Execution Order

- Phase 2 blocks everything: T001, T002, T003 in parallel, then T004.
- US1 → US2 → US3 → US4 → US5 sequential (shared router and test file). Summary route must be declared before `/{transaction_id}`.
- Phase 8 after US1 (needs transactions to exist); scheduled after US5 for simplicity.
- Phase 9 last. T017 any time after T004.

## Parallel Example: Foundational Phase

```bash
Task: "Create backend/models/transaction.py ..."   # T001
Task: "Create backend/schemas/transaction.py ..."  # T002
Task: "Create backend/core/periods.py + tests ..."  # T003
```

## Implementation Strategy

MVP = Phase 2 + US1 + US2 + US3: the dashboard cards and the history page work. US4/US5 complete the edit/delete buttons; Phase 8 protects category integrity.

## Notes

- Ownership in every `WHERE`, including category lookups (NFR-002).
- Money stays `Decimal` until the response schema (NFR-003).
- Error strings: `Transaction not found`, `Category not found`, `Transaction type does not match category type`, `from must not be after to`, `from and to must be given together`, `Category has N transactions`.
- Commit per phase, Conventional Commits, no AI attribution.
