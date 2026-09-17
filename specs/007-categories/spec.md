# Feature Specification: Categories

**Feature Branch**: `feature/categories`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Backend: category/ GET (list my categories), category/ POST (create custom category), category/{category_id} PATCH (update), category/{category_id} DELETE. All require bearer token. Base path api/v1/. Stack: FastAPI, Python, Postgres."

## Clarifications

### Session 2026-09-16

- Q: In which language are default categories seeded? → A: Spanish. Expense: Comida, Transporte, Vivienda, Salud, Entretenimiento, Compras, Otros. Income: Sueldo, Otros.
- Q: Who implements the transaction-dependent guards (no type change, no delete when transactions exist)? → A: The transactions feature. This feature ships without those guards; transactions adds FR-006 and FR-008 with their tests when it creates the foreign key.
- Q: What shape does the category list response have? → A: A plain JSON array of category objects, ordered by type then name (case-insensitive). No pagination, no wrapper object.
- Q: Is a category name unique per user, or per user and type? → A: Per user and type (case-insensitive). Required so the default "Otros" can exist for both expense and income.
- Q: What does a category `budget` mean? → A: A spending cap per user budget period (the period defined by the user's `budget_start_day`), consistent with `monthly_budget_limit`. This feature only stores it; the transactions summary compares it against spending.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List my categories (Priority: P1)

A logged-in user retrieves the categories they can classify transactions with, so the transaction form can populate its dropdown.

**Why this priority**: The transaction form and filters cannot work without a category list. It is also the simplest endpoint to deliver value with.

**Independent Test**: Log in as a user with known categories, call the list endpoint, and verify only that user's categories are returned.

**Acceptance Scenarios**:

1. **Given** a new user, **When** they list categories, **Then** they receive the default set of categories seeded at registration (see FR-002).
2. **Given** a user who created custom categories, **When** they list categories, **Then** defaults and custom ones are returned together, ordered by type then name.
3. **Given** two different users, **When** each lists categories, **Then** neither sees the other's custom categories.
4. **Given** a request without a valid token, **When** listing categories, **Then** it is rejected as unauthenticated.

---

### User Story 2 - Create a custom category (Priority: P1)

A logged-in user creates a category with a name, a type (income or expense) and an optional budget.

**Why this priority**: Custom categories are the core of personalisation; without them users are stuck with defaults.

**Independent Test**: Create a category, then list categories and confirm it appears with the given attributes.

**Acceptance Scenarios**:

1. **Given** a valid token, **When** the user creates a category "Gym" of type expense with budget 150, **Then** it is created, returned with its new id, and belongs only to that user.
2. **Given** the user already has an expense category named "Gym", **When** they create another expense "gym" (case-insensitive match), **Then** creation is rejected with a conflict message. An income category named "Gym" is allowed.
3. **Given** a name that is empty or longer than 50 characters, or a type other than income/expense, or a negative budget, **When** submitted, **Then** it is rejected with a validation message naming the field.
4. **Given** a category created without a budget, **When** it is returned, **Then** its budget is null (meaning "no budget set").

---

### User Story 3 - Update a category (Priority: P2)

A logged-in user renames a category or changes its budget or type.

**Why this priority**: Editing is convenient but the user can work around it by creating a new category.

**Independent Test**: Update the budget of an existing category and confirm the change on the next list.

**Acceptance Scenarios**:

1. **Given** a category owned by the user, **When** they send a partial update with a new budget, **Then** only the budget changes and the updated category is returned.
2. **Given** a category id owned by another user or that does not exist, **When** the user tries to update it, **Then** the response is "not found" (never revealing another user's data).
3. **Given** an update whose new name duplicates another of the user's categories, **When** submitted, **Then** it is rejected with a conflict message.
4. **Given** a category with existing transactions, **When** its type is changed, **Then** the change is rejected with a message explaining that categories with transactions cannot change type.

---

### User Story 4 - Delete a category (Priority: P2)

A logged-in user removes a category they no longer use.

**Why this priority**: Keeps the list tidy; not required for core tracking.

**Independent Test**: Delete an unused category and confirm it no longer appears in the list.

**Acceptance Scenarios**:

1. **Given** a category with no transactions, **When** the user deletes it, **Then** it is removed and a success confirmation is returned.
2. **Given** a category that has transactions, **When** the user deletes it, **Then** deletion is rejected with a message stating how many transactions still use it.
3. **Given** a category id owned by another user or that does not exist, **When** the user tries to delete it, **Then** the response is "not found".

---

### Edge Cases

- Category names are trimmed of surrounding whitespace before validation and uniqueness checks.
- Uniqueness is per user and type: two different users can both have "Gym", and one user can have "Otros" as both an expense and an income category.
- The default categories seeded at registration are ordinary rows owned by the user; they can be renamed or deleted like any other.
- A non-numeric or negative `category_id` in the path is rejected as a validation error, not a server error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let an authenticated user list all categories they own, returned as a plain JSON array of category objects ordered by `type` then `name` (case-insensitive), without pagination or a wrapper object.
- **FR-002**: When a user account is created, the system MUST seed a default category set for that user: expense: Comida, Transporte, Vivienda, Salud, Entretenimiento, Compras, Otros; income: Sueldo, Otros (Spanish, the users' language; names are data, not code).
- **FR-003**: System MUST let an authenticated user create a category with `name` (1-50 characters), `type` (`income` or `expense`) and optional `budget` (decimal ≥ 0, 2 decimals, null = no budget). `budget` is a spending cap per user budget period (defined by `budget_start_day`); this feature stores it and the transactions summary applies it.
- **FR-004**: Category names MUST be unique per user and type, compared case-insensitively after trimming. The same name may exist once as an expense and once as an income category (e.g. the default "Otros").
- **FR-005**: System MUST let the owner partially update `name`, `type` and `budget` of a category.
- **FR-006**: System MUST reject a type change on a category that has one or more transactions. Implemented by the transactions feature, which owns the transactions table; until then type changes are unconditional.
- **FR-007**: System MUST let the owner delete a category that has no transactions.
- **FR-008**: System MUST reject deletion of a category that has transactions and report the count of blocking transactions. Implemented by the transactions feature; until then deletion is unconditional.
- **FR-009**: Any access to a category not owned by the caller MUST return "not found", identical to a non-existent id.
- **FR-010**: All endpoints MUST live under `api/v1/category` and require a bearer token.

### Non-Functional Requirements

- **NFR-001**: Listing categories responds in under 200 ms at the 95th percentile for users with up to 200 categories.
- **NFR-002**: Ownership MUST be enforced in every query, never only in the API layer, so a bug in one endpoint cannot leak another user's data.
- **NFR-003**: Every functional requirement MUST be covered by automated tests, per the constitution's Testing Standards.

### Key Entities *(include if feature involves data)*

- **Category**: A user-owned label for classifying transactions. Attributes: id, user_id (owner), name, type (income | expense), budget (optional decimal, cap per budget period). Referenced by Transactions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a category and see it in the transaction form dropdown in under 30 seconds.
- **SC-002**: 100% of cross-user category accesses return "not found".
- **SC-003**: 0 transactions are ever left pointing at a deleted category.
- **SC-004**: Automated tests cover list, create (success, duplicate, validation), update (success, type-change block, not-found) and delete (success, blocked, not-found).

## Assumptions

- Default categories are seeded per user at registration (implemented in the user-auth feature's registration flow, or as a hook the categories feature provides). Seeding is preferred over global shared categories so the schema stays as in the constitution (every category has a `user_id`).
- Categories are not soft-deleted; blocking deletion when transactions exist is enough protection.
- FR-006 and FR-008 depend on the transactions table and are delivered by the transactions feature so this feature is mergeable on its own.
- `type` on a category constrains which transactions may use it: an expense transaction must use an expense category. That rule is enforced in the transactions feature.
- The planning document's "UPDATE/PATCH" is implemented as PATCH (partial update).

## Out of Scope

- Global or system-wide categories shared by all users.
- Category icons, colours or ordering preferences.
- Reassigning transactions to another category as part of deletion.
- Per-category spending reports (belongs to the transactions summary).
