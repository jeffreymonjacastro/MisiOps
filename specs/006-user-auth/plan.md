# Implementation Plan: User Authentication & Profile

**Branch**: `feature/user-auth` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-user-auth/spec.md`

## Summary

Add registration, JSON login issuing a 24-hour HS256 JWT, and bearer-protected read/patch/delete of the caller's own profile under `api/v1/`. Implementation extends the existing flat `backend/` layout with one router per resource, Pydantic schemas, a `security.py` helper (PyJWT + pwdlib/argon2) and a `get_current_user` dependency. Tests run with pytest + httpx `ASGITransport` against an in-memory SQLite database through a dependency override, so CI needs no Postgres.

## Technical Context

**Language/Version**: Python 3.13 (`backend/.python-version`), package manager `uv`

**Primary Dependencies**: FastAPI ≥ 0.141, SQLAlchemy 2.x async + asyncpg (already present), pydantic-settings (present). New: `pyjwt`, `pwdlib[argon2]`, `email-validator`. Dev: `pytest`, `anyio`, `httpx`, `aiosqlite`.

**Storage**: PostgreSQL (`users` table). Tests: SQLite in-memory via `aiosqlite`.

**Testing**: pytest with `@pytest.mark.anyio`, httpx `AsyncClient(transport=ASGITransport(app=app))`, `app.dependency_overrides[get_db]`.

**Target Platform**: Linux server (uvicorn). Local dev on macOS.

**Project Type**: web-service (backend half of the monorepo)

**Performance Goals**: NFR-001: login and register p95 < 500 ms with 10 concurrent logins. Argon2id default parameters from `pwdlib` (~50-100 ms per hash) leave headroom.

**Constraints**: Token secret only from env (NFR-003). No plaintext or hash in responses/logs (FR-004, NFR-005). Error shape is FastAPI default `{"detail": ...}` (FR-015). No custom service/repository layers.

**Scale/Scope**: 5 endpoints, 1 table, single-digit users during the course project. No horizontal scaling concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Code Quality | No abstraction without a second consumer. Routers call SQLAlchemy directly; no service/repository layers. | PASS |
| II. Testing Standards | Every FR has at least one automated test; tests run without external services. | PASS (see `quickstart.md` test matrix) |
| III. UX Consistency | One error shape, one base path, one auth mechanism reused by later features. | PASS (FR-014, FR-015, `get_current_user`) |
| IV. Performance | Latency target stated and measurable; hashing cost bounded. | PASS (NFR-001, argon2 defaults) |
| Additional: security & maintainability | Secret from env, argon2id, unique constraints at DB level, dependencies pinned by `uv.lock`. | PASS |
| Development Workflow | Feature branch `feature/user-auth`, PR to `develop`. | PASS |

Post-design re-check (after Phase 1): unchanged, PASS. No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-user-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── user-auth.openapi.yaml
├── evaluations/eval-report.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
backend/
├── main.py                  # app factory, lifespan, CORS, include api router
├── core/
│   ├── config.py            # + SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES, CORS_ORIGINS
│   ├── database.py          # echo=False (echo logs SQL parameters, i.e. password hashes: FR-004, NFR-005)
│   └── security.py          # hash/verify password, create/decode token
├── models/
│   └── user.py              # extended User model
├── schemas/
│   └── user.py              # UserCreate, UserLogin, UserUpdate, UserOut, Token
├── api/
│   ├── deps.py              # get_current_user (HTTPBearer)
│   └── v1/
│       ├── router.py        # APIRouter(prefix="/api/v1"), includes auth + users
│       ├── auth.py          # POST /auth/register, POST /auth/login
│       └── users.py         # GET/PATCH/DELETE /user/
├── api/, api/v1/, schemas/ each get an empty __init__.py
├── tests/
│   ├── conftest.py          # sqlite engine, get_db override, client fixture, env
│   ├── test_auth.py
│   └── test_users.py
├── .env.example
└── pyproject.toml           # + deps, [tool.pytest.ini_options]

.github/workflows/backend-ci.yml   # uv sync + pytest on PRs to develop (constitution CI gate)
```

**Structure Decision**: Keep the existing flat layout (`core/`, `models/`, `main.py`) and add `schemas/`, `api/` and `tests/` beside them. The `fastapi-templates` skill's `services/` and `repositories/` layers are skipped: five endpoints with one table do not need them, and the constitution's Code Quality principle asks that complexity be justified.

## Complexity Tracking

No constitution violations. Table intentionally empty.

## Implementation notes carried into tasks

- Email is lower-cased and stripped before every read and write; uniqueness is a plain unique index on the stored value (no `citext`, works on SQLite and Postgres).
- `telegram_chat_id` is a nullable unique string; multiple NULLs are allowed by both engines.
- Registration catches `IntegrityError` from the unique indexes and returns 409, which also covers the concurrent-registration edge case.
- Login runs `verify` against a dummy hash when the email is unknown so both failure paths take the same time (FR-006).
- `get_current_user` uses `HTTPBearer(auto_error=False)` and answers 401 with `WWW-Authenticate: Bearer` for a missing header, wrong scheme, bad signature, expired token or a `sub` that no longer exists (covers deleted-account scenario).
- `DELETE /user/` returns 204 No Content. The team doc's "status = 200" is read as "success".
- Schema is still created with `Base.metadata.create_all` at startup. `ponytail:` existing dev databases created from the placeholder model must be dropped once; Alembic is added when the first shared environment exists.
- CORS: `CORSMiddleware` with `CORS_ORIGINS` (default `http://localhost:3000`) so the Next.js dev server can call the API. Without it no frontend feature can be tested end-to-end.
- Cascade on delete (FR-012) is declared by the features that create child tables (`ondelete="CASCADE"` on their FKs). This feature deletes the single `users` row.
