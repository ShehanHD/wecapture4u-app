# Accounting Reports Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 accounting report endpoints (P&L, Balance Sheet, Trial Balance, Cash Flow, Tax Summary, AR Aging) with JSON + CSV export.

**Architecture:** Pure service layer functions query `journal_lines` (posted entries only) via SQLAlchemy 2.0 async. A thin router calls the service and returns JSON or `StreamingResponse` for CSV. Cash flow uses `invoice_payments` and `expenses` tables directly (actual cash transactions). AR aging queries outstanding invoices grouped by days overdue.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Python `csv` stdlib, pytest-asyncio, httpx AsyncClient

---

## File Structure

```
backend/
  services/
    reports.py              # Create: 6 report functions + 6 CSV serializers + shared helpers
  routers/
    reports.py              # Create: 6 GET endpoints with ?format=csv support
  tests/
    test_routers_reports.py # Create: 6 tests + 2 CSV format tests
  main.py                   # Modify: register reports_router
```

---

### Task 1: Write failing tests

**Files:**
- Create: `backend/tests/test_routers_reports.py`

- [ ] **Step 1: Write the test file**

```python
# backend/tests/test_routers_reports.py
from __future__ import annotations
import uuid
from datetime import date
from decimal import Decimal

import pytest

from models.account import Account
from models.client import Client
from models.expense import Expense
from models.invoice import Invoice, InvoicePayment
from models.journal import JournalEntry, JournalLine


# ─── helpers ──────────────────────────────────────────────────────────────────

async def _make_account(db, type_: str, normal_balance: str) -> Account:
    acct = Account(
        code=uuid.uuid4().hex[:8],
        name=f"Test {type_.title()} {uuid.uuid4().hex[:4]}",
        type=type_,
        normal_balance=normal_balance,
        is_system=False,
        archived=False,
    )
    db.add(acct)
    await db.flush()
    return acct


async def _post_entry(
    db,
    date_: date,
    lines: list[tuple[Account, Decimal, Decimal]],
) -> JournalEntry:
    """Create a posted journal entry with the given lines."""
    entry = JournalEntry(
        date=date_,
        description="Test entry",
        status="posted",
        created_by="test",
    )
    db.add(entry)
    await db.flush()
    for acct, debit, credit in lines:
        db.add(JournalLine(
            entry_id=entry.id,
            account_id=acct.id,
            debit=debit,
            credit=credit,
            description="",
        ))
    await db.flush()
    return entry


# ─── P&L ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pl_report(test_client, admin_auth_headers, db_session):
    """P&L returns correct revenue and expense totals for a date range."""
    asset = await _make_account(db_session, "asset", "debit")
    revenue = await _make_account(db_session, "revenue", "credit")
    expense = await _make_account(db_session, "expense", "debit")

    # Revenue entry: debit asset $500, credit revenue $500
    await _post_entry(db_session, date(2099, 6, 1), [
        (asset, Decimal("500"), Decimal("0")),
        (revenue, Decimal("0"), Decimal("500")),
    ])
    # Expense entry: debit expense $200, credit asset $200
    await _post_entry(db_session, date(2099, 6, 2), [
        (expense, Decimal("200"), Decimal("0")),
        (asset, Decimal("0"), Decimal("200")),
    ])

    resp = await test_client.get(
        "/api/reports/pl",
        params={"start_date": "2099-06-01", "end_date": "2099-06-30"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_revenue"] == "500.00"
    assert data["total_expenses"] == "200.00"
    assert data["net_profit"] == "300.00"
    assert revenue.name in data["revenue_by_account"]
    assert expense.name in data["expenses_by_account"]


@pytest.mark.asyncio
async def test_pl_csv(test_client, admin_auth_headers, db_session):
    """P&L with format=csv returns text/csv."""
    asset = await _make_account(db_session, "asset", "debit")
    revenue = await _make_account(db_session, "revenue", "credit")
    await _post_entry(db_session, date(2099, 7, 1), [
        (asset, Decimal("100"), Decimal("0")),
        (revenue, Decimal("0"), Decimal("100")),
    ])
    resp = await test_client.get(
        "/api/reports/pl",
        params={"start_date": "2099-07-01", "end_date": "2099-07-31", "format": "csv"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "content-disposition" in resp.headers


# ─── Balance Sheet ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_balance_sheet(test_client, admin_auth_headers, db_session):
    """Balance sheet returns our test accounts with correct balances."""
    asset = await _make_account(db_session, "asset", "debit")
    equity = await _make_account(db_session, "equity", "credit")

    # Entry: debit asset $1000, credit equity $1000
    await _post_entry(db_session, date(2099, 6, 1), [
        (asset, Decimal("1000"), Decimal("0")),
        (equity, Decimal("0"), Decimal("1000")),
    ])

    resp = await test_client.get(
        "/api/reports/balance-sheet",
        params={"as_of_date": "2099-12-31"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    our_asset = next((a for a in data["assets"] if a["name"] == asset.name), None)
    our_equity = next((e for e in data["equity"] if e["name"] == equity.name), None)
    assert our_asset is not None
    assert our_asset["balance"] == "1000.00"
    assert our_equity is not None
    assert our_equity["balance"] == "1000.00"


# ─── Trial Balance ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_trial_balance(test_client, admin_auth_headers, db_session):
    """Trial balance includes our test accounts and reports as balanced."""
    asset = await _make_account(db_session, "asset", "debit")
    revenue = await _make_account(db_session, "revenue", "credit")

    await _post_entry(db_session, date(2099, 6, 1), [
        (asset, Decimal("750"), Decimal("0")),
        (revenue, Decimal("0"), Decimal("750")),
    ])

    resp = await test_client.get(
        "/api/reports/trial-balance",
        params={"as_of_date": "2099-12-31"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["balanced"] is True

    asset_row = next((r for r in data["rows"] if r["name"] == asset.name), None)
    rev_row = next((r for r in data["rows"] if r["name"] == revenue.name), None)
    assert asset_row is not None
    assert asset_row["debit_balance"] == "750.00"
    assert asset_row["credit_balance"] == "0.00"
    assert rev_row is not None
    assert rev_row["credit_balance"] == "750.00"
    assert rev_row["debit_balance"] == "0.00"


# ─── Cash Flow ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cash_flow(test_client, admin_auth_headers, db_session):
    """Cash flow sums invoice payments (in) and paid expenses (out) in the period."""
    # Seed client + invoice + payment (cash in $400)
    client = Client(
        name=f"CF Client {uuid.uuid4().hex[:4]}",
        email=f"cf_{uuid.uuid4().hex[:6]}@test.internal",
    )
    db_session.add(client)
    await db_session.flush()

    invoice = Invoice(
        client_id=client.id,
        status="paid",
        total=Decimal("400"),
        balance_due=Decimal("0"),
        subtotal=Decimal("400"),
    )
    db_session.add(invoice)
    await db_session.flush()

    asset = await _make_account(db_session, "asset", "debit")
    db_session.add(InvoicePayment(
        invoice_id=invoice.id,
        amount=Decimal("400"),
        payment_date=date(2099, 6, 15),
        account_id=asset.id,
    ))

    # Seed a paid expense (cash out $150)
    exp_acct = await _make_account(db_session, "expense", "debit")
    db_session.add(Expense(
        date=date(2099, 6, 10),
        description="Test CF Expense",
        expense_account_id=exp_acct.id,
        amount=Decimal("150"),
        payment_status="paid",
        payment_account_id=asset.id,
    ))
    await db_session.flush()

    resp = await test_client.get(
        "/api/reports/cash-flow",
        params={"start_date": "2099-06-01", "end_date": "2099-06-30"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cash_collected"] == "400.00"
    assert data["cash_spent"] == "150.00"
    assert data["net_change"] == "250.00"


# ─── Tax Summary ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tax_summary(test_client, admin_auth_headers, db_session):
    """Tax summary returns taxable revenue, deductible expenses, net taxable income."""
    asset = await _make_account(db_session, "asset", "debit")
    revenue = await _make_account(db_session, "revenue", "credit")
    expense = await _make_account(db_session, "expense", "debit")

    await _post_entry(db_session, date(2099, 6, 1), [
        (asset, Decimal("600"), Decimal("0")),
        (revenue, Decimal("0"), Decimal("600")),
    ])
    await _post_entry(db_session, date(2099, 6, 2), [
        (expense, Decimal("100"), Decimal("0")),
        (asset, Decimal("0"), Decimal("100")),
    ])

    resp = await test_client.get(
        "/api/reports/tax-summary",
        params={"start_date": "2099-06-01", "end_date": "2099-06-30"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["taxable_revenue"] == "600.00"
    assert data["total_deductible_expenses"] == "100.00"
    assert data["net_taxable_income"] == "500.00"


# ─── AR Aging ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ar_aging(test_client, admin_auth_headers, db_session):
    """AR aging buckets an overdue invoice correctly."""
    client = Client(
        name=f"AR Client {uuid.uuid4().hex[:4]}",
        email=f"ar_{uuid.uuid4().hex[:6]}@test.internal",
    )
    db_session.add(client)
    await db_session.flush()

    # due_date = 2099-05-01, as_of = 2099-06-15 → 45 days overdue → "31_60" bucket
    invoice = Invoice(
        client_id=client.id,
        status="sent",
        total=Decimal("300"),
        balance_due=Decimal("300"),
        subtotal=Decimal("300"),
        due_date=date(2099, 5, 1),
    )
    db_session.add(invoice)
    await db_session.flush()

    resp = await test_client.get(
        "/api/reports/ar-aging",
        params={"as_of_date": "2099-06-15"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    bucket = data["buckets"]["31_60"]
    our_entry = next((e for e in bucket if e["invoice_id"] == str(invoice.id)), None)
    assert our_entry is not None
    assert our_entry["balance"] == "300.00"
    assert our_entry["client_name"] == client.name
```

- [ ] **Step 2: Run tests — expect failures (module doesn't exist)**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/tests/test_routers_reports.py -v 2>&1 | head -30
```

Expected: All tests fail with `404 Not Found` (router not registered yet). If you see `ImportError`, check that all model imports are correct.

---

### Task 2: Implement reports service

**Files:**
- Create: `backend/services/reports.py`

- [ ] **Step 1: Write the service file**

```python
# backend/services/reports.py
from __future__ import annotations
import csv
import io
from datetime import date
from decimal import Decimal

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.account import Account
from models.client import Client
from models.expense import Expense
from models.invoice import Invoice, InvoicePayment
from models.journal import JournalEntry, JournalLine


# ─── shared helpers ───────────────────────────────────────────────────────────

async def _account_balances(
    db: AsyncSession,
    account_types: list[str] | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    as_of_date: date | None = None,
) -> list[dict]:
    """
    Returns {account, total_debit, total_credit} for all non-archived accounts.
    Filters to posted journal entries only.
    Accounts with no matching lines appear with zero balances (outer join).
    """
    entry_q = select(JournalEntry.id).where(JournalEntry.status == "posted")
    if start_date and end_date:
        entry_q = entry_q.where(
            JournalEntry.date >= start_date,
            JournalEntry.date <= end_date,
        )
    elif as_of_date:
        entry_q = entry_q.where(JournalEntry.date <= as_of_date)

    q = (
        select(
            Account,
            func.coalesce(func.sum(JournalLine.debit), Decimal("0")).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0")).label("total_credit"),
        )
        .outerjoin(
            JournalLine,
            and_(
                JournalLine.account_id == Account.id,
                JournalLine.entry_id.in_(entry_q),
            ),
        )
        .where(Account.archived == False)  # noqa: E712
        .group_by(Account.id)
        .order_by(Account.code)
    )
    if account_types:
        q = q.where(Account.type.in_(account_types))

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
    """Net balance respecting the account's normal balance side."""
    acct = row["account"]
    if acct.normal_balance == "debit":
        return row["total_debit"] - row["total_credit"]
    return row["total_credit"] - row["total_debit"]


def _rows_to_csv(headers: list[str], rows: list[list]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue()


# ─── P&L ──────────────────────────────────────────────────────────────────────

async def get_pl(db: AsyncSession, start_date: date, end_date: date) -> dict:
    rows = await _account_balances(
        db,
        account_types=["revenue", "expense"],
        start_date=start_date,
        end_date=end_date,
    )
    revenue_by_account: dict[str, Decimal] = {}
    expenses_by_account: dict[str, Decimal] = {}
    for row in rows:
        balance = _net_balance(row)
        if balance == Decimal("0"):
            continue
        if row["account"].type == "revenue":
            revenue_by_account[row["account"].name] = balance
        else:
            expenses_by_account[row["account"].name] = balance

    total_revenue = sum(revenue_by_account.values(), Decimal("0"))
    total_expenses = sum(expenses_by_account.values(), Decimal("0"))
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "revenue_by_account": {k: str(v) for k, v in revenue_by_account.items()},
        "total_revenue": str(total_revenue),
        "expenses_by_account": {k: str(v) for k, v in expenses_by_account.items()},
        "total_expenses": str(total_expenses),
        "net_profit": str(total_revenue - total_expenses),
    }


def pl_to_csv(pl: dict) -> str:
    rows: list[list] = []
    for name, amount in pl["revenue_by_account"].items():
        rows.append([name, "Revenue", amount])
    for name, amount in pl["expenses_by_account"].items():
        rows.append([name, "Expense", amount])
    rows.append(["Net Profit", "", pl["net_profit"]])
    return _rows_to_csv(["Account", "Type", "Amount"], rows)


# ─── Balance Sheet ────────────────────────────────────────────────────────────

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
        balance = _net_balance(row)
        entry = {
            "code": row["account"].code,
            "name": row["account"].name,
            "balance": str(balance),
        }
        t = row["account"].type
        if t == "asset":
            assets.append(entry)
        elif t == "liability":
            liabilities.append(entry)
        else:
            equity.append(entry)

    total_assets = sum(Decimal(a["balance"]) for a in assets)
    total_liabilities = sum(Decimal(l["balance"]) for l in liabilities)
    total_equity = sum(Decimal(e["balance"]) for e in equity)
    return {
        "as_of_date": as_of_date.isoformat(),
        "assets": assets,
        "total_assets": str(total_assets),
        "liabilities": liabilities,
        "total_liabilities": str(total_liabilities),
        "equity": equity,
        "total_equity": str(total_equity),
        "balanced": abs(total_assets - (total_liabilities + total_equity)) < Decimal("0.01"),
    }


def balance_sheet_to_csv(bs: dict) -> str:
    rows: list[list] = []
    for a in bs["assets"]:
        rows.append([a["code"], a["name"], "Asset", a["balance"]])
    for l in bs["liabilities"]:
        rows.append([l["code"], l["name"], "Liability", l["balance"]])
    for e in bs["equity"]:
        rows.append([e["code"], e["name"], "Equity", e["balance"]])
    rows.append(["", "Total Assets", "", bs["total_assets"]])
    rows.append(["", "Total Liabilities + Equity", "",
                 str(Decimal(bs["total_liabilities"]) + Decimal(bs["total_equity"]))])
    return _rows_to_csv(["Code", "Name", "Type", "Balance"], rows)


# ─── Trial Balance ────────────────────────────────────────────────────────────

async def get_trial_balance(db: AsyncSession, as_of_date: date) -> dict:
    rows = await _account_balances(db, as_of_date=as_of_date)
    tb_rows: list[dict] = []
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    for row in rows:
        net = row["total_debit"] - row["total_credit"]
        debit_bal = max(net, Decimal("0"))
        credit_bal = max(-net, Decimal("0"))
        total_debit += debit_bal
        total_credit += credit_bal
        tb_rows.append({
            "code": row["account"].code,
            "name": row["account"].name,
            "debit_balance": str(debit_bal),
            "credit_balance": str(credit_bal),
        })
    return {
        "as_of_date": as_of_date.isoformat(),
        "rows": tb_rows,
        "total_debit": str(total_debit),
        "total_credit": str(total_credit),
        "balanced": abs(total_debit - total_credit) < Decimal("0.01"),
    }


def trial_balance_to_csv(tb: dict) -> str:
    rows = [[r["code"], r["name"], r["debit_balance"], r["credit_balance"]] for r in tb["rows"]]
    rows.append(["", "TOTALS", tb["total_debit"], tb["total_credit"]])
    return _rows_to_csv(["Code", "Name", "Debit", "Credit"], rows)


# ─── Cash Flow ────────────────────────────────────────────────────────────────

async def get_cash_flow(db: AsyncSession, start_date: date, end_date: date) -> dict:
    """
    Direct method cash flow:
    - Cash in:  invoice payments received in the period (InvoicePayment.payment_date)
    - Cash out: paid expenses incurred in the period (Expense.date where payment_status='paid')
    Note: Expense.date is used as the cash-out date since Expense has no separate payment_date column.
    """
    cash_in = Decimal(str(await db.scalar(
        select(func.coalesce(func.sum(InvoicePayment.amount), Decimal("0"))).where(
            InvoicePayment.payment_date >= start_date,
            InvoicePayment.payment_date <= end_date,
        )
    )))
    cash_out = Decimal(str(await db.scalar(
        select(func.coalesce(func.sum(Expense.amount), Decimal("0"))).where(
            Expense.payment_status == "paid",
            Expense.date >= start_date,
            Expense.date <= end_date,
        )
    )))
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "cash_collected": str(cash_in),
        "cash_spent": str(cash_out),
        "net_change": str(cash_in - cash_out),
    }


def cash_flow_to_csv(cf: dict) -> str:
    rows = [
        ["Cash collected from clients", cf["cash_collected"]],
        ["Cash spent on expenses", cf["cash_spent"]],
        ["Net cash change", cf["net_change"]],
    ]
    return _rows_to_csv(["Description", "Amount"], rows)


# ─── Tax Summary ──────────────────────────────────────────────────────────────

async def get_tax_summary(db: AsyncSession, start_date: date, end_date: date) -> dict:
    rows = await _account_balances(
        db,
        account_types=["revenue", "expense"],
        start_date=start_date,
        end_date=end_date,
    )
    taxable_revenue = Decimal("0")
    deductible_expenses: dict[str, Decimal] = {}
    for row in rows:
        balance = _net_balance(row)
        if balance == Decimal("0"):
            continue
        if row["account"].type == "revenue":
            taxable_revenue += balance
        else:
            deductible_expenses[row["account"].name] = balance

    total_deductible = sum(deductible_expenses.values(), Decimal("0"))
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "taxable_revenue": str(taxable_revenue),
        "deductible_expenses": {k: str(v) for k, v in deductible_expenses.items()},
        "total_deductible_expenses": str(total_deductible),
        "net_taxable_income": str(taxable_revenue - total_deductible),
    }


def tax_summary_to_csv(ts: dict) -> str:
    rows: list[list] = [["Total Revenue", ts["taxable_revenue"]]]
    for name, amount in ts["deductible_expenses"].items():
        rows.append([f"Expense: {name}", amount])
    rows.append(["Net Taxable Income", ts["net_taxable_income"]])
    return _rows_to_csv(["Description", "Amount"], rows)


# ─── AR Aging ─────────────────────────────────────────────────────────────────

async def get_ar_aging(db: AsyncSession, as_of_date: date) -> dict:
    """
    Group outstanding invoices (status=sent/partially_paid, balance_due>0) by days overdue.
    Days overdue = (as_of_date - due_date). Uses due_date if set, else invoice created_at.date().
    Buckets: current (≤0), 1_30 (1-30), 31_60 (31-60), 61_90 (61-90), over_90 (>90).
    """
    q = (
        select(Invoice, Client)
        .join(Client, Client.id == Invoice.client_id)
        .where(
            Invoice.status.in_(["sent", "partially_paid"]),
            Invoice.balance_due > 0,
        )
    )
    result = await db.execute(q)

    buckets: dict[str, list] = {
        "current": [], "1_30": [], "31_60": [], "61_90": [], "over_90": []
    }
    for invoice, client in result.all():
        reference_date = invoice.due_date or invoice.created_at.date()
        days_overdue = (as_of_date - reference_date).days
        entry = {
            "invoice_id": str(invoice.id),
            "client_name": client.name,
            "balance": str(invoice.balance_due),
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "days_overdue": days_overdue,
        }
        if days_overdue <= 0:
            buckets["current"].append(entry)
        elif days_overdue <= 30:
            buckets["1_30"].append(entry)
        elif days_overdue <= 60:
            buckets["31_60"].append(entry)
        elif days_overdue <= 90:
            buckets["61_90"].append(entry)
        else:
            buckets["over_90"].append(entry)

    total_outstanding = sum(
        Decimal(e["balance"])
        for bucket in buckets.values()
        for e in bucket
    )
    return {
        "as_of_date": as_of_date.isoformat(),
        "buckets": buckets,
        "total_outstanding": str(total_outstanding),
    }


def ar_aging_to_csv(ar: dict) -> str:
    bucket_labels = {
        "current": "Current",
        "1_30": "1-30 days",
        "31_60": "31-60 days",
        "61_90": "61-90 days",
        "over_90": "Over 90 days",
    }
    rows: list[list] = []
    for key, label in bucket_labels.items():
        for entry in ar["buckets"][key]:
            rows.append([
                label,
                entry["client_name"],
                entry["invoice_id"],
                entry["due_date"] or "",
                entry["balance"],
            ])
    return _rows_to_csv(["Bucket", "Client", "Invoice ID", "Due Date", "Balance"], rows)
```

---

### Task 3: Implement router + register in main.py

**Files:**
- Create: `backend/routers/reports.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the router**

```python
# backend/routers/reports.py
from __future__ import annotations
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from services import reports as svc

router = APIRouter(prefix="/api/reports", tags=["reports"])

DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


def _csv_response(csv_str: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([csv_str]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/pl")
async def get_pl(
    db: DB,
    _: Admin,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_pl(db, start_date, end_date)
    if format == "csv":
        return _csv_response(svc.pl_to_csv(data), "pl.csv")
    return data


@router.get("/balance-sheet")
async def get_balance_sheet(
    db: DB,
    _: Admin,
    as_of_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_balance_sheet(db, as_of_date)
    if format == "csv":
        return _csv_response(svc.balance_sheet_to_csv(data), "balance_sheet.csv")
    return data


@router.get("/trial-balance")
async def get_trial_balance(
    db: DB,
    _: Admin,
    as_of_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_trial_balance(db, as_of_date)
    if format == "csv":
        return _csv_response(svc.trial_balance_to_csv(data), "trial_balance.csv")
    return data


@router.get("/cash-flow")
async def get_cash_flow(
    db: DB,
    _: Admin,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_cash_flow(db, start_date, end_date)
    if format == "csv":
        return _csv_response(svc.cash_flow_to_csv(data), "cash_flow.csv")
    return data


@router.get("/tax-summary")
async def get_tax_summary(
    db: DB,
    _: Admin,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_tax_summary(db, start_date, end_date)
    if format == "csv":
        return _csv_response(svc.tax_summary_to_csv(data), "tax_summary.csv")
    return data


@router.get("/ar-aging")
async def get_ar_aging(
    db: DB,
    _: Admin,
    as_of_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_ar_aging(db, as_of_date)
    if format == "csv":
        return _csv_response(svc.ar_aging_to_csv(data), "ar_aging.csv")
    return data
```

- [ ] **Step 2: Register the router in main.py**

Open `backend/main.py`. Add the import alongside the other router imports:

```python
from routers.reports import router as reports_router
```

Add the `include_router` call after the existing accounting routers:

```python
app.include_router(reports_router)
```

- [ ] **Step 3: Run all report tests**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/tests/test_routers_reports.py -v
```

Expected output:
```
PASSED tests/test_routers_reports.py::test_pl_report
PASSED tests/test_routers_reports.py::test_pl_csv
PASSED tests/test_routers_reports.py::test_balance_sheet
PASSED tests/test_routers_reports.py::test_trial_balance
PASSED tests/test_routers_reports.py::test_cash_flow
PASSED tests/test_routers_reports.py::test_tax_summary
PASSED tests/test_routers_reports.py::test_ar_aging
7 passed
```

If any test fails, read the error carefully:
- `404`: router not registered — check Step 2
- `422`: query param missing or wrong type — check the endpoint signature
- `500`: service bug — read the traceback, fix the relevant function in `services/reports.py`
- Assertion error on value: check the Decimal formatting — PostgreSQL `NUMERIC(10,2)` returns values like `"500.00"`, `"0.00"` etc.

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/tests/ -v --tb=short 2>&1 | tail -20
```

Expected: All previously passing tests still pass. 0 new failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/reports.py backend/routers/reports.py backend/tests/test_routers_reports.py backend/main.py
git commit -m "feat: add accounting reports backend (P&L, Balance Sheet, Trial Balance, Cash Flow, Tax Summary, AR Aging)"
```
