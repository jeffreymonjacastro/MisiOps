# Research: User Authentication & Profile

All Technical Context items were resolvable from the repo, the constitution and current FastAPI documentation (checked via Context7 on 2026-09-16: `fastapi.tiangolo.com/tutorial/security/oauth2-jwt`, `/advanced/async-tests`). No NEEDS CLARIFICATION remain.

## R1. Password hashing library

- **Decision**: `pwdlib[argon2]`, `PasswordHash.recommended()` (argon2id).
- **Rationale**: It is what the current FastAPI security tutorial uses. Argon2id satisfies NFR-002. `pwdlib` has a maintained API and exposes `hash()` / `verify()` only, which is all we need.
- **Alternatives considered**: `passlib[bcrypt]` (unmaintained, breaks with bcrypt ≥ 4.1); raw `bcrypt` (fine, but pwdlib gives argon2 with the same two calls and tracks parameter defaults for us).

## R2. JWT library and token shape

- **Decision**: `pyjwt`, HS256, payload `{"sub": "<user id>", "exp": <utc>}`, lifetime from `ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440 = 24 h, FR-007).
- **Rationale**: FastAPI docs standard. HS256 needs no key pair; a single `SECRET_KEY` from env satisfies NFR-003. `sub` = numeric id keeps the token valid across name changes and lets the dependency do a primary-key lookup.
- **Alternatives considered**: `python-jose` (less maintained); RS256 (no second party needs to verify tokens); opaque server-side sessions (spec assumes stateless).

## R3. Bearer extraction: `HTTPBearer` vs `OAuth2PasswordBearer`

- **Decision**: `fastapi.security.HTTPBearer(auto_error=False)` in `api/deps.py`, returning 401 + `WWW-Authenticate: Bearer` for every failure case.
- **Rationale**: Clarification Q1 fixed login as a JSON body, so the OAuth2 password-flow form that `OAuth2PasswordBearer` advertises in Swagger would be misleading. `HTTPBearer` only reads the `Authorization` header, which is exactly FR-008. `auto_error=False` lets us return one uniform 401 message instead of the default 403 for a missing header.
- **Alternatives considered**: `OAuth2PasswordBearer(tokenUrl=...)` (Swagger's Authorize button would post a form our login rejects); custom header parsing (reinvents the helper).

## R4. Test database strategy

- **Decision**: In-memory SQLite through `aiosqlite`, engine created per test function, `Base.metadata.create_all`, `app.dependency_overrides[get_db]`. httpx `AsyncClient(transport=ASGITransport(app=app))`, `@pytest.mark.anyio`, `anyio_backend` fixture pinned to `asyncio`.
- **Rationale**: Zero external services for `pytest` and CI, per constitution Testing Standards. Everything this feature uses (Integer, String, Numeric, DateTime, unique indexes) behaves the same on both engines.
- **Alternatives considered**: `testcontainers` Postgres (real engine parity, but Docker-in-CI setup cost is not justified by one table); shared dev Postgres (tests would not be hermetic).
- **Known ceiling** (`ponytail:`): later features that rely on `ON DELETE CASCADE` must add `PRAGMA foreign_keys=ON` on SQLite connections or move to a Postgres test container. Documented here so the categories feature picks it up.

## R5. Lifespan in tests

- **Decision**: Tests do not run the app lifespan. The test fixture creates tables itself.
- **Rationale**: FastAPI docs note `AsyncClient` does not trigger lifespan; the only lifespan work is `create_all` on the real engine, which tests must not touch.
- **Alternatives considered**: `asgi-lifespan` `LifespanManager` (extra dependency for behaviour we deliberately bypass).

## R6. Migrations

- **Decision**: Keep `create_all` at startup for this feature.
- **Rationale**: There is no deployed database yet; the placeholder `users` table has never held real data. Alembic adds files, a config and a workflow the team has not agreed on.
- **Alternatives considered**: Alembic now (deferred until a shared environment exists). Cost of deferral: each dev drops their local DB once after this feature lands (documented in `quickstart.md`).

## R7. Email normalisation and uniqueness

- **Decision**: `email` is validated with Pydantic `EmailStr` (needs `email-validator`), then `.strip().lower()` before any query or insert. Plain `UNIQUE` index on the column.
- **Rationale**: Spec edge case requires case-insensitive matching. Normalising on write is one line and works on SQLite and Postgres; `citext` or a functional index would be Postgres-only and break R4.
- **Alternatives considered**: Postgres `citext`; `LOWER(email)` functional index.

## R8. CORS

- **Decision**: `CORSMiddleware` with `allow_origins=settings.CORS_ORIGINS` (list, default `["http://localhost:3000"]`), `allow_credentials=True`, all methods and headers.
- **Rationale**: The Next.js dev server runs on a different origin; without CORS no frontend feature can exercise these endpoints. It is global API plumbing that has to land with the first real endpoints.
- **Alternatives considered**: Next.js rewrites/proxy (frontend-side decision, does not remove the need on the API when deployed separately).

## R9. Logging (NFR-005)

- **Decision**: stdlib `logging`, `logger = logging.getLogger("misiops.auth")`; `warning` on failed login with the submitted email, `info` on registration and deletion with the user id. Never log password, hash or token.
- **Rationale**: Meets NFR-005 with no dependency.
- **Alternatives considered**: structlog (not needed at this scale).
