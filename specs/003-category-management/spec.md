# Feature Specification: Category Management

**Feature Branch**: `[003-category-management]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Let a logged-in user view, create, rename and remove the categories used to classify their manually entered transactions (feature 001), each category having a name and a type (income or expense), matching the CATEGORIES entity in constitution.md's data schema. New users should start with a sensible set of default categories so they can log transactions immediately without first having to set up categories. Inspired by the category chips/lists seen in Monarch Money, Copilot and Kuanto, but scoped only to naming/typing categories for manual transactions (no per-category budget amounts, no icons/color picker requirement, no shared/family categories)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start logging with default categories already in place (Priority: P1)

A brand-new user signs up and, without doing any setup, is able to log their first transaction because a small set of common categories (e.g. Groceries, Transportation, Salary) already exists on their account.

**Why this priority**: This unblocks feature 001 (manual transaction entry) for first-time users; without it, entry is blocked on a setup step the user didn't ask for.

**Independent Test**: Can be fully tested by creating a new user account and confirming a non-empty list of categories, covering both income and expense types, exists before any category is manually created.

**Acceptance Scenarios**:

1. **Given** a newly created user account, **When** the user opens the transaction form or category list for the first time, **Then** they already have at least one income category and several expense categories available.
2. **Given** the default categories, **When** the user inspects them, **Then** each one is clearly labeled with its type (income or expense).

---

### User Story 2 - Add a category that fits my life (Priority: P1)

The default categories don't cover everything (e.g. "Pet care", "Side hustle income"), so the user creates a new category with a name and a type.

**Why this priority**: Personalization is core to the value proposition (tracking "where money actually goes" per the constitution's problem statement); without custom categories, entry is forced into a poor fit.

**Independent Test**: Can be fully tested by creating a category with a chosen name and type and confirming it becomes selectable when logging a transaction of that type.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a category with a name and a type, **Then** the category appears in their category list and becomes available in the transaction form for that type.
2. **Given** a user, **When** they try to create a category with a name identical to one they already have for the same type, **Then** the system blocks it and explains the name is already in use.
3. **Given** a user, **When** they submit a category with no name, **Then** the system blocks submission with a clear error.

---

### User Story 3 - Clean up categories I don't use (Priority: P3)

A user renames a category to better reflect its purpose, or removes one they no longer use.

**Why this priority**: Useful hygiene, but the app remains fully usable with an imperfect category list (P1/P2 already deliver the core value), so this is the smallest slice.

**Independent Test**: Can be fully tested by renaming a category and confirming existing transactions using it show the new name, and by deleting an unused category and confirming it no longer appears as a selectable option.

**Acceptance Scenarios**:

1. **Given** an existing category, **When** the user renames it, **Then** all transactions previously classified under it now display the new name.
2. **Given** a category with no transactions using it, **When** the user deletes it, **Then** it no longer appears in the category list or transaction form.
3. **Given** a category that already has transactions using it, **When** the user attempts to delete it, **Then** the system asks for confirmation and clearly explains what will happen to those transactions before proceeding.

---

### Edge Cases

- What happens when a user deletes a category that is used by existing transactions? The system MUST NOT silently orphan or delete those transactions; it MUST require confirmation and reassign them to a fallback "Uncategorized" category of the matching type (or block deletion until the user reassigns them — see Assumptions for the chosen default).
- What happens when a user tries to change a category's type after it has transactions? The system MUST prevent changing type once transactions exist under that category, to avoid income/expense mismatches, and MUST explain why.
- What happens if a user has zero categories left after deleting (e.g. removed all defaults)? The system MUST still guarantee at least a system-provided "Uncategorized" fallback exists per type so transaction entry is never fully blocked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provision each new user account with a default set of categories covering both income and expense types before the user creates any category themselves.
- **FR-002**: The system MUST let a logged-in user view all of their categories, grouped or labeled by type (income/expense).
- **FR-003**: The system MUST let a logged-in user create a new category with a required name and a required type.
- **FR-004**: The system MUST prevent two categories of the same type from having the same name for the same user (case-insensitive).
- **FR-005**: The system MUST let a logged-in user rename an existing category they own.
- **FR-006**: The system MUST prevent changing a category's type once it has at least one transaction classified under it.
- **FR-007**: The system MUST let a logged-in user delete a category they own, with an explicit confirmation step when the category has existing transactions.
- **FR-008**: The system MUST reassign transactions from a deleted category to a fallback "Uncategorized" category of the matching type rather than leaving them without a category.
- **FR-009**: The system MUST only expose a user's own categories to that user, never another user's categories.

### Non-Functional Requirements

- **NFR-001**: Category list, create, rename and delete actions must complete and reflect in the UI in under 1.5 seconds under normal conditions.
- **NFR-002**: Category management MUST be usable on both desktop and mobile-width screens, consistent with the rest of the application (Constitution Principle III).
- **NFR-003**: Destructive actions (delete) MUST require an explicit confirmation step and MUST be operable via keyboard and readable by screen readers.

### Key Entities

- **Category**: A named grouping with a type (income/expense), owned by one user, used to classify Transactions (see `specs/001-manual-transaction-entry`). A category may optionally represent the system-provided default or fallback "Uncategorized" category per type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can log their first transaction (feature 001) without ever visiting a category-setup screen, because usable defaults already exist.
- **SC-002**: A user can create a new custom category in under 20 seconds.
- **SC-003**: 100% of attempts to delete a category with existing transactions surface an explicit confirmation before any data changes.
- **SC-004**: 0% of transactions become uncategorized-and-unlabeled (invisible) after any category rename or delete action.

## Assumptions

- Categories are private per user (no shared/family/team categories), consistent with the single-user schema in `constitution.md` (no shared-category entity is defined there).
- Default categories are a fixed starter set chosen by the product (exact names/count are a content decision for `/speckit-plan`, not this spec) and are themselves regular categories the user can rename or delete.
- Deleting a category reassigns its transactions to an "Uncategorized" fallback of the same type rather than blocking deletion outright, favoring a low-friction cleanup experience over forcing manual reassignment first.
- Category budgets/limits (the `budget` field on the CATEGORIES entity and `monthly_budget_limit` on USERS in `constitution.md`) are intentionally excluded here and covered separately, if pursued, by `specs/005-category-budget-limits`.

## Out of Scope

- Per-category budget amounts or spending limits are not included (see `specs/005-category-budget-limits`).
- Custom icons or color pickers per category are not included; categories are name + type only for this iteration.
- Shared or family/multi-user categories are not included.
- Bulk category import/merge tools are not included.
