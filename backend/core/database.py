from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
# expire_on_commit=False: async sessions cannot lazy-load expired attributes after commit
SessionLocal = async_sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    async with SessionLocal() as session:
        yield session
