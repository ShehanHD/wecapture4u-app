# Accounting Plan 2 — Accounts API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all six `GET/POST/PATCH/DELETE /api/accounts` endpoints plus the account ledger endpoint, with full business rule enforcement and balance computation.

**Architecture:** Thin router → service → ORM pattern, matching existing codebase conventions. Balance is computed from `posted` journal lines via SQL aggregation; the service sets `account.balance` as a dynamic attribute before returning, which Pydantic's `from_attributes=True` picks up. The ledger endpoint computes an opening balance (all posted lines before `start_date`), then streams running balance per line.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, pytest-asyncio, real Supabase test DB (savepoint rollback — no mocks)

---

## File Map

| File | Change |
|---|---|
| `backend/services/accounts.py` | New — all business logic |
| `backend/routers/accounts.py` | New — thin route handlers |
| `backend/schemas/accounts.py` | Modify — add `AccountLedgerLineOut`, `AccountLedgerOut`; add `date` import |
| `backend/main.py` | Modify — register accounts router |
| `backend/tests/test_routers_accounts.py` | New — integration tests |

---

### Task 1: List and get accounts

**Files:**
- Create: `backend/services/accounts.py`
- Create: `backend/routers/accounts.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_routers_accounts.py`

- [ ] **Step 1: Create test file with list and get tests**

```python
# backend/tests/test_routers_accounts.py
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -v 2>&1 | head -20`

Expected: FAIL — `404 Not Found` (routes don't exist yet)

- [ ] **Step 3: Create `backend/services/accounts.py`**

```python
import uuid
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.account import Account
from models.journal import JournalEntry, JournalLine

logger = logging.getLogger(__name__)

_TYPE_TO_NORMAL_BALANCE: dict[str, str] = {
    "asset": "debit",
    "expense": "debit",
    "liability": "credit",
    "equity": "credit",
    "revenue": "credit",
}

VALID_ACCOUNT_TYPES = set(_TYPE_TO_NORMAL_BALANCE.keys())


async def _get_or_404(db: AsyncSession, account_id: uuid.UUID) -> Account:
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found.")
    return account


async def _compute_balance(
    db: AsyncSession,
    account_id: uuid.UUID,
    normal_balance: str,
    as_of_date: Optional[date] = None,
) -> Decimal:
    q = (
        select(
            func.coalesce(func.sum(JournalLine.debit), 0).label("d"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("c"),
        )
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .where(
            JournalLine.account_id == account_id,
            JournalEntry.status == "posted",
        )
    )
    if as_of_date is not None:
        q = q.where(JournalEntry.date <= as_of_date)
    result = await db.execute(q)
    row = result.one()
    d = Decimal(str(row.d))
    c = Decimal(str(row.c))
    if normal_balance == "debit":
        return (d - c).quantize(Decimal("0.01"))
    return (c - d).quantize(Decimal("0.01"))


async def list_accounts(
    db: AsyncSession,
    *,
    type: Optional[str] = None,
    archived: Optional[bool] = None,
) -> list[Account]:
    q = select(Account).order_by(Account.code)
    if type is not None:
        q = q.where(Account.type == type)
    if archived is not None:
        q = q.where(Account.archived == archived)
    result = await db.execute(q)
    accounts = list(result.scalars().all())

    if not accounts:
        return accounts

    # Bulk balance: one query for all accounts
    ids = [a.id for a in accounts]
    bal_q = (
        select(
            JournalLine.account_id,
            func.coalesce(func.sum(JournalLine.debit), 0).label("d"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("c"),
        )
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .where(JournalEntry.status == "posted", JournalLine.account_id.in_(ids))
        .group_by(JournalLine.account_id)
    )
    bal_result = await db.execute(bal_q)
    balance_map: dict[uuid.UUID, tuple[Decimal, Decimal]] = {
        row.account_id: (Decimal(str(row.d)), Decimal(str(row.c)))
        for row in bal_result
    }

    for account in accounts:
        d, c = balance_map.get(account.id, (Decimal("0"), Decimal("0")))
        if account.normal_balance == "debit":
            account.balance = (d - c).quantize(Decimal("0.01"))
        else:
            account.balance = (c - d).quantize(Decimal("0.01"))

    return accounts


async def get_account(db: AsyncSession, *, id: uuid.UUID) -> Account:
    account = await _get_or_404(db, id)
    account.balance = await _compute_balance(db, account.id, account.normal_balance)
    return account
```

- [ ] **Step 4: Create `backend/routers/accounts.py`**

```python
import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.accounts import AccountCreate, AccountUpdate, AccountOut, AccountLedgerOut
from services import accounts as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(
    db: DB, _: Admin,
    type: Optional[str] = Query(None),
    archived: Optional[bool] = Query(None),
):
    return await svc.list_accounts(db, type=type, archived=archived)


@router.get("/accounts/{id}", response_model=AccountOut)
async def get_account(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_account(db, id=id)
```

- [ ] **Step 5: Register router in `backend/main.py`**

Add import and include after the existing routers (before the closing of the file):

```python
from routers.accounts import router as accounts_router
```

And in the `app.include_router` section:
```python
app.include_router(accounts_router, prefix="/api", tags=["accounts"])
```

- [ ] **Step 6: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -v 2>&1 | tail -20`

Expected: All 5 tests PASS

- [ ] **Step 7: Run full test suite**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest -v 2>&1 | tail -10`

Expected: No regressions

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/accounts.py backend/routers/accounts.py backend/main.py backend/tests/test_routers_accounts.py
git commit -m "feat: add list and get accounts endpoints with balance computation"
```

---

### Task 2: Create account

**Files:**
- Modify: `backend/services/accounts.py`
- Modify: `backend/routers/accounts.py`
- Modify: `backend/tests/test_routers_accounts.py`

- [ ] **Step 1: Add failing tests**

Add to `backend/tests/test_routers_accounts.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py::test_create_account_derives_normal_balance tests/test_routers_accounts.py::test_create_account_duplicate_code_returns_409 -v 2>&1 | tail -10`

Expected: FAIL — `404` (route doesn't exist yet) or `405`

- [ ] **Step 3: Add `create_account` to `backend/services/accounts.py`**

```python
async def create_account(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    type: str,
) -> Account:
    if type not in VALID_ACCOUNT_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid account type '{type}'. Must be one of: {', '.join(sorted(VALID_ACCOUNT_TYPES))}.")

    existing = await db.execute(select(Account).where(Account.code == code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=f"Account code '{code}' already exists.")

    normal_balance = _TYPE_TO_NORMAL_BALANCE[type]
    account = Account(code=code, name=name, type=type, normal_balance=normal_balance)
    db.add(account)
    await db.flush()
    account.balance = Decimal("0.00")
    return account
```

- [ ] **Step 4: Add `POST /accounts` route to `backend/routers/accounts.py`**

```python
@router.post("/accounts", response_model=AccountOut, status_code=201)
async def create_account(body: AccountCreate, db: DB, _: Admin):
    return await svc.create_account(db, code=body.code, name=body.name, type=body.type)
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -k "create" -v 2>&1 | tail -15`

Expected: All 4 create tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/accounts.py backend/routers/accounts.py backend/tests/test_routers_accounts.py
git commit -m "feat: add create account endpoint with normal_balance derivation"
```

---

### Task 3: Update account (rename and archive)

**Files:**
- Modify: `backend/services/accounts.py`
- Modify: `backend/routers/accounts.py`
- Modify: `backend/tests/test_routers_accounts.py`

- [ ] **Step 1: Add failing tests**

Add to `backend/tests/test_routers_accounts.py`:

```python
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
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '4300'"))
    account_id = result.scalar_one()  # Other Income — system=False actually; use 4000 Session Fees
    result2 = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1000'"))
    account_id = result2.scalar_one()  # Cash on Hand — is_system=True

    resp = await test_client.patch(
        f"/api/accounts/{account_id}",
        json={"name": "Petty Cash"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Petty Cash"
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -k "rename or archive" -v 2>&1 | tail -15`

Expected: FAIL — `404` or `405`

- [ ] **Step 3: Add `update_account` to `backend/services/accounts.py`**

```python
async def update_account(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: Optional[str] = None,
    archived: Optional[bool] = None,
) -> Account:
    account = await _get_or_404(db, id)

    if archived is True and account.is_system:
        raise HTTPException(status_code=403, detail="System accounts cannot be archived.")

    if name is not None:
        account.name = name
    if archived is not None:
        account.archived = archived

    await db.flush()
    account.balance = await _compute_balance(db, account.id, account.normal_balance)
    return account
```

- [ ] **Step 4: Add `PATCH /accounts/{id}` route to `backend/routers/accounts.py`**

```python
@router.patch("/accounts/{id}", response_model=AccountOut)
async def update_account(id: uuid.UUID, body: AccountUpdate, db: DB, _: Admin):
    return await svc.update_account(db, id=id, name=body.name, archived=body.archived)
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -k "rename or archive" -v 2>&1 | tail -15`

Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/accounts.py backend/routers/accounts.py backend/tests/test_routers_accounts.py
git commit -m "feat: add update account endpoint (rename and archive)"
```

---

### Task 4: Delete account

**Files:**
- Modify: `backend/services/accounts.py`
- Modify: `backend/routers/accounts.py`
- Modify: `backend/tests/test_routers_accounts.py`

- [ ] **Step 1: Add failing tests**

Add to `backend/tests/test_routers_accounts.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -k "delete" -v 2>&1 | tail -15`

Expected: FAIL — `404` or `405`

- [ ] **Step 3: Add `delete_account` to `backend/services/accounts.py`**

```python
async def delete_account(db: AsyncSession, *, id: uuid.UUID) -> None:
    account = await _get_or_404(db, id)

    if account.is_system:
        raise HTTPException(status_code=403, detail="System accounts cannot be deleted.")

    count_result = await db.execute(
        select(func.count(JournalLine.id)).where(JournalLine.account_id == id)
    )
    line_count = count_result.scalar_one()
    if line_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Account is referenced in {line_count} journal line(s).",
        )

    await db.delete(account)
    await db.flush()
```

- [ ] **Step 4: Add `DELETE /accounts/{id}` route to `backend/routers/accounts.py`**

```python
@router.delete("/accounts/{id}", status_code=204)
async def delete_account(id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_account(db, id=id)
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -k "delete" -v 2>&1 | tail -15`

Expected: All 3 tests PASS

- [ ] **Step 6: Run full account test suite**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -v 2>&1 | tail -25`

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/accounts.py backend/routers/accounts.py backend/tests/test_routers_accounts.py
git commit -m "feat: add delete account endpoint with system and journal-line guards"
```

---

### Task 5: Account ledger

**Files:**
- Modify: `backend/schemas/accounts.py`
- Modify: `backend/services/accounts.py`
- Modify: `backend/routers/accounts.py`
- Modify: `backend/tests/test_routers_accounts.py`

- [ ] **Step 1: Add ledger schemas to `backend/schemas/accounts.py`**

Add `date` to the imports (currently only `datetime` is imported), and add two new classes at the bottom of the file:

Updated import line:
```python
from datetime import date, datetime
```

New classes to append:
```python
class AccountLedgerLineOut(BaseModel):
    journal_entry_id: uuid.UUID
    date: date
    description: str
    line_description: Optional[str]
    debit: Decimal
    credit: Decimal
    running_balance: Decimal


class AccountLedgerOut(BaseModel):
    account_id: uuid.UUID
    account_name: str
    normal_balance: str
    opening_balance: Decimal
    closing_balance: Decimal
    lines: list[AccountLedgerLineOut]
```

- [ ] **Step 2: Add failing tests**

Add to `backend/tests/test_routers_accounts.py`:

```python
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
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -k "ledger" -v 2>&1 | tail -15`

Expected: FAIL — `404` (route doesn't exist yet)

- [ ] **Step 4: Add `get_account_ledger` to `backend/services/accounts.py`**

Add this import at the top (alongside existing imports):
```python
from datetime import date, timedelta
```

Then add the function:

```python
async def get_account_ledger(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    account = await _get_or_404(db, id)

    opening_balance = Decimal("0.00")
    if start_date is not None:
        opening_balance = await _compute_balance(
            db, id, account.normal_balance, as_of_date=start_date - timedelta(days=1)
        )

    q = (
        select(JournalLine, JournalEntry)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .where(
            JournalLine.account_id == id,
            JournalEntry.status == "posted",
        )
        .order_by(JournalEntry.date, JournalEntry.created_at)
    )
    if start_date is not None:
        q = q.where(JournalEntry.date >= start_date)
    if end_date is not None:
        q = q.where(JournalEntry.date <= end_date)

    result = await db.execute(q)
    rows = result.all()

    running = opening_balance
    lines = []
    for line, entry in rows:
        d = Decimal(str(line.debit))
        c = Decimal(str(line.credit))
        if account.normal_balance == "debit":
            running = (running + d - c).quantize(Decimal("0.01"))
        else:
            running = (running + c - d).quantize(Decimal("0.01"))
        lines.append({
            "journal_entry_id": entry.id,
            "date": entry.date,
            "description": entry.description,
            "line_description": line.description,
            "debit": d,
            "credit": c,
            "running_balance": running,
        })

    return {
        "account_id": account.id,
        "account_name": account.name,
        "normal_balance": account.normal_balance,
        "opening_balance": opening_balance,
        "closing_balance": running,
        "lines": lines,
    }
```

- [ ] **Step 5: Add `GET /accounts/{id}/ledger` route to `backend/routers/accounts.py`**

```python
@router.get("/accounts/{id}/ledger", response_model=AccountLedgerOut)
async def get_account_ledger(
    id: uuid.UUID, db: DB, _: Admin,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    return await svc.get_account_ledger(db, id=id, start_date=start_date, end_date=end_date)
```

- [ ] **Step 6: Run ledger tests**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -k "ledger" -v 2>&1 | tail -15`

Expected: All 3 ledger tests PASS

- [ ] **Step 7: Run full accounts test suite**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_accounts.py -v 2>&1 | tail -30`

Expected: All tests pass

- [ ] **Step 8: Run full project test suite**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest -v 2>&1 | tail -10`

Expected: No regressions

- [ ] **Step 9: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/schemas/accounts.py backend/services/accounts.py backend/routers/accounts.py backend/tests/test_routers_accounts.py
git commit -m "feat: add account ledger endpoint with opening/running/closing balance"
```
