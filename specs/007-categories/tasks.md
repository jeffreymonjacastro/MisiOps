# Tasks: Categories

**Input**: Design documents from `/specs/007-categories/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/categories.openapi.yaml, quickstart.md. Branch `feature/categories` already contains the user-auth code (model, `get_current_user`, test fixtures).

**Tests**: Included (NFR-003, constitution Testing Standards). Tests first, watch them fail, then implement.

**Organization**: Four user stories share one router file and one test file, so stories run sequentially.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 list, US2 create, US3 update, US4 delete
- Paths relative to the repository root

## Path Conventions

Backend-only. `backend/` flat layout. Run from `backend/` with `uv run`.

---

## Phase 1: Setup

No new dependencies. Nothing to do.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Model, schemas, router registration, seeding hook and SQLite FK enforcement

- [X] T001 [P] Create `backend/models/category.py`: `Category` with `id` Integer PK; `user_id` Integer `ForeignKey("users.id", ondelete="CASCADE")` NOT NULL indexed; `name` String(50) NOT NULL; `type` String(10) NOT NULL with `CheckConstraint("type IN ('income','expense')")`; `budget` Numeric(12, 2) nullable; `__table_args__` with `Index("ix_categories_user_type_lower_name", "user_id", "type", func.lower(name), unique=True)`. Add `DEFAULT_CATEGORIES: list[tuple[str, str]]` = expense: Comida, Transporte, Vivienda, Salud, Entretenimiento, Compras, Otros; income: Sueldo, Otros; and `default_categories(user_id: int) -> list[Category]`
- [X] T002 [P] Create `backend/schemas/category.py`: `CategoryType = Literal["income", "expense"]`; `CategoryCreate` (`name` str 1-50 after strip, `type` CategoryType, `budget` Decimal | None = None, ge=0, decimal_places=2); `CategoryUpdate` (all optional, `extra="ignore"`); `CategoryOut` (`from_attributes`; `id` int, `name` str, `type` CategoryType, `budget: float | None`)
- [X] T003 [P] Add `PRAGMA foreign_keys=ON` to `backend/tests/conftest.py` via `@event.listens_for(engine.sync_engine, "connect")` on the test engine (`dbapi_conn.execute("PRAGMA foreign_keys=ON")`) so FK cascades are enforced in SQLite
- [X] T004 Create `backend/api/v1/categories.py` with `router = APIRouter(prefix="/category", tags=["category"])` and `logger = logging.getLogger("misiops.categories")`; include it in `backend/api/v1/router.py`; add `import models.category  # noqa: F401` next to `import models.user` in `backend/main.py` (depends on T001)
- [X] T005 Seed defaults in `register` in `backend/api/v1/auth.py`: move `db.add(user)` inside the existing `try`, then `await db.flush()` (this is where a duplicate email raises `IntegrityError`, so it must be inside the `try`), `db.add_all(default_categories(user.id))`, then the existing `await db.commit()`; add a test in `backend/tests/test_auth.py` `test_register_duplicate_email_still_409_with_seeding` if not already covered by `test_register_duplicate_email_case_insensitive` (depends on T001)

**Checkpoint**: `uv run pytest` green (34 tests), `/docs` shows the empty `category` tag

---

## Phase 3: User Story 1 - List my categories (Priority: P1) 🎯 MVP

**Goal**: `GET /api/v1/category/` returns the caller's categories as a plain array

**Independent Test**: `uv run pytest tests/test_categories.py -k list` passes; a fresh user gets 9 Spanish defaults

### Tests for User Story 1

- [X] T006 [US1] Create `backend/tests/test_categories.py` with helper `CAT = "/api/v1/category/"` and tests: `test_new_user_gets_spanish_defaults` (200, 9 items, expense names then income names, each ordered case-insensitively, every item has exactly `{"id","name","type","budget"}` and `budget is None`); `test_list_is_per_user` (two users, custom category of one never appears for the other); `test_list_unauthenticated` (401)

### Implementation for User Story 1

- [X] T007 [US1] Implement `list_categories` in `backend/api/v1/categories.py`: `@router.get("/", response_model=list[CategoryOut])`; `select(Category).where(Category.user_id == user.id).order_by(Category.type, func.lower(Category.name))` (depends on T006)

**Checkpoint**: US1 green

---

## Phase 4: User Story 2 - Create a custom category (Priority: P1)

**Goal**: `POST /api/v1/category/` creates a category owned by the caller

**Independent Test**: `uv run pytest tests/test_categories.py -k create` passes

### Tests for User Story 2

- [X] T008 [US2] Append to `backend/tests/test_categories.py`: `test_create_ok` (201, body has int `id`, `name == "Gimnasio"`, `type == "expense"`, `budget == 150`, and it appears in the list); `test_create_without_budget_is_null`; `test_create_duplicate_name_case_insensitive` (`"gimnasio"` after `"Gimnasio"` → 409 `{"detail": "Category name already exists"}`); `test_create_same_name_other_user_ok` (201); `test_create_same_name_other_type_ok` (expense "Otros" exists by default; income "Otros" too; creating expense "Sueldo" → 201); `test_create_validation` parametrised: `name=""`, `name="x"*51`, `type="other"`, `budget=-1`, `budget=1.005` → 422; `test_create_trims_name` (`"  Gym  "` → `"Gym"`)

### Implementation for User Story 2

- [X] T009 [US2] Implement `create_category` in `backend/api/v1/categories.py`: `@router.post("/", status_code=201, response_model=CategoryOut)`; build `Category(user_id=user.id, **body.model_dump())`; `db.add`, `db.commit` inside `try`, on `IntegrityError` rollback and raise 409 `Category name already exists` `from None`; `db.refresh`; `logger.info("category created user=%s id=%s", user.id, cat.id)` (depends on T007)

**Checkpoint**: US1-US2 green

---

## Phase 5: User Story 3 - Update a category (Priority: P2)

**Goal**: `PATCH /api/v1/category/{category_id}` partially updates name, type, budget

**Independent Test**: `uv run pytest tests/test_categories.py -k patch` passes

### Tests for User Story 3

- [X] T010 [US3] Append: `test_patch_budget_only` (only budget changes); `test_patch_budget_null_clears`; `test_patch_empty_body_unchanged` (200, same body); `test_patch_rename_duplicate` → 409; `test_patch_type_change_allowed` (interim behaviour until transactions feature; 200); `test_patch_other_users_category_404` and `test_patch_unknown_id_404` (`{"detail": "Category not found"}`); `test_patch_id_zero_422`; `test_patch_default_category_allowed` (rename "Comida" → "Alimentos", 200)

### Implementation for User Story 3

- [X] T011 [US3] Implement `update_category` in `backend/api/v1/categories.py`: `@router.patch("/{category_id}", response_model=CategoryOut)` with `category_id: int = Path(gt=0)`; helper `async def _get_owned(db, user, category_id) -> Category` doing `select(Category).where(Category.id == category_id, Category.user_id == user.id)` and raising 404 `Category not found` on miss; apply `body.model_dump(exclude_unset=True)` with `setattr`; commit in `try`, `IntegrityError` → rollback + 409 `from None`; refresh; return (depends on T009)

**Checkpoint**: US1-US3 green

---

## Phase 6: User Story 4 - Delete a category (Priority: P2)

**Goal**: `DELETE /api/v1/category/{category_id}` removes the caller's category

**Independent Test**: `uv run pytest tests/test_categories.py -k delete` passes

### Tests for User Story 4

- [X] T012 [US4] Append: `test_delete_ok` (204, empty body, gone from list); `test_delete_other_users_category_404`; `test_delete_unknown_404`; `test_delete_default_category_allowed`; `test_delete_all_then_list_empty_array` (`[]`); `test_user_delete_cascades_categories` (register, `DELETE /api/v1/user/`, then query `select(func.count()).select_from(Category)` through `db_session` → 0)

### Implementation for User Story 4

- [X] T013 [US4] Implement `delete_category` in `backend/api/v1/categories.py`: `@router.delete("/{category_id}", status_code=204, response_class=Response)`; `_get_owned`; `db.delete`, `db.commit`; `logger.info("category deleted user=%s id=%s", ...)`; return `Response(status_code=204)` (depends on T011)

**Checkpoint**: All stories green

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T014 [P] Add the category endpoints and the default-category note to `backend/README.md`
- [X] T015 Run `uv run pytest -q`, `uvx ruff check .`, `uvx ruff format --check .` (all clean) and the quickstart.md curl smoke test against a local Postgres 16 after dropping the old database once

---

## Dependencies & Execution Order

- Phase 2 blocks everything. T001, T002, T003 in parallel; then T004, T005.
- US1 → US2 → US3 → US4 sequential (one router file, one test file).
- Phase 7 after US4. T014 can start any time after T004.

## Parallel Example: Foundational Phase

```bash
Task: "Create backend/models/category.py ..."      # T001
Task: "Create backend/schemas/category.py ..."     # T002
Task: "Add PRAGMA foreign_keys=ON to conftest ..."  # T003
```

## Implementation Strategy

MVP = Phase 2 + US1 + US2: the frontend form dropdown works with defaults and custom categories. US3 and US4 complete the categories page.

## Notes

- FR-006 and FR-008 (transaction guards) are delivered by the transactions feature; do not stub them here.
- Ownership goes in the `WHERE` clause, never only in the router (NFR-002).
- Error bodies stay FastAPI default; messages: `Category name already exists`, `Category not found`.
- Commit per phase, Conventional Commits, no AI attribution.

---

## Phase 8: Convergence

- [X] T016 Record in `specs/007-categories/plan.md` (Implementation notes) and `specs/007-categories/research.md` (new R7) that the shared `SessionLocal` in `backend/core/database.py` uses `expire_on_commit=False` because async sessions cannot lazy-load expired attributes after commit (caused a 500 on `POST /category/` against Postgres), and that `backend/tests/test_database.py` guards it, per plan: storage decision (unrequested)
