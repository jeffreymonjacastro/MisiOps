from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, Integer, Numeric, String, func

from core.database import Base

# Seeded per user at registration. Names are user-facing data in the users' language.
DEFAULT_CATEGORIES: list[tuple[str, str]] = [
    ("expense", "Comida"),
    ("expense", "Transporte"),
    ("expense", "Vivienda"),
    ("expense", "Salud"),
    ("expense", "Entretenimiento"),
    ("expense", "Compras"),
    ("expense", "Otros"),
    ("income", "Sueldo"),
    ("income", "Otros"),
]


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(50), nullable=False)  # stored trimmed, as typed
    type = Column(String(10), nullable=False)
    budget = Column(Numeric(12, 2), nullable=True)  # cap per budget period; null = no budget

    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense')", name="ck_categories_type"),
        # unique per user and type, case-insensitive; portable to SQLite and Postgres
        Index(
            "ix_categories_user_type_lower_name", "user_id", "type", func.lower(name), unique=True
        ),
    )


def default_categories(user_id: int) -> list[Category]:
    return [Category(user_id=user_id, type=t, name=n) for t, n in DEFAULT_CATEGORIES]
