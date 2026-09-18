import logging
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user
from core.database import get_db
from core.periods import budget_period
from models.category import Category
from models.transaction import Transaction
from models.user import User
from schemas.transaction import (
    CategoryTotal,
    SummaryOut,
    TransactionCreate,
    TransactionOut,
    TransactionPage,
    TransactionUpdate,
    TxType,
)

logger = logging.getLogger("misiops.transactions")
router = APIRouter(prefix="/transactions", tags=["transactions"])

TX_NOT_FOUND = "Transaction not found"
CAT_NOT_FOUND = "Category not found"
TYPE_MISMATCH = "Transaction type does not match category type"


def _today() -> date:  # separate so tests can pin the date
    return datetime.now(UTC).date()


async def _owned_category(db: AsyncSession, user: User, category_id: int) -> Category:
    stmt = select(Category).where(Category.id == category_id, Category.user_id == user.id)
    category = (await db.execute(stmt)).scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CAT_NOT_FOUND)
    return category


def _check_type(category: Category, tx_type: str) -> None:
    if category.type != tx_type:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=TYPE_MISMATCH)


async def _owned_transaction(db: AsyncSession, user: User, transaction_id: int) -> Transaction:
    stmt = select(Transaction).where(
        Transaction.id == transaction_id, Transaction.user_id == user.id
    )
    tx = (await db.execute(stmt)).scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TX_NOT_FOUND)
    return tx


async def _reload(db: AsyncSession, tx: Transaction) -> Transaction:
    await db.refresh(tx)
    await db.refresh(tx, ["category"])
    return tx


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TransactionOut)
async def create_transaction(
    body: TransactionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    category = await _owned_category(db, user, body.category_id)
    _check_type(category, body.type)
    tx = Transaction(user_id=user.id, source="manual", **body.model_dump(exclude_none=True))
    db.add(tx)
    await db.commit()
    await _reload(db, tx)
    logger.info("transaction created user=%s id=%s", user.id, tx.id)
    return tx


@router.get("", response_model=TransactionPage)
async def list_transactions(
    type: TxType | None = None,
    category_id: int | None = Query(None, gt=0),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionPage:
    filters = [Transaction.user_id == user.id]
    if type is not None:
        filters.append(Transaction.type == type)
    if category_id is not None:
        filters.append(Transaction.category_id == category_id)
    total = (
        await db.execute(select(func.count()).select_from(Transaction).where(*filters))
    ).scalar_one()
    page = (
        select(Transaction)
        .where(*filters)
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(page)).scalars().all()
    return TransactionPage(
        items=[TransactionOut.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/summary", response_model=SummaryOut)
async def summary(
    from_: date | None = Query(None, alias="from"),
    to: date | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SummaryOut:
    if (from_ is None) != (to is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="from and to must be given together",
        )
    if from_ is not None and to is not None:
        if from_ > to:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="from must not be after to",
            )
        start, end = from_, to
    else:
        start, end = budget_period(_today(), user.budget_start_day)

    start_dt = datetime.combine(start, time.min, tzinfo=UTC)
    end_dt = datetime.combine(end + timedelta(days=1), time.min, tzinfo=UTC)
    in_period = [
        Transaction.user_id == user.id,
        Transaction.transaction_date >= start_dt,
        Transaction.transaction_date < end_dt,
    ]

    def _sum_of(tx_type: str):
        return func.coalesce(
            func.sum(case((Transaction.type == tx_type, Transaction.amount), else_=0)), 0
        )

    total_income, total_expense = (
        await db.execute(select(_sum_of("income"), _sum_of("expense")).where(*in_period))
    ).one()
    total_income, total_expense = Decimal(total_income), Decimal(total_expense)

    total_col = func.sum(Transaction.amount).label("total")
    breakdown = (
        select(Category.id, Category.name, Category.type, Category.budget, total_col)
        .join(Transaction, Transaction.category_id == Category.id)
        .where(*in_period)
        .group_by(Category.id, Category.name, Category.type, Category.budget)
        .order_by(Category.type, total_col.desc())
    )
    by_category = [
        CategoryTotal(category_id=cid, name=name, type=ctype, budget=budget, total=total)
        for cid, name, ctype, budget, total in (await db.execute(breakdown)).all()
    ]

    limit = Decimal(user.monthly_budget_limit)
    return SummaryOut(
        period_start=start,
        period_end=end,
        total_income=total_income,
        total_expense=total_expense,
        balance=total_income - total_expense,
        monthly_budget_limit=limit,
        remaining_budget=None if limit == 0 else limit - total_expense,
        by_category=by_category,
    )


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    body: TransactionUpdate,
    transaction_id: int = Path(gt=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    tx = await _owned_transaction(db, user, transaction_id)
    data = body.model_dump(exclude_unset=True)
    if "type" in data or "category_id" in data:
        category = await _owned_category(db, user, data.get("category_id", tx.category_id))
        _check_type(category, data.get("type", tx.type))
    for field, value in data.items():
        setattr(tx, field, value)
    await db.commit()
    return await _reload(db, tx)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_transaction(
    transaction_id: int = Path(gt=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    tx = await _owned_transaction(db, user, transaction_id)
    await db.delete(tx)
    await db.commit()
    logger.info("transaction deleted user=%s id=%s", user.id, transaction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
