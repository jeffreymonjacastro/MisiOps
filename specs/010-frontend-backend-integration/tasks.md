# Tasks: Frontend-Backend Integration

**Feature**: `specs/010-frontend-backend-integration/spec.md` · **Plan**: [plan.md](./plan.md)
**Created**: 2026-09-18

Dependency-ordered. `[P]` marks tasks that can run in parallel with the previous one.

## Phase 1 — Client foundation

- [ ] **T001** Add `frontend/.env.example` documenting `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).
- [ ] **T002** Create `app/lib/api.ts`: base-URL resolution, JSON request helper, bearer attachment, and normalization of `{detail: string}` and `{detail: [{loc,msg,type}]}` into `{status, message, fieldErrors}`. Distinguish a network failure from an HTTP error. *(FR-002, FR-013)*
- [ ] **T003** Unit-test `api.ts` error normalization: string detail, validation array → field map, network failure, non-JSON body. *(NFR-005)*
- [ ] **T004** Create `app/lib/auth.ts`: token read/write/clear in `localStorage` via a `useSyncExternalStore` external store; `login`, `register` (register → login chain), `logout`. *(FR-001, FR-004, plan decision 3-4)*
- [ ] **T005** Unit-test `auth.ts`: token round-trip, clear on logout, storage unavailable, and the 401 path clearing the session exactly once. *(FR-005, NFR-005)*
- [ ] **T006** Create `app/lib/use-async.ts`: `{data, error, loading, reload}` with cancellation on unmount, calling `setState` only from callbacks (never synchronously in the effect body). *(FR-010, plan decision 2)*
- [ ] **T007** Rewrite `app/lib/types.ts` to the server's shapes: numeric ids, `category` object on a transaction, `budget: number | null`, summary and page envelopes. *(plan decision 5)*
- [ ] **T008** Create `app/lib/resources.ts`: typed calls for categories (list/create/update/delete), transactions (list with `type`/`category_id`/`limit`/`offset`, create, update, delete), summary, and `getMe`.
- [ ] **T009** Unit-test `resources.ts` query-string building (filters omitted when unset, limit/offset bounds) and request payload shaping (no `user_id`, no `source`). *(api checklist, NFR-005)*

## Phase 2 — Auth surface

- [ ] **T010** Create `app/components/async-state.tsx`: shared loading, error-with-retry, and empty presentations, with `role="status"`/`role="alert"` so states are announced. *(FR-010, NFR-004)*
- [ ] **T011** Create `app/login/page.tsx`: login and register in one screen, per-field errors, distinct message for bad credentials vs. duplicate e-mail. *(US1 AS2-AS4)*
- [ ] **T012** Create `app/components/auth-guard.tsx`: redirect to `/login` when no session; validate the stored token with `GET /user/` on first load. *(FR-003)*
- [ ] **T013** Update `app/components/app-shell.tsx`: hide nav when signed out, show the signed-in account and a logout control. *(FR-004)*

## Phase 3 — Screens on real data

- [ ] **T014** Rewrite `app/categorias/page.tsx` against the API, surfacing 409 refusals (delete/type-change) with the server's text and 422 duplicate-name on the field. *(US4, FR-006)*
- [ ] **T015** Update `app/components/transaction-form.tsx`: categories from the API, submit to the API, server field errors, typed values preserved on failure. *(US2 AS1/AS6, FR-011, FR-013)*
- [ ] **T016** Rewrite `app/movimientos/page.tsx`: server-side pagination (`limit`/`offset`) and server-side `type`/`category_id` filters; delete via the API. *(US2 AS3-AS5, FR-008)*
- [ ] **T017** Update `app/movimientos/[id]/page.tsx` to load and save one transaction through the API. *(US2 AS5)*
- [ ] **T018** Rewrite `app/page.tsx` (dashboard) to render the summary endpoint's totals, `remaining_budget` and `by_category`, computing nothing locally. *(US3, FR-009)*

## Phase 4 — Remove the local ledger

- [ ] **T019** Delete `ledger-store.ts`, `storage.ts`, `categories.ts`, `summary.ts`, `budgets.ts`, `sample-data.ts`, `components/sample-data-button.tsx` and their tests; reduce `transactions.ts` to form validation and `query.ts` to display helpers. *(FR-012)*
- [ ] **T020** Verify no ledger data is left in browser storage after logout. *(SC-006, security checklist)*

## Phase 5 — Verification

- [ ] **T021** `npm test`, `npm run lint`, `npm run build` all green. *(Constitution I, II)*
- [ ] **T022** Against the live container: register an account, create a category, record income and expenses, and confirm the dashboard totals match the listed transactions to the cent. *(SC-002)*
- [ ] **T023** Prove the data is server-side: query Postgres directly and match the rows the UI shows; reload in a fresh browser profile and see the same data. *(SC-001, evidence for the PR)*
- [ ] **T024** Confirm isolation: a second account sees none of the first account's rows. *(SC-003)*
- [ ] **T025** Stop the backend and confirm every screen shows an error state with retry, never an empty state. *(SC-004, US5 AS2)*
- [ ] **T026** Run `/speckit-converge` to audit the built code against this spec and append anything missing. *(Pipeline step 12)*
- [ ] **T027** Publish with `/git-change-publisher`; PR body filled from `.github/pull_request_template.md`, targeting `develop`. *(Pipeline step 13, AGENTS.md PR Creation rule)*

## Traceability

| Requirement | Tasks |
| --- | --- |
| FR-001, FR-004 | T004, T011, T013 |
| FR-002, FR-013 | T002, T003, T015 |
| FR-003, FR-005 | T005, T012 |
| FR-006 | T014 |
| FR-007 | T008, T015, T017 |
| FR-008 | T008, T016 |
| FR-009 | T018 |
| FR-010, FR-011 | T006, T010, T015 |
| FR-012 | T019, T020 |
| NFR-005 | T003, T005, T009, T021 |
| SC-001..SC-006 | T020, T022, T023, T024, T025 |

## Phase 6: Convergence

Appended by `/speckit-converge` on 2026-09-18 after the implement pass.

- [ ] **T028** CRITICAL: restore unit coverage for the modules that survived the rewrite — `money.ts` (`parseAmount`, `validateAmount`) and `transactions.ts` (`validateDraft`, `draftFrom`) — whose tests were deleted alongside the local-ledger modules per Constitution II (contradicts)
- [ ] **T029** Handle 401 centrally in `api.ts` so a rejected token clears the session and returns to login from any call, not only the auth guard's `getMe`, per FR-005 (partial)
- [ ] **T030** Page history with `offset` instead of growing `limit`, so a history longer than the server's 100-row cap stays reachable, per FR-008 (partial)
- [ ] **T031** Resolve the transaction on the edit route without scanning the first 100 rows, so an older movement is editable, per US2/AC5 (partial)
- [ ] **T032** Build `transaction_date` from the local day rather than appending `T00:00:00Z`, so "today" is not a future instant for users in UTC+ timezones, per specs/008-transactions edge case (partial)
- [ ] **T033** Add unit coverage for `query.ts` (`groupByDay`, `formatDay`) lost with `query.test.ts`, per Constitution II (contradicts)
