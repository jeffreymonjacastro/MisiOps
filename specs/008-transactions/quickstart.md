# Quickstart: Transactions

Contract: [contracts/transactions.openapi.yaml](contracts/transactions.openapi.yaml). Schema: [data-model.md](data-model.md). Setup and run as in `specs/006-user-auth/quickstart.md`. Schema changed: drop the local database once.

## Automated tests (primary validation)

```bash
cd backend && uv run pytest -q
```

Test matrix for `tests/test_transactions.py` (plus guard tests appended to `tests/test_categories.py`):

| Test | Covers |
|---|---|
| create expense ok → 201, source manual, date defaults to now, nested category | FR-001, FR-003, FR-007, US1 |
| create with date-only string stored as that day; with aware datetime converted to UTC | Q2, FR-001 |
| create type/category mismatch → 422 string detail | FR-002 |
| create with amount 0, negative, > 1e9, 3 decimals, description 256 chars, future date → 422 | FR-001, edge cases |
| create with another user's or unknown category → 404 | FR-001, FR-013 |
| list default page: 12 rows, limit 5 → 5 newest, total 12, offset 0; offset 10 → 2 | FR-004, FR-006, US2 |
| list filters type and category_id with AND; unknown type → 422; foreign category_id → empty, total 0 | FR-005, edge cases |
| list limit 0, 101, offset -1 → 422 | US2 scenario 4 |
| list isolation: two users; user_id query param ignored | FR-014, US2 scenario 5 |
| summary default period: totals 1500/300/1200, breakdown both types with budget | FR-008, US3 |
| summary period with budget_start_day 15 on the 20th → 15th to 14th; on the 10th → previous 15th to the 14th | FR-009 |
| summary remaining_budget with limit 2000 → 1700; limit 0 → null | FR-008 |
| summary explicit from/to; from > to → 422; only one of them → 422 | FR-010, edge case |
| summary with no transactions → zeros and empty breakdown | US3 scenario 5 |
| summary totals equal the sum of listed rows to the cent (0.10 + 0.20 = 0.30) | SC-002, NFR-003 |
| patch amount only; patch category to mismatching type → 422; patch type and category together → 200 | FR-011 |
| patch/delete other user's or unknown id → 404; id 0 → 422 | FR-013 |
| delete → 204; summary totals drop | FR-012, US5 |
| category PATCH type with transactions → 409 `Category has N transactions`; without → 200 | FR-015 |
| category DELETE with transactions → 409 with count; after deleting them → 204 | FR-015 |
| user delete cascades transactions | user-auth FR-012 |

## Manual smoke test (curl)

```bash
API=http://localhost:8000/api/v1; J='Content-Type: application/json'
curl -s -X POST $API/auth/register -H "$J" -d '{"name":"Ana","email":"ana@example.com","password":"secret123"}' >/dev/null
TOKEN=$(curl -s -X POST $API/auth/login -H "$J" -d '{"email":"ana@example.com","password":"secret123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
A="Authorization: Bearer $TOKEN"
COMIDA=$(curl -s $API/category/ -H "$A" | python3 -c 'import sys,json; print(next(c["id"] for c in json.load(sys.stdin) if c["name"]=="Comida"))')
SUELDO=$(curl -s $API/category/ -H "$A" | python3 -c 'import sys,json; print(next(c["id"] for c in json.load(sys.stdin) if c["name"]=="Sueldo"))')

curl -s -X POST $API/transactions -H "$A" -H "$J" -d "{\"amount\":25.5,\"type\":\"expense\",\"category_id\":$COMIDA,\"description\":\"Almuerzo\"}"          # 201
curl -s -X POST $API/transactions -H "$A" -H "$J" -d "{\"amount\":1500,\"type\":\"income\",\"category_id\":$SUELDO,\"transaction_date\":\"$(date -u +%F)\"}"  # 201
curl -s -X POST $API/transactions -H "$A" -H "$J" -d "{\"amount\":10,\"type\":\"income\",\"category_id\":$COMIDA}"                                            # 422 mismatch
curl -s "$API/transactions?limit=5" -H "$A"                                                                                                                  # page, total 2
curl -s "$API/transactions?type=expense" -H "$A"                                                                                                             # total 1
curl -s $API/transactions/summary -H "$A"                                                                                                                    # 1500 / 25.5 / 1474.5
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/category/$COMIDA -H "$A"                                                                             # 409
curl -s -X DELETE $API/category/$COMIDA -H "$A"                                                                                                              # {"detail":"Category has 1 transactions"}
```
