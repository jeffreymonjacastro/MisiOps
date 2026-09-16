import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user
from core.database import get_db
from models.user import User
from schemas.user import UserOut, UserUpdate

logger = logging.getLogger("misiops.auth")
router = APIRouter(prefix="/user", tags=["user"])


@router.get("/", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Telegram chat id already linked to another account",
        ) from None
    await db.refresh(user)
    return user


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    user_id = user.id
    await db.delete(user)
    await db.commit()
    logger.info("user deleted id=%s", user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
