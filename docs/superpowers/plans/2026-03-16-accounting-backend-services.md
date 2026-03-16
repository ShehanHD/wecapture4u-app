# weCapture4U — Accounting Backend: Services & Auto-Draft Engine

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the accounting service layer — auto-draft journal entry generation for each business event (invoice sent, payment recorded, deposit received, expense created/paid), balance invariant checking, void/reverse logic, and the expense + invoice payment CRUD services.

**Architecture:** Pure functions for auto-draft line generation (no DB I/O — returns `list[JournalLineIn]`). A thin orchestration layer handles DB writes and idempotency checks. The service layer is called by existing services (invoices, appointments) which call `ensure_system_draft()` after their own mutations.

**Depends on:** Plan 8 (Accounting models + schemas).

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (async), Pydantic v2.

---

## File Structure

```
backend/
  services/
    accounting.py           # Auto-draft engine, balance check, void logic, accounts CRUD
    expenses.py             # Expense CRUD + pay action
    invoice_payments.py     # Invoice payment CRUD
  services/__tests__/
    test_auto_draft.py      # Pure function tests for draft generation
```

---

## Chunk 1: Auto-Draft Engine (Pure Functions)

### Task 1: Write failing tests for auto-draft pure functions

**Files:**
- Create: `backend/services/__tests__/test_auto_draft.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/services/__tests__/test_auto_draft.py
import pytest
from decimal import Decimal
from uuid import uuid4
from backend.services.accounting import (
    draft_lines_for_invoice,
    draft_lines_for_payment,
    draft_lines_for_deposit,
    draft_lines_for_expense_paid,
    draft_lines_for_expense_payable,
    draft_lines_for_expense_pay,
    check_balance,
    DEFAULT_AR_ACCOUNT_CODE,
    DEFAULT_SESSION_FEES_CODE,
    DEFAULT_BANK_ACCOUNT_CODE,
    DEFAULT_DEFERRED_REVENUE_CODE,
    DEFAULT_AP_ACCOUNT_CODE,
)


# ─── draft_lines_for_invoice ────────────────────────────────────────────────

def _acct(code: str) -> object:
    """Stub account with id and code."""
    class A:
        id = uuid4()
        pass
    a = A()
    a.code = code
    return a


def test_invoice_draft_simple_no_tax():
    ar_acct = _acct("1100")
    session_fees_acct = _acct("4000")
    lines = draft_lines_for_invoice(
        total=Decimal("500"),
        subtotal=Decimal("500"),
        discount=Decimal("0"),
        tax=Decimal("0"),
        ar_account=ar_acct,
        revenue_lines=[(session_fees_acct, Decimal("500"))],
        tax_account=None,
    )
    # Dr AR 500, Cr Session Fees 500
    assert len(lines) == 2
    debit_line = next(l for l in lines if l["debit"] > 0)
    credit_line = next(l for l in lines if l["credit"] > 0)
    assert debit_line["debit"] == Decimal("500")
    assert credit_line["credit"] == Decimal("500")


def test_invoice_draft_with_tax():
    ar_acct = _acct("1100")
    session_fees_acct = _acct("4000")
    tax_acct = _acct("2300")
    lines = draft_lines_for_invoice(
        total=Decimal("550"),
        subtotal=Decimal("500"),
        discount=Decimal("0"),
        tax=Decimal("50"),
        ar_account=ar_acct,
        revenue_lines=[(session_fees_acct, Decimal("500"))],
        tax_account=tax_acct,
    )
    # Dr AR 550, Cr Session Fees 500, Cr Tax Payable 50
    assert len(lines) == 3
    debits = sum(l["debit"] for l in lines)
    credits = sum(l["credit"] for l in lines)
    assert debits == credits == Decimal("550")


def test_invoice_draft_with_discount_and_tax():
    ar_acct = _acct("1100")
    fees_acct = _acct("4000")
    tax_acct = _acct("2300")
    # subtotal=600, discount=100, tax=50, total=550
    lines = draft_lines_for_invoice(
        total=Decimal("550"),
        subtotal=Decimal("600"),
        discount=Decimal("100"),
        tax=Decimal("50"),
        ar_account=ar_acct,
        revenue_lines=[(fees_acct, Decimal("500"))],  # subtotal - discount
        tax_account=tax_acct,
    )
    debits = sum(l["debit"] for l in lines)
    credits = sum(l["credit"] for l in lines)
    assert debits == credits


def test_invoice_draft_zero_tax_omits_tax_line():
    ar_acct = _acct("1100")
    fees_acct = _acct("4000")
    tax_acct = _acct("2300")
    lines = draft_lines_for_invoice(
        total=Decimal("500"),
        subtotal=Decimal("500"),
        discount=Decimal("0"),
        tax=Decimal("0"),
        ar_account=ar_acct,
        revenue_lines=[(fees_acct, Decimal("500"))],
        tax_account=tax_acct,  # provided but should be excluded (zero amount)
    )
    assert len(lines) == 2  # no tax line


# ─── draft_lines_for_payment ────────────────────────────────────────────────

def test_payment_draft():
    bank = _acct("1010")
    ar = _acct("1100")
    lines = draft_lines_for_payment(
        amount=Decimal("200"),
        bank_account=bank,
        ar_account=ar,
    )
    assert len(lines) == 2
    assert sum(l["debit"] for l in lines) == Decimal("200")
    assert sum(l["credit"] for l in lines) == Decimal("200")


# ─── draft_lines_for_deposit ────────────────────────────────────────────────

def test_deposit_draft():
    bank = _acct("1010")
    deferred = _acct("2200")
    lines = draft_lines_for_deposit(
        amount=Decimal("150"),
        bank_account=bank,
        deferred_revenue_account=deferred,
    )
    assert len(lines) == 2
    assert sum(l["debit"] for l in lines) == Decimal("150")
    assert sum(l["credit"] for l in lines) == Decimal("150")


# ─── draft_lines_for_expense ────────────────────────────────────────────────

def test_expense_paid_draft():
    expense_acct = _acct("5000")
    bank = _acct("1010")
    lines = draft_lines_for_expense_paid(
        amount=Decimal("300"),
        expense_account=expense_acct,
        payment_account=bank,
    )
    assert len(lines) == 2
    assert sum(l["debit"] for l in lines) == Decimal("300")
    assert sum(l["credit"] for l in lines) == Decimal("300")


def test_expense_payable_draft():
    expense_acct = _acct("5000")
    ap = _acct("2000")
    lines = draft_lines_for_expense_payable(
        amount=Decimal("300"),
        expense_account=expense_acct,
        ap_account=ap,
    )
    assert len(lines) == 2
    debits = sum(l["debit"] for l in lines)
    credits = sum(l["credit"] for l in lines)
    assert debits == credits == Decimal("300")


# ─── check_balance ──────────────────────────────────────────────────────────

def test_check_balance_balanced():
    lines = [
        {"debit": Decimal("100"), "credit": Decimal("0")},
        {"debit": Decimal("0"), "credit": Decimal("100")},
    ]
    assert check_balance(lines) is True


def test_check_balance_unbalanced():
    lines = [
        {"debit": Decimal("100"), "credit": Decimal("0")},
        {"debit": Decimal("0"), "credit": Decimal("90")},
    ]
    assert check_balance(lines) is False
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_auto_draft.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError`

---

### Task 2: Implement pure draft-line functions + balance check

**Files:**
- Create: `backend/services/accounting.py` (partial — pure functions only in this task)

- [ ] **Step 1: Write the pure functions**

```python
# backend/services/accounting.py
"""
Accounting service: auto-draft generation, balance invariant, void logic,
and accounts CRUD.

Pure functions (no DB I/O) return list[dict] suitable for building JournalLine rows.
Orchestration functions are async and accept AsyncSession.
"""
from __future__ import annotations
from decimal import Decimal
from typing import Any
from uuid import UUID
from sqlalchemy import select, func as sqlfunc, update as sqlupt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from backend.models.accounting import (
    Account, JournalEntry, JournalLine, InvoicePayment, Expense,
)
from backend.models.invoices import Invoice, InvoiceItem
from backend.models.appointments import Appointment
from backend.schemas.accounting import (
    AccountCreate, AccountUpdate, JournalEntryCreate, JournalEntryUpdate,
    JournalLineIn, AutoDraftPreviewRequest,
)

# ─── WELL-KNOWN ACCOUNT CODES ─────────────────────────────────────────────────

DEFAULT_AR_ACCOUNT_CODE = "1100"
DEFAULT_BANK_ACCOUNT_CODE = "1010"
DEFAULT_SESSION_FEES_CODE = "4000"
DEFAULT_DEFERRED_REVENUE_CODE = "2200"
DEFAULT_AP_ACCOUNT_CODE = "2000"
DEFAULT_TAX_PAYABLE_CODE = "2300"


# ─── PURE FUNCTIONS: DRAFT LINE GENERATION ────────────────────────────────────

def _line(account: Any, debit: Decimal = Decimal("0"), credit: Decimal = Decimal("0"),
          description: str | None = None) -> dict:
    return {"account_id": account.id, "debit": debit, "credit": credit,
            "description": description}


def draft_lines_for_invoice(
    *,
    total: Decimal,
    subtotal: Decimal,
    discount: Decimal,
    tax: Decimal,
    ar_account: Any,
    revenue_lines: list[tuple[Any, Decimal]],
    tax_account: Any | None,
) -> list[dict]:
    """Dr AR (total) · Cr Revenue accounts (subtotal - discount) · Cr Tax Payable (tax if > 0)."""
    lines = [_line(ar_account, debit=total)]
    for acct, amount in revenue_lines:
        if amount > 0:
            lines.append(_line(acct, credit=amount))
    if tax > 0 and tax_account is not None:
        lines.append(_line(tax_account, credit=tax))
    return lines


def draft_lines_for_payment(
    *,
    amount: Decimal,
    bank_account: Any,
    ar_account: Any,
) -> list[dict]:
    """Dr Bank/Cash (amount) · Cr AR (amount)."""
    return [
        _line(bank_account, debit=amount),
        _line(ar_account, credit=amount),
    ]


def draft_lines_for_deposit(
    *,
    amount: Decimal,
    bank_account: Any,
    deferred_revenue_account: Any,
) -> list[dict]:
    """Dr Bank/Cash (amount) · Cr Deferred Revenue (amount)."""
    return [
        _line(bank_account, debit=amount),
        _line(deferred_revenue_account, credit=amount),
    ]


def draft_lines_for_expense_paid(
    *,
    amount: Decimal,
    expense_account: Any,
    payment_account: Any,
) -> list[dict]:
    """Dr Expense (amount) · Cr Bank/Cash (amount)."""
    return [
        _line(expense_account, debit=amount),
        _line(payment_account, credit=amount),
    ]


def draft_lines_for_expense_payable(
    *,
    amount: Decimal,
    expense_account: Any,
    ap_account: Any,
) -> list[dict]:
    """Dr Expense (amount) · Cr Accounts Payable (amount)."""
    return [
        _line(expense_account, debit=amount),
        _line(ap_account, credit=amount),
    ]


def draft_lines_for_expense_pay(
    *,
    amount: Decimal,
    ap_account: Any,
    payment_account: Any,
) -> list[dict]:
    """Dr Accounts Payable (amount) · Cr Bank/Cash (amount) — for paying off a payable expense."""
    return [
        _line(ap_account, debit=amount),
        _line(payment_account, credit=amount),
    ]


def check_balance(lines: list[dict]) -> bool:
    """Return True if sum(debit) == sum(credit)."""
    total_debit = sum(l.get("debit", Decimal("0")) for l in lines)
    total_credit = sum(l.get("credit", Decimal("0")) for l in lines)
    return total_debit == total_credit


# ─── DB HELPERS ───────────────────────────────────────────────────────────────

async def _get_account_by_code(db: AsyncSession, code: str) -> Account:
    result = await db.execute(select(Account).where(Account.code == code))
    acct = result.scalar_one_or_none()
    if acct is None:
        raise HTTPException(500, f"System account with code '{code}' not found in chart of accounts")
    return acct


async def _get_account_or_default(db: AsyncSession, account_id: UUID | None, code: str) -> Account:
    if account_id is not None:
        result = await db.execute(select(Account).where(Account.id == account_id))
        acct = result.scalar_one_or_none()
        if acct is not None:
            return acct
    return await _get_account_by_code(db, code)


async def _find_existing_system_draft(
    db: AsyncSession, reference_type: str, reference_id: UUID
) -> JournalEntry | None:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.reference_type == reference_type,
            JournalEntry.reference_id == reference_id,
            JournalEntry.created_by == "system",
            JournalEntry.status != "voided",
        )
    )
    return result.scalar_one_or_none()


async def _void_entry(db: AsyncSession, entry: JournalEntry) -> JournalEntry:
    """Create a reversing entry for a posted entry and mark original as voided."""
    if entry.status != "posted":
        raise HTTPException(409, "Only posted entries can be voided.")
    if entry.void_of is not None:
        raise HTTPException(409, "Reversing entries cannot be voided. Create a manual correction entry instead.")

    # Load original lines
    result = await db.execute(
        select(JournalLine).where(JournalLine.entry_id == entry.id)
    )
    original_lines = result.scalars().all()

    # Create reversing entry
    reversing = JournalEntry(
        date=entry.date,
        description=f"Void of: {entry.description}",
        reference_type=entry.reference_type,
        reference_id=entry.reference_id,
        status="voided",
        created_by=entry.created_by,
        void_of=entry.id,
    )
    db.add(reversing)
    await db.flush()

    for line in original_lines:
        db.add(JournalLine(
            entry_id=reversing.id,
            account_id=line.account_id,
            debit=line.credit,   # swap
            credit=line.debit,   # swap
        ))

    entry.status = "voided"
    await db.flush()
    return reversing


async def _create_entry_with_lines(
    db: AsyncSession,
    *,
    date: object,
    description: str,
    reference_type: str | None,
    reference_id: UUID | None,
    status: str,
    created_by: str,
    lines: list[dict],
) -> JournalEntry:
    entry = JournalEntry(
        date=date,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
        status=status,
        created_by=created_by,
    )
    db.add(entry)
    await db.flush()
    for l in lines:
        db.add(JournalLine(
            entry_id=entry.id,
            account_id=l["account_id"],
            debit=l["debit"],
            credit=l["credit"],
            description=l.get("description"),
        ))
    await db.flush()
    return entry


# ─── AUTO-DRAFT ORCHESTRATION ─────────────────────────────────────────────────

async def ensure_invoice_draft(db: AsyncSession, invoice_id: UUID) -> JournalEntry:
    """
    Called when invoice.status → 'sent'.
    If a non-voided system entry already exists, return it unchanged.
    If a draft exists from a previous send, void it and create a fresh draft.
    """
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if invoice is None:
        raise HTTPException(404, "Invoice not found")

    existing = await _find_existing_system_draft(db, "invoice", invoice_id)
    if existing:
        if existing.status == "draft":
            # Already a pending draft — return as-is
            return existing
        # It's posted — void it and create fresh
        await _void_entry(db, existing)

    ar_account = await _get_account_by_code(db, DEFAULT_AR_ACCOUNT_CODE)
    tax_account = await _get_account_by_code(db, DEFAULT_TAX_PAYABLE_CODE) if invoice.tax > 0 else None

    # Build revenue lines per invoice item
    items_result = await db.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
    )
    items = items_result.scalars().all()
    revenue_lines: list[tuple[Any, Decimal]] = []
    for item in items:
        acct = await _get_account_or_default(
            db, item.revenue_account_id, DEFAULT_SESSION_FEES_CODE
        )
        amount = item.quantity * item.unit_price
        revenue_lines.append((acct, amount))

    # Aggregate by account to avoid duplicate credit lines for the same account
    acct_map: dict[UUID, tuple[Any, Decimal]] = {}
    for acct, amount in revenue_lines:
        if acct.id in acct_map:
            acct_map[acct.id] = (acct, acct_map[acct.id][1] + amount)
        else:
            acct_map[acct.id] = (acct, amount)
    merged_revenue = list(acct_map.values())

    # Apply discount proportionally — simplest approach: reduce revenue credits by discount
    # (discount is applied to the whole invoice, not per-item in this iteration)
    if invoice.discount > 0 and merged_revenue:
        # Reduce the first revenue line by discount amount
        first_acct, first_amount = merged_revenue[0]
        merged_revenue[0] = (first_acct, first_amount - invoice.discount)

    import datetime
    lines = draft_lines_for_invoice(
        total=invoice.total,
        subtotal=invoice.subtotal,
        discount=invoice.discount,
        tax=invoice.tax,
        ar_account=ar_account,
        revenue_lines=merged_revenue,
        tax_account=tax_account,
    )

    return await _create_entry_with_lines(
        db,
        date=invoice.issue_date or datetime.date.today(),
        description=f"Invoice #{invoice.id} — revenue recognition",
        reference_type="invoice",
        reference_id=invoice_id,
        status="draft",
        created_by="system",
        lines=lines,
    )


async def ensure_payment_draft(
    db: AsyncSession, payment: InvoicePayment
) -> JournalEntry:
    """Called after an InvoicePayment row is created."""
    existing = await _find_existing_system_draft(db, "invoice_payment", payment.id)
    if existing:
        return existing

    bank_acct = await _get_account_or_default(db, payment.account_id, DEFAULT_BANK_ACCOUNT_CODE)
    ar_acct = await _get_account_by_code(db, DEFAULT_AR_ACCOUNT_CODE)
    lines = draft_lines_for_payment(amount=payment.amount, bank_account=bank_acct, ar_account=ar_acct)

    import datetime
    return await _create_entry_with_lines(
        db,
        date=payment.payment_date,
        description=f"Payment received — invoice #{payment.invoice_id}",
        reference_type="invoice_payment",
        reference_id=payment.id,
        status="draft",
        created_by="system",
        lines=lines,
    )


async def ensure_deposit_draft(
    db: AsyncSession, appointment_id: UUID
) -> JournalEntry | None:
    """
    Called when appointment.deposit_paid → True and deposit_amount > 0.
    Returns None if deposit_amount is 0 (no entry created).
    """
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if appt is None:
        raise HTTPException(404, "Appointment not found")
    if not appt.deposit_amount or appt.deposit_amount <= 0:
        return None

    existing = await _find_existing_system_draft(db, "appointment", appointment_id)
    if existing:
        if existing.status == "draft":
            return existing
        await _void_entry(db, existing)

    bank_acct = await _get_account_or_default(db, appt.deposit_account_id, DEFAULT_BANK_ACCOUNT_CODE)
    deferred_acct = await _get_account_by_code(db, DEFAULT_DEFERRED_REVENUE_CODE)
    lines = draft_lines_for_deposit(
        amount=appt.deposit_amount,
        bank_account=bank_acct,
        deferred_revenue_account=deferred_acct,
    )

    import datetime
    return await _create_entry_with_lines(
        db,
        date=appt.starts_at.date() if appt.starts_at else datetime.date.today(),
        description=f"Deposit received — appointment #{appointment_id}",
        reference_type="appointment",
        reference_id=appointment_id,
        status="draft",
        created_by="system",
        lines=lines,
    )


async def ensure_expense_draft(
    db: AsyncSession, expense: Expense
) -> JournalEntry:
    """Called after an Expense row is created."""
    existing = await _find_existing_system_draft(db, "expense", expense.id)
    if existing:
        return existing

    expense_acct = await _get_account_by_code(db, "")
    result = await db.execute(select(Account).where(Account.id == expense.expense_account_id))
    expense_acct = result.scalar_one_or_none()
    if expense_acct is None:
        raise HTTPException(422, "Expense account not found")

    if expense.payment_status == "paid":
        payment_acct = await _get_account_or_default(
            db, expense.payment_account_id, DEFAULT_BANK_ACCOUNT_CODE
        )
        lines = draft_lines_for_expense_paid(
            amount=expense.amount, expense_account=expense_acct, payment_account=payment_acct
        )
    else:  # payable
        ap_acct = await _get_account_by_code(db, DEFAULT_AP_ACCOUNT_CODE)
        lines = draft_lines_for_expense_payable(
            amount=expense.amount, expense_account=expense_acct, ap_account=ap_acct
        )

    return await _create_entry_with_lines(
        db,
        date=expense.date,
        description=f"Expense: {expense.description}",
        reference_type="expense",
        reference_id=expense.id,
        status="draft",
        created_by="system",
        lines=lines,
    )


async def ensure_expense_pay_draft(
    db: AsyncSession, expense: Expense, payment_account_id: UUID
) -> JournalEntry:
    """Called when a payable expense is marked as paid."""
    result = await db.execute(select(Account).where(Account.id == expense.expense_account_id))
    expense_acct = result.scalar_one_or_none()
    ap_acct = await _get_account_by_code(db, DEFAULT_AP_ACCOUNT_CODE)
    payment_acct = await _get_account_or_default(db, payment_account_id, DEFAULT_BANK_ACCOUNT_CODE)
    lines = draft_lines_for_expense_pay(
        amount=expense.amount, ap_account=ap_acct, payment_account=payment_acct
    )
    return await _create_entry_with_lines(
        db,
        date=expense.date,
        description=f"Expense paid: {expense.description}",
        reference_type="expense",
        reference_id=expense.id,
        status="draft",
        created_by="system",
        lines=lines,
    )


# ─── JOURNAL ENTRY CRUD ────────────────────────────────────────────────────────

async def post_journal_entry(db: AsyncSession, entry_id: UUID) -> JournalEntry:
    """
    Post a draft entry. Validates balance invariant first.
    The DB trigger fires after to provide a second guard.
    """
    result = await db.execute(
        select(JournalEntry).where(JournalEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(404, "Journal entry not found")
    if entry.status != "draft":
        raise HTTPException(409, "Only draft entries can be posted.")

    # Application-layer balance check
    lines_result = await db.execute(
        select(JournalLine).where(JournalLine.entry_id == entry_id)
    )
    lines = lines_result.scalars().all()
    total_debit = sum(l.debit for l in lines)
    total_credit = sum(l.credit for l in lines)
    if total_debit != total_credit:
        raise HTTPException(
            422,
            f"Entry does not balance: debits €{total_debit}, credits €{total_credit}"
        )

    entry.status = "posted"
    await db.flush()
    return entry


async def void_journal_entry(db: AsyncSession, entry_id: UUID) -> JournalEntry:
    result = await db.execute(select(JournalEntry).where(JournalEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(404, "Journal entry not found")

    reversing = await _void_entry(db, entry)

    # If this was a payment entry, flag the invoice as requires_review
    if entry.reference_type == "invoice_payment" and entry.reference_id is not None:
        pmt_result = await db.execute(
            select(InvoicePayment).where(InvoicePayment.id == entry.reference_id)
        )
        pmt = pmt_result.scalar_one_or_none()
        if pmt is not None:
            from backend.models.invoices import Invoice as InvoiceModel
            inv_result = await db.execute(
                select(InvoiceModel).where(InvoiceModel.id == pmt.invoice_id)
            )
            inv = inv_result.scalar_one_or_none()
            if inv is not None:
                inv.requires_review = True
                await db.flush()

    return reversing


# ─── ACCOUNTS CRUD ────────────────────────────────────────────────────────────

async def create_account(db: AsyncSession, data: AccountCreate) -> Account:
    existing = await db.execute(select(Account).where(Account.code == data.code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(409, f"An account with code '{data.code}' already exists.")
    account = Account(
        code=data.code,
        name=data.name,
        type=data.type,
        normal_balance=data.normal_balance,
        is_system=False,
        archived=False,
    )
    db.add(account)
    await db.flush()
    return account


async def update_account(db: AsyncSession, account_id: UUID, data: AccountUpdate) -> Account:
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(404, "Account not found")
    if data.archived is True and account.is_system:
        raise HTTPException(403, "System accounts cannot be archived.")
    if data.name is not None:
        account.name = data.name
    if data.archived is not None:
        account.archived = data.archived
    await db.flush()
    return account


async def delete_account(db: AsyncSession, account_id: UUID) -> None:
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(404, "Account not found")
    if account.is_system:
        raise HTTPException(403, "System accounts cannot be deleted.")
    # Check for journal line references
    count_result = await db.execute(
        select(sqlfunc.count()).select_from(JournalLine).where(JournalLine.account_id == account_id)
    )
    count = count_result.scalar_one()
    if count > 0:
        raise HTTPException(409, f"Account is referenced in {count} journal lines.")
    await db.delete(account)
    await db.flush()
```

- [ ] **Step 2: Run auto-draft tests — expect PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_auto_draft.py -v
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/accounting.py backend/services/__tests__/test_auto_draft.py
git commit -m "feat: add accounting service — auto-draft engine, balance check, void logic"
```

---

## Chunk 2: Expense & Invoice Payment Services

### Task 3: Invoice payment service

**Files:**
- Create: `backend/services/invoice_payments.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/services/__tests__/test_invoice_payments.py
# Integration-style — uses real DB session from conftest
import pytest
from decimal import Decimal
from uuid import uuid4


@pytest.mark.asyncio
async def test_record_payment_creates_draft_entry(db_session, sample_invoice):
    from backend.services.invoice_payments import record_payment
    from backend.schemas.accounting import InvoicePaymentCreate
    from backend.models.accounting import JournalEntry
    import datetime
    from sqlalchemy import select

    create = InvoicePaymentCreate(
        amount=Decimal("200"),
        payment_date=datetime.date.today(),
        account_id=sample_invoice.bank_account_id,
    )
    payment, entry = await record_payment(db_session, sample_invoice.id, create)
    assert payment.amount == Decimal("200")
    assert entry.status == "draft"
    assert entry.reference_type == "invoice_payment"


@pytest.mark.asyncio
async def test_delete_payment_blocked_if_entry_posted(db_session, sample_invoice_payment_posted):
    from backend.services.invoice_payments import delete_payment
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as exc:
        await delete_payment(db_session, sample_invoice_payment_posted.invoice_id, sample_invoice_payment_posted.id)
    assert exc.value.status_code == 409
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_invoice_payments.py -v 2>&1 | head -20
```

- [ ] **Step 3: Implement invoice payments service**

```python
# backend/services/invoice_payments.py
from __future__ import annotations
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from backend.models.accounting import InvoicePayment, JournalEntry
from backend.schemas.accounting import InvoicePaymentCreate
from backend.services.accounting import ensure_payment_draft


async def list_payments(db: AsyncSession, invoice_id: UUID) -> list[InvoicePayment]:
    result = await db.execute(
        select(InvoicePayment).where(InvoicePayment.invoice_id == invoice_id)
    )
    return list(result.scalars().all())


async def record_payment(
    db: AsyncSession, invoice_id: UUID, data: InvoicePaymentCreate
) -> tuple[InvoicePayment, JournalEntry]:
    payment = InvoicePayment(
        invoice_id=invoice_id,
        amount=data.amount,
        payment_date=data.payment_date,
        account_id=data.account_id,
        notes=data.notes,
    )
    db.add(payment)
    await db.flush()

    entry = await ensure_payment_draft(db, payment)
    return payment, entry


async def delete_payment(
    db: AsyncSession, invoice_id: UUID, payment_id: UUID
) -> None:
    result = await db.execute(
        select(InvoicePayment).where(
            InvoicePayment.id == payment_id,
            InvoicePayment.invoice_id == invoice_id,
        )
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(404, "Payment not found")

    # Find linked journal entry
    entry_result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.reference_type == "invoice_payment",
            JournalEntry.reference_id == payment_id,
        )
    )
    entry = entry_result.scalar_one_or_none()

    if entry and entry.status == "posted":
        raise HTTPException(
            409,
            "Cannot delete a payment with a posted journal entry. Void the journal entry first."
        )

    # Delete entry if draft or voided (cascade deletes lines)
    if entry is not None:
        await db.delete(entry)

    await db.delete(payment)
    await db.flush()
```

- [ ] **Step 4: Run tests — expect PASS (integration tests require DB setup in conftest)**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_invoice_payments.py -v
```

---

### Task 4: Expense service

**Files:**
- Create: `backend/services/expenses.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/services/__tests__/test_expenses.py
import pytest
from decimal import Decimal
from uuid import uuid4
import datetime


@pytest.mark.asyncio
async def test_create_expense_creates_draft(db_session, sample_expense_account, sample_bank_account):
    from backend.services.expenses import create_expense
    from backend.schemas.accounting import ExpenseCreate

    create = ExpenseCreate(
        date=datetime.date.today(),
        description="Test equipment",
        expense_account_id=sample_expense_account.id,
        amount=Decimal("300"),
        payment_status="paid",
        payment_account_id=sample_bank_account.id,
    )
    expense, entry = await create_expense(db_session, create)
    assert expense.amount == Decimal("300")
    assert entry.status == "draft"
    assert entry.reference_type == "expense"


@pytest.mark.asyncio
async def test_update_expense_blocked_if_posted(db_session, sample_posted_expense):
    from backend.services.expenses import update_expense
    from backend.schemas.accounting import ExpenseUpdate
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await update_expense(db_session, sample_posted_expense.id, ExpenseUpdate(description="Changed"))
    assert exc.value.status_code == 409
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_expenses.py -v 2>&1 | head -20
```

- [ ] **Step 3: Implement expense service**

```python
# backend/services/expenses.py
from __future__ import annotations
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from backend.models.accounting import Expense, JournalEntry
from backend.schemas.accounting import ExpenseCreate, ExpenseUpdate, ExpensePayRequest
from backend.services.accounting import ensure_expense_draft, ensure_expense_pay_draft


async def list_expenses(
    db: AsyncSession,
    *,
    expense_account_id: UUID | None = None,
    payment_status: str | None = None,
    start_date: object = None,
    end_date: object = None,
) -> list[Expense]:
    q = select(Expense).order_by(Expense.date.desc())
    if expense_account_id:
        q = q.where(Expense.expense_account_id == expense_account_id)
    if payment_status:
        q = q.where(Expense.payment_status == payment_status)
    if start_date:
        q = q.where(Expense.date >= start_date)
    if end_date:
        q = q.where(Expense.date <= end_date)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_expense(
    db: AsyncSession, data: ExpenseCreate
) -> tuple[Expense, JournalEntry]:
    expense = Expense(
        date=data.date,
        description=data.description,
        expense_account_id=data.expense_account_id,
        amount=data.amount,
        payment_status=data.payment_status,
        payment_account_id=data.payment_account_id,
        receipt_url=data.receipt_url,
        notes=data.notes,
    )
    db.add(expense)
    await db.flush()
    entry = await ensure_expense_draft(db, expense)
    return expense, entry


async def _get_linked_entry(db: AsyncSession, expense_id: UUID) -> JournalEntry | None:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.reference_type == "expense",
            JournalEntry.reference_id == expense_id,
            JournalEntry.status != "voided",
        )
    )
    return result.scalar_one_or_none()


async def update_expense(
    db: AsyncSession, expense_id: UUID, data: ExpenseUpdate
) -> Expense:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(404, "Expense not found")

    entry = await _get_linked_entry(db, expense_id)
    if entry and entry.status == "posted":
        raise HTTPException(
            409,
            "Cannot edit an expense with a posted journal entry. Void the entry first."
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)
    await db.flush()
    return expense


async def delete_expense(db: AsyncSession, expense_id: UUID) -> None:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(404, "Expense not found")

    entry = await _get_linked_entry(db, expense_id)
    if entry and entry.status == "posted":
        raise HTTPException(
            409,
            "Cannot delete an expense with a posted journal entry. Void the entry first."
        )
    if entry is not None:
        await db.delete(entry)
    await db.delete(expense)
    await db.flush()


async def pay_expense(
    db: AsyncSession, expense_id: UUID, data: ExpensePayRequest
) -> tuple[Expense, JournalEntry]:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(404, "Expense not found")
    if expense.payment_status != "payable":
        raise HTTPException(409, "Only payable expenses can be marked as paid.")

    expense.payment_status = "paid"
    expense.payment_account_id = data.payment_account_id
    await db.flush()

    entry = await ensure_expense_pay_draft(db, expense, data.payment_account_id)
    return expense, entry
```

- [ ] **Step 4: Run all service tests**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/ -v
```

Expected: All PASS (integration tests require DB conftest — pure function tests must pass without DB).

- [ ] **Step 5: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/invoice_payments.py backend/services/expenses.py backend/services/__tests__/test_invoice_payments.py backend/services/__tests__/test_expenses.py
git commit -m "feat: add invoice payment and expense services with auto-draft integration"
```
