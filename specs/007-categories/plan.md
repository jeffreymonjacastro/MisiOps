# Implementation Plan: Categories

**Branch**: `feature/categories` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-categories/spec.md`

## Summary

Add a user-owned `categories` table and four bearer-protected endpoints under `api/v1/category` (list, create, patch, delete), plus seeding of nine Spanish default categories inside the registration transaction. Reuses everything user-auth built: `get_current_user`, error shape, test fixtures. Guards that depend on the transactions table (FR-006, FR-008) are delivered by the transactions feature.

## Technical Context

**Language/Version**: Python 3.13, `uv`

**Primary Dependencies**: FastAPI, SQLAlchemy 2 async, Pydantic v2 (all present). No new dependencies.

**Storage**: PostgreSQL `categories` table with FK to `users` (`ON DELETE CASCADE`). Tests on SQLite in-memory with `PRAGMA foreign_keys=ON`.

**Testing**: pytest + httpx `ASGITransport`, fixtures from `backend/tests/conftest.py` (`client`, `register`, `auth_headers`).

**Target Platform**: Linux server (uvicorn)

**Project Type**: web-service (backend)

**Performance Goals**: NFR-001: list p95 < 200 ms with up to 200 categories. One indexed query by `user_id`.

**Constraints**: Ownership enforced in every query (`WHERE user_id = current_user.id`), never only in the router (NFR-002). Error shape `{"detail": ...}`. No service/repository layers.

**Scale/Scope**: 4 endpoints, 1 table, 1 change to `auth.register`.

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I. Code Quality | Router + model + schema only; seeding is a 3-line helper next to the model. | PASS |
| II. Testing Standards | Every FR delivered here has a test; SQLite FK enforcement added so cascade is tested. | PASS |
| III. UX Consistency | Same auth dependency, base path, error shape and status codes (201/200/204/404/409/422) as user-auth. | PASS |
| IV. Performance | Single indexed query; target stated. | PASS |
| Security & maintainability | Ownership in the query; DB-level uniqueness and FK cascade; no new deps. | PASS |
| Development Workflow | `feature/categories` → PR to `develop`; CI from user-auth applies. | PASS |

Post-design re-check: PASS. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-categories/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/categories.openapi.yaml
├── evaluations/eval-report.md
├── checklists/requirements.md, security.md, api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── models/
│   └── category.py          # Category model + DEFAULT_CATEGORIES + default_categories(user_id)
├── schemas/
│   └── category.py          # CategoryCreate, CategoryUpdate, CategoryOut
├── api/v1/
│   ├── categories.py        # GET/POST /category/, PATCH/DELETE /category/{id}
│   ├── auth.py              # register: seed defaults in the same transaction
│   └── router.py            # include categories.router
├── main.py                  # import models.category before create_all
└── tests/
    ├── conftest.py          # PRAGMA foreign_keys=ON for SQLite
    └── test_categories.py
```

**Structure Decision**: Same flat layout as user-auth. One new model file, one schema file, one router file, one test file, three one-line touches.

## Complexity Tracking

None.

## Implementation notes carried into tasks

- Uniqueness per user and type, case-insensitive: `Index("ix_categories_user_type_lower_name", "user_id", "type", func.lower(Category.name), unique=True)`. Expression indexes work on both Postgres and SQLite, so no `citext`. Names are stored as typed (trimmed), compared lower-cased by the index.
- `IntegrityError` on create/update → 409 `Category name already exists`.
- Ownership: every read is `select(Category).where(Category.id == id, Category.user_id == user.id)`; miss → 404 `Category not found`. Path parameter `category_id: int = Path(gt=0)` so 0 and negatives are 422, non-numeric is 422 by FastAPI.
- Seeding: in `register`, inside the existing `try`: `db.add(user); await db.flush(); db.add_all(default_categories(user.id)); await db.commit()`. The flush is where a duplicate email raises `IntegrityError`, so it must stay inside the `try` that maps it to 409. One transaction, so a failed seed never leaves a user without defaults.
- FK `ForeignKey("users.id", ondelete="CASCADE")`. SQLite only honours it with `PRAGMA foreign_keys=ON`, set via an engine `connect` event in `conftest.py`. This also makes user-auth's FR-012 cascade testable for the first time; add that test here.
- `budget` is `Numeric(12, 2)` nullable; `CategoryOut.budget: float | None`. PATCH with `budget: null` clears it (same `exclude_unset` pattern as profile update).
- Ordering: `ORDER BY type, lower(name)`.
- DELETE returns 204; POST returns 201 with the created category.
- Logging: `misiops.categories` logger, info on create and delete with user id and category id.
- Shared session factory: `SessionLocal` in `backend/core/database.py` uses `expire_on_commit=False`. Async sessions cannot lazy-load attributes expired by a commit; with the default, the first attribute access after `commit()` (e.g. `user.id` in a log line) raised `MissingGreenlet` and `POST /category/` returned 500 against Postgres while SQLite tests passed. `backend/tests/test_database.py` asserts the setting so it cannot regress. Later features must not re-enable expiry.
