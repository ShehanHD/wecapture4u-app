import uuid
from datetime import date, timedelta
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


async def update_account(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: Optional[str] = None,
    archived: Optional[bool] = None,
) -> Account:
    account = await _get_or_404(db, id)

    if archived is True and account.is_system:
        raise HTTPException(status_code=403, detail="System accounts cannot be archived.")

    if name is not None:
        account.name = name
    if archived is not None:
        account.archived = archived

    await db.flush()
    account.balance = await _compute_balance(db, account.id, account.normal_balance)
    return account


async def delete_account(db: AsyncSession, *, id: uuid.UUID) -> None:
    account = await _get_or_404(db, id)

    if account.is_system:
        raise HTTPException(status_code=403, detail="System accounts cannot be deleted.")

    count_result = await db.execute(
        select(func.count(JournalLine.id)).where(JournalLine.account_id == id)
    )
    line_count = count_result.scalar_one()
    if line_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Account is referenced in {line_count} journal line(s).",
        )

    await db.delete(account)
    await db.flush()


async def get_account_ledger(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    account = await _get_or_404(db, id)

    opening_balance = Decimal("0.00")
    if start_date is not None:
        opening_balance = await _compute_balance(
            db, id, account.normal_balance, as_of_date=start_date - timedelta(days=1)
        )

    q = (
        select(JournalLine, JournalEntry)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .where(
            JournalLine.account_id == id,
            JournalEntry.status == "posted",
        )
        .order_by(JournalEntry.date, JournalEntry.created_at)
    )
    if start_date is not None:
        q = q.where(JournalEntry.date >= start_date)
    if end_date is not None:
        q = q.where(JournalEntry.date <= end_date)

    result = await db.execute(q)
    rows = result.all()

    running = opening_balance
    lines = []
    for line, entry in rows:
        d = Decimal(str(line.debit))
        c = Decimal(str(line.credit))
        if account.normal_balance == "debit":
            running = (running + d - c).quantize(Decimal("0.01"))
        else:
            running = (running + c - d).quantize(Decimal("0.01"))
        lines.append({
            "journal_entry_id": entry.id,
            "date": entry.date,
            "description": entry.description,
            "line_description": line.description,
            "debit": d,
            "credit": c,
            "running_balance": running,
        })

    return {
        "account_id": account.id,
        "account_name": account.name,
        "normal_balance": account.normal_balance,
        "opening_balance": opening_balance,
        "closing_balance": running,
        "lines": lines,
    }


async def create_account(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    type: str,
) -> Account:
    existing = await db.execute(select(Account).where(Account.code == code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=f"Account code '{code}' already exists.")

    normal_balance = _TYPE_TO_NORMAL_BALANCE[type]
    account = Account(code=code, name=name, type=type, normal_balance=normal_balance)
    db.add(account)
    await db.flush()
    account.balance = Decimal("0.00")
    return account
