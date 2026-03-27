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
