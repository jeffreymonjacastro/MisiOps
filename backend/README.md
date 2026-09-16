# MisiOps Backend

FastAPI + SQLAlchemy (async) + PostgreSQL. Python 3.13, managed with [uv](https://docs.astral.sh/uv/).

## Setup

```bash
cd backend
uv sync
cp .env.example .env
python3 -c 'import secrets; print(secrets.token_hex(32))'   # paste the output as SECRET_KEY in .env
```

`SECRET_KEY` is required and must be at least 32 characters. The app refuses to start without it.

### Local PostgreSQL

```bash
docker run -d --name misiops-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db \
  -p 5432:5432 postgres:16
```

Tables are created automatically on startup (`create_all`). There are no migrations yet, so when the schema changes you must reset your local database once:

```bash
docker exec misiops-db psql -U postgres -c 'DROP DATABASE app_db;' -c 'CREATE DATABASE app_db;'
```

## Run

```bash
uv run uvicorn main:app --reload
```

- API base path: `http://localhost:8000/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- Health check: `GET /` → `{"status": "ok"}`

### Endpoints

| Area | Endpoints | Spec |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` | `specs/006-user-auth` |
| Profile | `GET`, `PATCH`, `DELETE /user/` | `specs/006-user-auth` |
| Categories | `GET`, `POST /category/`, `PATCH`, `DELETE /category/{id}` | `specs/007-categories` |
| Transactions | `GET`, `POST /transactions`, `GET /transactions/summary`, `PATCH`, `DELETE /transactions/{id}` | `specs/008-transactions` |

Transactions are listed newest first with `limit`/`offset` pagination and optional `type` and `category_id` filters. The summary covers the current budget period (from the user's `budget_start_day` to the day before the next one) unless `from`/`to` dates are given, and returns income, expense, balance, remaining budget and a per-category breakdown. A transaction's type must match its category's type. A category that has transactions cannot change type or be deleted (409).

Every new account is seeded with nine default categories in Spanish (Comida, Transporte, Vivienda, Salud, Entretenimiento, Compras, Otros; Sueldo, Otros). They are ordinary rows the user can rename or delete. Category names are unique per user and type, case-insensitive.

## Test

```bash
uv run pytest -q
```

Tests use an in-memory SQLite database; no PostgreSQL needed. The same command runs in CI (`.github/workflows/backend-ci.yml`) on every pull request to `develop`.

## Layout

```text
backend/
├── main.py          # app, CORS, router registration, health check
├── core/            # settings, database engine/session, password hashing + JWT
├── models/          # SQLAlchemy models
├── schemas/         # Pydantic request/response models
├── api/             # deps.py (get_current_user) and v1/ routers
└── tests/
```

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_SERVER` | `localhost` | |
| `POSTGRES_USER` | `postgres` | |
| `POSTGRES_PASSWORD` | `postgres` | |
| `POSTGRES_DB` | `app_db` | |
| `SECRET_KEY` | none | required, ≥ 32 chars, signs access tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | JSON list |

Feature specs live in `../specs/`. Start with `specs/006-user-auth/quickstart.md` for an end-to-end walkthrough of the auth endpoints.
