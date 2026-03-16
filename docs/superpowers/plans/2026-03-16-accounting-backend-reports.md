# weCapture4U — Accounting Backend: Reports, Routers & Integration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all six accounting reports (P&L, Balance Sheet, Trial Balance, Cash Flow, Tax Summary, AR Aging) with CSV export, all FastAPI routers, and hook the auto-draft engine into the existing invoice and appointment services.

**Architecture:** Reports are pure SQL queries against `journal_lines` (posted only). CSV export uses FastAPI `StreamingResponse`. Routers are thin — services do all logic. Existing `services/invoices.py` and `services/appointments.py` call `ensure_invoice_draft` / `ensure_deposit_draft` after their mutations.

**Depends on:** Plans 8 and 9 (Accounting models, schemas, services).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Python `csv` stdlib.

---

## File Structure

```
backend/
  services/
    reports.py              # All six report functions
  routers/
    accounting.py           # All accounting endpoints (accounts, journal, expenses, payments, reports)
  main.py                   # Register accounting router
  services/invoices.py      # Add ensure_invoice_draft call on status → 'sent'
  services/appointments.py  # Add ensure_deposit_draft call on deposit_paid → True/False
```

---

## Chunk 1: Reports Service

### Task 1: Write failing report tests

**Files:**
- Create: `backend/services/__tests__/test_reports.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/services/__tests__/test_reports.py
import pytest
from decimal import Decimal
from backend.services.reports import (
    compute_pl,
    compute_trial_balance,
    balance_sheet_equation_holds,
)


def test_pl_revenue_minus_expenses():
    # Pure function — takes pre-aggregated account balances
    result = compute_pl(
        revenue_totals={"Session Fees": Decimal("1000")},
        expense_totals={"Equipment": Decimal("300")},
    )
    assert result["gross_revenue"] == Decimal("1000")
    assert result["total_expenses"] == Decimal("300")
    assert result["net_profit"] == Decimal("700")


def test_pl_loss():
    result = compute_pl(
        revenue_totals={"Session Fees": Decimal("200")},
        expense_totals={"Equipment": Decimal("500")},
    )
    assert result["net_profit"] == Decimal("-300")


def test_trial_balance_totals_match():
    # Trial balance: sum of all debit balances == sum of all credit balances
    rows = [
        {"account": "AR", "debit_balance": Decimal("500"), "credit_balance": Decimal("0")},
        {"account": "Revenue", "debit_balance": Decimal("0"), "credit_balance": Decimal("500")},
    ]
    total_debit, total_credit = compute_trial_balance(rows)
    assert total_debit == total_credit


def test_balance_sheet_equation():
    # Assets = Liabilities + Equity
    assert balance_sheet_equation_holds(
        total_assets=Decimal("10000"),
        total_liabilities=Decimal("3000"),
        total_equity=Decimal("7000"),
    ) is True


def test_balance_sheet_equation_fails():
    assert balance_sheet_equation_holds(
        total_assets=Decimal("10000"),
        total_liabilities=Decimal("3000"),
        total_equity=Decimal("6999"),
    ) is False
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_reports.py -v 2>&1 | head -20
```

---

### Task 2: Implement reports service

**Files:**
- Create: `backend/services/reports.py`

- [ ] **Step 1: Write the service**

```python
# backend/services/reports.py
"""
Report generation from posted journal lines.
Pure functions accept pre-aggregated data (for unit testability).
Async functions query the DB and call the pure functions.
"""
from __future__ import annotations
import csv
import io
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any
from sqlalchemy import select, func as sqlfunc, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from backend.models.accounting import (
    Account, JournalEntry, JournalLine, InvoicePayment,
)
from backend.models.invoices import Invoice


# ─── PURE FUNCTIONS ──────────────────────────────────────────────────────────

def compute_pl(
    revenue_totals: dict[str, Decimal],
    expense_totals: dict[str, Decimal],
) -> dict:
    gross_revenue = sum(revenue_totals.values(), Decimal("0"))
    total_expenses = sum(expense_totals.values(), Decimal("0"))
    return {
        "gross_revenue": gross_revenue,
        "revenue_by_account": revenue_totals,
        "total_expenses": total_expenses,
        "expenses_by_account": expense_totals,
        "net_profit": gross_revenue - total_expenses,
    }


def compute_trial_balance(
    rows: list[dict],
) -> tuple[Decimal, Decimal]:
    total_debit = sum(r["debit_balance"] for r in rows)
    total_credit = sum(r["credit_balance"] for r in rows)
    return total_debit, total_credit


def balance_sheet_equation_holds(
    total_assets: Decimal,
    total_liabilities: Decimal,
    total_equity: Decimal,
) -> bool:
    return total_assets == total_liabilities + total_equity


def rows_to_csv(headers: list[str], rows: list[list]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue()


# ─── DB HELPERS ───────────────────────────────────────────────────────────────

async def _account_balances(
    db: AsyncSession,
    *,
    account_types: list[str] | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    as_of_date: date | None = None,
) -> list[dict]:
    """
    Sum posted debit and credit lines per account, optionally filtered by date range.
    Returns: [{"account": Account, "total_debit": Decimal, "total_credit": Decimal}]
    """
    q = (
        select(
            Account,
            sqlfunc.coalesce(sqlfunc.sum(JournalLine.debit), 0).label("total_debit"),
            sqlfunc.coalesce(sqlfunc.sum(JournalLine.credit), 0).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
        .where(JournalEntry.status == "posted")
    )
    if account_types:
        q = q.where(Account.type.in_(account_types))
    if start_date:
        q = q.where(JournalEntry.date >= start_date)
    if end_date or as_of_date:
        cutoff = end_date or as_of_date
        q = q.where(JournalEntry.date <= cutoff)
    q = q.group_by(Account.id).order_by(Account.code)
    result = await db.execute(q)
    return [
        {
            "account": row.Account,
            "total_debit": Decimal(str(row.total_debit)),
            "total_credit": Decimal(str(row.total_credit)),
        }
        for row in result.all()
    ]


def _net_balance(row: dict) -> Decimal:
    """Net balance respecting normal balance direction."""
    acct = row["account"]
    if acct.normal_balance == "debit":
        return row["total_debit"] - row["total_credit"]
    else:
        return row["total_credit"] - row["total_debit"]


# ─── P&L REPORT ───────────────────────────────────────────────────────────────

async def get_pl(
    db: AsyncSession, start_date: date, end_date: date
) -> dict:
    rows = await _account_balances(
        db, account_types=["revenue", "expense"], start_date=start_date, end_date=end_date
    )
    revenue_totals: dict[str, Decimal] = {}
    expense_totals: dict[str, Decimal] = {}
    for row in rows:
        acct = row["account"]
        balance = _net_balance(row)
        if acct.type == "revenue":
            revenue_totals[acct.name] = balance
        else:
            expense_totals[acct.name] = balance
    return compute_pl(revenue_totals=revenue_totals, expense_totals=expense_totals)


def pl_to_csv(pl: dict) -> str:
    rows = [["Account", "Type", "Amount"]]
    for name, amount in pl["revenue_by_account"].items():
        rows.append([name, "Revenue", str(amount)])
    for name, amount in pl["expenses_by_account"].items():
        rows.append([name, "Expense", str(amount)])
    rows.append(["Net Profit", "", str(pl["net_profit"])])
    return rows_to_csv(rows[0], rows[1:])


# ─── BALANCE SHEET ────────────────────────────────────────────────────────────

async def get_balance_sheet(db: AsyncSession, as_of_date: date) -> dict:
    rows = await _account_balances(
        db,
        account_types=["asset", "liability", "equity"],
        as_of_date=as_of_date,
    )
    assets: list[dict] = []
    liabilities: list[dict] = []
    equity: list[dict] = []
    for row in rows:
        acct = row["account"]
        balance = _net_balance(row)
        entry = {"code": acct.code, "name": acct.name, "balance": balance}
        if acct.type == "asset":
            assets.append(entry)
        elif acct.type == "liability":
            liabilities.append(entry)
        else:
            equity.append(entry)
    total_assets = sum(a["balance"] for a in assets)
    total_liabilities = sum(l["balance"] for l in liabilities)
    total_equity = sum(e["balance"] for e in equity)
    balanced = balance_sheet_equation_holds(total_assets, total_liabilities, total_equity)
    return {
        "as_of_date": as_of_date.isoformat(),
        "assets": assets, "total_assets": total_assets,
        "liabilities": liabilities, "total_liabilities": total_liabilities,
        "equity": equity, "total_equity": total_equity,
        "balanced": balanced,
    }


# ─── TRIAL BALANCE ────────────────────────────────────────────────────────────

async def get_trial_balance(db: AsyncSession, as_of_date: date) -> dict:
    rows = await _account_balances(db, as_of_date=as_of_date)
    tb_rows = []
    for row in rows:
        acct = row["account"]
        debit_bal = row["total_debit"] - row["total_credit"]
        credit_bal = Decimal("0")
        if debit_bal < 0:
            credit_bal = abs(debit_bal)
            debit_bal = Decimal("0")
        tb_rows.append({
            "code": acct.code, "name": acct.name,
            "debit_balance": debit_bal, "credit_balance": credit_bal,
        })
    total_debit, total_credit = compute_trial_balance(tb_rows)
    return {"rows": tb_rows, "total_debit": total_debit, "total_credit": total_credit}


# ─── CASH FLOW ────────────────────────────────────────────────────────────────

async def get_cash_flow(db: AsyncSession, start_date: date, end_date: date) -> dict:
    """
    Direct method: all movements in Cash on Hand (1000) + Business Bank Account (1010).
    """
    cash_account_codes = ["1000", "1010"]
    q = (
        select(
            JournalLine.debit,
            JournalLine.credit,
            JournalEntry.description,
            JournalEntry.date,
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
        .join(Account, Account.id == JournalLine.account_id)
        .where(
            JournalEntry.status == "posted",
            JournalEntry.date >= start_date,
            JournalEntry.date <= end_date,
            Account.code.in_(cash_account_codes),
        )
        .order_by(JournalEntry.date)
    )
    result = await db.execute(q)
    rows = result.all()
    total_inflows = sum(r.debit for r in rows if r.debit > 0)
    total_outflows = sum(r.credit for r in rows if r.credit > 0)
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_inflows": Decimal(str(total_inflows)),
        "total_outflows": Decimal(str(total_outflows)),
        "net_change": Decimal(str(total_inflows)) - Decimal(str(total_outflows)),
        "lines": [
            {
                "date": r.date.isoformat(),
                "description": r.description,
                "inflow": Decimal(str(r.debit)) if r.debit > 0 else Decimal("0"),
                "outflow": Decimal(str(r.credit)) if r.credit > 0 else Decimal("0"),
            }
            for r in rows
        ],
    }


# ─── TAX SUMMARY ─────────────────────────────────────────────────────────────

async def get_tax_summary(
    db: AsyncSession, start_date: date, end_date: date, tax_enabled: bool
) -> dict:
    if not tax_enabled:
        raise HTTPException(404, "Tax reporting is disabled. Enable tax in Settings.")
    pl = await get_pl(db, start_date, end_date)
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_income": pl["gross_revenue"],
        "deductible_expenses": pl["expenses_by_account"],
        "total_expenses": pl["total_expenses"],
        "net_profit": pl["net_profit"],
    }


# ─── AR AGING ─────────────────────────────────────────────────────────────────

async def get_ar_aging(db: AsyncSession, as_of_date: date) -> dict:
    """
    Outstanding invoice balances grouped by age.
    Balance = total - SUM(invoice_payments.amount) for each invoice.
    """
    result = await db.execute(
        select(Invoice).where(Invoice.status != "paid")
    )
    invoices = result.scalars().all()

    buckets: dict[str, list[dict]] = {
        "0_30": [], "31_60": [], "61_90": [], "90_plus": []
    }

    for inv in invoices:
        # Calculate balance
        pmt_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(InvoicePayment.amount), 0))
            .where(InvoicePayment.invoice_id == inv.id)
        )
        paid = Decimal(str(pmt_result.scalar_one()))
        balance = inv.total - paid
        if balance <= 0:
            continue

        # Calculate days overdue
        if inv.due_date is None:
            days = 0
        else:
            days = (as_of_date - inv.due_date).days

        entry = {
            "invoice_id": str(inv.id),
            "client_id": str(inv.client_id),
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "balance": balance,
            "days_overdue": max(0, days),
        }

        if days <= 30:
            buckets["0_30"].append(entry)
        elif days <= 60:
            buckets["31_60"].append(entry)
        elif days <= 90:
            buckets["61_90"].append(entry)
        else:
            buckets["90_plus"].append(entry)

    return {
        "as_of_date": as_of_date.isoformat(),
        "buckets": buckets,
        "total_outstanding": sum(
            e["balance"] for bucket in buckets.values() for e in bucket
        ),
    }
```

- [ ] **Step 2: Run report tests**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_reports.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/reports.py backend/services/__tests__/test_reports.py
git commit -m "feat: add accounting reports service (P&L, Balance Sheet, Trial Balance, Cash Flow, Tax, AR Aging)"
```

---

## Chunk 2: Routers + Integration

### Task 3: Accounting router

**Files:**
- Create: `backend/routers/accounting.py`

- [ ] **Step 1: Write the router**

```python
# backend/routers/accounting.py
from __future__ import annotations
import io
from datetime import date
from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.auth import get_current_admin
from backend.models.accounting import Account, JournalEntry, JournalLine
from backend.schemas.accounting import (
    AccountCreate, AccountUpdate, AccountOut, AccountLedgerOut, LedgerLine,
    JournalEntryCreate, JournalEntryUpdate, JournalEntryOut, JournalEntryListItem,
    ExpenseCreate, ExpenseUpdate, ExpensePayRequest, ExpenseOut,
    InvoicePaymentCreate, InvoicePaymentOut,
    AutoDraftPreviewRequest,
)
from backend.services.accounting import (
    create_account, update_account, delete_account,
    post_journal_entry, void_journal_entry,
    ensure_invoice_draft, ensure_payment_draft, ensure_deposit_draft,
    ensure_expense_draft,
)
from backend.services.expenses import (
    list_expenses, create_expense, update_expense, delete_expense, pay_expense,
)
from backend.services.invoice_payments import list_payments, record_payment, delete_payment
from backend.services import reports as report_svc

router = APIRouter(prefix="/api", tags=["accounting"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(get_current_admin)]


# ─── ACCOUNTS ─────────────────────────────────────────────────────────────────

@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(
    db: DbDep, admin: AdminDep,
    type: str | None = None,
    archived: bool = False,
):
    q = select(Account).order_by(Account.code)
    if type:
        q = q.where(Account.type == type)
    if not archived:
        q = q.where(Account.archived == False)  # noqa: E712
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/accounts", response_model=AccountOut, status_code=201)
async def create_account_route(db: DbDep, admin: AdminDep, data: AccountCreate):
    account = await create_account(db, data)
    await db.commit()
    return account


@router.get("/accounts/{account_id}", response_model=AccountOut)
async def get_account(db: DbDep, admin: AdminDep, account_id: UUID):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        from fastapi import HTTPException
        raise HTTPException(404, "Account not found")
    return account


@router.patch("/accounts/{account_id}", response_model=AccountOut)
async def update_account_route(db: DbDep, admin: AdminDep, account_id: UUID, data: AccountUpdate):
    account = await update_account(db, account_id, data)
    await db.commit()
    return account


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account_route(db: DbDep, admin: AdminDep, account_id: UUID):
    await delete_account(db, account_id)
    await db.commit()


@router.get("/accounts/{account_id}/ledger", response_model=AccountLedgerOut)
async def get_account_ledger(
    db: DbDep, admin: AdminDep,
    account_id: UUID,
    start_date: date | None = None,
    end_date: date | None = None,
):
    from fastapi import HTTPException
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(404, "Account not found")

    q = (
        select(JournalLine, JournalEntry)
        .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
        .where(
            JournalLine.account_id == account_id,
            JournalEntry.status == "posted",
        )
        .order_by(JournalEntry.date)
    )
    if start_date:
        q = q.where(JournalEntry.date >= start_date)
    if end_date:
        q = q.where(JournalEntry.date <= end_date)
    rows = (await db.execute(q)).all()

    running = account_out = AccountOut.model_validate(account)
    running_balance = 0
    lines = []
    from decimal import Decimal
    running_balance = Decimal("0")
    for line, entry in rows:
        if account.normal_balance == "debit":
            running_balance += line.debit - line.credit
        else:
            running_balance += line.credit - line.debit
        lines.append(LedgerLine(
            entry_id=entry.id,
            date=entry.date,
            description=entry.description,
            debit=line.debit,
            credit=line.credit,
            running_balance=running_balance,
        ))
    return AccountLedgerOut(
        account=account_out,
        opening_balance=Decimal("0"),
        lines=lines,
        closing_balance=running_balance,
    )


# ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────────

@router.get("/journal-entries", response_model=list[JournalEntryListItem])
async def list_journal_entries(
    db: DbDep, admin: AdminDep,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    reference_type: str | None = None,
    account_id: UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from sqlalchemy import select as sa_select
    q = sa_select(
        JournalEntry,
        sqlfunc.coalesce(sqlfunc.sum(JournalLine.debit), 0).label("total_debit"),
    ).outerjoin(JournalLine, JournalLine.entry_id == JournalEntry.id).group_by(JournalEntry.id)
    if status:
        q = q.where(JournalEntry.status == status)
    if start_date:
        q = q.where(JournalEntry.date >= start_date)
    if end_date:
        q = q.where(JournalEntry.date <= end_date)
    if reference_type:
        q = q.where(JournalEntry.reference_type == reference_type)
    if account_id:
        q = q.where(JournalLine.account_id == account_id)
    q = q.order_by(JournalEntry.date.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    from decimal import Decimal
    items = []
    for row in result.all():
        entry = row[0]
        items.append(JournalEntryListItem(
            id=entry.id, date=entry.date, description=entry.description,
            reference_type=entry.reference_type, status=entry.status,
            created_by=entry.created_by, total_debit=Decimal(str(row[1])),
        ))
    return items


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryOut)
async def get_journal_entry(db: DbDep, admin: AdminDep, entry_id: UUID):
    from fastapi import HTTPException
    result = await db.execute(
        select(JournalEntry).where(JournalEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(404, "Journal entry not found")
    # Load lines with account info
    lines_result = await db.execute(
        select(JournalLine, Account)
        .join(Account, Account.id == JournalLine.account_id)
        .where(JournalLine.entry_id == entry_id)
    )
    from backend.schemas.accounting import JournalLineOut
    lines = [
        JournalLineOut(
            id=line.id, account_id=line.account_id,
            account_name=acct.name, account_code=acct.code,
            debit=line.debit, credit=line.credit, description=line.description,
        )
        for line, acct in lines_result.all()
    ]
    return JournalEntryOut(
        id=entry.id, date=entry.date, description=entry.description,
        reference_type=entry.reference_type, reference_id=entry.reference_id,
        status=entry.status, created_by=entry.created_by,
        void_of=entry.void_of, lines=lines,
    )


@router.post("/journal-entries", response_model=JournalEntryOut, status_code=201)
async def create_journal_entry(db: DbDep, admin: AdminDep, data: JournalEntryCreate):
    from backend.services.accounting import _create_entry_with_lines
    lines = [
        {"account_id": l.account_id, "debit": l.debit, "credit": l.credit, "description": l.description}
        for l in data.lines
    ]
    entry = await _create_entry_with_lines(
        db, date=data.date, description=data.description,
        reference_type=None, reference_id=None,
        status="draft", created_by="manual", lines=lines,
    )
    await db.commit()
    return await get_journal_entry(db, admin, entry.id)


@router.post("/journal-entries/preview", response_model=JournalEntryOut)
async def preview_auto_draft(db: DbDep, admin: AdminDep, data: AutoDraftPreviewRequest):
    """Generate auto-draft preview without committing to DB."""
    # This route MUST be declared before /journal-entries/{entry_id} in FastAPI
    from fastapi import HTTPException
    raise HTTPException(501, "Preview endpoint not yet implemented")


@router.patch("/journal-entries/{entry_id}", response_model=JournalEntryOut)
async def update_journal_entry(db: DbDep, admin: AdminDep, entry_id: UUID, data: JournalEntryUpdate):
    from fastapi import HTTPException
    result = await db.execute(select(JournalEntry).where(JournalEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(404, "Journal entry not found")
    if entry.status != "draft":
        raise HTTPException(409, "Cannot modify a posted or voided entry. Void it first.")
    if data.date is not None:
        entry.date = data.date
    if data.description is not None:
        entry.description = data.description
    if data.lines is not None:
        # Replace all lines
        await db.execute(
            JournalLine.__table__.delete().where(JournalLine.entry_id == entry_id)
        )
        for l in data.lines:
            db.add(JournalLine(
                entry_id=entry_id,
                account_id=l.account_id,
                debit=l.debit,
                credit=l.credit,
                description=l.description,
            ))
    await db.commit()
    return await get_journal_entry(db, admin, entry_id)


@router.post("/journal-entries/{entry_id}/post", response_model=JournalEntryOut)
async def post_entry(db: DbDep, admin: AdminDep, entry_id: UUID):
    entry = await post_journal_entry(db, entry_id)
    await db.commit()
    return await get_journal_entry(db, admin, entry_id)


@router.post("/journal-entries/{entry_id}/void", response_model=JournalEntryOut)
async def void_entry(db: DbDep, admin: AdminDep, entry_id: UUID):
    reversing = await void_journal_entry(db, entry_id)
    await db.commit()
    return await get_journal_entry(db, admin, reversing.id)


# ─── EXPENSES ─────────────────────────────────────────────────────────────────

@router.get("/expenses", response_model=list[ExpenseOut])
async def list_expenses_route(
    db: DbDep, admin: AdminDep,
    expense_account_id: UUID | None = None,
    payment_status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    return await list_expenses(
        db, expense_account_id=expense_account_id,
        payment_status=payment_status, start_date=start_date, end_date=end_date,
    )


@router.get("/expenses/{expense_id}", response_model=ExpenseOut)
async def get_expense(db: DbDep, admin: AdminDep, expense_id: UUID):
    from fastapi import HTTPException
    from backend.models.accounting import Expense
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(404, "Expense not found")
    return expense


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense_route(db: DbDep, admin: AdminDep, data: ExpenseCreate):
    expense, entry = await create_expense(db, data)
    await db.commit()
    return expense


@router.patch("/expenses/{expense_id}", response_model=ExpenseOut)
async def update_expense_route(db: DbDep, admin: AdminDep, expense_id: UUID, data: ExpenseUpdate):
    expense = await update_expense(db, expense_id, data)
    await db.commit()
    return expense


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense_route(db: DbDep, admin: AdminDep, expense_id: UUID):
    await delete_expense(db, expense_id)
    await db.commit()


@router.post("/expenses/{expense_id}/pay", response_model=ExpenseOut)
async def pay_expense_route(db: DbDep, admin: AdminDep, expense_id: UUID, data: ExpensePayRequest):
    expense, entry = await pay_expense(db, expense_id, data)
    await db.commit()
    return expense


# ─── INVOICE PAYMENTS ─────────────────────────────────────────────────────────

@router.get("/invoices/{invoice_id}/payments", response_model=list[InvoicePaymentOut])
async def list_invoice_payments(db: DbDep, admin: AdminDep, invoice_id: UUID):
    return await list_payments(db, invoice_id)


@router.post("/invoices/{invoice_id}/payments", response_model=InvoicePaymentOut, status_code=201)
async def record_invoice_payment(
    db: DbDep, admin: AdminDep, invoice_id: UUID, data: InvoicePaymentCreate
):
    payment, entry = await record_payment(db, invoice_id, data)
    await db.commit()
    return payment


@router.delete("/invoices/{invoice_id}/payments/{payment_id}", status_code=204)
async def delete_invoice_payment(db: DbDep, admin: AdminDep, invoice_id: UUID, payment_id: UUID):
    await delete_payment(db, invoice_id, payment_id)
    await db.commit()


# ─── REPORTS ──────────────────────────────────────────────────────────────────

def _format_response(data: dict, fmt: str, csv_fn):
    if fmt == "csv":
        csv_str = csv_fn(data)
        return StreamingResponse(
            io.StringIO(csv_str),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=report.csv"},
        )
    return data


@router.get("/reports/pl")
async def report_pl(
    db: DbDep, admin: AdminDep,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: Literal["json", "csv"] = "json",
):
    data = await report_svc.get_pl(db, start_date, end_date)
    return _format_response(data, format, report_svc.pl_to_csv)


@router.get("/reports/balance-sheet")
async def report_balance_sheet(
    db: DbDep, admin: AdminDep,
    as_of_date: date = Query(...),
    format: Literal["json", "csv"] = "json",
):
    data = await report_svc.get_balance_sheet(db, as_of_date)
    if format == "csv":
        rows = (
            [["Type", "Code", "Name", "Balance"]] +
            [["Asset", r["code"], r["name"], str(r["balance"])] for r in data["assets"]] +
            [["Liability", r["code"], r["name"], str(r["balance"])] for r in data["liabilities"]] +
            [["Equity", r["code"], r["name"], str(r["balance"])] for r in data["equity"]]
        )
        csv_str = report_svc.rows_to_csv(rows[0], rows[1:])
        return StreamingResponse(io.StringIO(csv_str), media_type="text/csv",
                                  headers={"Content-Disposition": "attachment; filename=balance_sheet.csv"})
    return data


@router.get("/reports/trial-balance")
async def report_trial_balance(
    db: DbDep, admin: AdminDep,
    as_of_date: date = Query(...),
    format: Literal["json", "csv"] = "json",
):
    data = await report_svc.get_trial_balance(db, as_of_date)
    if format == "csv":
        headers = ["Code", "Name", "Debit Balance", "Credit Balance"]
        rows = [[r["code"], r["name"], str(r["debit_balance"]), str(r["credit_balance"])] for r in data["rows"]]
        rows.append(["", "TOTALS", str(data["total_debit"]), str(data["total_credit"])])
        csv_str = report_svc.rows_to_csv(headers, rows)
        return StreamingResponse(io.StringIO(csv_str), media_type="text/csv",
                                  headers={"Content-Disposition": "attachment; filename=trial_balance.csv"})
    return data


@router.get("/reports/cash-flow")
async def report_cash_flow(
    db: DbDep, admin: AdminDep,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: Literal["json", "csv"] = "json",
):
    data = await report_svc.get_cash_flow(db, start_date, end_date)
    if format == "csv":
        headers = ["Date", "Description", "Inflow", "Outflow"]
        rows = [[l["date"], l["description"], str(l["inflow"]), str(l["outflow"])] for l in data["lines"]]
        csv_str = report_svc.rows_to_csv(headers, rows)
        return StreamingResponse(io.StringIO(csv_str), media_type="text/csv",
                                  headers={"Content-Disposition": "attachment; filename=cash_flow.csv"})
    return data


@router.get("/reports/tax-summary")
async def report_tax_summary(
    db: DbDep, admin: AdminDep,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: Literal["json", "csv"] = "json",
):
    from sqlalchemy import select as sa_select
    from backend.models.admin import AppSettings
    settings_result = await db.execute(sa_select(AppSettings))
    settings = settings_result.scalar_one_or_none()
    tax_enabled = settings.tax_enabled if settings else False
    data = await report_svc.get_tax_summary(db, start_date, end_date, tax_enabled)
    return data


@router.get("/reports/ar-aging")
async def report_ar_aging(
    db: DbDep, admin: AdminDep,
    as_of_date: date = Query(...),
    format: Literal["json", "csv"] = "json",
):
    data = await report_svc.get_ar_aging(db, as_of_date)
    return data
```

- [ ] **Step 2: No automated test for routers — covered by integration tests**

---

### Task 4: Register router in main.py + hook invoice/appointment services

**Files:**
- Modify: `backend/main.py` — add accounting router
- Modify: `backend/services/invoices.py` — call `ensure_invoice_draft` on status → 'sent'
- Modify: `backend/services/appointments.py` — call `ensure_deposit_draft` on deposit_paid toggle

- [ ] **Step 1: Write failing integration test**

```python
# backend/routers/__tests__/test_accounting_router.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_accounts_list_returns_seeded_accounts(client: AsyncClient, admin_token: str):
    response = await client.get(
        "/api/accounts",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    accounts = response.json()
    codes = [a["code"] for a in accounts]
    assert "1100" in codes  # Accounts Receivable
    assert "4000" in codes  # Session Fees


@pytest.mark.asyncio
async def test_create_account(client: AsyncClient, admin_token: str):
    response = await client.post(
        "/api/accounts",
        json={"code": "9999", "name": "Test Account", "type": "expense"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201
    assert response.json()["code"] == "9999"
```

- [ ] **Step 2: Run — expect 404 (route not registered)**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/routers/__tests__/test_accounting_router.py -v 2>&1 | head -20
```

- [ ] **Step 3: Register accounting router in main.py**

In `backend/main.py`, add alongside other router imports:

```python
from backend.routers.accounting import router as accounting_router
# Inside the lifespan/startup or app factory, add:
app.include_router(accounting_router)
```

- [ ] **Step 4: Hook ensure_invoice_draft into invoices service**

In `backend/services/invoices.py`, locate the `update_invoice` function where `status` is changed. After the status is set to `'sent'`:

```python
if new_status == "sent" and old_status != "sent":
    from backend.services.accounting import ensure_invoice_draft
    await ensure_invoice_draft(db, invoice_id)
```

- [ ] **Step 5: Hook ensure_deposit_draft into appointments service**

In `backend/services/appointments.py`, locate where `deposit_paid` is toggled:

```python
# When deposit_paid → True:
if data.deposit_paid is True and not old_deposit_paid:
    from backend.services.accounting import ensure_deposit_draft
    await ensure_deposit_draft(db, appointment_id)

# When deposit_paid → False (and was True):
if data.deposit_paid is False and old_deposit_paid:
    # Void existing non-voided deposit draft
    from sqlalchemy import select
    from backend.models.accounting import JournalEntry
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.reference_type == "appointment",
            JournalEntry.reference_id == appointment_id,
            JournalEntry.created_by == "system",
            JournalEntry.status != "voided",
        )
    )
    entry = result.scalar_one_or_none()
    if entry is not None and entry.status == "posted":
        from backend.services.accounting import void_journal_entry
        await void_journal_entry(db, entry.id)
    elif entry is not None:
        await db.delete(entry)
```

- [ ] **Step 6: Run accounting router integration tests**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/routers/__tests__/test_accounting_router.py -v
```

Expected: All PASS.

- [ ] **Step 7: Run full backend test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/ -v
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/routers/accounting.py backend/main.py backend/services/invoices.py backend/services/appointments.py backend/routers/__tests__/test_accounting_router.py
git commit -m "feat: add accounting router, register with FastAPI, hook auto-draft into invoice and appointment services"
```
