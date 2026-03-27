import uuid
from typing import Optional
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.journal import JournalEntry, JournalLine


async def _get_or_404(db: AsyncSession, entry_id: uuid.UUID) -> JournalEntry:
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    return entry


async def list_entries(
    db: AsyncSession,
    *,
    status: Optional[str] = None,
    reference_type: Optional[str] = None,
) -> list[JournalEntry]:
    q = select(JournalEntry).order_by(JournalEntry.date.desc(), JournalEntry.created_at.desc())
    if status is not None:
        q = q.where(JournalEntry.status == status)
    if reference_type is not None:
        q = q.where(JournalEntry.reference_type == reference_type)

    result = await db.execute(q)
    entries = list(result.scalars().all())

    if not entries:
        return entries

    # Bulk totals — single query for all entries
    ids = [e.id for e in entries]
    totals_q = (
        select(
            JournalLine.entry_id,
            func.coalesce(func.sum(JournalLine.debit), 0).label("td"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("tc"),
        )
        .where(JournalLine.entry_id.in_(ids))
        .group_by(JournalLine.entry_id)
    )
    totals_result = await db.execute(totals_q)
    totals_map: dict[uuid.UUID, tuple[Decimal, Decimal]] = {
        row.entry_id: (Decimal(str(row.td)), Decimal(str(row.tc)))
        for row in totals_result
    }

    for entry in entries:
        td, tc = totals_map.get(entry.id, (Decimal("0"), Decimal("0")))
        entry.total_debit = td.quantize(Decimal("0.01"))
        entry.total_credit = tc.quantize(Decimal("0.01"))

    return entries


async def get_entry(db: AsyncSession, *, id: uuid.UUID) -> JournalEntry:
    return await _get_or_404(db, id)
