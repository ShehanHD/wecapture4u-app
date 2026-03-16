# weCapture4U — Accounting Backend: Models & Migration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the accounting database migration, SQLAlchemy models (Account, JournalEntry, JournalLine, InvoicePayment, Expense), and Pydantic v2 schemas.

**Architecture:** Five new tables plus extensions to existing `appointments` and `invoice_items`. Status/type columns use Python `str` in SQLAlchemy — PostgreSQL enforces enum constraints via migration. Accounting FK columns (`deposit_account_id`, `revenue_account_id`) already exist as nullable UUID columns in the admin models (Plans 3–4) with inline comments referencing this migration. This plan wires them up with SQLAlchemy relationships.

**Depends on:** Plan 3 (Admin backend models — appointments, invoice_items, invoices tables).

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL, Pydantic v2, Alembic-style raw SQL migrations.

---

## File Structure

```
migrations/
  003_accounting.sql        # New tables, FK constraints, CHECK constraints, DB trigger, seed data
backend/
  models/
    accounting.py           # Account, JournalEntry, JournalLine, InvoicePayment, Expense
  schemas/
    accounting.py           # All Pydantic v2 schemas for accounting domain
    __tests__/
      test_accounting_schemas.py  # Schema validation unit tests
```

---

## Chunk 1: Migration + Models

### Task 1: Write failing schema tests

**Files:**
- Create: `backend/schemas/__tests__/test_accounting_schemas.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/schemas/__tests__/test_accounting_schemas.py
import pytest
from decimal import Decimal
from uuid import uuid4
from pydantic import ValidationError
from backend.schemas.accounting import (
    AccountCreate, AccountUpdate, AccountOut,
    JournalEntryCreate, JournalLineIn, JournalEntryOut,
    ExpenseCreate, InvoicePaymentCreate,
)


def test_account_create_valid():
    a = AccountCreate(code="1010", name="Business Bank", type="asset")
    assert a.code == "1010"
    assert a.type == "asset"


def test_account_create_invalid_type():
    with pytest.raises(ValidationError):
        AccountCreate(code="1010", name="Bank", type="invalid_type")


def test_account_update_rename_only():
    u = AccountUpdate(name="New Name")
    assert u.name == "New Name"
    assert u.archived is None


def test_journal_line_debit_and_credit_both_set_fails():
    with pytest.raises(ValidationError):
        JournalLineIn(account_id=uuid4(), debit=Decimal("100"), credit=Decimal("50"))


def test_journal_line_both_zero_fails():
    with pytest.raises(ValidationError):
        JournalLineIn(account_id=uuid4(), debit=Decimal("0"), credit=Decimal("0"))


def test_journal_line_negative_fails():
    with pytest.raises(ValidationError):
        JournalLineIn(account_id=uuid4(), debit=Decimal("-10"), credit=Decimal("0"))


def test_journal_entry_create_valid():
    entry = JournalEntryCreate(
        date="2026-01-15",
        description="Test entry",
        lines=[
            JournalLineIn(account_id=uuid4(), debit=Decimal("100"), credit=Decimal("0")),
            JournalLineIn(account_id=uuid4(), debit=Decimal("0"), credit=Decimal("100")),
        ]
    )
    assert len(entry.lines) == 2


def test_journal_entry_requires_at_least_two_lines():
    with pytest.raises(ValidationError):
        JournalEntryCreate(
            date="2026-01-15",
            description="Test",
            lines=[JournalLineIn(account_id=uuid4(), debit=Decimal("100"), credit=Decimal("0"))]
        )


def test_expense_create_paid_requires_payment_account():
    with pytest.raises(ValidationError):
        ExpenseCreate(
            date="2026-01-15",
            description="Camera lens",
            expense_account_id=uuid4(),
            amount=Decimal("500"),
            payment_status="paid",
            payment_account_id=None,  # missing — required when paid
        )


def test_expense_create_payable_no_payment_account_ok():
    e = ExpenseCreate(
        date="2026-01-15",
        description="Lens",
        expense_account_id=uuid4(),
        amount=Decimal("500"),
        payment_status="payable",
    )
    assert e.payment_account_id is None


def test_invoice_payment_positive_amount():
    with pytest.raises(ValidationError):
        InvoicePaymentCreate(
            amount=Decimal("0"),
            payment_date="2026-01-15",
            account_id=uuid4(),
        )
```

- [ ] **Step 2: Run tests — expect import errors (modules don't exist yet)**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/schemas/__tests__/test_accounting_schemas.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'backend.schemas.accounting'`

---

### Task 2: Migration 003_accounting.sql

**Files:**
- Create: `migrations/003_accounting.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migrations/003_accounting.sql
-- Accounting module: chart of accounts, journal entries, lines, payments, expenses
-- Depends on: 001_initial_schema.sql, 002_auth.sql

-- ─── ENUM TYPES ───────────────────────────────────────────────────────────────

CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE normal_balance_type AS ENUM ('debit', 'credit');
CREATE TYPE journal_entry_status AS ENUM ('draft', 'posted', 'voided');
CREATE TYPE journal_created_by AS ENUM ('system', 'manual');
CREATE TYPE payment_status_type AS ENUM ('paid', 'payable');

-- ─── ACCOUNTS ─────────────────────────────────────────────────────────────────

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    type            account_type NOT NULL,
    normal_balance  normal_balance_type NOT NULL,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    archived        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON accounts (type);
CREATE INDEX ON accounts (archived);

-- ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────────

CREATE TABLE journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date            DATE NOT NULL,
    description     TEXT NOT NULL,
    reference_type  TEXT,         -- 'invoice' | 'invoice_payment' | 'expense' | 'appointment' | 'manual'
    reference_id    UUID,
    status          journal_entry_status NOT NULL DEFAULT 'draft',
    created_by      journal_created_by NOT NULL DEFAULT 'manual',
    void_of         UUID REFERENCES journal_entries(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: only one non-voided system entry per (reference_type, reference_id)
CREATE UNIQUE INDEX journal_entries_system_idempotency
    ON journal_entries (reference_type, reference_id)
    WHERE status != 'voided' AND created_by = 'system' AND reference_type IS NOT NULL;

CREATE INDEX ON journal_entries (status);
CREATE INDEX ON journal_entries (date DESC);
CREATE INDEX ON journal_entries (reference_type, reference_id);

-- ─── JOURNAL LINES ────────────────────────────────────────────────────────────

CREATE TABLE journal_lines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id  UUID NOT NULL REFERENCES accounts(id),
    debit       NUMERIC(10,2) NOT NULL DEFAULT 0,
    credit      NUMERIC(10,2) NOT NULL DEFAULT 0,
    description TEXT,
    CONSTRAINT chk_non_negative    CHECK (debit >= 0 AND credit >= 0),
    CONSTRAINT chk_one_nonzero     CHECK (debit = 0 OR credit = 0),
    CONSTRAINT chk_not_both_zero   CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX ON journal_lines (entry_id);
CREATE INDEX ON journal_lines (account_id);

-- PostgreSQL trigger: enforce balance invariant on post
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debit  NUMERIC;
    total_credit NUMERIC;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        SELECT
            COALESCE(SUM(debit), 0),
            COALESCE(SUM(credit), 0)
        INTO total_debit, total_credit
        FROM journal_lines
        WHERE entry_id = NEW.id;

        IF total_debit != total_credit THEN
            RAISE EXCEPTION 'Journal entry does not balance: debits %, credits %',
                total_debit, total_credit;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_journal_balance
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION check_journal_balance();

-- ─── INVOICE PAYMENTS ─────────────────────────────────────────────────────────

CREATE TABLE invoice_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_date    DATE NOT NULL,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON invoice_payments (invoice_id);

-- ─── EXPENSES ─────────────────────────────────────────────────────────────────

CREATE TABLE expenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date                DATE NOT NULL,
    description         TEXT NOT NULL,
    expense_account_id  UUID NOT NULL REFERENCES accounts(id),
    amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_status      payment_status_type NOT NULL,
    payment_account_id  UUID REFERENCES accounts(id),
    receipt_url         TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON expenses (date DESC);
CREATE INDEX ON expenses (expense_account_id);
CREATE INDEX ON expenses (payment_status);

-- ─── FOREIGN KEY WIRES (accounting columns added in 001/003 plan stubs) ───────

-- appointments.deposit_account_id → accounts
ALTER TABLE appointments
    ADD CONSTRAINT fk_appointments_deposit_account
    FOREIGN KEY (deposit_account_id) REFERENCES accounts(id);

-- invoice_items.revenue_account_id → accounts
ALTER TABLE invoice_items
    ADD CONSTRAINT fk_invoice_items_revenue_account
    FOREIGN KEY (revenue_account_id) REFERENCES accounts(id);

-- invoices: add requires_review flag (set when a posted payment entry is voided)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── CHART OF ACCOUNTS SEED ───────────────────────────────────────────────────

INSERT INTO accounts (code, name, type, normal_balance, is_system) VALUES
    -- Assets
    ('1000', 'Cash on Hand',          'asset',     'debit',  TRUE),
    ('1010', 'Business Bank Account', 'asset',     'debit',  TRUE),
    ('1020', 'Investment Account',    'asset',     'debit',  TRUE),
    ('1100', 'Accounts Receivable',   'asset',     'debit',  TRUE),
    -- Liabilities
    ('2000', 'Accounts Payable',      'liability', 'credit', TRUE),
    ('2100', 'Loan Payable',          'liability', 'credit', TRUE),
    ('2200', 'Deferred Revenue',      'liability', 'credit', TRUE),
    ('2300', 'Tax Payable',           'liability', 'credit', TRUE),
    -- Equity
    ('3000', 'Owner''s Capital',      'equity',    'credit', TRUE),
    ('3100', 'Owner''s Drawings',     'equity',    'debit',  TRUE),  -- contra-equity, debit normal
    ('3200', 'Retained Earnings',     'equity',    'credit', TRUE),
    -- Revenue
    ('4000', 'Session Fees',          'revenue',   'credit', TRUE),
    ('4100', 'Print Sales',           'revenue',   'credit', FALSE),
    ('4200', 'Album Sales',           'revenue',   'credit', FALSE),
    ('4300', 'Other Income',          'revenue',   'credit', FALSE),
    -- Expenses
    ('5000', 'Equipment',             'expense',   'debit',  FALSE),
    ('5100', 'Software & Subscriptions', 'expense','debit',  FALSE),
    ('5200', 'Travel & Transport',    'expense',   'debit',  FALSE),
    ('5300', 'Print & Production',    'expense',   'debit',  FALSE),
    ('5400', 'Marketing & Advertising','expense',  'debit',  FALSE),
    ('5500', 'Interest Expense',      'expense',   'debit',  TRUE),
    ('5600', 'Other Expenses',        'expense',   'debit',  FALSE)
ON CONFLICT (code) DO NOTHING;
```

- [ ] **Step 2: No automated test for SQL migrations — verify manually later during integration tests**

---

### Task 3: SQLAlchemy models

**Files:**
- Create: `backend/models/accounting.py`

- [ ] **Step 1: Write the models**

```python
# backend/models/accounting.py
from __future__ import annotations
import uuid
from decimal import Decimal
from sqlalchemy import String, Boolean, Numeric, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.models.base import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    # type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' — enforced by migration enum
    normal_balance: Mapped[str] = mapped_column(String, nullable=False)
    # normal_balance: 'debit' | 'credit' — enforced by migration enum
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at = mapped_column(server_default=func.now(), nullable=False)

    lines: Mapped[list[JournalLine]] = relationship("JournalLine", back_populates="account", lazy="select")


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[object] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String, nullable=True)
    # reference_type: 'invoice' | 'invoice_payment' | 'expense' | 'appointment' | 'manual' | null
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    # status: 'draft' | 'posted' | 'voided' — enforced by migration enum
    created_by: Mapped[str] = mapped_column(String, nullable=False, default="manual")
    # created_by: 'system' | 'manual' — enforced by migration enum
    void_of: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id"), nullable=True
    )
    created_at = mapped_column(server_default=func.now(), nullable=False)

    lines: Mapped[list[JournalLine]] = relationship(
        "JournalLine", back_populates="entry", cascade="all, delete-orphan", lazy="select"
    )


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False
    )
    debit: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    entry: Mapped[JournalEntry] = relationship("JournalEntry", back_populates="lines")
    account: Mapped[Account] = relationship("Account", back_populates="lines")


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[object] = mapped_column(Date, nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at = mapped_column(server_default=func.now(), nullable=False)


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[object] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    expense_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_status: Mapped[str] = mapped_column(String, nullable=False)
    # payment_status: 'paid' | 'payable' — enforced by migration enum
    payment_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True
    )
    receipt_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at = mapped_column(server_default=func.now(), nullable=False)
```

- [ ] **Step 2: No direct test — models are tested via schema + integration tests**

---

### Task 4: Pydantic v2 schemas

**Files:**
- Create: `backend/schemas/accounting.py`

- [ ] **Step 1: Write the schemas**

```python
# backend/schemas/accounting.py
from __future__ import annotations
from decimal import Decimal
from datetime import date
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, field_validator, model_validator


# ─── ACCOUNTS ─────────────────────────────────────────────────────────────────

AccountType = Literal["asset", "liability", "equity", "revenue", "expense"]
NormalBalance = Literal["debit", "credit"]
_ACCOUNT_NORMAL: dict[str, str] = {
    "asset": "debit", "expense": "debit",
    "liability": "credit", "equity": "credit", "revenue": "credit",
}
# Owner's Drawings is the sole exception — seeded explicitly in the migration.


class AccountCreate(BaseModel):
    code: str
    name: str
    type: AccountType

    @property
    def normal_balance(self) -> NormalBalance:
        return _ACCOUNT_NORMAL[self.type]  # type: ignore[return-value]


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    archived: Optional[bool] = None


class AccountOut(BaseModel):
    id: UUID
    code: str
    name: str
    type: str
    normal_balance: str
    is_system: bool
    archived: bool

    model_config = {"from_attributes": True}


# ─── JOURNAL LINES ────────────────────────────────────────────────────────────

class JournalLineIn(BaseModel):
    account_id: UUID
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: Optional[str] = None

    @field_validator("debit", "credit")
    @classmethod
    def non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("debit and credit must be non-negative")
        return v

    @model_validator(mode="after")
    def exactly_one_nonzero(self) -> "JournalLineIn":
        if self.debit > 0 and self.credit > 0:
            raise ValueError("A journal line cannot have both debit and credit > 0")
        if self.debit == 0 and self.credit == 0:
            raise ValueError("A journal line must have debit > 0 or credit > 0")
        return self


class JournalLineOut(BaseModel):
    id: UUID
    account_id: UUID
    account_name: str
    account_code: str
    debit: Decimal
    credit: Decimal
    description: Optional[str]

    model_config = {"from_attributes": True}


# ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────────

class JournalEntryCreate(BaseModel):
    date: date
    description: str
    lines: list[JournalLineIn]

    @field_validator("lines")
    @classmethod
    def at_least_two_lines(cls, v: list[JournalLineIn]) -> list[JournalLineIn]:
        if len(v) < 2:
            raise ValueError("A journal entry must have at least two lines")
        return v


class JournalEntryUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    lines: Optional[list[JournalLineIn]] = None


class JournalEntryOut(BaseModel):
    id: UUID
    date: date
    description: str
    reference_type: Optional[str]
    reference_id: Optional[UUID]
    status: str
    created_by: str
    void_of: Optional[UUID]
    lines: list[JournalLineOut] = []

    model_config = {"from_attributes": True}


class JournalEntryListItem(BaseModel):
    id: UUID
    date: date
    description: str
    reference_type: Optional[str]
    status: str
    created_by: str
    total_debit: Decimal

    model_config = {"from_attributes": True}


# ─── INVOICE PAYMENTS ─────────────────────────────────────────────────────────

class InvoicePaymentCreate(BaseModel):
    amount: Decimal
    payment_date: date
    account_id: UUID
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def positive_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return v


class InvoicePaymentOut(BaseModel):
    id: UUID
    invoice_id: UUID
    amount: Decimal
    payment_date: date
    account_id: UUID
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ─── EXPENSES ─────────────────────────────────────────────────────────────────

PaymentStatus = Literal["paid", "payable"]


class ExpenseCreate(BaseModel):
    date: date
    description: str
    expense_account_id: UUID
    amount: Decimal
    payment_status: PaymentStatus
    payment_account_id: Optional[UUID] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def positive_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v

    @model_validator(mode="after")
    def payment_account_required_when_paid(self) -> "ExpenseCreate":
        if self.payment_status == "paid" and self.payment_account_id is None:
            raise ValueError("payment_account_id is required when payment_status is 'paid'")
        return self


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


class ExpensePayRequest(BaseModel):
    payment_account_id: UUID
    payment_date: date


class ExpenseOut(BaseModel):
    id: UUID
    date: date
    description: str
    expense_account_id: UUID
    amount: Decimal
    payment_status: str
    payment_account_id: Optional[UUID]
    receipt_url: Optional[str]
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ─── AUTO-DRAFT PREVIEW ───────────────────────────────────────────────────────

class AutoDraftPreviewRequest(BaseModel):
    reference_type: Literal["invoice", "invoice_payment", "expense", "appointment"]
    reference_id: UUID


# ─── ACCOUNT LEDGER ───────────────────────────────────────────────────────────

class LedgerLine(BaseModel):
    entry_id: UUID
    date: date
    description: str
    debit: Decimal
    credit: Decimal
    running_balance: Decimal


class AccountLedgerOut(BaseModel):
    account: AccountOut
    opening_balance: Decimal
    lines: list[LedgerLine]
    closing_balance: Decimal
```

- [ ] **Step 2: Run the failing tests — expect them to pass now**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/schemas/__tests__/test_accounting_schemas.py -v
```

Expected: All 10 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add migrations/003_accounting.sql backend/models/accounting.py backend/schemas/accounting.py backend/schemas/__tests__/test_accounting_schemas.py
git commit -m "feat: add accounting models, migration 003, and Pydantic schemas"
```

---

## Chunk 2: Update existing models + final verification

### Task 5: Wire accounting FKs into existing models

**Files:**
- Modify: `backend/models/appointments.py` — add relationship to Account for deposit_account
- Modify: `backend/models/invoices.py` — add relationship to Account for revenue_account; add `requires_review` column; add `payments` relationship

- [ ] **Step 1: Write a failing test verifying the relationship attributes exist**

```python
# backend/models/__tests__/test_accounting_relationships.py
import inspect
from backend.models.accounting import Account
from backend.models.appointments import Appointment
from backend.models.invoices import Invoice, InvoiceItem


def test_appointment_has_deposit_account_relationship():
    # SQLAlchemy relationships are registered on the class
    assert hasattr(Appointment, "deposit_account")


def test_invoice_item_has_revenue_account_relationship():
    assert hasattr(InvoiceItem, "revenue_account")


def test_invoice_has_requires_review_column():
    assert hasattr(Invoice, "requires_review")


def test_invoice_has_payments_relationship():
    assert hasattr(Invoice, "payments")
```

- [ ] **Step 2: Run — expect AttributeError failures**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/models/__tests__/test_accounting_relationships.py -v
```

Expected: All 4 tests FAIL.

- [ ] **Step 3: Add relationships to existing models**

In `backend/models/appointments.py`, add after existing imports and before or after `deposit_account_id` column:

```python
from sqlalchemy.orm import relationship
# Inside Appointment class, after deposit_account_id column:
deposit_account: Mapped["Account | None"] = relationship(
    "Account", foreign_keys="[Appointment.deposit_account_id]", lazy="select"
)
```

In `backend/models/invoices.py`, add:

```python
# Inside Invoice class:
requires_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
payments: Mapped[list["InvoicePayment"]] = relationship(
    "InvoicePayment", back_populates="invoice", lazy="select"
)

# Inside InvoiceItem class:
revenue_account: Mapped["Account | None"] = relationship(
    "Account", foreign_keys="[InvoiceItem.revenue_account_id]", lazy="select"
)
```

In `backend/models/accounting.py`, inside `InvoicePayment` class, add:

```python
invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/models/__tests__/test_accounting_relationships.py -v
```

Expected: All 4 PASS.

- [ ] **Step 5: Run all schema tests to ensure nothing broken**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/schemas/__tests__/ -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/models/appointments.py backend/models/invoices.py backend/models/accounting.py backend/models/__tests__/test_accounting_relationships.py
git commit -m "feat: wire accounting FK relationships into appointment and invoice models"
```
