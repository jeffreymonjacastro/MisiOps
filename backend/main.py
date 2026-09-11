from contextlib import asynccontextmanager
from fastapi import FastAPI

from core.database import engine, Base
import models.user  # Ensure models are loaded before create_all()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    # Note: In production, use Alembic migrations instead of create_all()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup on shutdown
    await engine.dispose()

app = FastAPI(
    title="FastAPI Backend Placeholder",
    lifespan=lifespan
)

@app.get("/")
async def root():
    return {"message": "Hello from the FastAPI backend placeholder!"}
