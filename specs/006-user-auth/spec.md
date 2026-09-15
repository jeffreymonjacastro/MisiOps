# Feature Specification: User Authentication & Profile

**Feature Branch**: `feature/user-auth`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Backend: auth/register, auth/login returning a bearer token; user/ GET (own profile), user/ PATCH (update profile), user/ DELETE (delete account). All under base path api/v1/. Stack: FastAPI, Python, Postgres."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register an account (Priority: P1)

A new visitor creates a MisiOps account with their name, email and password so they can start tracking their money.

**Why this priority**: Nothing else in the product works without an account. This is the entry point for every other feature.

**Independent Test**: Submit a registration with valid data and confirm the account exists and can be used to log in.

**Acceptance Scenarios**:

1. **Given** no account exists for `ana@example.com`, **When** Ana registers with name, that email and a valid password, **Then** the account is created and she receives a success confirmation.
2. **Given** an account already exists for `ana@example.com`, **When** someone registers again with that email, **Then** registration is rejected with a conflict message and no second account is created.
3. **Given** a registration with a malformed email or a password shorter than 8 characters, **When** submitted, **Then** it is rejected with a validation message naming the invalid field.
4. **Given** a registration that includes an optional Telegram chat id, **When** submitted, **Then** the id is stored with the account so the bot can later link messages to this user.

---

### User Story 2 - Log in and obtain an access token (Priority: P1)

A registered user logs in with email and password and receives a bearer access token that the frontend stores and sends on every private request.

**Why this priority**: Every private endpoint (profile, categories, transactions) needs a way to identify the caller. Login is the only way to obtain that identity.

**Independent Test**: Log in with valid credentials, receive a token, and use it to call the profile endpoint successfully.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they log in with the correct email and password, **Then** they receive an access token and its type ("bearer").
2. **Given** a registered user, **When** they log in with a wrong password, **Then** login is rejected with an "invalid credentials" message and no token is issued.
3. **Given** an email that is not registered, **When** someone tries to log in, **Then** the response is the same "invalid credentials" message (no hint about whether the email exists).
4. **Given** a valid token, **When** it is sent on a private endpoint after its expiry time, **Then** the request is rejected as unauthenticated.

---

### User Story 3 - View own profile (Priority: P2)

A logged-in user retrieves their own profile (name, email, budget settings, Telegram link) so the dashboard can greet them and show their settings.

**Why this priority**: The dashboard and profile page depend on it, but it is read-only and lower risk than auth itself.

**Independent Test**: Call the profile endpoint with a valid token and verify the returned fields match the registered data.

**Acceptance Scenarios**:

1. **Given** a valid bearer token, **When** the user requests their profile, **Then** they receive their id, name, email, Telegram chat id, monthly budget limit, budget start day and creation date. The password (or any hash of it) is never returned.
2. **Given** no token or an invalid token, **When** the profile is requested, **Then** the request is rejected as unauthenticated.

---

### User Story 4 - Update own profile (Priority: P2)

A logged-in user updates editable fields of their profile: name, monthly budget limit, budget start day, Telegram chat id.

**Why this priority**: Needed by the profile page, but users can operate the app with defaults until they change them.

**Independent Test**: Send a partial update with a new budget limit, then read the profile back and confirm only that field changed.

**Acceptance Scenarios**:

1. **Given** a valid token, **When** the user sends a partial update containing only `monthly_budget_limit`, **Then** that field is updated, all other fields are unchanged, and the updated profile is returned.
2. **Given** an update with a negative budget limit or a budget start day outside 1-28, **When** submitted, **Then** it is rejected with a validation message.
3. **Given** an update trying to change `email`, `id` or `password`, **When** submitted, **Then** those fields are ignored (email and password changes are out of scope for this feature).
4. **Given** an update with a Telegram chat id already linked to another account, **When** submitted, **Then** it is rejected with a conflict message.

---

### User Story 5 - Delete own account (Priority: P3)

A logged-in user permanently deletes their account and all data attached to it.

**Why this priority**: Required for the profile page and for basic data ownership, but least frequently used.

**Independent Test**: Delete the account, then verify the old token is rejected and the email can be registered again.

**Acceptance Scenarios**:

1. **Given** a valid token, **When** the user deletes their account, **Then** the account and all of its categories, transactions and bot interactions are removed and a success confirmation is returned.
2. **Given** an account that was just deleted, **When** its previous token is used on any private endpoint, **Then** the request is rejected as unauthenticated.
3. **Given** an account that was just deleted, **When** someone registers with the same email, **Then** registration succeeds as a brand-new account.

---

### Edge Cases

- Email comparison is case-insensitive: `Ana@Example.com` and `ana@example.com` are the same account.
- Leading/trailing whitespace in email and name is trimmed before validation.
- Token sent with a wrong scheme (e.g. `Basic`), missing `Bearer` prefix, or tampered signature is rejected as unauthenticated, never as a server error.
- Two concurrent registrations with the same email: exactly one succeeds; the other receives the conflict message.
- Deleting an account while another request from the same user is in flight: the in-flight request may succeed or be rejected, but must never leave orphaned data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a visitor to register with `name`, `email`, `password` and optional `telegram_chat_id`.
- **FR-002**: System MUST reject registration when the email is already in use (case-insensitive) or the Telegram chat id is already linked to another account.
- **FR-003**: System MUST validate that `email` is a well-formed email address and `password` has at least 8 characters.
- **FR-004**: System MUST store passwords only as a salted one-way hash. Plaintext passwords MUST never be persisted or logged.
- **FR-005**: System MUST allow a registered user to log in with `email` + `password` and receive a bearer access token plus its token type.
- **FR-006**: Login failures MUST return a single generic "invalid credentials" message regardless of whether the email exists.
- **FR-007**: Access tokens MUST expire. Default lifetime: 24 hours. Expired or invalid tokens MUST be rejected as unauthenticated.
- **FR-008**: Every private endpoint (profile, and by extension categories and transactions) MUST identify the caller exclusively from the bearer token. Clients MUST NOT be able to act on another user's data by passing a different user id.
- **FR-009**: System MUST return the authenticated user's profile: `id`, `name`, `email`, `telegram_chat_id`, `monthly_budget_limit`, `budget_start_day`, `created_at`. Password hashes MUST never be returned.
- **FR-010**: System MUST allow partial updates of `name`, `telegram_chat_id`, `monthly_budget_limit` and `budget_start_day`. Omitted fields are unchanged. Other fields in the payload are ignored.
- **FR-011**: `monthly_budget_limit` MUST be zero or positive. `budget_start_day` MUST be an integer between 1 and 28 (so every month has that day).
- **FR-012**: System MUST allow the authenticated user to delete their own account. Deletion MUST cascade to the user's categories, transactions and bot interactions.
- **FR-013**: New accounts MUST start with `monthly_budget_limit = 0` (meaning "no limit set") and `budget_start_day = 1`.
- **FR-014**: All endpoints MUST live under the `api/v1/` base path and use JSON request/response bodies.

### Non-Functional Requirements

- **NFR-001**: Login and registration respond in under 500 ms at the 95th percentile under normal load (password hashing cost is the dominant factor and is tuned accordingly).
- **NFR-002**: Password hashing MUST use a purpose-built, slow algorithm (bcrypt or argon2 class). MD5/SHA-only hashing is not acceptable.
- **NFR-003**: The token signing secret MUST come from environment configuration, never from source code.
- **NFR-004**: Every functional requirement MUST be covered by automated tests, per the constitution's Testing Standards.

### Key Entities *(include if feature involves data)*

- **User**: A person with a MisiOps account. Attributes: id, name, email (unique), hashed password, telegram_chat_id (unique, optional), monthly_budget_limit, budget_start_day, created_at. Owns Categories, Transactions and Bot Interactions.
- **Access Token**: A signed, time-limited credential issued at login that identifies one User. Not stored server-side.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can register and log in in under 1 minute end to end.
- **SC-002**: 100% of requests to private endpoints without a valid token are rejected.
- **SC-003**: 0 plaintext passwords or password hashes appear in any API response or log line.
- **SC-004**: After account deletion, 0 rows owned by that user remain in any table.
- **SC-005**: Automated tests cover registration, login (success and failure), profile read, partial update and deletion.

## Assumptions

- The database schema in `.specify/memory/constitution.md` is the source of truth. It has `monthly_budget_limit` and `budget_start_day`. The planning document's `daily_budget_limit` is treated as a naming slip for `monthly_budget_limit`. The frontend should use the constitution's field names.
- The schema in the constitution omits a password column. The existing `User` model already has `hashed_password`. This spec adds it to the schema as required.
- Registration takes `name`, not a separate `user`/username field. Email is the login identifier.
- Token-based stateless auth is used (no server-side sessions, no refresh tokens, no logout endpoint). The frontend "logs out" by discarding the token.
- Changing email or password after registration is out of scope for this feature.
- The Telegram bot and Gmail scraping are separate future features. This feature only stores `telegram_chat_id`.
- Success responses use HTTP 200 for login and 201 for registration; the planning document's "status = 200" is read as "success".

## Out of Scope

- Password reset / forgot-password flow.
- Email verification on registration.
- Changing email or password.
- Refresh tokens, logout endpoint, token revocation lists.
- Third-party login (Google, GitHub, etc.).
- Admin roles or any permission model beyond "a user owns their own data".
- Rate limiting and account lockout after failed logins (recommended for a later hardening feature).
