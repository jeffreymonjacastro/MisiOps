# Data Model: User Authentication & Profile

Source of truth for the schema: `.specify/memory/constitution.md` ERD, plus `hashed_password` (spec Assumptions).

## Entity: User (`users` table)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, autoincrement | JWT `sub` |
| `name` | varchar(100) | NOT NULL | stripped |
| `email` | varchar(255) | NOT NULL, UNIQUE | stored lower-cased and stripped (R7) |
| `hashed_password` | varchar(255) | NOT NULL | argon2id string, never serialised |
| `telegram_chat_id` | varchar(64) | UNIQUE, NULL | NULLs do not collide |
| `monthly_budget_limit` | numeric(12,2) | NOT NULL, default 0 | 0 = no limit (FR-013); ≥ 0 (FR-011) |
| `budget_start_day` | smallint | NOT NULL, default 1 | 1 ≤ x ≤ 28 (FR-011) |
| `created_at` | timestamp with tz | NOT NULL, default now() (server side) | |

Relationships: owns Categories, Transactions, Bot Interactions (declared by those features with `ondelete="CASCADE"` on their `user_id` FK). No relationship attributes are declared in this feature.

### Delta versus current `backend/models/user.py`

Current model has only `id`, `email`, `hashed_password`. This feature adds `name`, `telegram_chat_id`, `monthly_budget_limit`, `budget_start_day`, `created_at` and the unique index on `telegram_chat_id`. Existing local databases created from the placeholder must be dropped once (R6).

## Validation rules (Pydantic schemas, `backend/schemas/user.py`)

| Schema | Fields | Rules |
|---|---|---|
| `UserCreate` (register body) | `name`, `email`, `password`, `telegram_chat_id?` | `name` 1-100 chars after strip; `email` `EmailStr`; `password` min 8 chars (FR-003); `telegram_chat_id` 1-64 chars or omitted |
| `UserLogin` | `email`, `password` | `EmailStr`; password non-empty |
| `UserUpdate` (PATCH body) | `name?`, `telegram_chat_id?`, `monthly_budget_limit?`, `budget_start_day?` | all optional, `exclude_unset` applied; limit ≥ 0 with 2 decimals; day 1-28; unknown keys ignored (`extra="ignore"`, FR-010) |
| `UserOut` | `id`, `name`, `email`, `telegram_chat_id`, `monthly_budget_limit`, `budget_start_day`, `created_at` | `from_attributes=True`; never includes `hashed_password` (FR-009) |
| `Token` | `access_token`, `token_type="bearer"` | |

## Access token (not stored)

| Claim | Value |
|---|---|
| `sub` | `str(user.id)` |
| `exp` | issue time + `ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440) |

Algorithm HS256, key `SECRET_KEY` from env.

## State transitions

User has no state machine. Lifecycle: created (register) → updated (patch, any number of times) → deleted (physical delete, FR-012). A deleted id is never reused for authentication because the `sub` lookup fails → 401.
