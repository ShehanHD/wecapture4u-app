import pytest
from uuid import uuid4
from datetime import date as date_type
from decimal import Decimal


# ── helpers ──────────────────────────────────────────────────────────────────

async def _get_account_id(db_session, code: str):
    from sqlalchemy import text
    return await db_session.scalar(text("SELECT id FROM accounts WHERE code = :code"), {"code": code})


async def _seed_expense(db_session, *, payment_status="paid", amount="200.00"):
    from models.expense import Expense
    eq_id = await _get_account_id(db_session, "5000")
    bank_id = await _get_account_id(db_session, "1010")
    exp = Expense(
        date=date_type(2026, 3, 1),
        description="Test expense",
        expense_account_id=eq_id,
        amount=Decimal(amount),
        payment_status=payment_status,
        payment_account_id=bank_id if payment_status == "paid" else None,
    )
    db_session.add(exp)
    await db_session.flush()
    return exp


# ── Task 1: list + get ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_expenses_empty(test_client, admin_auth_headers):
    resp = await test_client.get("/api/expenses", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_expenses_returns_seeded(test_client, admin_auth_headers, db_session):
    await _seed_expense(db_session)
    resp = await test_client.get("/api/expenses", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    exp = data[0]
    assert "id" in exp
    assert "date" in exp
    assert "description" in exp
    assert "payment_status" in exp
    assert "journal_entry_id" in exp


@pytest.mark.asyncio
async def test_list_expenses_filter_payment_status(test_client, admin_auth_headers, db_session):
    await _seed_expense(db_session, payment_status="paid")
    await _seed_expense(db_session, payment_status="payable")
    resp = await test_client.get("/api/expenses?payment_status=payable", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert all(e["payment_status"] == "payable" for e in resp.json())


@pytest.mark.asyncio
async def test_get_expense_not_found(test_client, admin_auth_headers):
    resp = await test_client.get(f"/api/expenses/{uuid4()}", headers=admin_auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_expense_returns_data(test_client, admin_auth_headers, db_session):
    exp = await _seed_expense(db_session)
    resp = await test_client.get(f"/api/expenses/{exp.id}", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(exp.id)
    assert data["description"] == "Test expense"
    assert "journal_entry_id" in data


# ── Task 2: create ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_paid_expense_success(test_client, admin_auth_headers, db_session):
    eq_id = await _get_account_id(db_session, "5000")
    bank_id = await _get_account_id(db_session, "1010")
    resp = await test_client.post(
        "/api/expenses",
        json={
            "date": "2026-03-10",
            "description": "New camera lens",
            "expense_account_id": str(eq_id),
            "amount": "450.00",
            "payment_status": "paid",
            "payment_account_id": str(bank_id),
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "New camera lens"
    assert data["payment_status"] == "paid"
    assert data["journal_entry_id"] is not None


@pytest.mark.asyncio
async def test_create_payable_expense_success(test_client, admin_auth_headers, db_session):
    sw_id = await _get_account_id(db_session, "5100")
    resp = await test_client.post(
        "/api/expenses",
        json={
            "date": "2026-03-11",
            "description": "Adobe subscription",
            "expense_account_id": str(sw_id),
            "amount": "60.00",
            "payment_status": "payable",
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["payment_status"] == "payable"
    assert data["payment_account_id"] is None
    assert data["journal_entry_id"] is not None


@pytest.mark.asyncio
async def test_create_paid_expense_missing_payment_account_returns_422(test_client, admin_auth_headers, db_session):
    eq_id = await _get_account_id(db_session, "5000")
    resp = await test_client.post(
        "/api/expenses",
        json={
            "date": "2026-03-12",
            "description": "Missing account",
            "expense_account_id": str(eq_id),
            "amount": "100.00",
            "payment_status": "paid",
            # payment_account_id omitted
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_expense_auto_draft_has_correct_lines(test_client, admin_auth_headers, db_session):
    """Created paid expense auto-draft: Dr Equipment / Cr Bank."""
    from models.journal import JournalLine
    from sqlalchemy import select
    eq_id = await _get_account_id(db_session, "5000")
    bank_id = await _get_account_id(db_session, "1010")

    resp = await test_client.post(
        "/api/expenses",
        json={
            "date": "2026-03-13",
            "description": "Tripod",
            "expense_account_id": str(eq_id),
            "amount": "80.00",
            "payment_status": "paid",
            "payment_account_id": str(bank_id),
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    entry_id = resp.json()["journal_entry_id"]
    assert entry_id is not None

    result = await db_session.execute(
        select(JournalLine).where(JournalLine.entry_id == entry_id)
    )
    lines = result.scalars().all()
    assert len(lines) == 2
    debit_line = next(ln for ln in lines if ln.debit > 0)
    credit_line = next(ln for ln in lines if ln.credit > 0)
    assert debit_line.account_id == eq_id
    assert Decimal(str(debit_line.debit)) == Decimal("80.00")
    assert credit_line.account_id == bank_id
    assert Decimal(str(credit_line.credit)) == Decimal("80.00")


@pytest.mark.asyncio
async def test_create_payable_expense_draft_credits_accounts_payable(test_client, admin_auth_headers, db_session):
    """Created payable expense auto-draft: Dr Equipment / Cr Accounts Payable (2000)."""
    from models.journal import JournalLine
    from sqlalchemy import select
    eq_id = await _get_account_id(db_session, "5000")
    ap_id = await _get_account_id(db_session, "2000")

    resp = await test_client.post(
        "/api/expenses",
        json={
            "date": "2026-03-14",
            "description": "Backdrop",
            "expense_account_id": str(eq_id),
            "amount": "120.00",
            "payment_status": "payable",
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    entry_id = resp.json()["journal_entry_id"]

    result = await db_session.execute(
        select(JournalLine).where(JournalLine.entry_id == entry_id)
    )
    lines = result.scalars().all()
    credit_line = next(ln for ln in lines if ln.credit > 0)
    assert credit_line.account_id == ap_id
