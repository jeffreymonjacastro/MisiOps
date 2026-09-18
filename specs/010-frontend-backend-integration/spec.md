# Feature Specification: Frontend-Backend Integration

**Feature Branch**: `feature/frontend-backend-integration`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Connect the existing Next.js frontend to the FastAPI backend, replacing the browser-local (localStorage) ledger with the real API defined in specs/006-user-auth, specs/007-categories and specs/008-transactions. Scope: authentication UI, categories via API, transactions via API with server-side pagination and filters, dashboard via the summary endpoint, and loading/error states for every screen. The localStorage ledger and the dev-only sample-data button are removed."

## Clarifications

### Session 2026-09-18

- Q: Where is the bearer token kept between page loads? → A: `localStorage`, read by the client at request time. The app is a static client-side Next.js app with no server session; cookie-based storage would require a backend-for-frontend that does not exist. Recorded as a known trade-off in Assumptions.
- Q: What happens to data a user already entered in the old browser-local ledger? → A: It is discarded, not migrated. The old ledger was dev-only sample data with no real users; migrating it would require inventing an ownership mapping.
- Q: Does the user's own profile (`monthly_budget_limit`, `budget_start_day`) become editable in this feature? → A: No. It is read and displayed where the summary needs it, but profile editing is out of scope and left to a later feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and see my own data (Priority: P1)

A person opens the app, creates an account or logs in, and from then on every screen shows the data stored on the server for that account — not whatever happened to be in this browser.

**Why this priority**: Every other endpoint requires a bearer token. Without this, nothing else in the feature can work, and the product cannot have more than one user per browser.

**Independent Test**: Register a new account, log in, and confirm the app shows an empty but working dashboard tied to that account; log in from a different browser and see the same data.

**Acceptance Scenarios**:

1. **Given** a visitor with no session, **When** they open any app screen, **Then** they are sent to the login screen instead of seeing someone else's or empty data.
2. **Given** a visitor on the login screen, **When** they register with an e-mail and password, **Then** an account is created, they are signed in, and they land on the dashboard.
3. **Given** a registered user, **When** they log in with correct credentials, **Then** they reach the dashboard and their categories and transactions are their own.
4. **Given** a user with wrong credentials, **When** they submit, **Then** they see a clear "e-mail or password is incorrect" message and stay on the login screen.
5. **Given** a signed-in user, **When** they log out, **Then** the stored session is cleared and returning to any screen sends them back to login.
6. **Given** a signed-in user whose session has expired, **When** any screen loads data, **Then** they are returned to the login screen with a message explaining the session ended, rather than seeing a raw error.

---

### User Story 2 - Record and review real transactions (Priority: P1)

A signed-in user records an income or expense and sees it in their history, with the data surviving a refresh, a different browser, and a different device.

**Why this priority**: This is the product's core loop and the whole point of connecting to a server.

**Independent Test**: Create a transaction, hard-refresh, and confirm it is still listed; open the app in a second browser signed in as the same user and see the same row.

**Acceptance Scenarios**:

1. **Given** a signed-in user with at least one category, **When** they submit a valid transaction, **Then** it is stored on the server and appears in their history without a manual refresh.
2. **Given** a stored transaction, **When** the user reloads the page or opens the app elsewhere, **Then** the transaction is still there.
3. **Given** the history list, **When** the user filters by type or category, **Then** the filtering is done by the server and the list and its total reflect the filter.
4. **Given** a user with more transactions than one page, **When** they ask for more, **Then** the next page is fetched from the server rather than all rows being loaded at once.
5. **Given** a transaction the user edits or deletes, **When** the change is saved, **Then** the server copy changes and the history and dashboard both reflect it.
6. **Given** the server rejects a transaction (for example a category whose type does not match), **When** the user submits, **Then** the message explaining why is shown on the form and the typed values are kept.

---

### User Story 3 - See a dashboard computed from server data (Priority: P1)

A signed-in user sees totals, remaining budget and a per-category breakdown for their current budget period, computed by the server rather than by the browser.

**Why this priority**: The dashboard is the product's headline view, and its numbers must agree with the server's own totals — a browser-side recomputation is exactly how the two drift apart.

**Independent Test**: Create known incomes and expenses, open the dashboard, and confirm the totals match the sum of the listed transactions to the cent.

**Acceptance Scenarios**:

1. **Given** a user with transactions in the current period, **When** they open the dashboard, **Then** total income, total expenses and balance come from the server's summary and match the listed transactions to the cent.
2. **Given** a user with a monthly budget limit set, **When** they open the dashboard, **Then** the remaining budget is shown as reported by the server.
3. **Given** a user with categories that have budgets, **When** they open the dashboard, **Then** the per-category breakdown shows the server's rows, ordered as the server returns them, including categories of both types that had movements.
4. **Given** a user with no transactions in the period, **When** they open the dashboard, **Then** they see a zeroed starter state, not an error.

---

### User Story 4 - Manage categories against the server (Priority: P2)

A signed-in user creates, renames and deletes categories, and is told clearly when the server refuses because the category is in use.

**Why this priority**: Categories are required before a transaction can be recorded, but the seeded defaults already make the app usable, so refinement ranks below the core loop.

**Independent Test**: Create a category, use it on a transaction, then attempt to delete it and confirm the refusal message names the number of transactions.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the categories screen, **Then** they see the categories stored on the server for their account.
2. **Given** a new category name, **When** they create it, **Then** it is stored on the server and becomes available when recording a transaction.
3. **Given** a category that has transactions, **When** the user tries to delete it, **Then** the server's refusal is shown as a readable message stating how many transactions block it, and the category stays.
4. **Given** a category that has transactions, **When** the user tries to change its type, **Then** the same kind of refusal is shown and the type is unchanged.
5. **Given** a duplicate category name, **When** the user submits it, **Then** the server's rejection is shown on the form.

---

### User Story 5 - Know what the app is doing (Priority: P2)

Because data now travels over a network, every screen tells the user when it is loading, when something failed, and what they can do about it.

**Why this priority**: Without it, a slow or failed request looks identical to "you have no data", which is the most damaging confusion in a money-tracking app.

**Independent Test**: Stop the backend, open each screen, and confirm each shows a distinguishable error state with a retry, never an empty state implying the data is gone.

**Acceptance Scenarios**:

1. **Given** a screen whose data is still loading, **When** the user looks at it, **Then** it shows a loading state distinct from both the empty state and the error state.
2. **Given** the server is unreachable, **When** a screen tries to load, **Then** the user sees an error explaining the app could not reach the server, with a way to retry, and never an empty state that implies their data is gone.
3. **Given** a failed write (create, edit or delete), **When** it fails, **Then** the user is told it failed, and the app does not show the change as if it had succeeded.

---

### Edge Cases

- What happens when the token is present but rejected by the server (expired or revoked)? The app MUST clear the stored session and send the user to login with an explanatory message, not retry in a loop.
- What happens when the user has zero categories and tries to record a transaction? The form MUST direct them to create a category first rather than submitting something the server will reject.
- What happens when a category is deleted in another tab and the user then submits a transaction using it? The server's "not found" MUST surface as a readable message and the category list MUST refresh.
- What happens when the server returns a validation error for a field the form does not show? The message MUST still be surfaced rather than swallowed.
- What happens when a page of history is requested beyond the last one? The list MUST show no additional rows and MUST NOT present a control that fetches nothing.
- What happens when two screens request the same data at once? The user MUST NOT see contradictory numbers on the same screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a visitor register an account and log in, and MUST keep the resulting session across page reloads within the same browser.
- **FR-002**: The system MUST attach the caller's session credential to every request it makes to the server.
- **FR-003**: The system MUST redirect a visitor without a valid session to the login screen from every data-bearing screen, and MUST NOT render another account's data.
- **FR-004**: The system MUST let a signed-in user log out, clearing the stored session.
- **FR-005**: The system MUST treat a rejected session as a logout: clear it, inform the user, and return them to login without a retry loop.
- **FR-006**: The system MUST read and write categories through the server, and MUST show the server's refusals (duplicate name, type change blocked, deletion blocked) as readable messages naming the reason.
- **FR-007**: The system MUST create, list, update and delete transactions through the server.
- **FR-008**: The system MUST request history one page at a time from the server, and MUST apply type and category filters server-side rather than filtering a locally held set.
- **FR-009**: The system MUST source dashboard totals, remaining budget and the per-category breakdown from the server's summary rather than recomputing them in the browser.
- **FR-010**: The system MUST show, on every data-bearing screen, states that distinguish loading, empty, and failed, and MUST offer a retry on failure.
- **FR-011**: The system MUST preserve the user's typed input when a write fails, so nothing is lost to a network error.
- **FR-012**: The system MUST NOT persist ledger data in the browser; the server is the only source of truth for categories and transactions.
- **FR-013**: The system MUST surface server validation messages on the form field they concern where the server identifies one, and at form level otherwise.

### Non-Functional Requirements

- **NFR-001**: A signed-in user reaching the dashboard MUST see their real totals within 3 seconds on a normal connection.
- **NFR-002**: The stored session credential MUST NOT be written to application logs or included in any URL.
- **NFR-003**: Every screen MUST remain usable at mobile width and operable by keyboard, consistent with the rest of the application (Constitution Principle III).
- **NFR-004**: Loading and error states MUST be announced to assistive technology, not conveyed by visual change alone.
- **NFR-005**: The behaviour introduced here MUST be covered by automated tests, per the constitution's Testing Standards.

### Key Entities *(include if feature involves data)*

- **Session**: Proof that requests belong to a given account, obtained at login and presented on every later request. Held per browser; not shared between users or devices.
- **Category** and **Transaction**: As defined by `specs/007-categories` and `specs/008-transactions`. This feature consumes them; it does not define or extend them.
- **Summary**: The server-computed totals for a budget period, as defined by `specs/008-transactions`. Read-only to this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A transaction recorded on one device is visible to the same account on a different device 100% of the time.
- **SC-002**: Dashboard totals match the sum of that period's listed transactions to the cent, 100% of the time.
- **SC-003**: No screen ever displays another account's categories or transactions.
- **SC-004**: With the server unreachable, 100% of data-bearing screens show an error state rather than an empty state.
- **SC-005**: A new visitor can go from the login screen to a recorded first transaction in under 3 minutes.
- **SC-006**: No categories or transactions remain readable in browser storage after logout.

## Assumptions

- The backend of `specs/006-user-auth`, `specs/007-categories` and `specs/008-transactions` is already implemented and reachable; this feature consumes it and changes no server behaviour.
- The session credential is kept in browser storage, read at request time. This is a deliberate trade-off: the app is a client-side application with no server session layer, so the alternative (an HTTP-only cookie) would require a backend-for-frontend that does not exist. It carries a known exposure to script injection and is recorded here so a later feature can revisit it.
- Data previously held in the browser-local ledger is discarded, not migrated. It was dev-only sample data with no real owner.
- New accounts get whatever default categories the server provides; the frontend no longer seeds any.
- The user's profile fields (monthly budget limit, budget period start day) are read where the summary needs them but are not editable in this feature.
- A single implied currency, matching the backend.

## Out of Scope

- Any change to backend behaviour, schema or endpoints.
- Password reset, e-mail verification, and third-party or social login.
- Editing the user profile (budget limit, period start day) or deleting the account from the UI.
- Migrating previously stored browser-local data into an account.
- Offline support, background sync, or optimistic updates that survive a failed write.
- The Telegram/NLP chatbot entry path described in the constitution; this feature covers the manual UI only.
- Multi-currency, attachments, and transaction export.
