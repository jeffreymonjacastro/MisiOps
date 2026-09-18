# Quickstart: Categories

Contract: [contracts/categories.openapi.yaml](contracts/categories.openapi.yaml). Schema: [data-model.md](data-model.md). Setup and run are the same as `specs/006-user-auth/quickstart.md` (`uv sync`, `.env`, local Postgres, `uv run uvicorn main:app --reload`). Schema changed: drop the local database once.

## Automated tests (primary validation)

```bash
cd backend && uv run pytest -q
```

Test matrix for `tests/test_categories.py`:

| Test | Covers |
|---|---|
| new user lists 9 Spanish defaults, ordered by type then name | FR-001, FR-002, US1 |
| two users never see each other's categories | FR-009, NFR-002 |
| list unauthenticated → 401 | FR-010 |
| create ok → 201 with id, owner only; budget null when omitted | FR-003, US2 |
| create duplicate name case-insensitive → 409 | FR-004 |
| create validation: empty name, 51 chars, bad type, negative budget → 422 | FR-003 |
| patch budget only; patch budget null clears; empty body → 200 unchanged | FR-005 |
| patch duplicate name → 409 | FR-004 |
| patch / delete other user's id and unknown id → 404; id 0 → 422 | FR-009, edge case |
| delete unused → 204 and gone from list | FR-007 |
| deleting the user deletes their categories (FK cascade) | user-auth FR-012 |
| default categories are editable and deletable | edge case |

## Manual smoke test (curl)

```bash
API=http://localhost:8000/api/v1; J='Content-Type: application/json'
curl -s -X POST $API/auth/register -H "$J" -d '{"name":"Ana","email":"ana@example.com","password":"secret123"}'
TOKEN=$(curl -s -X POST $API/auth/login -H "$J" -d '{"email":"ana@example.com","password":"secret123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
A="Authorization: Bearer $TOKEN"

curl -s $API/category/ -H "$A"                                   # 9 defaults
curl -s -X POST $API/category/ -H "$A" -H "$J" -d '{"name":"Gimnasio","type":"expense","budget":150}'   # 201
curl -s -X POST $API/category/ -H "$A" -H "$J" -d '{"name":"gimnasio","type":"expense"}'                # 409
curl -s -X PATCH $API/category/10 -H "$A" -H "$J" -d '{"budget":null}'                                  # 200
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/category/10 -H "$A"                             # 204
curl -s $API/category/999 -X DELETE -H "$A"                                                              # 404
```
