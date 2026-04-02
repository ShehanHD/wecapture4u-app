import uuid
from datetime import date
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


async def create_entry(
    db: AsyncSession,
    *,
    date: date,
    description: str,
    lines: list,
) -> JournalEntry:
    entry = JournalEntry(
        date=date,
        description=description,
        status="draft",
        created_by="manual",
    )
    db.add(entry)
    await db.flush()

    for ln in lines:
        db.add(JournalLine(
            entry_id=entry.id,
            account_id=ln.account_id,
            debit=ln.debit,
            credit=ln.credit,
            description=ln.description,
        ))
    await db.flush()

    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.id == entry.id)
        .options(selectinload(JournalEntry.lines))
    )
    return result.scalar_one()


async def update_entry(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    date: Optional[date] = None,
    description: Optional[str] = None,
    lines: Optional[list] = None,
) -> JournalEntry:
    entry = await _get_or_404(db, id)

    if entry.status != "draft":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot update a journal entry with status '{entry.status}'. Only draft entries may be updated.",
        )

    if date is not None:
        entry.date = date
    if description is not None:
        entry.description = description

    if lines is not None:
        for existing_line in list(entry.lines):
            await db.delete(existing_line)
        await db.flush()

        for ln in lines:
            db.add(JournalLine(
                entry_id=entry.id,
                account_id=ln.account_id,
                debit=ln.debit,
                credit=ln.credit,
                description=ln.description,
            ))

    await db.flush()
    db.expire(entry)

    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.id == id)
        .options(selectinload(JournalEntry.lines))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def post_entry(db: AsyncSession, *, id: uuid.UUID) -> JournalEntry:
    entry = await _get_or_404(db, id)

    if entry.status != "draft":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot post a journal entry with status '{entry.status}'. Only draft entries may be posted.",
        )

    if not entry.lines:
        raise HTTPException(status_code=422, detail="Cannot post an entry with no lines.")

    total_debit = sum(Decimal(str(ln.debit)) for ln in entry.lines)
    total_credit = sum(Decimal(str(ln.credit)) for ln in entry.lines)

    if total_debit != total_credit:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Journal entry is unbalanced: "
                f"total debit {total_debit:.2f} \u2260 total credit {total_credit:.2f}."
            ),
        )

    entry.status = "posted"
    await db.flush()
    return entry


async def void_entry(db: AsyncSession, *, id: uuid.UUID) -> JournalEntry:
    entry = await _get_or_404(db, id)

    if entry.void_of is not None:
        raise HTTPException(
            status_code=409,
            detail="Cannot void a reversing entry. Create a manual correction entry instead.",
        )

    if entry.status != "posted":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot void a journal entry with status '{entry.status}'. Only posted entries may be voided.",
        )

    reversing = JournalEntry(
        date=date.today(),
        description=f"Void of: {entry.description}",
        status="voided",
        created_by="manual",
        void_of=entry.id,
    )
    db.add(reversing)
    await db.flush()

    for ln in entry.lines:
        db.add(JournalLine(
            entry_id=reversing.id,
            account_id=ln.account_id,
            debit=ln.credit,
            credit=ln.debit,
            description=ln.description,
        ))

    entry.status = "voided"
    await db.flush()

    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.id == reversing.id)
        .options(selectinload(JournalEntry.lines))
    )
    return result.scalar_one()
