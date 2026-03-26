import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.account import Account
from models.journal import JournalEntry, JournalLine

_TYPE_TO_NORMAL_BALANCE: dict[str, str] = {
    "asset": "debit",
    "expense": "debit",
    "liability": "credit",
    "equity": "credit",
    "revenue": "credit",
}

VALID_ACCOUNT_TYPES = set(_TYPE_TO_NORMAL_BALANCE.keys())


async def _get_or_404(db: AsyncSession, account_id: uuid.UUID) -> Account:
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found.")
    return account


async def _compute_balance(
    db: AsyncSession,
    account_id: uuid.UUID,
    normal_balance: str,
    as_of_date: Optional[date] = None,
) -> Decimal:
    q = (
        select(
            func.coalesce(func.sum(JournalLine.debit), 0).label("d"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("c"),
        )
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .where(
            JournalLine.account_id == account_id,
            JournalEntry.status == "posted",
        )
    )
    if as_of_date is not None:
        q = q.where(JournalEntry.date <= as_of_date)
    result = await db.execute(q)
    row = result.one()
    d = Decimal(str(row.d))
    c = Decimal(str(row.c))
    if normal_balance == "debit":
        return (d - c).quantize(Decimal("0.01"))
    return (c - d).quantize(Decimal("0.01"))


async def list_accounts(
    db: AsyncSession,
    *,
    type: Optional[str] = None,
    archived: Optional[bool] = None,
) -> list[Account]:
    q = select(Account).order_by(Account.code)
    if type is not None:
        q = q.where(Account.type == type)
    if archived is not None:
        q = q.where(Account.archived == archived)
    result = await db.execute(q)
    accounts = list(result.scalars().all())

    if not accounts:
        return accounts

    # Bulk balance: one query for all accounts
    ids = [a.id for a in accounts]
    bal_q = (
        select(
            JournalLine.account_id,
            func.coalesce(func.sum(JournalLine.debit), 0).label("d"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("c"),
        )
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .where(JournalEntry.status == "posted", JournalLine.account_id.in_(ids))
        .group_by(JournalLine.account_id)
    )
    bal_result = await db.execute(bal_q)
    balance_map: dict[uuid.UUID, tuple[Decimal, Decimal]] = {
        row.account_id: (Decimal(str(row.d)), Decimal(str(row.c)))
        for row in bal_result
    }

    for account in accounts:
        d, c = balance_map.get(account.id, (Decimal("0"), Decimal("0")))
        if account.normal_balance == "debit":
            account.balance = (d - c).quantize(Decimal("0.01"))
        else:
            account.balance = (c - d).quantize(Decimal("0.01"))

    return accounts


async def get_account(db: AsyncSession, *, id: uuid.UUID) -> Account:
    account = await _get_or_404(db, id)
    account.balance = await _compute_balance(db, account.id, account.normal_balance)
    return account
