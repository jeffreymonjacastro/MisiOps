import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import DUMMY_HASH, create_access_token, hash_password, verify_password
from models.user import User
from schemas.user import Token, UserCreate, UserLogin, UserOut

logger = logging.getLogger("misiops.auth")
router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_TAKEN = "Email already registered"
TELEGRAM_TAKEN = "Telegram chat id already linked to another account"


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserOut)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        telegram_chat_id=body.telegram_chat_id,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        # Unique index names contain the column name on both SQLite and Postgres.
        detail = EMAIL_TAKEN if "email" in str(exc.orig) else TELEGRAM_TAKEN
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from None
    await db.refresh(user)
    logger.info("user registered id=%s", user.id)
    return user


@router.post("/login", response_model=Token)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)) -> Token:
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    # Verify against a dummy hash when the email is unknown so both failures take the same time.
    # ponytail: argon2 runs on the event loop (p95 351 ms at 10 concurrent logins);
    # wrap in fastapi.concurrency.run_in_threadpool if p95 ever exceeds 500 ms.
    ok = verify_password(body.password, user.hashed_password if user else DUMMY_HASH)
    if user is None or not ok:
        logger.warning("failed login email=%s", body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=create_access_token(user.id))
