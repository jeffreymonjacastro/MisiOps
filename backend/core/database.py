from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.config import settings
from core.orm import Base as Base

engine = create_async_engine(settings.DATABASE_URL, echo=False, hide_parameters=True)
# expire_on_commit=False: async sessions cannot lazy-load expired attributes after commit
SessionLocal = async_sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as session:
        yield session
