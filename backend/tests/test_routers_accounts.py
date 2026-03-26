import pytest
from uuid import uuid4


@pytest.mark.asyncio
async def test_list_accounts_returns_seeded_accounts(test_client, admin_auth_headers):
    resp = await test_client.get("/api/accounts", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 17  # at least 17 seeded accounts

    codes = {a["code"] for a in data}
    assert "1010" in codes  # Business Bank Account
    assert "4000" in codes  # Session Fees

    bank = next(a for a in data if a["code"] == "1010")
    assert bank["name"] == "Business Bank Account"
    assert bank["type"] == "asset"
    assert bank["normal_balance"] == "debit"
    assert bank["is_system"] is True
    assert bank["archived"] is False
    assert "balance" in bank
    assert bank["balance"] == "0.00"  # no journal lines yet


@pytest.mark.asyncio
async def test_list_accounts_filter_by_type(test_client, admin_auth_headers):
    resp = await test_client.get("/api/accounts?type=asset", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(a["type"] == "asset" for a in data)
    assert len(data) == 4  # 1000, 1010, 1020, 1100


@pytest.mark.asyncio
async def test_list_accounts_filter_archived(test_client, admin_auth_headers, db_session):
    from models.account import Account
    acct = Account(code="9999", name="Archived Test", type="expense", normal_balance="debit", is_system=False, archived=True)
    db_session.add(acct)
    await db_session.flush()

    resp = await test_client.get("/api/accounts?archived=false", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert all(a["archived"] is False for a in resp.json())

    resp2 = await test_client.get("/api/accounts?archived=true", headers=admin_auth_headers)
    assert resp2.status_code == 200
    assert any(a["code"] == "9999" for a in resp2.json())


@pytest.mark.asyncio
async def test_get_account_by_id(test_client, admin_auth_headers, db_session):
    from sqlalchemy import text
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1010'"))
    account_id = result.scalar_one()

    resp = await test_client.get(f"/api/accounts/{account_id}", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "1010"
    assert data["balance"] == "0.00"


@pytest.mark.asyncio
async def test_get_account_not_found(test_client, admin_auth_headers):
    resp = await test_client.get(f"/api/accounts/{uuid4()}", headers=admin_auth_headers)
    assert resp.status_code == 404
