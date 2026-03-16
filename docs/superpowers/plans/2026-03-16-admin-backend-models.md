# weCapture4U — Admin Backend: Models & Schemas

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define all SQLAlchemy ORM models and Pydantic v2 schemas for the admin module entities: Client, SessionType, Appointment, JobStage, Job, Invoice, InvoiceItem, Notification, AppSettings.

**Architecture:** Each entity lives in its own model file under `backend/models/`. Pydantic schemas live in `backend/schemas/` with one file per domain. All models inherit from the shared `Base` from `backend/models/base.py`. Status fields use Python `str` type in SQLAlchemy (PostgreSQL enforces enum constraints at the DB level via migrations). Accounting-integration FK columns (`deposit_account_id`, `revenue_account_id`) are stored as nullable UUID columns — no SQLAlchemy relationship to `Account` until Plan 8.

**Depends on:** Plan 1 (Foundation — `backend/models/base.py`, `backend/database.py`), Plan 2 (Auth — `backend/models/user.py` defines `User`).

**Tech Stack:** SQLAlchemy 2 (async), Pydantic v2, Python 3.11.

---

## File Structure

```
backend/
  models/
    client.py           # Client
    session_type.py     # SessionType
    appointment.py      # Appointment
    job.py              # JobStage + Job
    invoice.py          # Invoice + InvoiceItem
    notification.py     # Notification
    settings.py         # AppSettings
    __init__.py         # Updated: import all new models so Alembic can discover them
  schemas/
    clients.py          # ClientCreate, ClientUpdate, ClientOut, ClientWithStats
    appointments.py     # AppointmentCreate, AppointmentUpdate, AppointmentOut
    jobs.py             # JobStageCreate/Update/Out, JobCreate/Update/Out, StagePositionReorder
    invoices.py         # InvoiceCreate/Update/Out, InvoiceItemCreate/Update/Out
    notifications.py    # NotificationOut
    settings.py         # AppSettingsOut, AppSettingsUpdate, SessionTypeCreate/Out
  tests/
    test_admin_models.py     # Import + field assertions for all models
    test_admin_schemas.py    # Pydantic validation tests
```

---

## Chunk 1: Models

### Task 1: Client + SessionType models

**Files:**
- Create: `backend/models/client.py`
- Create: `backend/models/session_type.py`
- Modify: `backend/models/__init__.py`
- Create: `backend/tests/test_admin_models.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_admin_models.py
from backend.models.client import Client
from backend.models.session_type import SessionType


def test_client_tablename():
    assert Client.__tablename__ == "clients"


def test_client_has_required_columns():
    cols = {c.name for c in Client.__table__.columns}
    assert {"id", "user_id", "name", "email", "phone", "address",
            "tags", "birthday", "notes", "created_at"}.issubset(cols)


def test_client_user_id_nullable():
    col = Client.__table__.c["user_id"]
    assert col.nullable is True


def test_session_type_tablename():
    assert SessionType.__tablename__ == "session_types"


def test_session_type_has_required_columns():
    cols = {c.name for c in SessionType.__table__.columns}
    assert {"id", "name", "created_at"}.issubset(cols)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_admin_models.py -v
```
Expected: `ImportError` — modules don't exist yet.

- [ ] **Step 3: Create `backend/models/client.py`**

```python
import uuid
from sqlalchemy import Column, String, Text, Date, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from sqlalchemy.orm import relationship
from backend.models.base import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), nullable=False, server_default="{}")
    birthday = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    portal_user = relationship("User", foreign_keys=[user_id], lazy="select")
    appointments = relationship("Appointment", back_populates="client", lazy="select")
    jobs = relationship("Job", back_populates="client", lazy="select")
    invoices = relationship("Invoice", back_populates="client", lazy="select")
```

- [ ] **Step 4: Create `backend/models/session_type.py`**

```python
import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from backend.models.base import Base


class SessionType(Base):
    __tablename__ = "session_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 5: Update `backend/models/__init__.py`** — add imports so all models are discovered:

```python
from backend.models.user import User  # noqa: F401 (already exists from Plan 2)
from backend.models.auth import RefreshToken, WebAuthnCredential  # noqa (Plan 2)
from backend.models.client import Client  # noqa
from backend.models.session_type import SessionType  # noqa
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/test_admin_models.py::test_client_tablename \
       tests/test_admin_models.py::test_client_has_required_columns \
       tests/test_admin_models.py::test_client_user_id_nullable \
       tests/test_admin_models.py::test_session_type_tablename \
       tests/test_admin_models.py::test_session_type_has_required_columns -v
```
Expected: 5 PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/models/client.py backend/models/session_type.py \
        backend/models/__init__.py backend/tests/test_admin_models.py
git commit -m "feat: add Client and SessionType SQLAlchemy models"
```

---

### Task 2: Appointment model

**Files:**
- Create: `backend/models/appointment.py`
- Modify: `backend/models/__init__.py`
- Modify: `backend/tests/test_admin_models.py`

- [ ] **Step 1: Add the failing test**

```python
# append to backend/tests/test_admin_models.py
from backend.models.appointment import Appointment


def test_appointment_tablename():
    assert Appointment.__tablename__ == "appointments"


def test_appointment_has_required_columns():
    cols = {c.name for c in Appointment.__table__.columns}
    assert {
        "id", "client_id", "session_type_id", "title", "starts_at", "ends_at",
        "location", "status", "addons", "deposit_paid", "deposit_amount",
        "deposit_account_id", "contract_signed", "notes", "created_at"
    }.issubset(cols)


def test_appointment_deposit_account_id_nullable():
    col = Appointment.__table__.c["deposit_account_id"]
    assert col.nullable is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_admin_models.py::test_appointment_tablename -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/models/appointment.py`**

```python
import uuid
from decimal import Decimal
from sqlalchemy import Column, String, Text, Boolean, Numeric, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.models.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    session_type_id = Column(UUID(as_uuid=True), ForeignKey("session_types.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    location = Column(String, nullable=True)
    # status: 'pending' | 'confirmed' | 'cancelled' — PostgreSQL enum enforced by migration
    status = Column(String, nullable=False, server_default="pending")
    # addons: fixed list ['album', 'thank_you_card', 'enlarged_photos']
    addons = Column(ARRAY(Text), nullable=False, server_default="{}")
    deposit_paid = Column(Boolean, nullable=False, server_default="false")
    deposit_amount = Column(Numeric(10, 2), nullable=False, server_default="0")
    # deposit_account_id FKs to accounts table (created in 003_accounting.sql).
    # No SQLAlchemy relationship until Plan 8 (Accounting).
    deposit_account_id = Column(UUID(as_uuid=True), nullable=True)
    contract_signed = Column(Boolean, nullable=False, server_default="false")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="appointments", lazy="select")
    session_type = relationship("SessionType", lazy="select")
    job = relationship("Job", back_populates="appointment", uselist=False, lazy="select")
```

- [ ] **Step 4: Update `backend/models/__init__.py`**

```python
from backend.models.appointment import Appointment  # noqa
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_admin_models.py -k "appointment" -v
```
Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/models/appointment.py backend/models/__init__.py \
        backend/tests/test_admin_models.py
git commit -m "feat: add Appointment SQLAlchemy model"
```

---

### Task 3: JobStage + Job models

**Files:**
- Create: `backend/models/job.py`
- Modify: `backend/models/__init__.py`
- Modify: `backend/tests/test_admin_models.py`

- [ ] **Step 1: Add failing tests**

```python
# append to backend/tests/test_admin_models.py
from backend.models.job import JobStage, Job


def test_job_stage_tablename():
    assert JobStage.__tablename__ == "job_stages"


def test_job_stage_columns():
    cols = {c.name for c in JobStage.__table__.columns}
    assert {"id", "name", "color", "position", "is_terminal", "created_at"}.issubset(cols)


def test_job_tablename():
    assert Job.__tablename__ == "jobs"


def test_job_columns():
    cols = {c.name for c in Job.__table__.columns}
    assert {
        "id", "client_id", "appointment_id", "title", "stage_id",
        "shoot_date", "delivery_deadline", "delivery_url", "notes", "created_at"
    }.issubset(cols)


def test_job_appointment_id_nullable():
    assert Job.__table__.c["appointment_id"].nullable is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_admin_models.py -k "job" -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/models/job.py`**

```python
import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.models.base import Base


class JobStage(Base):
    __tablename__ = "job_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)  # hex, e.g. '#f59e0b'
    position = Column(Integer, nullable=False)
    is_terminal = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    jobs = relationship("Job", back_populates="stage", lazy="select")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("job_stages.id", ondelete="RESTRICT"), nullable=False)
    shoot_date = Column(Date, nullable=True)
    delivery_deadline = Column(Date, nullable=True)
    # delivery_url added by 004_client_portal.sql migration
    delivery_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="jobs", lazy="select")
    appointment = relationship("Appointment", back_populates="job", lazy="select")
    stage = relationship("JobStage", back_populates="jobs", lazy="select")
    invoices = relationship("Invoice", back_populates="job", lazy="select")
```

- [ ] **Step 4: Update `backend/models/__init__.py`**

```python
from backend.models.job import JobStage, Job  # noqa
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_admin_models.py -k "job" -v
```
Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/models/job.py backend/models/__init__.py \
        backend/tests/test_admin_models.py
git commit -m "feat: add JobStage and Job SQLAlchemy models"
```

---

### Task 4: Invoice + InvoiceItem models

**Files:**
- Create: `backend/models/invoice.py`
- Modify: `backend/models/__init__.py`
- Modify: `backend/tests/test_admin_models.py`

- [ ] **Step 1: Add failing tests**

```python
# append to backend/tests/test_admin_models.py
from backend.models.invoice import Invoice, InvoiceItem


def test_invoice_tablename():
    assert Invoice.__tablename__ == "invoices"


def test_invoice_columns():
    cols = {c.name for c in Invoice.__table__.columns}
    assert {
        "id", "job_id", "client_id", "status", "subtotal", "discount", "tax",
        "total", "deposit_amount", "balance_due", "requires_review",
        "due_date", "sent_at", "paid_at", "created_at"
    }.issubset(cols)


def test_invoice_item_tablename():
    assert InvoiceItem.__tablename__ == "invoice_items"


def test_invoice_item_columns():
    cols = {c.name for c in InvoiceItem.__table__.columns}
    assert {
        "id", "invoice_id", "revenue_account_id", "description",
        "quantity", "unit_price", "amount"
    }.issubset(cols)


def test_invoice_job_id_nullable():
    assert Invoice.__table__.c["job_id"].nullable is True


def test_invoice_item_revenue_account_id_nullable():
    assert InvoiceItem.__table__.c["revenue_account_id"].nullable is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_admin_models.py -k "invoice" -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/models/invoice.py`**

```python
import uuid
from sqlalchemy import Column, String, Boolean, Numeric, ForeignKey, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.models.base import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    # status: 'draft' | 'sent' | 'partially_paid' | 'paid' — enforced by migration enum
    status = Column(String, nullable=False, server_default="draft")
    subtotal = Column(Numeric(10, 2), nullable=False, server_default="0")
    discount = Column(Numeric(10, 2), nullable=False, server_default="0")
    tax = Column(Numeric(10, 2), nullable=False, server_default="0")
    total = Column(Numeric(10, 2), nullable=False, server_default="0")
    deposit_amount = Column(Numeric(10, 2), nullable=False, server_default="0")
    balance_due = Column(Numeric(10, 2), nullable=False, server_default="0")
    requires_review = Column(Boolean, nullable=False, server_default="false")
    due_date = Column(Date, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="invoices", lazy="select")
    job = relationship("Job", back_populates="invoices", lazy="select")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", lazy="select")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    # revenue_account_id FKs to accounts table (003_accounting.sql).
    # No relationship until Plan 8.
    revenue_account_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(String, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, server_default="1")
    unit_price = Column(Numeric(10, 2), nullable=False)
    # amount = quantity × unit_price — computed by service layer, stored for query perf
    amount = Column(Numeric(10, 2), nullable=False, server_default="0")

    invoice = relationship("Invoice", back_populates="items", lazy="select")
```

- [ ] **Step 4: Update `backend/models/__init__.py`**

```python
from backend.models.invoice import Invoice, InvoiceItem  # noqa
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_admin_models.py -k "invoice" -v
```
Expected: 6 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/models/invoice.py backend/models/__init__.py \
        backend/tests/test_admin_models.py
git commit -m "feat: add Invoice and InvoiceItem SQLAlchemy models"
```

---

### Task 5: Notification + AppSettings models

**Files:**
- Create: `backend/models/notification.py`
- Create: `backend/models/settings.py`
- Modify: `backend/models/__init__.py`
- Modify: `backend/tests/test_admin_models.py`

- [ ] **Step 1: Add failing tests**

```python
# append to backend/tests/test_admin_models.py
from backend.models.notification import Notification
from backend.models.settings import AppSettings


def test_notification_tablename():
    assert Notification.__tablename__ == "notifications"


def test_notification_columns():
    cols = {c.name for c in Notification.__table__.columns}
    assert {"id", "user_id", "type", "title", "body", "read", "sent_email", "created_at"}.issubset(cols)


def test_app_settings_tablename():
    assert AppSettings.__tablename__ == "app_settings"


def test_app_settings_columns():
    cols = {c.name for c in AppSettings.__table__.columns}
    assert {"id", "tax_enabled", "tax_rate", "pdf_invoices_enabled", "updated_at"}.issubset(cols)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_admin_models.py -k "notification or app_settings" -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/models/notification.py`**

```python
import uuid
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.models.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)  # appointment_reminder, birthday, invoice_overdue, etc.
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    read = Column(Boolean, nullable=False, server_default="false")
    sent_email = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", lazy="select")
```

- [ ] **Step 4: Create `backend/models/settings.py`**

```python
from sqlalchemy import Column, Integer, Boolean, Numeric, DateTime
from sqlalchemy.sql import func
from backend.models.base import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    # Always id = 1. Single-row table. Never deleted.
    id = Column(Integer, primary_key=True)
    tax_enabled = Column(Boolean, nullable=False, server_default="false")
    tax_rate = Column(Numeric(5, 2), nullable=False, server_default="0")
    pdf_invoices_enabled = Column(Boolean, nullable=False, server_default="false")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
```

- [ ] **Step 5: Update `backend/models/__init__.py`** — final version:

```python
# Plan 2 models
from backend.models.user import User  # noqa: F401
from backend.models.auth import RefreshToken, WebAuthnCredential  # noqa: F401
# Plan 3 models
from backend.models.client import Client  # noqa: F401
from backend.models.session_type import SessionType  # noqa: F401
from backend.models.appointment import Appointment  # noqa: F401
from backend.models.job import JobStage, Job  # noqa: F401
from backend.models.invoice import Invoice, InvoiceItem  # noqa: F401
from backend.models.notification import Notification  # noqa: F401
from backend.models.settings import AppSettings  # noqa: F401
```

- [ ] **Step 6: Run all model tests**

```bash
pytest tests/test_admin_models.py -v
```
Expected: all PASS (20+ tests).

- [ ] **Step 7: Commit**

```bash
git add backend/models/notification.py backend/models/settings.py \
        backend/models/__init__.py backend/tests/test_admin_models.py
git commit -m "feat: add Notification and AppSettings SQLAlchemy models"
```

---

## Chunk 2: Schemas

### Task 6: Client + Settings schemas

**Files:**
- Create: `backend/schemas/clients.py`
- Create: `backend/schemas/settings.py`
- Create: `backend/tests/test_admin_schemas.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_admin_schemas.py
import uuid
from backend.schemas.clients import ClientCreate, ClientOut
from backend.schemas.settings import AppSettingsOut, SessionTypeCreate, SessionTypeOut


def test_client_create_requires_name_and_email():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        ClientCreate(name="Alice")  # missing email


def test_client_create_valid():
    c = ClientCreate(name="Alice", email="alice@example.com")
    assert c.name == "Alice"
    assert c.email == "alice@example.com"
    assert c.tags == []


def test_client_out_from_orm():
    # Simulates building from ORM attributes
    c = ClientOut.model_validate({
        "id": uuid.uuid4(),
        "user_id": None,
        "name": "Alice",
        "email": "alice@example.com",
        "phone": None,
        "address": None,
        "tags": [],
        "birthday": None,
        "notes": None,
        "created_at": "2026-01-01T00:00:00Z",
    })
    assert c.name == "Alice"


def test_session_type_create_requires_name():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        SessionTypeCreate()


def test_app_settings_out_defaults():
    s = AppSettingsOut.model_validate({
        "id": 1, "tax_enabled": False, "tax_rate": "0.00",
        "pdf_invoices_enabled": False, "updated_at": "2026-01-01T00:00:00Z"
    })
    assert s.tax_enabled is False
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_admin_schemas.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/schemas/clients.py`**

```python
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    tags: list[str] = []
    birthday: Optional[date] = None
    notes: Optional[str] = None
    # Portal access — if True, temp_password must be provided
    portal_access: bool = False
    temp_password: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tags: Optional[list[str]] = None
    birthday: Optional[date] = None
    notes: Optional[str] = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    name: str
    email: str
    phone: Optional[str]
    address: Optional[str]
    tags: list[str]
    birthday: Optional[date]
    notes: Optional[str]
    created_at: datetime


class ClientWithStats(ClientOut):
    """Extended response for client detail view — includes computed stats."""
    total_spent: float = 0.0
    is_active: Optional[bool] = None  # None if no portal account


class PortalAccessToggle(BaseModel):
    is_active: bool


class CreatePortalAccess(BaseModel):
    temp_password: str
```

- [ ] **Step 4: Create `backend/schemas/settings.py`**

```python
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AppSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tax_enabled: bool
    tax_rate: Decimal
    pdf_invoices_enabled: bool
    updated_at: datetime


class AppSettingsUpdate(BaseModel):
    tax_enabled: Optional[bool] = None
    tax_rate: Optional[Decimal] = None
    pdf_invoices_enabled: Optional[bool] = None


class SessionTypeCreate(BaseModel):
    name: str


class SessionTypeUpdate(BaseModel):
    name: str


class SessionTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    created_at: datetime
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_admin_schemas.py -k "client or session_type or app_settings" -v
```
Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/clients.py backend/schemas/settings.py \
        backend/tests/test_admin_schemas.py
git commit -m "feat: add Client and Settings Pydantic schemas"
```

---

### Task 7: Appointment + Job schemas

**Files:**
- Create: `backend/schemas/appointments.py`
- Create: `backend/schemas/jobs.py`
- Modify: `backend/tests/test_admin_schemas.py`

- [ ] **Step 1: Add failing tests**

```python
# append to backend/tests/test_admin_schemas.py
import uuid
from datetime import datetime, timezone
from backend.schemas.appointments import AppointmentCreate, AppointmentOut
from backend.schemas.jobs import JobCreate, JobStageOut, StagePositionReorder


def test_appointment_create_valid():
    a = AppointmentCreate(
        client_id=uuid.uuid4(),
        title="Wedding shoot",
        starts_at=datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc),
    )
    assert a.status == "pending"
    assert a.addons == []


def test_appointment_create_invalid_status():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        AppointmentCreate(
            client_id=uuid.uuid4(),
            title="Test",
            starts_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            status="invalid_status",
        )


def test_job_create_requires_client_title_stage():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        JobCreate(title="My Job")  # missing client_id and stage_id


def test_stage_position_reorder_valid():
    items = [
        {"id": str(uuid.uuid4()), "position": 1},
        {"id": str(uuid.uuid4()), "position": 2},
    ]
    r = StagePositionReorder(stages=items)
    assert len(r.stages) == 2
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_admin_schemas.py -k "appointment or job" -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/schemas/appointments.py`**

```python
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, field_validator

VALID_STATUSES = {"pending", "confirmed", "cancelled"}
VALID_ADDONS = {"album", "thank_you_card", "enlarged_photos"}


class AppointmentCreate(BaseModel):
    client_id: uuid.UUID
    session_type_id: Optional[uuid.UUID] = None
    title: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    location: Optional[str] = None
    status: str = "pending"
    addons: list[str] = []
    deposit_paid: bool = False
    deposit_amount: Decimal = Decimal("0")
    deposit_account_id: Optional[uuid.UUID] = None
    contract_signed: bool = False
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v

    @field_validator("addons")
    @classmethod
    def addons_must_be_valid(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_ADDONS
        if invalid:
            raise ValueError(f"invalid addons: {invalid}. Must be subset of {VALID_ADDONS}")
        return v


class AppointmentUpdate(BaseModel):
    session_type_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    location: Optional[str] = None
    status: Optional[str] = None
    addons: Optional[list[str]] = None
    deposit_paid: Optional[bool] = None
    deposit_amount: Optional[Decimal] = None
    deposit_account_id: Optional[uuid.UUID] = None
    contract_signed: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class SessionTypeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    session_type_id: Optional[uuid.UUID]
    session_type: Optional[SessionTypeSummary]
    title: str
    starts_at: datetime
    ends_at: Optional[datetime]
    location: Optional[str]
    status: str
    addons: list[str]
    deposit_paid: bool
    deposit_amount: Decimal
    deposit_account_id: Optional[uuid.UUID]
    contract_signed: bool
    notes: Optional[str]
    created_at: datetime
```

- [ ] **Step 4: Create `backend/schemas/jobs.py`**

```python
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class JobStageCreate(BaseModel):
    name: str
    color: str  # hex e.g. '#f59e0b'
    is_terminal: bool = False


class JobStageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_terminal: Optional[bool] = None


class JobStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    position: int
    is_terminal: bool
    created_at: datetime


class StagePositionItem(BaseModel):
    id: uuid.UUID
    position: int


class StagePositionReorder(BaseModel):
    stages: list[StagePositionItem]


class JobCreate(BaseModel):
    client_id: uuid.UUID
    title: str
    stage_id: uuid.UUID
    appointment_id: Optional[uuid.UUID] = None
    shoot_date: Optional[date] = None
    delivery_deadline: Optional[date] = None
    notes: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    stage_id: Optional[uuid.UUID] = None
    appointment_id: Optional[uuid.UUID] = None
    shoot_date: Optional[date] = None
    delivery_deadline: Optional[date] = None
    delivery_url: Optional[str] = None
    notes: Optional[str] = None


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    email: str


class AppointmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    starts_at: datetime
    status: str


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    client: Optional[ClientSummary]
    appointment_id: Optional[uuid.UUID]
    title: str
    stage_id: uuid.UUID
    shoot_date: Optional[date]
    delivery_deadline: Optional[date]
    delivery_url: Optional[str]
    notes: Optional[str]
    created_at: datetime


class JobDetailOut(JobOut):
    """Extended response for job detail view."""
    appointment: Optional[AppointmentSummary]
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_admin_schemas.py -k "appointment or job" -v
```
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/appointments.py backend/schemas/jobs.py \
        backend/tests/test_admin_schemas.py
git commit -m "feat: add Appointment and Job Pydantic schemas"
```

---

### Task 8: Invoice + Notification schemas

**Files:**
- Create: `backend/schemas/invoices.py`
- Create: `backend/schemas/notifications.py`
- Modify: `backend/tests/test_admin_schemas.py`

- [ ] **Step 1: Add failing tests**

```python
# append to backend/tests/test_admin_schemas.py
import uuid
from decimal import Decimal
from backend.schemas.invoices import InvoiceCreate, InvoiceItemCreate, InvoiceOut
from backend.schemas.notifications import NotificationOut


def test_invoice_create_requires_client_id():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        InvoiceCreate()


def test_invoice_create_valid():
    inv = InvoiceCreate(client_id=uuid.uuid4())
    assert inv.status == "draft"
    assert inv.discount == Decimal("0")


def test_invoice_item_create_valid():
    item = InvoiceItemCreate(
        description="Session fee", quantity=Decimal("1"), unit_price=Decimal("500")
    )
    assert item.quantity == Decimal("1")


def test_notification_out_from_dict():
    import datetime
    n = NotificationOut.model_validate({
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "type": "appointment_reminder",
        "title": "Reminder",
        "body": "You have an appointment tomorrow",
        "read": False,
        "sent_email": True,
        "created_at": datetime.datetime.now(datetime.timezone.utc),
    })
    assert n.type == "appointment_reminder"
    assert n.read is False
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_admin_schemas.py -k "invoice or notification" -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/schemas/invoices.py`**

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class InvoiceItemCreate(BaseModel):
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    revenue_account_id: Optional[uuid.UUID] = None


class InvoiceItemUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    revenue_account_id: Optional[uuid.UUID] = None


class InvoiceItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    revenue_account_id: Optional[uuid.UUID]
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal


class InvoiceCreate(BaseModel):
    client_id: uuid.UUID
    job_id: Optional[uuid.UUID] = None
    status: str = "draft"
    discount: Decimal = Decimal("0")
    tax: Decimal = Decimal("0")
    deposit_amount: Decimal = Decimal("0")
    due_date: Optional[date] = None


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None
    due_date: Optional[date] = None


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: Optional[uuid.UUID]
    client_id: uuid.UUID
    status: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    deposit_amount: Decimal
    balance_due: Decimal
    requires_review: bool
    due_date: Optional[date]
    sent_at: Optional[datetime]
    paid_at: Optional[datetime]
    created_at: datetime
    items: list[InvoiceItemOut] = []
```

- [ ] **Step 4: Create `backend/schemas/notifications.py`**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    title: str
    body: str
    read: bool
    sent_email: bool
    created_at: datetime
```

- [ ] **Step 5: Run all schema tests**

```bash
pytest tests/test_admin_schemas.py -v
```
Expected: all PASS (13+ tests).

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/invoices.py backend/schemas/notifications.py \
        backend/tests/test_admin_schemas.py
git commit -m "feat: add Invoice and Notification Pydantic schemas"
```

---

## Chunk 3: Final Verification

### Task 9: Full import check

**Files:** (no changes)

- [ ] **Step 1: Verify all models + schemas import cleanly together**

```bash
cd backend
python -c "
import backend.models
import backend.schemas.clients
import backend.schemas.settings
import backend.schemas.appointments
import backend.schemas.jobs
import backend.schemas.invoices
import backend.schemas.notifications
print('All models and schemas imported OK')
"
```
Expected: `All models and schemas imported OK`

- [ ] **Step 2: Run full test suite**

```bash
pytest tests/ -v
```
Expected: all PASS — no import errors, no regressions from Plans 1 and 2.

- [ ] **Step 3: Confirm all individual task commits are clean**

All files were committed incrementally in Tasks 1–8. If any unstaged changes remain, review them and commit per the specific task they belong to. There is nothing new to commit in this task — it is verification only.
