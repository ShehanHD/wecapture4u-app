import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.expense import Expense
from models.journal import JournalEntry, JournalLine


async def _get_or_404(db: AsyncSession, expense_id: uuid.UUID) -> Expense:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return expense


async def _get_ap_account_id(db: AsyncSession) -> uuid.UUID:
    """Returns the Accounts Payable account id (code 2000, always seeded)."""
    from models.account import Account
    ap_id = await db.scalar(select(Account.id).where(Account.code == "2000"))
    if ap_id is None:
        raise HTTPException(status_code=500, detail="Accounts Payable account (2000) not found.")
    return ap_id


async def _has_posted_entry(db: AsyncSession, expense_id: uuid.UUID) -> bool:
    count = await db.scalar(
        select(JournalEntry.id)
        .where(
            JournalEntry.reference_type == "expense",
            JournalEntry.reference_id == expense_id,
            JournalEntry.status == "posted",
        )
        .limit(1)
    )
    return count is not None


async def _attach_journal_entry_ids(db: AsyncSession, expenses: list[Expense]) -> None:
    """Bulk-fetch most recent non-voided entry id per expense and attach to instance."""
    if not expenses:
        return
    ids = [e.id for e in expenses]
    rows = await db.execute(
        select(JournalEntry.reference_id, JournalEntry.id, JournalEntry.created_at)
        .where(
            JournalEntry.reference_type == "expense",
            JournalEntry.reference_id.in_(ids),
            JournalEntry.status != "voided",
        )
        .order_by(JournalEntry.created_at.desc())
    )
    entry_map: dict[uuid.UUID, uuid.UUID] = {}
    for row in rows:
        if row.reference_id not in entry_map:
            entry_map[row.reference_id] = row.id
    for expense in expenses:
        expense.journal_entry_id = entry_map.get(expense.id)


async def _create_draft_entry(
    db: AsyncSession,
    expense: Expense,
    description: str,
    debit_account_id: uuid.UUID,
    credit_account_id: uuid.UUID,
    entry_date: Optional[date] = None,
) -> JournalEntry:
    entry = JournalEntry(
        date=entry_date if entry_date is not None else expense.date,
        description=description,
        status="draft",
        created_by="system",
        reference_type="expense",
        reference_id=expense.id,
    )
    db.add(entry)
    await db.flush()
    db.add(JournalLine(
        entry_id=entry.id,
        account_id=debit_account_id,
        debit=expense.amount,
        credit=Decimal("0"),
    ))
    db.add(JournalLine(
        entry_id=entry.id,
        account_id=credit_account_id,
        debit=Decimal("0"),
        credit=expense.amount,
    ))
    await db.flush()
    return entry


async def list_expenses(
    db: AsyncSession,
    *,
    expense_account_id: Optional[uuid.UUID] = None,
    payment_status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[Expense]:
    q = select(Expense).order_by(Expense.date.desc(), Expense.created_at.desc())
    if expense_account_id is not None:
        q = q.where(Expense.expense_account_id == expense_account_id)
    if payment_status is not None:
        q = q.where(Expense.payment_status == payment_status)
    if start_date is not None:
        q = q.where(Expense.date >= start_date)
    if end_date is not None:
        q = q.where(Expense.date <= end_date)
    result = await db.execute(q)
    expenses = list(result.scalars().all())
    await _attach_journal_entry_ids(db, expenses)
    return expenses


async def get_expense(db: AsyncSession, *, id: uuid.UUID) -> Expense:
    expense = await _get_or_404(db, id)
    await _attach_journal_entry_ids(db, [expense])
    return expense


async def create_expense(
    db: AsyncSession,
    *,
    date: date,
    description: str,
    expense_account_id: uuid.UUID,
    amount: Decimal,
    payment_status: str,
    payment_account_id: Optional[uuid.UUID] = None,
    receipt_url: Optional[str] = None,
    notes: Optional[str] = None,
) -> Expense:
    expense = Expense(
        date=date,
        description=description,
        expense_account_id=expense_account_id,
        amount=amount,
        payment_status=payment_status,
        payment_account_id=payment_account_id,
        receipt_url=receipt_url,
        notes=notes,
    )
    db.add(expense)
    await db.flush()

    if payment_status == "paid":
        await _create_draft_entry(
            db, expense,
            description=f"Expense: {description}",
            debit_account_id=expense_account_id,
            credit_account_id=payment_account_id,
        )
    else:  # payable
        ap_id = await _get_ap_account_id(db)
        await _create_draft_entry(
            db, expense,
            description=f"Expense (payable): {description}",
            debit_account_id=expense_account_id,
            credit_account_id=ap_id,
        )

    await _attach_journal_entry_ids(db, [expense])
    return expense


async def update_expense(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    date: Optional[date] = None,
    description: Optional[str] = None,
    expense_account_id: Optional[uuid.UUID] = None,
    amount: Optional[Decimal] = None,
    payment_status: Optional[str] = None,
    payment_account_id: Optional[uuid.UUID] = None,
    receipt_url: Optional[str] = None,
    notes: Optional[str] = None,
) -> Expense:
    expense = await _get_or_404(db, id)

    if await _has_posted_entry(db, id):
        raise HTTPException(
            status_code=409,
            detail="Cannot edit an expense with a posted journal entry. Void the entry first.",
        )

    if date is not None:
        expense.date = date
    if description is not None:
        expense.description = description
    if expense_account_id is not None:
        expense.expense_account_id = expense_account_id
    if amount is not None:
        expense.amount = amount
    if payment_status is not None:
        expense.payment_status = payment_status
    if payment_account_id is not None:
        expense.payment_account_id = payment_account_id
    if receipt_url is not None:
        expense.receipt_url = receipt_url
    if notes is not None:
        expense.notes = notes

    await db.flush()
    await _attach_journal_entry_ids(db, [expense])
    return expense


async def delete_expense(db: AsyncSession, *, id: uuid.UUID) -> None:
    expense = await _get_or_404(db, id)

    if await _has_posted_entry(db, id):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete an expense with a posted journal entry. Void the entry first.",
        )

    # Delete any draft/voided journal entries referencing this expense
    draft_entries = await db.execute(
        select(JournalEntry).where(
            JournalEntry.reference_type == "expense",
            JournalEntry.reference_id == id,
        )
    )
    for entry in draft_entries.scalars().all():
        await db.delete(entry)

    await db.delete(expense)
    await db.flush()


async def pay_expense(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    payment_account_id: uuid.UUID,
    payment_date: Optional[date] = None,
) -> Expense:
    expense = await _get_or_404(db, id)

    if expense.payment_status != "payable":
        raise HTTPException(
            status_code=409,
            detail=f"Expense is already '{expense.payment_status}'. Only payable expenses can be paid.",
        )

    expense.payment_status = "paid"
    expense.payment_account_id = payment_account_id
    await db.flush()

    ap_id = await _get_ap_account_id(db)
    pay_date = payment_date or date.today()
    await _create_draft_entry(
        db, expense,
        description=f"Payment of payable expense: {expense.description}",
        debit_account_id=ap_id,
        credit_account_id=payment_account_id,
        entry_date=pay_date,
    )
    await db.flush()

    await _attach_journal_entry_ids(db, [expense])
    return expense
