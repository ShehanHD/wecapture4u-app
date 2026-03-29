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
            "debit_balance": f"{debit_bal:.2f}",
            "credit_balance": f"{credit_bal:.2f}",
        })
    return {
        "as_of_date": as_of_date.isoformat(),
        "rows": tb_rows,
        "total_debit": f"{total_debit:.2f}",
        "total_credit": f"{total_credit:.2f}",
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
            "balance": f"{Decimal(str(invoice.balance_due)):.2f}",
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
