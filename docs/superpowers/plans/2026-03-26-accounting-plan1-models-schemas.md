# Accounting Plan 1 — Models & Schemas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the InvoicePayment model mismatch with the migration, add the missing ORM models (Account, JournalEntry, JournalLine, Expense), and add Pydantic schemas for all — laying the data layer foundation for the accounting endpoints.

**Architecture:** Migration 003_accounting.sql is already applied (all tables exist). This plan aligns the Python ORM layer with the DB schema. No new endpoints are added — that is Plan 2+. Tests are direct DB integration tests using the savepoint-rollback fixture.

**Tech Stack:** SQLAlchemy async ORM, Pydantic v2, pytest-asyncio, real Supabase test DB (no mocks)

---

## File Map

| File | Change |
|---|---|
| `backend/models/account.py` | New — Account ORM model |
| `backend/models/journal.py` | New — JournalEntry + JournalLine ORM models |
| `backend/models/expense.py` | New — Expense ORM model |
| `backend/models/invoice.py` | Modify — fix InvoicePayment fields (payment_date + account_id), add FK on InvoiceItem.revenue_account_id |
| `backend/models/appointment.py` | Modify — add FK on deposit_account_id |
| `backend/schemas/accounts.py` | New — AccountCreate, AccountUpdate, AccountOut |
| `backend/schemas/journal.py` | New — JournalEntryCreate, JournalEntryUpdate, JournalEntryOut, JournalLineCreate, JournalLineOut |
| `backend/schemas/expenses.py` | New — ExpenseCreate, ExpenseUpdate, ExpenseOut |
| `backend/schemas/invoices.py` | Modify — fix PaymentCreate/PaymentOut fields |
| `backend/services/invoices.py` | Modify — fix add_payment signature and body |
| `backend/routers/invoices.py` | Modify — fix add_payment route |
| `backend/tests/test_accounting_models.py` | New — DB-level model integration tests |

---

### Task 1: Fix InvoicePayment model to match migration

The migration creates `invoice_payments` with `payment_date DATE` and `account_id UUID` (FK → accounts). The current model uses `paid_at` and `method` — this must be fixed across the model, schema, service, and router.

**Files:**
- Modify: `backend/models/invoice.py`
- Modify: `backend/schemas/invoices.py`
- Modify: `backend/services/invoices.py`
- Modify: `backend/routers/invoices.py`
- Create: `backend/tests/test_accounting_models.py`

- [ ] **Step 1: Create the test file with a failing test**

```python
# backend/tests/test_accounting_models.py
import pytest
from uuid import uuid4
from decimal import Decimal
from datetime import date
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_invoice_payment_uses_payment_date_and_account_id(db_session: AsyncSession):
    """InvoicePayment model must use payment_date + account_id, not paid_at + method."""
    from models.client import Client
    from models.invoice import Invoice, InvoicePayment

    client = Client(name="Acct Test", email=f"acct_{uuid4().hex[:8]}@test.internal", tags=[])
    db_session.add(client)
    await db_session.flush()

    invoice = Invoice(client_id=client.id, status="sent")
    db_session.add(invoice)
    await db_session.flush()

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1010'"))
    account_id = result.scalar_one()

    payment = InvoicePayment(
        invoice_id=invoice.id,
        amount=Decimal("100.00"),
        payment_date=date.today(),
        account_id=account_id,
        notes="Test payment",
    )
    db_session.add(payment)
    await db_session.flush()

    assert payment.payment_date == date.today()
    assert payment.account_id == account_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_invoice_payment_uses_payment_date_and_account_id -v`

Expected: FAIL — `InvoicePayment` has no `payment_date` or `account_id` attributes

- [ ] **Step 3: Fix InvoicePayment in `backend/models/invoice.py`**

Replace the `InvoicePayment` class:

```python
class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="payments", lazy="select")
```

Also update the `Invoice.payments` relationship `order_by`:

```python
payments = relationship(
    "InvoicePayment",
    back_populates="invoice",
    cascade="all, delete-orphan",
    lazy="select",
    order_by="InvoicePayment.payment_date",
)
```

Make sure `Date` is in the imports at the top of `invoice.py` (it already is).

- [ ] **Step 4: Fix schemas in `backend/schemas/invoices.py`**

Replace `PaymentCreate` and `PaymentOut`:

```python
class PaymentCreate(BaseModel):
    amount: Decimal
    payment_date: date
    account_id: uuid.UUID
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: Decimal
    payment_date: date
    account_id: uuid.UUID
    notes: Optional[str]
    created_at: datetime
```

- [ ] **Step 5: Fix `backend/services/invoices.py` — update `add_payment`**

Replace the `add_payment` function:

```python
async def add_payment(
    db: AsyncSession,
    *,
    invoice_id: uuid.UUID,
    amount: Decimal,
    payment_date,
    account_id: uuid.UUID,
    notes: Optional[str] = None,
) -> InvoicePayment:
    invoice = await get_invoice(db, id=invoice_id)
    if invoice.status not in ("sent", "partially_paid", "paid"):
        raise HTTPException(status_code=409, detail="Payments can only be recorded on sent or active invoices.")
    payment = InvoicePayment(
        invoice_id=invoice_id,
        amount=amount.quantize(Decimal("0.01")),
        payment_date=payment_date,
        account_id=account_id,
        notes=notes,
    )
    db.add(payment)
    await db.flush()
    await _update_payment_status(db, invoice)
    return payment
```

- [ ] **Step 6: Fix `backend/routers/invoices.py` — update `add_payment` route**

Replace:

```python
@router.post("/invoices/{id}/payments", response_model=PaymentOut, status_code=201)
async def add_payment(id: uuid.UUID, body: PaymentCreate, db: DB, _: Admin):
    return await svc.add_payment(
        db,
        invoice_id=id,
        amount=body.amount,
        payment_date=body.payment_date,
        account_id=body.account_id,
        notes=body.notes,
    )
```

- [ ] **Step 7: Run the new test**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_invoice_payment_uses_payment_date_and_account_id -v`

Expected: PASS

- [ ] **Step 8: Run full test suite to check for regressions**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest -v 2>&1 | tail -20`

Expected: All previously passing tests still pass

- [ ] **Step 9: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/models/invoice.py backend/schemas/invoices.py backend/services/invoices.py backend/routers/invoices.py backend/tests/test_accounting_models.py
git commit -m "fix: align InvoicePayment model with migration (payment_date + account_id)"
```

---

### Task 2: Add Account model and schemas

**Files:**
- Create: `backend/models/account.py`
- Create: `backend/schemas/accounts.py`
- Modify: `backend/tests/test_accounting_models.py`

- [ ] **Step 1: Add a failing test for Account**

Add to `backend/tests/test_accounting_models.py`:

```python
@pytest.mark.asyncio
async def test_account_model_create_and_query(db_session: AsyncSession):
    """Seeded accounts exist and new custom accounts can be created."""
    from models.account import Account

    # Verify seeded Business Bank Account
    result = await db_session.execute(
        select(Account).where(Account.code == "1010")
    )
    bank = result.scalar_one()
    assert bank.name == "Business Bank Account"
    assert bank.type == "asset"
    assert bank.normal_balance == "debit"
    assert bank.is_system is True
    assert bank.archived is False

    # Create a custom account
    acct = Account(
        code="9001",
        name="Test Custom Account",
        type="expense",
        normal_balance="debit",
        is_system=False,
    )
    db_session.add(acct)
    await db_session.flush()
    assert acct.id is not None
    assert acct.archived is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_account_model_create_and_query -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'models.account'`

- [ ] **Step 3: Create `backend/models/account.py`**

```python
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(
        SAEnum('asset', 'liability', 'equity', 'revenue', 'expense',
               name='account_type', create_type=False),
        nullable=False,
    )
    normal_balance = Column(
        SAEnum('debit', 'credit', name='normal_balance_type', create_type=False),
        nullable=False,
    )
    is_system = Column(Boolean, nullable=False, server_default="false")
    archived = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    journal_lines = relationship("JournalLine", back_populates="account", lazy="select")
```

- [ ] **Step 4: Create `backend/schemas/accounts.py`**

```python
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AccountCreate(BaseModel):
    code: str
    name: str
    type: str  # asset | liability | equity | revenue | expense


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    archived: Optional[bool] = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    type: str
    normal_balance: str
    is_system: bool
    archived: bool
    created_at: datetime
    balance: Optional[Decimal] = None  # populated by service layer from posted journal lines
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_account_model_create_and_query -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/models/account.py backend/schemas/accounts.py backend/tests/test_accounting_models.py
git commit -m "feat: add Account model and schemas"
```

---

### Task 3: Wire FK constraints on existing models

Now that `Account` exists as an ORM class, add proper SQLAlchemy `ForeignKey` declarations to the existing columns that already reference `accounts.id` at the DB level but lack it in the ORM.

**Files:**
- Modify: `backend/models/invoice.py` — `InvoiceItem.revenue_account_id`
- Modify: `backend/models/appointment.py` — `deposit_account_id`
- Modify: `backend/tests/test_accounting_models.py`

- [ ] **Step 1: Add a test for revenue_account_id FK**

Add to `backend/tests/test_accounting_models.py`:

```python
@pytest.mark.asyncio
async def test_invoice_item_revenue_account_fk(db_session: AsyncSession):
    """InvoiceItem.revenue_account_id FK references accounts table correctly."""
    from models.invoice import Invoice, InvoiceItem
    from models.client import Client

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '4000'"))
    session_fees_id = result.scalar_one()

    client = Client(name="FK Test", email=f"fk_{uuid4().hex[:8]}@test.internal", tags=[])
    db_session.add(client)
    await db_session.flush()

    invoice = Invoice(client_id=client.id, status="draft")
    db_session.add(invoice)
    await db_session.flush()

    item = InvoiceItem(
        invoice_id=invoice.id,
        description="Session",
        quantity=Decimal("1"),
        unit_price=Decimal("300.00"),
        amount=Decimal("300.00"),
        revenue_account_id=session_fees_id,
    )
    db_session.add(item)
    await db_session.flush()

    result = await db_session.execute(
        select(InvoiceItem).where(InvoiceItem.id == item.id)
    )
    fetched = result.scalar_one()
    assert fetched.revenue_account_id == session_fees_id
```

- [ ] **Step 2: Run test to confirm it passes (DB FK already enforced)**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_invoice_item_revenue_account_fk -v`

Expected: PASS (column already exists in DB — this test establishes a baseline before adding ORM FK)

- [ ] **Step 3: Add ForeignKey to `InvoiceItem.revenue_account_id` in `backend/models/invoice.py`**

Replace:
```python
revenue_account_id = Column(UUID(as_uuid=True), nullable=True)
```
With:
```python
revenue_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
```

- [ ] **Step 4: Add ForeignKey to `Appointment.deposit_account_id` in `backend/models/appointment.py`**

Replace:
```python
# deposit_account_id FKs to accounts table (created in 003_accounting.sql).
# No SQLAlchemy relationship until Plan 8 (Accounting).
deposit_account_id = Column(UUID(as_uuid=True), nullable=True)
```
With:
```python
deposit_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
```

(`ForeignKey` is already imported in `appointment.py`)

- [ ] **Step 5: Run all accounting model tests**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py -v`

Expected: All tests pass

- [ ] **Step 6: Run full test suite**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest -v 2>&1 | tail -20`

Expected: No regressions

- [ ] **Step 7: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/models/invoice.py backend/models/appointment.py backend/tests/test_accounting_models.py
git commit -m "fix: add SQLAlchemy ForeignKey constraints for accounts references in existing models"
```

---

### Task 4: Add JournalEntry + JournalLine models and schemas

**Files:**
- Create: `backend/models/journal.py`
- Create: `backend/schemas/journal.py`
- Modify: `backend/tests/test_accounting_models.py`

- [ ] **Step 1: Add a failing test for JournalEntry + JournalLine**

Add to `backend/tests/test_accounting_models.py`:

```python
@pytest.mark.asyncio
async def test_journal_entry_with_lines(db_session: AsyncSession):
    """JournalEntry with two balanced JournalLines can be created and related."""
    from models.journal import JournalEntry, JournalLine

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1100'"))
    ar_id = result.scalar_one()
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '4000'"))
    fees_id = result.scalar_one()

    entry = JournalEntry(
        date=date.today(),
        description="Invoice sent - test",
        reference_type="invoice",
        reference_id=uuid4(),
        status="draft",
        created_by="system",
    )
    db_session.add(entry)
    await db_session.flush()

    dr_line = JournalLine(
        entry_id=entry.id, account_id=ar_id,
        debit=Decimal("500.00"), credit=Decimal("0"),
    )
    cr_line = JournalLine(
        entry_id=entry.id, account_id=fees_id,
        debit=Decimal("0"), credit=Decimal("500.00"),
    )
    db_session.add_all([dr_line, cr_line])
    await db_session.flush()

    await db_session.refresh(entry, ["lines"])
    assert len(entry.lines) == 2
    assert entry.status == "draft"
    assert entry.created_by == "system"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_journal_entry_with_lines -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'models.journal'`

- [ ] **Step 3: Create `backend/models/journal.py`**

```python
import uuid
from sqlalchemy import Column, String, Text, Numeric, ForeignKey, Date, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    reference_type = Column(String, nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(
        SAEnum('draft', 'posted', 'voided', name='journal_entry_status', create_type=False),
        nullable=False,
        server_default="draft",
    )
    created_by = Column(
        SAEnum('system', 'manual', name='journal_created_by', create_type=False),
        nullable=False,
    )
    void_of = Column(UUID(as_uuid=True), ForeignKey("journal_entries.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lines = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan", lazy="select")


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id = Column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    debit = Column(Numeric(10, 2), nullable=False, server_default="0")
    credit = Column(Numeric(10, 2), nullable=False, server_default="0")
    description = Column(Text, nullable=True)

    entry = relationship("JournalEntry", back_populates="lines", lazy="select")
    account = relationship("Account", back_populates="journal_lines", lazy="select")
```

- [ ] **Step 4: Create `backend/schemas/journal.py`**

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class JournalLineCreate(BaseModel):
    account_id: uuid.UUID
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: Optional[str] = None


class JournalLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entry_id: uuid.UUID
    account_id: uuid.UUID
    debit: Decimal
    credit: Decimal
    description: Optional[str]


class JournalEntryCreate(BaseModel):
    date: date
    description: str
    lines: list[JournalLineCreate]


class JournalEntryUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    lines: Optional[list[JournalLineCreate]] = None


class JournalEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    description: str
    reference_type: Optional[str]
    reference_id: Optional[uuid.UUID]
    status: str
    created_by: str
    void_of: Optional[uuid.UUID]
    created_at: datetime
    lines: list[JournalLineOut] = []
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_journal_entry_with_lines -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/models/journal.py backend/schemas/journal.py backend/tests/test_accounting_models.py
git commit -m "feat: add JournalEntry and JournalLine models and schemas"
```

---

### Task 5: Add Expense model and schemas

**Files:**
- Create: `backend/models/expense.py`
- Create: `backend/schemas/expenses.py`
- Modify: `backend/tests/test_accounting_models.py`

- [ ] **Step 1: Add a failing test for Expense**

Add to `backend/tests/test_accounting_models.py`:

```python
@pytest.mark.asyncio
async def test_expense_model_create(db_session: AsyncSession):
    """Expense model supports paid and payable payment_status values."""
    from models.expense import Expense

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '5000'"))
    equipment_id = result.scalar_one()
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1010'"))
    bank_id = result.scalar_one()

    paid_expense = Expense(
        date=date.today(),
        description="Camera lens",
        expense_account_id=equipment_id,
        amount=Decimal("800.00"),
        payment_status="paid",
        payment_account_id=bank_id,
    )
    db_session.add(paid_expense)
    await db_session.flush()
    assert paid_expense.id is not None
    assert paid_expense.payment_status == "paid"

    payable_expense = Expense(
        date=date.today(),
        description="Print order",
        expense_account_id=equipment_id,
        amount=Decimal("200.00"),
        payment_status="payable",
    )
    db_session.add(payable_expense)
    await db_session.flush()
    assert payable_expense.payment_account_id is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py::test_expense_model_create -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'models.expense'`

- [ ] **Step 3: Create `backend/models/expense.py`**

```python
import uuid
from sqlalchemy import Column, Text, Numeric, ForeignKey, Date, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    expense_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_status = Column(
        SAEnum('paid', 'payable', name='expense_payment_status', create_type=False),
        nullable=False,
    )
    payment_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=True)
    receipt_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    expense_account = relationship("Account", foreign_keys=[expense_account_id], lazy="select")
    payment_account = relationship("Account", foreign_keys=[payment_account_id], lazy="select")
```

- [ ] **Step 4: Create `backend/schemas/expenses.py`**

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ExpenseCreate(BaseModel):
    date: date
    description: str
    expense_account_id: uuid.UUID
    amount: Decimal
    payment_status: str  # paid | payable
    payment_account_id: Optional[uuid.UUID] = None  # required when payment_status == 'paid'
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    expense_account_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


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
```

- [ ] **Step 5: Run all accounting model tests**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest tests/test_accounting_models.py -v`

Expected: All 5 tests pass

- [ ] **Step 6: Run full test suite**

Run: `cd /Users/don/Desktop/weCapture4U-app/backend && pytest -v 2>&1 | tail -20`

Expected: No regressions

- [ ] **Step 7: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/models/expense.py backend/schemas/expenses.py backend/tests/test_accounting_models.py
git commit -m "feat: add Expense model and schemas"
```
