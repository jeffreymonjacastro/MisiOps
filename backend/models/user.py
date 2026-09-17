from sqlalchemy import Column, DateTime, Integer, Numeric, SmallInteger, String, func

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)  # stored lower-cased
    hashed_password = Column(String(255), nullable=False)
    telegram_chat_id = Column(String(64), unique=True, nullable=True)
    monthly_budget_limit = Column(Numeric(12, 2), nullable=False, server_default="0")
    budget_start_day = Column(SmallInteger, nullable=False, server_default="1")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
