# Tasks: User Authentication & Profile

**Input**: Design documents from `/specs/006-user-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/user-auth.openapi.yaml, quickstart.md

**Tests**: Included. Spec NFR-004 and the constitution's Testing Standards make automated tests mandatory. Each story writes its tests first and watches them fail before implementing.

**Organization**: Tasks are grouped by user story. All five stories share two source files (`api/v1/auth.py` for US1-US2, `api/v1/users.py` for US3-US5) and two test files, so stories in the same file run sequentially, not in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1..US5)
- All paths are relative to the repository root

## Path Conventions

Backend-only feature. Code lives in `backend/` with the flat layout from plan.md: `core/`, `models/`, `schemas/`, `api/`, `tests/`. Run everything from `backend/` with `uv run`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and test runner configuration

- [X] T001 Add runtime dependencies with `uv add pyjwt "pwdlib[argon2]" email-validator` and dev dependencies with `uv add --dev pytest anyio httpx aiosqlite` in `backend/pyproject.toml` (commit the updated `backend/uv.lock`)
- [X] T002 [P] Add `[tool.pytest.ini_options]` with `testpaths = ["tests"]` and `pythonpath = ["."]` to `backend/pyproject.toml`
- [X] T003 [P] Create `backend/.env.example` with `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SECRET_KEY=` (empty, comment: `python3 -c 'import secrets; print(secrets.token_hex(32))'`), `ACCESS_TOKEN_EXPIRE_MINUTES=1440`, `CORS_ORIGINS=["http://localhost:3000"]`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Settings, model, schemas, security helpers, auth dependency, app wiring and test fixtures that every story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Extend `Settings` in `backend/core/config.py` with `SECRET_KEY: str` (required, no default), `ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440`, `CORS_ORIGINS: list[str] = ["http://localhost:3000"]`, and set `PROJECT_NAME = "MisiOps API"`
- [X] T005 [P] Create `backend/core/security.py` with `hash_password(str) -> str` and `verify_password(str, str) -> bool` using `pwdlib.PasswordHash.recommended()`, a module-level `DUMMY_HASH = hash_password("dummy")`, `create_access_token(user_id: int) -> str` (PyJWT HS256, claims `sub=str(user_id)`, `exp=now_utc + settings.ACCESS_TOKEN_EXPIRE_MINUTES`; read `settings` inside the function on every call, never copy it to a module constant, so tests can monkeypatch it), and `decode_access_token(str) -> int | None` returning `None` on any `jwt.InvalidTokenError` or missing/non-numeric `sub`
- [X] T006 [P] Rewrite `User` in `backend/models/user.py` per data-model.md: `id` Integer PK; `name` String(100) NOT NULL; `email` String(255) NOT NULL UNIQUE indexed; `hashed_password` String(255) NOT NULL; `telegram_chat_id` String(64) UNIQUE nullable; `monthly_budget_limit` Numeric(12, 2) NOT NULL server_default "0"; `budget_start_day` SmallInteger NOT NULL server_default "1"; `created_at` DateTime(timezone=True) NOT NULL server_default `func.now()`
- [X] T007 [P] Create `backend/schemas/user.py` with Pydantic v2 models: `UserCreate` (`name` str 1-100 after strip, `email` EmailStr, `password` str 8-128, `telegram_chat_id` str 1-64 | None = None); `UserLogin` (`email` EmailStr, `password` str min 1); `UserUpdate` (`model_config = ConfigDict(extra="ignore")`, all optional: `name` 1-100, `telegram_chat_id` str | None with a validator turning `""` into `None`, `monthly_budget_limit` Decimal ≥ 0 with `decimal_places=2`, `budget_start_day` int 1-28); `UserOut` (`model_config = ConfigDict(from_attributes=True)`; `id`, `name`, `email`, `telegram_chat_id`, `monthly_budget_limit: float` (declared float so JSON emits a number, not the string Pydantic uses for Decimal; contract says `number`), `budget_start_day`, `created_at`); `Token` (`access_token` str, `token_type: Literal["bearer"] = "bearer"`). Add a shared `normalize_email(str) -> str` helper doing `strip().lower()`
- [X] T008 Create `backend/api/deps.py` with `get_current_user(credentials = Depends(HTTPBearer(auto_error=False)), db = Depends(get_db)) -> User`: raise `HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})` when credentials are missing, scheme is not `bearer` (case-insensitive), `decode_access_token` returns None, or no user row matches the id (depends on T005, T006)
- [X] T009 Create `backend/api/v1/router.py` exposing `api_router = APIRouter(prefix="/api/v1")` that includes `auth.router` and `users.router`; create empty routers `router = APIRouter(prefix="/auth", tags=["auth"])` in `backend/api/v1/auth.py` and `router = APIRouter(prefix="/user", tags=["user"])` in `backend/api/v1/users.py`; add `backend/api/__init__.py`, `backend/api/v1/__init__.py`, `backend/schemas/__init__.py`; in `backend/main.py` set `title=settings.PROJECT_NAME`, add `CORSMiddleware(allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`, `app.include_router(api_router)`, `logging.basicConfig(level=logging.INFO)`, and set `echo=False` on the engine in `backend/core/database.py` (depends on T004)
- [X] T010 Create `backend/tests/conftest.py`: set `os.environ["SECRET_KEY"] = "test-secret"` before importing the app; `anyio_backend` fixture returning `"asyncio"`; function-scoped `db_session` fixture creating `create_async_engine("sqlite+aiosqlite:///:memory:")`, running `Base.metadata.create_all`, yielding an `async_sessionmaker(expire_on_commit=False)` session and disposing the engine; `client` fixture overriding `app.dependency_overrides[get_db]` and yielding `httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")`; helper fixtures `register(client, **overrides)` and `auth_headers(client)` that register+login a default user `{"name": "Ana", "email": "ana@example.com", "password": "secret123"}` and return `{"Authorization": f"Bearer {token}"}` (depends on T006, T009)

**Checkpoint**: `uv run pytest` collects zero tests and exits cleanly; `uv run uvicorn main:app` starts and `/docs` shows the two empty routers

---

## Phase 3: User Story 1 - Register an account (Priority: P1) 🎯 MVP

**Goal**: `POST /api/v1/auth/register` creates a user and returns 201 with the profile

**Independent Test**: `uv run pytest tests/test_auth.py -k register` passes; curl step 1 of quickstart.md returns 201 without a password field

### Tests for User Story 1

> Write these first; they must fail before T012

- [X] T011 [US1] Create `backend/tests/test_auth.py` with async tests: `test_register_ok` (201, body has `id`, `name`, `email` lower-cased, `telegram_chat_id` null, `monthly_budget_limit == 0`, `budget_start_day == 1`, `created_at`, and no `password`/`hashed_password` keys); `test_register_stores_telegram_chat_id`; `test_register_duplicate_email_case_insensitive` (second call with `Ana@Example.com` → 409 `{"detail": "Email already registered"}`); `test_register_duplicate_telegram_chat_id` (409 `{"detail": "Telegram chat id already linked to another account"}`); `test_register_validation` parametrised over bad email, 7-char password, 129-char password, empty name → 422 with `detail` list naming the field in `loc`

### Implementation for User Story 1

- [X] T012 [US1] Implement `register` in `backend/api/v1/auth.py`: `@router.post("/register", status_code=201, response_model=UserOut)`; normalise email; build `User` with `hash_password`; `db.add`, `db.commit`, `db.refresh`; catch `sqlalchemy.exc.IntegrityError`, `db.rollback()`, and raise 409 with the email message if the error text mentions `email`, else the telegram message; `logger.info("user registered id=%s", user.id)` (depends on T010)

**Checkpoint**: US1 tests green; registration works end to end against Postgres via curl

---

## Phase 4: User Story 2 - Log in and obtain an access token (Priority: P1)

**Goal**: `POST /api/v1/auth/login` returns a 24-hour bearer token; the token authenticates protected routes

**Independent Test**: `uv run pytest tests/test_auth.py -k login` passes; a minimal protected probe (`GET /api/v1/user/` from US3, or a temporary test-only route) accepts the token

### Tests for User Story 2

- [X] T013 [US2] Append to `backend/tests/test_auth.py`: `test_login_ok` (200, `access_token` non-empty, `token_type == "bearer"`); `test_login_email_case_insensitive`; `test_login_wrong_password_and_unknown_email_same_body` (both 401 `{"detail": "Invalid credentials"}`); `test_expired_token_rejected` (create token with `monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", -1)` then call a protected route → 401); `test_bad_bearer_variants` parametrised over no header, `Basic abc`, `Bearer not.a.jwt`, tampered signature → 401 with `WWW-Authenticate: Bearer`; `test_failed_login_logs_warning_without_password` using `caplog` (record contains the email, not the password)

### Implementation for User Story 2

- [X] T014 [US2] Implement `login` in `backend/api/v1/auth.py`: `@router.post("/login", response_model=Token)`; normalise email; select user by email; if missing, run `verify_password(body.password, DUMMY_HASH)` to equalise timing; on any failure `logger.warning("failed login email=%s", email)` and raise 401 `{"detail": "Invalid credentials"}` with `WWW-Authenticate: Bearer`; on success return `Token(access_token=create_access_token(user.id))` (depends on T012)

**Checkpoint**: US1 + US2 green; quickstart curl steps 1, 2 and 5 behave as documented

---

## Phase 5: User Story 3 - View own profile (Priority: P2)

**Goal**: `GET /api/v1/user/` returns the caller's profile from the bearer token

**Independent Test**: `uv run pytest tests/test_users.py -k get` passes; quickstart curl step 3 returns the registered data

### Tests for User Story 3

- [X] T015 [US3] Create `backend/tests/test_users.py` with `test_get_me_ok` (200, exact key set `{"id","name","email","telegram_chat_id","monthly_budget_limit","budget_start_day","created_at"}`), `test_get_me_unauthenticated` (401), `test_get_me_only_own_data` (register two users, each token returns its own email)

### Implementation for User Story 3

- [X] T016 [US3] Implement `get_me` in `backend/api/v1/users.py`: `@router.get("/", response_model=UserOut)` returning `Depends(get_current_user)` (depends on T014 for the login helper used by fixtures)

**Checkpoint**: US1-US3 green

---

## Phase 6: User Story 4 - Update own profile (Priority: P2)

**Goal**: `PATCH /api/v1/user/` partially updates name, telegram_chat_id, monthly_budget_limit, budget_start_day

**Independent Test**: `uv run pytest tests/test_users.py -k patch` passes; quickstart curl step 4 changes only the budget limit

### Tests for User Story 4

- [X] T017 [US4] Append to `backend/tests/test_users.py`: `test_patch_only_budget_limit` (other fields unchanged, response is full profile); `test_patch_ignores_email_id_password` (keys ignored, 200, values unchanged); `test_patch_validation` parametrised over `monthly_budget_limit=-1`, `budget_start_day=0`, `budget_start_day=29`, `name=""` → 422; `test_patch_empty_body_returns_unchanged_profile` (`{}` → 200); `test_patch_telegram_null_unlinks_and_empty_string_treated_as_null`; `test_patch_telegram_conflict` (second user sets first user's chat id → 409)

### Implementation for User Story 4

- [X] T018 [US4] Implement `update_me` in `backend/api/v1/users.py`: `@router.patch("/", response_model=UserOut)`; `data = body.model_dump(exclude_unset=True)`; `setattr` each key on the current user; `db.commit` inside `try`, on `IntegrityError` rollback and raise 409 `{"detail": "Telegram chat id already linked to another account"}`; `db.refresh` and return (depends on T016)

**Checkpoint**: US1-US4 green

---

## Phase 7: User Story 5 - Delete own account (Priority: P3)

**Goal**: `DELETE /api/v1/user/` physically removes the user; the token stops working; the email can be reused

**Independent Test**: `uv run pytest tests/test_users.py -k delete` passes; quickstart curl step 6 returns 204 then 401

### Tests for User Story 5

- [X] T019 [US5] Append to `backend/tests/test_users.py`: `test_delete_me` (204 with empty body), `test_token_invalid_after_delete` (GET /user/ → 401), `test_email_reusable_after_delete` (register same email → 201), `test_delete_unauthenticated` (401)

### Implementation for User Story 5

- [X] T020 [US5] Implement `delete_me` in `backend/api/v1/users.py`: `@router.delete("/", status_code=204, response_class=Response)`; `await db.delete(user)`, `db.commit`, `logger.info("user deleted id=%s", user.id)`, return `Response(status_code=204)` (depends on T018)

**Checkpoint**: All five stories green

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full validation, final cleanup

- [X] T021 [P] Update `backend/README.md` with the setup, run and test commands from `specs/006-user-auth/quickstart.md` and the one-time database reset note
- [X] T022 [P] Remove the placeholder root route and title from `backend/main.py` if still present; keep `GET /` returning `{"status": "ok"}` as a health check
- [X] T023 Run `uv run pytest -q` (all green) and the quickstart.md curl smoke test against a local Postgres; run the quickstart.md performance snippet and record the measured p95 in the PR description (must be < 500 ms, NFR-001)
- [X] T024 [P] Create `.github/workflows/backend-ci.yml` triggered on `pull_request` to `develop` and `push` to `develop` with paths `backend/**`: checkout, `astral-sh/setup-uv@v6`, `uv sync` and `uv run pytest -q` with `working-directory: backend` and env `SECRET_KEY: ci-secret` (constitution: CI gates must pass before merge)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Phase 1; blocks every story
- **US1 → US2 → US3 → US4 → US5**: sequential. US2 needs US1 (login needs a registered user), US3-US5 need US2 (fixtures log in), and each pair shares a source file and a test file
- **Polish (Phase 8)**: after US5

### Parallel Opportunities

- Phase 1: T002 and T003 in parallel after T001
- Phase 2: T005, T006, T007 in parallel after T004; then T008, T009; then T010
- Phase 8: T021, T022 and T024 in parallel
- Stories themselves are not parallel in this feature (shared files, one developer)

---

## Parallel Example: Foundational Phase

```bash
# After T004 lands, run these three together (three different files, no shared state):
Task: "Create backend/core/security.py ..."           # T005
Task: "Rewrite User in backend/models/user.py ..."    # T006
Task: "Create backend/schemas/user.py ..."            # T007
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1 and Phase 2
2. US1 (register) then US2 (login) — together they are the smallest demo the frontend login page can use
3. **STOP and VALIDATE**: `uv run pytest tests/test_auth.py` green, curl steps 1-2 and 5 work
4. Open the PR to `develop` as draft if the team wants early contract feedback

### Incremental Delivery

1. US3 (GET profile) unblocks Yare's dashboard greeting
2. US4 (PATCH) unblocks the profile page
3. US5 (DELETE) completes the profile page
4. Phase 8, then `/speckit-converge`, then `/git-change-publisher` to `develop`

---

## Notes

- Never log or return `hashed_password`, a plaintext password or a token (FR-004, NFR-005)
- Email is normalised with `strip().lower()` on every read and write (R7)
- Error bodies are FastAPI defaults only (FR-015); do not add an error envelope
- Schema is created by `create_all` on startup; developers with a placeholder-era local DB drop it once (R6)
- Cascade on delete is declared by the categories/transactions features on their FKs, not here (FR-012)
- Commit after each phase with a Conventional Commit and no AI attribution

---

## Phase 9: Convergence

- [X] T025 CRITICAL: add linting and a dependency security scan to `.github/workflows/backend-ci.yml` (`uvx ruff check .` and `uvx pip-audit` run from `backend/`), fixing any lint findings in `backend/` so the job passes, per Constitution Development Workflow "CI quality gates (tests, linting, security scans)" (partial)
- [X] T026 Align `specs/006-user-auth/contracts/user-auth.openapi.yaml` `UserCreate.telegram_chat_id` with the implemented behaviour: an empty string is normalised to null on register as well as on update (drop `minLength: 1` for the null-able variant and state the rule in the property description), per FR-010 and `schemas/user.py` (partial)
- [X] T027 Record the 32-character minimum for `SECRET_KEY` in `specs/006-user-auth/spec.md` NFR-003, matching `core/config.py`, per NFR-003 (unrequested)
