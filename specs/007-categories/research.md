# Research: Categories

No NEEDS CLARIFICATION items. Decisions below reuse what user-auth established (see `specs/006-user-auth/research.md` R3-R5, R7-R9) and add the category-specific ones.

## R1. Case-insensitive uniqueness per user

- **Decision**: Unique expression index on `(user_id, type, lower(name))` declared in the model with `sqlalchemy.Index(..., func.lower(Category.name), unique=True)`.
- **Rationale**: Enforced by the database (constitution: security and maintainability), portable across Postgres and SQLite so tests stay hermetic, and it turns the concurrent-create race into a plain `IntegrityError` → 409.
- **Alternatives considered**: Store a `name_lower` shadow column (extra column to keep in sync); pre-check with `SELECT` (racy); `citext` (Postgres-only, breaks SQLite tests).

## R2. Seeding defaults inside registration

- **Decision**: `register` flushes the user to obtain its id, adds the nine default `Category` rows, then commits once.
- **Rationale**: Atomic: either the user exists with defaults or not at all. Three lines in `auth.py`; no event hooks or background tasks.
- **Alternatives considered**: SQLAlchemy `after_insert` event (hidden control flow); seeding lazily on first list (makes GET a write); a global default table (contradicts the per-user schema in the constitution).

## R3. Foreign-key enforcement in SQLite tests

- **Decision**: `@event.listens_for(engine.sync_engine, "connect")` executing `PRAGMA foreign_keys=ON` in `conftest.py`.
- **Rationale**: SQLite ignores `ON DELETE CASCADE` unless the pragma is on. Needed so the user-delete cascade (user-auth FR-012, this feature's FK) is actually tested. Documented as a known ceiling in user-auth R4.
- **Alternatives considered**: Postgres test container (heavier; still not needed).

## R4. Transaction-dependent guards

- **Decision**: FR-006 (no type change with transactions) and FR-008 (no delete with transactions) are not implemented here (Clarification Q2).
- **Rationale**: The `transactions` table does not exist on this branch; implementing the guards would require creating a table owned by another feature. The transactions feature adds both guards and their tests when it adds the FK from transactions to categories.
- **Alternatives considered**: Stub guards returning zero (dead code until replaced); creating a minimal transactions model (ownership conflict with feature 008).

## R5. List response shape

- **Decision**: Plain JSON array ordered by `type`, then `lower(name)` (Clarification Q3).
- **Rationale**: Small, unpaginated list consumed by a dropdown; simplest for the frontend.
- **Alternatives considered**: `{"items": [...]}` wrapper (only useful with pagination metadata).

## R6. Budget semantics

- **Decision**: `budget` is a cap per user budget period, the same window as `monthly_budget_limit` (Clarification Q4). This feature stores it; the transactions summary applies it.
- **Rationale**: One period definition across the system.
- **Alternatives considered**: Calendar month (would diverge from `budget_start_day`); undefined until later (frontend needs the meaning now for its budget page).

## R7. Session expiry after commit (shared, affects every feature)

- **Decision**: `SessionLocal = async_sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)` in `backend/core/database.py`, guarded by `backend/tests/test_database.py`.
- **Rationale**: SQLAlchemy expires all instance attributes on commit by default. In an async session the next attribute access triggers a synchronous lazy load and raises `MissingGreenlet`. It surfaced as a 500 on `POST /category/` against Postgres (the test session factory already had expiry off, so the suite was green). Disabling expiry on the shared factory fixes every current and future router at once; the objects are refreshed explicitly where fresh server defaults are needed.
- **Alternatives considered**: Read every needed attribute before `commit()` in each endpoint (fragile, easy to forget); `await db.refresh()` after every commit (extra round trip per request).
