# Expenses API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Expenses CRUD API (list, get, create, update, delete, pay) with automatic draft journal entry generation for each expense event.

**Architecture:** Thin router → service → ORM, matching existing patterns. `create_expense` always generates a draft journal entry (`created_by='system'`, `reference_type='expense'`, `reference_id=expense.id`). `pay_expense` generates a second draft for the Accounts Payable settlement. Both use the same reference so the service can find all entries for a given expense. `ExpenseOut` includes `journal_entry_id` (most recent non-voided entry) set dynamically by the service layer — same pattern as `account.balance` in `services/accounts.py`.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, pytest-asyncio, real Supabase test DB (savepoint rollback — no mocks)

---

## File Map

| File | Change |
|---|---|
| `backend/schemas/expenses.py` | Modify — add validators + `journal_entry_id` to `ExpenseOut`, add `ExpensePayPayload` |
| `backend/services/expenses.py` | New — all business logic |
| `backend/routers/expenses.py` | New — thin route handlers |
| `backend/main.py` | Modify — register expenses router |
| `backend/tests/test_routers_expenses.py` | New — integration tests |

## Seeded accounts used in tests

All seeded in `migrations/003_accounting.sql` (always present in the test DB):
- `1000` → Cash on Hand (asset)
- `1010` → Business Bank Account (asset)
- `2000` → Accounts Payable (liability)
- `5000` → Equipment (expense)
- `5100` → Software & Subscriptions (expense)

---

### Task 1: Schema update + list/get endpoints + router registration

**Files:**
- Modify: `backend/schemas/expenses.py`
- Create: `backend/services/expenses.py`
- Create: `backend/routers/expenses.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_routers_expenses.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_routers_expenses.py
import pytest
from uuid import uuid4
from datetime import date as date_type
from decimal import Decimal


# ── helpers ──────────────────────────────────────────────────────────────────

async def _get_account_id(db_session, code: str):
    from sqlalchemy import text
    return await db_session.scalar(text(f"SELECT id FROM accounts WHERE code = '{code}'"))


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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -v 2>&1 | tail -15
```

Expected: collection errors or 404/connection errors — routes don't exist yet.

- [ ] **Step 3: Add `journal_entry_id` and `ExpensePayPayload` to schemas**

Replace the entire contents of `backend/schemas/expenses.py`:

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


ExpensePaymentStatus = Literal["paid", "payable"]


class ExpenseCreate(BaseModel):
    date: date
    description: str = Field(min_length=1)
    expense_account_id: uuid.UUID
    amount: Decimal = Field(gt=0)
    payment_status: ExpensePaymentStatus
    payment_account_id: Optional[uuid.UUID] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def payment_account_required_when_paid(self) -> "ExpenseCreate":
        if self.payment_status == "paid" and self.payment_account_id is None:
            raise ValueError("payment_account_id is required when payment_status is 'paid'")
        return self


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = Field(None, min_length=1)
    expense_account_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    payment_status: Optional[ExpensePaymentStatus] = None
    payment_account_id: Optional[uuid.UUID] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


class ExpensePayPayload(BaseModel):
    payment_account_id: uuid.UUID
    payment_date: Optional[date] = None  # defaults to today if omitted


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    description: str
    expense_account_id: uuid.UUID
    amount: Decimal
    payment_status: str
    payment_account_id: Optional[uuid.UUID]
    receipt_url: Optional[str]
    notes: Optional[str]
    created_at: datetime
    journal_entry_id: Optional[uuid.UUID] = None  # set dynamically by service layer
```

- [ ] **Step 4: Create `backend/services/expenses.py`**

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.expense import Expense
from models.journal import JournalEntry, JournalLine


async def _get_or_404(db: AsyncSession, expense_id: uuid.UUID) -> Expense:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return expense


async def _get_ap_account_id(db: AsyncSession) -> uuid.UUID:
    """Returns the Accounts Payable account id (code 2000, always seeded)."""
    from models.account import Account
    ap_id = await db.scalar(select(Account.id).where(Account.code == "2000"))
    if ap_id is None:
        raise HTTPException(status_code=500, detail="Accounts Payable account (2000) not found.")
    return ap_id


async def _has_posted_entry(db: AsyncSession, expense_id: uuid.UUID) -> bool:
    count = await db.scalar(
        select(JournalEntry.id)
        .where(
            JournalEntry.reference_type == "expense",
            JournalEntry.reference_id == expense_id,
            JournalEntry.status == "posted",
        )
        .limit(1)
    )
    return count is not None


async def _attach_journal_entry_ids(db: AsyncSession, expenses: list[Expense]) -> None:
    """Bulk-fetch most recent non-voided entry id per expense and attach to instance."""
    if not expenses:
        return
    ids = [e.id for e in expenses]
    rows = await db.execute(
        select(JournalEntry.reference_id, JournalEntry.id, JournalEntry.created_at)
        .where(
            JournalEntry.reference_type == "expense",
            JournalEntry.reference_id.in_(ids),
            JournalEntry.status != "voided",
        )
        .order_by(JournalEntry.created_at.desc())
    )
    entry_map: dict[uuid.UUID, uuid.UUID] = {}
    for row in rows:
        if row.reference_id not in entry_map:
            entry_map[row.reference_id] = row.id
    for expense in expenses:
        expense.journal_entry_id = entry_map.get(expense.id)


async def _create_draft_entry(
    db: AsyncSession,
    expense: Expense,
    description: str,
    debit_account_id: uuid.UUID,
    credit_account_id: uuid.UUID,
    entry_date: Optional[date] = None,
) -> JournalEntry:
    entry = JournalEntry(
        date=entry_date if entry_date is not None else expense.date,
        description=description,
        status="draft",
        created_by="system",
        reference_type="expense",
        reference_id=expense.id,
    )
    db.add(entry)
    await db.flush()
    db.add(JournalLine(
        entry_id=entry.id,
        account_id=debit_account_id,
        debit=expense.amount,
        credit=Decimal("0"),
    ))
    db.add(JournalLine(
        entry_id=entry.id,
        account_id=credit_account_id,
        debit=Decimal("0"),
        credit=expense.amount,
    ))
    await db.flush()
    return entry


async def list_expenses(
    db: AsyncSession,
    *,
    expense_account_id: Optional[uuid.UUID] = None,
    payment_status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[Expense]:
    q = select(Expense).order_by(Expense.date.desc(), Expense.created_at.desc())
    if expense_account_id is not None:
        q = q.where(Expense.expense_account_id == expense_account_id)
    if payment_status is not None:
        q = q.where(Expense.payment_status == payment_status)
    if start_date is not None:
        q = q.where(Expense.date >= start_date)
    if end_date is not None:
        q = q.where(Expense.date <= end_date)
    result = await db.execute(q)
    expenses = list(result.scalars().all())
    await _attach_journal_entry_ids(db, expenses)
    return expenses


async def get_expense(db: AsyncSession, *, id: uuid.UUID) -> Expense:
    expense = await _get_or_404(db, id)
    await _attach_journal_entry_ids(db, [expense])
    return expense


async def create_expense(
    db: AsyncSession,
    *,
    date: date,
    description: str,
    expense_account_id: uuid.UUID,
    amount: Decimal,
    payment_status: str,
    payment_account_id: Optional[uuid.UUID] = None,
    receipt_url: Optional[str] = None,
    notes: Optional[str] = None,
) -> Expense:
    expense = Expense(
        date=date,
        description=description,
        expense_account_id=expense_account_id,
        amount=amount,
        payment_status=payment_status,
        payment_account_id=payment_account_id,
        receipt_url=receipt_url,
        notes=notes,
    )
    db.add(expense)
    await db.flush()

    if payment_status == "paid":
        await _create_draft_entry(
            db, expense,
            description=f"Expense: {description}",
            debit_account_id=expense_account_id,
            credit_account_id=payment_account_id,
        )
    else:  # payable
        ap_id = await _get_ap_account_id(db)
        await _create_draft_entry(
            db, expense,
            description=f"Expense (payable): {description}",
            debit_account_id=expense_account_id,
            credit_account_id=ap_id,
        )

    await _attach_journal_entry_ids(db, [expense])
    return expense
```

- [ ] **Step 5: Create `backend/routers/expenses.py`**

```python
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.expenses import ExpenseCreate, ExpenseOut, ExpensePayPayload, ExpenseUpdate
from services import expenses as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/expenses", response_model=list[ExpenseOut])
async def list_expenses(
    db: DB, _: Admin,
    expense_account_id: Optional[uuid.UUID] = Query(None),
    payment_status: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    return await svc.list_expenses(
        db,
        expense_account_id=expense_account_id,
        payment_status=payment_status,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/expenses/{id}", response_model=ExpenseOut)
async def get_expense(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_expense(db, id=id)
```

- [ ] **Step 6: Register router in `backend/main.py`**

Read `backend/main.py`, find where the journal_entries router is included. Add after it:

```python
from routers import expenses as expenses_router
# ...
app.include_router(expenses_router.router, prefix="/api", tags=["expenses"])
```

- [ ] **Step 7: Run tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py::test_list_expenses_empty tests/test_routers_expenses.py::test_list_expenses_returns_seeded tests/test_routers_expenses.py::test_list_expenses_filter_payment_status tests/test_routers_expenses.py::test_get_expense_not_found tests/test_routers_expenses.py::test_get_expense_returns_data -v 2>&1 | tail -20
```

Expected: all 5 PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/schemas/expenses.py backend/services/expenses.py backend/routers/expenses.py backend/main.py backend/tests/test_routers_expenses.py
git commit -m "feat: add expenses list/get endpoints"
```

---

### Task 2: Create expense + auto-draft journal entry

**Files:**
- Modify: `backend/services/expenses.py` (already has `create_expense`)
- Modify: `backend/routers/expenses.py`
- Modify: `backend/tests/test_routers_expenses.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_routers_expenses.py`:

```python
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
    from models.journal import JournalEntry, JournalLine
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -k "create" -v 2>&1 | tail -10
```

Expected: FAIL — 405 (route doesn't exist).

- [ ] **Step 3: Add `POST /expenses` route to `backend/routers/expenses.py`**

Add before `GET /expenses/{id}`:

```python
@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(body: ExpenseCreate, db: DB, _: Admin):
    return await svc.create_expense(
        db,
        date=body.date,
        description=body.description,
        expense_account_id=body.expense_account_id,
        amount=body.amount,
        payment_status=body.payment_status,
        payment_account_id=body.payment_account_id,
        receipt_url=body.receipt_url,
        notes=body.notes,
    )
```

- [ ] **Step 4: Run create tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -k "create" -v 2>&1 | tail -15
```

Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/expenses.py backend/routers/expenses.py backend/tests/test_routers_expenses.py
git commit -m "feat: add create expense endpoint with auto-draft journal entry"
```

---

### Task 3: Update and delete expense

**Files:**
- Modify: `backend/services/expenses.py`
- Modify: `backend/routers/expenses.py`
- Modify: `backend/tests/test_routers_expenses.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_routers_expenses.py`:

```python
# ── Task 3: update + delete ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_expense_description(test_client, admin_auth_headers, db_session):
    exp = await _seed_expense(db_session)
    resp = await test_client.patch(
        f"/api/expenses/{exp.id}",
        json={"description": "Updated description"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated description"


@pytest.mark.asyncio
async def test_update_expense_not_found(test_client, admin_auth_headers):
    resp = await test_client.patch(
        f"/api/expenses/{uuid4()}",
        json={"description": "Ghost"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_expense_blocked_if_posted_entry(test_client, admin_auth_headers, db_session):
    """PATCH blocked when a posted journal entry references this expense."""
    from models.journal import JournalEntry, JournalLine
    eq_id = await _get_account_id(db_session, "5000")
    bank_id = await _get_account_id(db_session, "1010")
    exp = await _seed_expense(db_session)

    # Seed a posted journal entry referencing this expense
    entry = JournalEntry(
        date=date_type(2026, 3, 1),
        description="Posted entry for expense",
        status="posted",
        created_by="system",
        reference_type="expense",
        reference_id=exp.id,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(JournalLine(entry_id=entry.id, account_id=eq_id, debit=Decimal("200"), credit=Decimal("0")))
    db_session.add(JournalLine(entry_id=entry.id, account_id=bank_id, debit=Decimal("0"), credit=Decimal("200")))
    await db_session.flush()

    resp = await test_client.patch(
        f"/api/expenses/{exp.id}",
        json={"description": "Blocked"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_expense_success(test_client, admin_auth_headers, db_session):
    exp = await _seed_expense(db_session)
    resp = await test_client.delete(f"/api/expenses/{exp.id}", headers=admin_auth_headers)
    assert resp.status_code == 204

    resp2 = await test_client.get(f"/api/expenses/{exp.id}", headers=admin_auth_headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_expense_not_found(test_client, admin_auth_headers):
    resp = await test_client.delete(f"/api/expenses/{uuid4()}", headers=admin_auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_expense_blocked_if_posted_entry(test_client, admin_auth_headers, db_session):
    """DELETE blocked when a posted journal entry references this expense."""
    from models.journal import JournalEntry, JournalLine
    eq_id = await _get_account_id(db_session, "5000")
    bank_id = await _get_account_id(db_session, "1010")
    exp = await _seed_expense(db_session)

    entry = JournalEntry(
        date=date_type(2026, 3, 1),
        description="Posted",
        status="posted",
        created_by="system",
        reference_type="expense",
        reference_id=exp.id,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(JournalLine(entry_id=entry.id, account_id=eq_id, debit=Decimal("200"), credit=Decimal("0")))
    db_session.add(JournalLine(entry_id=entry.id, account_id=bank_id, debit=Decimal("0"), credit=Decimal("200")))
    await db_session.flush()

    resp = await test_client.delete(f"/api/expenses/{exp.id}", headers=admin_auth_headers)
    assert resp.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -k "update or delete" -v 2>&1 | tail -15
```

Expected: FAIL — 405 (routes don't exist).

- [ ] **Step 3: Add `update_expense` and `delete_expense` to `backend/services/expenses.py`**

```python
async def update_expense(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    date: Optional[date] = None,
    description: Optional[str] = None,
    expense_account_id: Optional[uuid.UUID] = None,
    amount: Optional[Decimal] = None,
    payment_status: Optional[str] = None,
    payment_account_id: Optional[uuid.UUID] = None,
    receipt_url: Optional[str] = None,
    notes: Optional[str] = None,
) -> Expense:
    expense = await _get_or_404(db, id)

    if await _has_posted_entry(db, id):
        raise HTTPException(
            status_code=409,
            detail="Cannot edit an expense with a posted journal entry. Void the entry first.",
        )

    if date is not None:
        expense.date = date
    if description is not None:
        expense.description = description
    if expense_account_id is not None:
        expense.expense_account_id = expense_account_id
    if amount is not None:
        expense.amount = amount
    if payment_status is not None:
        expense.payment_status = payment_status
    if payment_account_id is not None:
        expense.payment_account_id = payment_account_id
    if receipt_url is not None:
        expense.receipt_url = receipt_url
    if notes is not None:
        expense.notes = notes

    await db.flush()
    await _attach_journal_entry_ids(db, [expense])
    return expense


async def delete_expense(db: AsyncSession, *, id: uuid.UUID) -> None:
    expense = await _get_or_404(db, id)

    if await _has_posted_entry(db, id):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete an expense with a posted journal entry. Void the entry first.",
        )

    # Delete any draft/voided journal entries referencing this expense
    draft_entries = await db.execute(
        select(JournalEntry).where(
            JournalEntry.reference_type == "expense",
            JournalEntry.reference_id == id,
        )
    )
    for entry in draft_entries.scalars().all():
        await db.delete(entry)

    await db.delete(expense)
    await db.flush()
```

- [ ] **Step 4: Add PATCH and DELETE routes to `backend/routers/expenses.py`**

```python
@router.patch("/expenses/{id}", response_model=ExpenseOut)
async def update_expense(id: uuid.UUID, body: ExpenseUpdate, db: DB, _: Admin):
    return await svc.update_expense(
        db,
        id=id,
        date=body.date,
        description=body.description,
        expense_account_id=body.expense_account_id,
        amount=body.amount,
        payment_status=body.payment_status,
        payment_account_id=body.payment_account_id,
        receipt_url=body.receipt_url,
        notes=body.notes,
    )


@router.delete("/expenses/{id}", status_code=204)
async def delete_expense(id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_expense(db, id=id)
```

- [ ] **Step 5: Run update/delete tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -k "update or delete" -v 2>&1 | tail -15
```

Expected: all 6 PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/expenses.py backend/routers/expenses.py backend/tests/test_routers_expenses.py
git commit -m "feat: add update and delete expense endpoints"
```

---

### Task 4: Pay a payable expense

**Files:**
- Modify: `backend/services/expenses.py`
- Modify: `backend/routers/expenses.py`
- Modify: `backend/tests/test_routers_expenses.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_routers_expenses.py`:

```python
# ── Task 4: pay ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pay_payable_expense_success(test_client, admin_auth_headers, db_session):
    bank_id = await _get_account_id(db_session, "1010")
    exp = await _seed_expense(db_session, payment_status="payable")

    resp = await test_client.post(
        f"/api/expenses/{exp.id}/pay",
        json={"payment_account_id": str(bank_id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["payment_status"] == "paid"
    assert data["payment_account_id"] == str(bank_id)
    assert data["journal_entry_id"] is not None


@pytest.mark.asyncio
async def test_pay_already_paid_expense_returns_409(test_client, admin_auth_headers, db_session):
    exp = await _seed_expense(db_session, payment_status="paid")
    bank_id = await _get_account_id(db_session, "1010")

    resp = await test_client.post(
        f"/api/expenses/{exp.id}/pay",
        json={"payment_account_id": str(bank_id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_pay_expense_creates_ap_settlement_draft(test_client, admin_auth_headers, db_session):
    """Pay action creates Dr Accounts Payable / Cr Bank draft."""
    from models.journal import JournalLine
    from sqlalchemy import select
    bank_id = await _get_account_id(db_session, "1010")
    ap_id = await _get_account_id(db_session, "2000")
    exp = await _seed_expense(db_session, payment_status="payable", amount="150.00")

    resp = await test_client.post(
        f"/api/expenses/{exp.id}/pay",
        json={"payment_account_id": str(bank_id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    entry_id = resp.json()["journal_entry_id"]

    result = await db_session.execute(
        select(JournalLine).where(JournalLine.entry_id == entry_id)
    )
    lines = result.scalars().all()
    assert len(lines) == 2
    debit_line = next(ln for ln in lines if ln.debit > 0)
    credit_line = next(ln for ln in lines if ln.credit > 0)
    assert debit_line.account_id == ap_id
    assert Decimal(str(debit_line.debit)) == Decimal("150.00")
    assert credit_line.account_id == bank_id
    assert Decimal(str(credit_line.credit)) == Decimal("150.00")


@pytest.mark.asyncio
async def test_pay_expense_not_found(test_client, admin_auth_headers):
    resp = await test_client.post(
        f"/api/expenses/{uuid4()}/pay",
        json={"payment_account_id": str(uuid4())},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -k "pay" -v 2>&1 | tail -10
```

Expected: FAIL — 405 (route doesn't exist).

- [ ] **Step 3: Add `pay_expense` to `backend/services/expenses.py`**

```python
async def pay_expense(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    payment_account_id: uuid.UUID,
    payment_date: Optional[date] = None,
) -> Expense:
    expense = await _get_or_404(db, id)

    if expense.payment_status != "payable":
        raise HTTPException(
            status_code=409,
            detail=f"Expense is already '{expense.payment_status}'. Only payable expenses can be paid.",
        )

    expense.payment_status = "paid"
    expense.payment_account_id = payment_account_id
    await db.flush()

    ap_id = await _get_ap_account_id(db)
    pay_date = payment_date or date.today()
    await _create_draft_entry(
        db, expense,
        description=f"Payment of payable expense: {expense.description}",
        debit_account_id=ap_id,
        credit_account_id=payment_account_id,
        entry_date=pay_date,
    )
    await db.flush()

    await _attach_journal_entry_ids(db, [expense])
    return expense
```

- [ ] **Step 4: Add `POST /expenses/{id}/pay` route to `backend/routers/expenses.py`**

```python
@router.post("/expenses/{id}/pay", response_model=ExpenseOut)
async def pay_expense(id: uuid.UUID, body: ExpensePayPayload, db: DB, _: Admin):
    return await svc.pay_expense(
        db,
        id=id,
        payment_account_id=body.payment_account_id,
        payment_date=body.payment_date,
    )
```

- [ ] **Step 5: Run all pay tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -k "pay" -v 2>&1 | tail -15
```

Expected: all 4 PASS.

- [ ] **Step 6: Run full expenses test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest tests/test_routers_expenses.py -v 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 7: Run full project test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && python -m pytest --tb=no -q 2>&1 | tail -5
```

Expected: no regressions.

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/expenses.py backend/routers/expenses.py backend/tests/test_routers_expenses.py
git commit -m "feat: add pay expense endpoint with AP settlement auto-draft"
```

---

## Architectural notes

**`journal_entry_id` dynamic attribute:** Set on ORM instances before returning (same pattern as `account.balance` in `services/accounts.py`). Pydantic's `from_attributes=True` picks it up via `getattr`. The `ExpenseOut` schema declares it as `Optional[uuid.UUID] = None` so Pydantic won't error if the service forgets to set it.

**`_attach_journal_entry_ids` bulk query:** Fetches all non-voided journal entries for the given expense IDs in a single query, ordered by `created_at` DESC. The first hit per `reference_id` is used — this is the most recent non-voided entry. For `pay_expense`, this correctly returns the new AP settlement draft (created after the original expense draft).

**`delete_expense` cascade:** The `journal_entries` table has no FK to `expenses`, so draft/voided entries are not automatically deleted. The service explicitly deletes them. Posted entries are blocked before reaching the delete logic.

**`pay_expense` date handling:** The AP settlement draft uses the payment date (not the expense's original date). `_create_draft_entry` accepts an optional `entry_date` parameter; when set it overrides `expense.date` for the journal entry header. No mutation of the expense object required.
