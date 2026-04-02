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
    assert bank["balance"] is not None  # balance field is populated


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
    assert "balance" in data  # balance field is present (may be non-zero from existing data)


@pytest.mark.asyncio
async def test_get_account_not_found(test_client, admin_auth_headers):
    resp = await test_client.get(f"/api/accounts/{uuid4()}", headers=admin_auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_account_derives_normal_balance(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/accounts",
        json={"code": "6001", "name": "Photography Props", "type": "expense"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "6001"
    assert data["name"] == "Photography Props"
    assert data["type"] == "expense"
    assert data["normal_balance"] == "debit"  # derived from type
    assert data["is_system"] is False
    assert data["archived"] is False
    assert data["balance"] == "0.00"


@pytest.mark.asyncio
async def test_create_account_liability_gets_credit_normal_balance(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/accounts",
        json={"code": "2400", "name": "Test Liability", "type": "liability"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["normal_balance"] == "credit"


@pytest.mark.asyncio
async def test_create_account_duplicate_code_returns_409(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/accounts",
        json={"code": "1010", "name": "Duplicate", "type": "asset"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_account_invalid_type_returns_422(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/accounts",
        json={"code": "9900", "name": "Bad Type", "type": "notatype"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_rename_account(test_client, admin_auth_headers, db_session):
    from models.account import Account
    acct = Account(code="7001", name="Old Name", type="expense", normal_balance="debit", is_system=False)
    db_session.add(acct)
    await db_session.flush()

    resp = await test_client.patch(
        f"/api/accounts/{acct.id}",
        json={"name": "New Name"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_archive_system_account_returns_403(test_client, admin_auth_headers, db_session):
    from sqlalchemy import text
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1010'"))
    account_id = result.scalar_one()

    resp = await test_client.patch(
        f"/api/accounts/{account_id}",
        json={"archived": True},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_archive_non_system_account(test_client, admin_auth_headers, db_session):
    from models.account import Account
    acct = Account(code="7002", name="To Archive", type="expense", normal_balance="debit", is_system=False)
    db_session.add(acct)
    await db_session.flush()

    resp = await test_client.patch(
        f"/api/accounts/{acct.id}",
        json={"archived": True},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["archived"] is True


@pytest.mark.asyncio
async def test_rename_system_account_allowed(test_client, admin_auth_headers, db_session):
    from sqlalchemy import text
    result2 = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1000'"))
    account_id = result2.scalar_one()  # Cash on Hand — is_system=True

    resp = await test_client.patch(
        f"/api/accounts/{account_id}",
        json={"name": "Petty Cash"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Petty Cash"


@pytest.mark.asyncio
async def test_update_account_not_found(test_client, admin_auth_headers):
    from uuid import uuid4
    resp = await test_client.patch(
        f"/api/accounts/{uuid4()}",
        json={"name": "Ghost"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_system_account_returns_403(test_client, admin_auth_headers, db_session):
    from sqlalchemy import text
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1010'"))
    account_id = result.scalar_one()

    resp = await test_client.delete(f"/api/accounts/{account_id}", headers=admin_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_account_with_journal_lines_returns_409(test_client, admin_auth_headers, db_session):
    from models.account import Account
    from models.journal import JournalEntry, JournalLine
    from datetime import date

    # Create a custom account and a journal line referencing it
    acct = Account(code="8001", name="Has Lines", type="expense", normal_balance="debit", is_system=False)
    db_session.add(acct)
    await db_session.flush()

    entry = JournalEntry(date=date.today(), description="Test entry", status="draft", created_by="manual")
    db_session.add(entry)
    await db_session.flush()

    line = JournalLine(entry_id=entry.id, account_id=acct.id, debit="100.00", credit="0")
    db_session.add(line)
    await db_session.flush()

    resp = await test_client.delete(f"/api/accounts/{acct.id}", headers=admin_auth_headers)
    assert resp.status_code == 409
    assert "1 journal line" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_account_success(test_client, admin_auth_headers, db_session):
    from models.account import Account

    acct = Account(code="8002", name="To Delete", type="expense", normal_balance="debit", is_system=False)
    db_session.add(acct)
    await db_session.flush()
    acct_id = acct.id

    resp = await test_client.delete(f"/api/accounts/{acct_id}", headers=admin_auth_headers)
    assert resp.status_code == 204

    # Confirm gone
    resp2 = await test_client.get(f"/api/accounts/{acct_id}", headers=admin_auth_headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_ledger_empty(test_client, admin_auth_headers, db_session):
    from sqlalchemy import text
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1100'"))
    account_id = result.scalar_one()

    resp = await test_client.get(f"/api/accounts/{account_id}/ledger", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["opening_balance"] == "0.00"
    assert data["closing_balance"] == "0.00"
    assert data["lines"] == []
    assert data["normal_balance"] == "debit"


@pytest.mark.asyncio
async def test_ledger_with_posted_lines(test_client, admin_auth_headers, db_session):
    from models.account import Account
    from models.journal import JournalEntry, JournalLine
    from datetime import date

    # Custom revenue account (credit normal balance)
    acct = Account(code="4999", name="Test Revenue", type="revenue", normal_balance="credit", is_system=False)
    db_session.add(acct)
    await db_session.flush()

    # Need a debit account for the other side of the entry
    from sqlalchemy import text
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1100'"))
    ar_id = result.scalar_one()

    # Posted entry: Dr AR 300, Cr Test Revenue 300
    entry = JournalEntry(
        date=date(2026, 3, 1),
        description="Invoice sent",
        reference_type="invoice",
        reference_id=None,
        status="posted",
        created_by="system",
    )
    db_session.add(entry)
    await db_session.flush()

    db_session.add(JournalLine(entry_id=entry.id, account_id=ar_id, debit="300.00", credit="0"))
    db_session.add(JournalLine(entry_id=entry.id, account_id=acct.id, debit="0", credit="300.00"))
    await db_session.flush()

    # Second posted entry on same account
    entry2 = JournalEntry(
        date=date(2026, 3, 15),
        description="Another invoice",
        status="posted",
        created_by="system",
    )
    db_session.add(entry2)
    await db_session.flush()
    db_session.add(JournalLine(entry_id=entry2.id, account_id=ar_id, debit="200.00", credit="0"))
    db_session.add(JournalLine(entry_id=entry2.id, account_id=acct.id, debit="0", credit="200.00"))
    await db_session.flush()

    resp = await test_client.get(f"/api/accounts/{acct.id}/ledger", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["opening_balance"] == "0.00"
    assert len(data["lines"]) == 2
    # Credit normal balance: running = credit - debit
    assert data["lines"][0]["running_balance"] == "300.00"
    assert data["lines"][1]["running_balance"] == "500.00"
    assert data["closing_balance"] == "500.00"


@pytest.mark.asyncio
async def test_ledger_with_start_date_computes_opening_balance(test_client, admin_auth_headers, db_session):
    from models.account import Account
    from models.journal import JournalEntry, JournalLine
    from sqlalchemy import text
    from datetime import date

    acct = Account(code="4998", name="Test Revenue 2", type="revenue", normal_balance="credit", is_system=False)
    db_session.add(acct)
    await db_session.flush()

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1100'"))
    ar_id = result.scalar_one()

    # Pre-period entry (Jan)
    entry_jan = JournalEntry(date=date(2026, 1, 10), description="Jan entry", status="posted", created_by="system")
    db_session.add(entry_jan)
    await db_session.flush()
    db_session.add(JournalLine(entry_id=entry_jan.id, account_id=ar_id, debit="100.00", credit="0"))
    db_session.add(JournalLine(entry_id=entry_jan.id, account_id=acct.id, debit="0", credit="100.00"))
    await db_session.flush()

    # In-period entry (March)
    entry_mar = JournalEntry(date=date(2026, 3, 5), description="Mar entry", status="posted", created_by="system")
    db_session.add(entry_mar)
    await db_session.flush()
    db_session.add(JournalLine(entry_id=entry_mar.id, account_id=ar_id, debit="50.00", credit="0"))
    db_session.add(JournalLine(entry_id=entry_mar.id, account_id=acct.id, debit="0", credit="50.00"))
    await db_session.flush()

    resp = await test_client.get(
        f"/api/accounts/{acct.id}/ledger?start_date=2026-03-01",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["opening_balance"] == "100.00"  # Jan entry is pre-period
    assert len(data["lines"]) == 1
    assert data["lines"][0]["running_balance"] == "150.00"
    assert data["closing_balance"] == "150.00"
