# Implementation Plan: Frontend-Backend Integration

**Feature**: `specs/010-frontend-backend-integration/spec.md`
**Branch**: `feature/frontend-backend-integration`
**Created**: 2026-09-18

## Summary

Replace the frontend's browser-local ledger with the already-implemented FastAPI API. Add an auth surface (register, login, logout, route guard), swap every read and write to `api/v1/*`, move pagination/filtering/aggregation to the server, and give every screen explicit loading and error states. No backend change.

## Technical Context

| Item | Value |
| --- | --- |
| Language | TypeScript 5, React 19, Next.js 16 (App Router, client components) |
| Styling | Tailwind v4 with the existing tokens in `app/globals.css` |
| API base | `NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:8000` |
| Auth | Bearer JWT from `POST /api/v1/auth/login`, kept in `localStorage` |
| Testing | `node --import tsx --test` over `app/lib/*.test.ts` (existing harness, no new runner) |
| New dependencies | **None.** A ~40-line fetch wrapper and a small async hook replace a data-fetching library |
| Upstream contracts | `specs/006-user-auth`, `specs/007-categories`, `specs/008-transactions` |

### API surface consumed

| Screen | Call |
| --- | --- |
| Login / register | `POST /api/v1/auth/login` → `{access_token, token_type}`; `POST /api/v1/auth/register` → `UserOut` (**no token**, so register is followed by a login call) |
| Session bootstrap | `GET /api/v1/user/` → `UserOut` (validates the stored token, supplies `monthly_budget_limit`) |
| Categories | `GET/POST /api/v1/category/`, `PATCH/DELETE /api/v1/category/{id}` |
| History | `GET /api/v1/transactions?type=&category_id=&limit=&offset=` → `{items,total,limit,offset}` |
| Entry / edit | `POST /api/v1/transactions`, `PATCH|DELETE /api/v1/transactions/{id}` |
| Dashboard | `GET /api/v1/transactions/summary[?from=&to=]` → totals, `remaining_budget`, `by_category[]` |

### Error contract

`{detail: string}` for 401/403/404/409, and `{detail: [{loc, msg, type}]}` for 422. The client normalizes both into one shape: `{status, message, fieldErrors}` where `fieldErrors` maps a form field name to its message, derived from the last string element of each `loc`.

## Constitution Check

| Principle | How this plan satisfies it |
| --- | --- |
| I. Code Quality | One `api.ts` boundary; screens never build URLs or read tokens themselves. No new dependency. |
| II. Testing (non-negotiable) | Pure modules (`api` error normalization, `auth` token handling, query-string building) unit-tested with the existing runner. Network-dependent screen behaviour verified in-browser against the live container and recorded in the PR. |
| III. UX Consistency | Loading/empty/error furniture is one shared component set reused by all screens; existing visual tokens unchanged. |
| IV. Performance | Pagination and aggregation move server-side (FR-008, FR-009); the browser stops holding the full ledger. |
| Security | Token never in a URL or log (NFR-002). Storage trade-off recorded in the spec's Assumptions. |

## Project Structure

### Documentation (this feature)

```text
specs/010-frontend-backend-integration/
├── spec.md
├── plan.md
├── tasks.md
├── checklists/
│   ├── requirements.md
│   ├── api.md
│   └── security.md
└── evaluations/
    └── eval-report.md
```

### Source Code (repository root)

```text
frontend/app/
├── lib/
│   ├── api.ts              # NEW fetch wrapper: base URL, bearer, error normalization
│   ├── api.test.ts         # NEW
│   ├── auth.ts             # NEW token storage + session state (external store)
│   ├── auth.test.ts        # NEW
│   ├── use-async.ts        # NEW tiny load/error/retry hook
│   ├── resources.ts        # NEW typed calls: categories, transactions, summary
│   ├── resources.test.ts   # NEW query-string + payload shaping
│   ├── types.ts            # CHANGED to the server's shapes (numeric ids, category object)
│   ├── money.ts            # KEPT (formatting only)
│   ├── query.ts            # REDUCED to display helpers; filtering moves server-side
│   ├── ledger-store.ts     # DELETED
│   ├── storage.ts          # DELETED
│   ├── categories.ts       # DELETED (server owns validation and defaults)
│   ├── transactions.ts     # REDUCED to form-level validation only
│   ├── summary.ts          # DELETED (server computes)
│   ├── budgets.ts          # DELETED (budget is a category field; progress comes from summary)
│   └── sample-data.ts      # DELETED
├── components/
│   ├── app-shell.tsx       # CHANGED: adds session/logout, hides nav when signed out
│   ├── async-state.tsx     # NEW loading / error / retry furniture
│   ├── auth-guard.tsx      # NEW redirect when unauthenticated
│   ├── transaction-form.tsx# CHANGED: server categories, server errors
│   └── sample-data-button.tsx # DELETED
├── login/page.tsx          # NEW
├── page.tsx                # CHANGED: dashboard from summary endpoint
├── categorias/page.tsx     # CHANGED
└── movimientos/            # CHANGED (list, nuevo, [id])
```

## Key decisions

1. **No data-fetching library.** `use-async.ts` is a ~40-line hook returning `{data, error, loading, reload}`. React Query would be a dependency for five screens that each make one call.
2. **`setState` in a callback, never in an effect body.** The repo's ESLint forbids the latter (`react-hooks/set-state-in-effect`); the fetch resolution path is a callback, so it passes.
3. **Session as an external store**, reusing the `useSyncExternalStore` pattern already proven in `ledger-store.ts`, so the token is read consistently across components without a provider and without a hydration mismatch.
4. **Register then login.** The contract returns no token on register (006 Clarification Q2), so the UI chains the two calls and reports either failure distinctly.
5. **Ids become numbers.** The server uses integer ids; the local string ids (`cat-…`, `tx-…`) disappear along with the local seed data.
6. **Amounts stay strings in form state** and are parsed once at submit, preserving the existing comma/dot handling while letting the server enforce the 2-decimal rule (422 surfaced on the field).
7. **The 409 guards are user-facing text**, not generic errors: category delete/type-change refusals show the server's `detail`, which names the blocking transaction count.

## Complexity Tracking

| Risk | Mitigation |
| --- | --- |
| Five screens change at once; a regression is easy to miss | Each screen verified in-browser against the live container before the PR, with evidence recorded |
| Deleting six lib modules could strand imports | `npm run build` type-checks the whole app; CI runs it |
| Token expiry mid-session produces a redirect loop | 401 handling clears the session exactly once and routes to `/login`; covered by a unit test on the error path |
| Backend unavailable during development | Error states are a first-class requirement (FR-010), so this is also the manual test for US5 |

## Implementation notes carried into tasks

- `frontend/.env.example` documents `NEXT_PUBLIC_API_BASE_URL`; the compose file already exposes the backend on `:8000` and the backend already allows `http://localhost:3000` via `CORS_ORIGINS`.
- Existing frontend unit tests that assert local-ledger behaviour (`categories.test.ts`, `summary.test.ts`, `budgets.test.ts`, `sample-data.test.ts`, most of `transactions.test.ts`) are deleted with the modules they cover; the surviving assertions move to `resources.test.ts` and `api.test.ts`.
- Specs 001-005 keep their user-facing requirements; only their "persistence is browser-local" assumption is superseded, which this feature's spec records.
