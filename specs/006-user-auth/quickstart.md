# Quickstart: User Authentication & Profile

Validation guide. Contract: [contracts/user-auth.openapi.yaml](contracts/user-auth.openapi.yaml). Schema: [data-model.md](data-model.md).

## Prerequisites

- Python 3.13 and `uv`
- Docker (for a local Postgres) or a reachable Postgres 16
- Repo on branch `feature/user-auth`

## Setup

```bash
cd backend
uv sync                                   # installs runtime + dev deps from uv.lock
cp .env.example .env                      # then set SECRET_KEY
python3 -c 'import secrets; print(secrets.token_hex(32))'   # paste as SECRET_KEY

# Local Postgres (skip if you already have one)
docker run -d --name misiops-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db -p 5432:5432 postgres:16

# If you had a database from the placeholder model, drop it once (schema changed, no migrations yet)
docker exec misiops-db psql -U postgres -c 'DROP DATABASE app_db;' -c 'CREATE DATABASE app_db;'
```

`.env.example` keys: `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES=1440`, `CORS_ORIGINS=["http://localhost:3000"]`.

## Run

```bash
cd backend
uv run uvicorn main:app --reload
# Swagger: http://localhost:8000/docs
```

## Automated tests (primary validation)

```bash
cd backend
uv run pytest -q
```

Expected: all green, no Postgres needed (tests use in-memory SQLite). Test matrix, one test per row minimum:

| Test | Covers |
|---|---|
| register ok returns 201 + profile without password | FR-001, FR-009, FR-013 |
| register duplicate email (different case) → 409 | FR-002, edge case |
| register duplicate telegram_chat_id → 409 | FR-002 |
| register short password / bad email → 422 | FR-003 |
| login ok → 200 token; token works on GET /user/ | FR-005, FR-008 |
| login wrong password and unknown email → same 401 body | FR-006 |
| expired token → 401 | FR-007 |
| missing header, `Basic` scheme, tampered token → 401 | edge cases |
| GET /user/ returns exact field set | FR-009 |
| PATCH only budget limit changes only that field | FR-010 |
| PATCH ignores email/id/password keys | FR-010 |
| PATCH negative limit / day 0 / day 29 → 422 | FR-011 |
| PATCH telegram id owned by other user → 409 | US4 scenario 4 |
| DELETE → 204; old token → 401; same email registers again | FR-012, US5 |
| failed login logs a warning without the password | NFR-005 |

## Manual smoke test (curl)

```bash
API=http://localhost:8000/api/v1

# 1. Register → 201, body has id/name/email, no password
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"Ana@Example.com","password":"secret123"}'

# 2. Login (lower-case email also works) → 200 {"access_token": "...", "token_type": "bearer"}
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"secret123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# 3. Profile → 200
curl -s $API/user/ -H "Authorization: Bearer $TOKEN"

# 4. Partial update → 200, only monthly_budget_limit changed
curl -s -X PATCH $API/user/ -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"monthly_budget_limit": 2000}'

# 5. Wrong password → 401 {"detail":"Invalid credentials"}
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"nope"}'

# 6. Delete → 204, then profile → 401
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/user/ -H "Authorization: Bearer $TOKEN"
curl -s $API/user/ -H "Authorization: Bearer $TOKEN"
```

## Performance check (NFR-001, optional)

```bash
# 10 concurrent logins, 100 requests; p95 must be < 500 ms
uv run python -c "
import asyncio, time, httpx
async def one(c):
    t=time.perf_counter(); await c.post('http://localhost:8000/api/v1/auth/login', json={'email':'ana@example.com','password':'secret123'}); return time.perf_counter()-t
async def main():
    async with httpx.AsyncClient() as c:
        ts=[]
        for _ in range(10): ts += await asyncio.gather(*[one(c) for _ in range(10)])
    ts.sort(); print('p95 ms', round(ts[int(len(ts)*0.95)-1]*1000))
asyncio.run(main())"
```
