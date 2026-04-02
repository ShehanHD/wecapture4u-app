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
        created_by="manual",
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
