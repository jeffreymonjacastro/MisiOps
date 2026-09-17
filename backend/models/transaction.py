from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import relationship

from core.database import Base
from models.category import Category


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # No ondelete: NO ACTION refuses deleting a category with transactions but is checked at the
    # end of the statement, so a user delete can still cascade through both tables.
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(10), nullable=False)
    source = Column(String(10), nullable=False, server_default="manual")
    description = Column(String(255), nullable=True)
    transaction_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    category = relationship(Category, lazy="joined")

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
        CheckConstraint("type IN ('income', 'expense')", name="ck_transactions_type"),
        CheckConstraint("source IN ('manual', 'telegram', 'gmail')", name="ck_transactions_source"),
        Index("ix_transactions_user_date", "user_id", "transaction_date", "id"),
        Index("ix_transactions_user_category", "user_id", "category_id"),
    )
