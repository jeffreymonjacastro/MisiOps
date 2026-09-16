import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user
from core.database import get_db
from models.category import Category
from models.transaction import Transaction
from models.user import User
from schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

logger = logging.getLogger("misiops.categories")
router = APIRouter(prefix="/category", tags=["category"])

NAME_TAKEN = "Category name already exists"
NOT_FOUND = "Category not found"


async def _get_owned(db: AsyncSession, user: User, category_id: int) -> Category:
    # Ownership lives in the query: another user's id is indistinguishable from a missing one.
    stmt = select(Category).where(Category.id == category_id, Category.user_id == user.id)
    category = (await db.execute(stmt)).scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return category


async def _transaction_count(db: AsyncSession, category_id: int) -> int:
    stmt = (
        select(func.count()).select_from(Transaction).where(Transaction.category_id == category_id)
    )
    return (await db.execute(stmt)).scalar_one()


async def _refuse_if_used(db: AsyncSession, category_id: int) -> None:
    count = await _transaction_count(db, category_id)
    if count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Category has {count} transactions"
        )


async def _commit_or_conflict(db: AsyncSession) -> None:
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NAME_TAKEN) from None


@router.get("/", response_model=list[CategoryOut])
async def list_categories(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[Category]:
    stmt = (
        select(Category)
        .where(Category.user_id == user.id)
        .order_by(Category.type, func.lower(Category.name))
    )
    return list((await db.execute(stmt)).scalars())


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=CategoryOut)
async def create_category(
    body: CategoryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Category:
    category = Category(user_id=user.id, **body.model_dump())
    db.add(category)
    await _commit_or_conflict(db)
    await db.refresh(category)
    logger.info("category created user=%s id=%s", user.id, category.id)
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    body: CategoryUpdate,
    category_id: int = Path(gt=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Category:
    category = await _get_owned(db, user, category_id)
    data = body.model_dump(exclude_unset=True)
    if "type" in data and data["type"] != category.type:
        await _refuse_if_used(db, category_id)  # FR-015: no type change with transactions
    for field, value in data.items():
        setattr(category, field, value)
    await _commit_or_conflict(db)
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_category(
    category_id: int = Path(gt=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    category = await _get_owned(db, user, category_id)
    await _refuse_if_used(db, category_id)  # FR-015: no delete with transactions
    await db.delete(category)
    await db.commit()
    logger.info("category deleted user=%s id=%s", user.id, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
