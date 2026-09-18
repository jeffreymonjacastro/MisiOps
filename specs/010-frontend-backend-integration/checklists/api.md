# API Integration Checklist: Frontend-Backend Integration

**Purpose**: Verify the client consumes the upstream contracts exactly as specified
**Created**: 2026-09-18
**Feature**: [spec.md](../spec.md) · **Contracts**: 006-user-auth, 007-categories, 008-transactions

## Contract conformance

- [ ] Every request goes to a path under `/api/v1/` built by the client module, never hand-written in a screen
- [ ] `POST /auth/register` is treated as returning **no token**; a login call follows it
- [ ] `POST /auth/login` reads `access_token` and sends it as `Authorization: Bearer <token>`
- [ ] `GET /user/` is used to validate a stored token and to read `monthly_budget_limit`
- [ ] Category calls use the trailing-slash collection path (`/category/`) as the contract defines it
- [ ] `GET /transactions` sends `limit` within 1..100 and `offset` ≥ 0, never values the server rejects
- [ ] `type` and `category_id` filters are sent as query parameters, not applied client-side
- [ ] The list renders `items` and uses `total` for paging decisions, not `items.length`
- [ ] Each row reads the embedded `category` object rather than making a second request
- [ ] The dashboard reads `total_income`, `total_expense`, `balance`, `remaining_budget` and `by_category` from the summary and recomputes none of them
- [ ] `remaining_budget: null` (limit is 0) renders as "no limit set", not as 0
- [ ] `transaction_date` is sent in a format the contract accepts and rendered in the user's locale

## Error handling

- [ ] 401 clears the session and routes to login exactly once (no retry loop)
- [ ] 403/404 render as "not found" without revealing whether the row belongs to someone else
- [ ] 409 on category delete/type-change shows the server's `detail` text verbatim to the user
- [ ] 422 `detail[]` is mapped to per-field messages via the last string in each `loc`
- [ ] A network failure (server unreachable) is distinguished from a 4xx and offers retry
- [ ] No response body is assumed to be JSON before the status is checked

## Payload hygiene

- [ ] `user_id` is never sent in a query or body; identity comes only from the token
- [ ] `source` is never set by the client; the server assigns `manual`
- [ ] Amounts are parsed once at submit and sent as numbers, not strings
- [ ] Empty optional fields are omitted or sent as null per the contract, not as `""`
