# Data Model: Categories

Source of truth: `.specify/memory/constitution.md` ERD (`CATEGORIES {id, user_id, name, type, budget}`).

## Entity: Category (`categories` table)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, autoincrement | |
| `user_id` | integer | NOT NULL, FK `users.id` ON DELETE CASCADE, indexed | owner |
| `name` | varchar(50) | NOT NULL | stored trimmed, as typed |
| `type` | varchar(10) | NOT NULL, CHECK in (`income`, `expense`) | |
| `budget` | numeric(12,2) | NULL | null = no budget; ≥ 0 |

Indexes: `ix_categories_user_id` on `user_id`; unique `ix_categories_user_type_lower_name` on `(user_id, type, lower(name))`.

Relationships: belongs to one User. Referenced by Transactions (FK added by the transactions feature).

## Default set (seeded per user at registration)

| type | name |
|---|---|
| expense | Comida, Transporte, Vivienda, Salud, Entretenimiento, Compras, Otros |
| income | Sueldo, Otros |

Nine rows, `budget` null. They are ordinary rows: editable and deletable like any other.

## Validation rules (`backend/schemas/category.py`)

| Schema | Fields | Rules |
|---|---|---|
| `CategoryCreate` | `name`, `type`, `budget?` | `name` 1-50 after strip; `type` literal `income` \| `expense`; `budget` Decimal ≥ 0, 2 decimal places, or null |
| `CategoryUpdate` | `name?`, `type?`, `budget?` | all optional, `exclude_unset`; `budget: null` clears; empty body accepted |
| `CategoryOut` | `id`, `name`, `type`, `budget` | `from_attributes`; `budget: float \| None` |

## State transitions

None. Created → updated (any number of times) → deleted (physical). Deleting the owning user deletes all their categories through the FK cascade.
