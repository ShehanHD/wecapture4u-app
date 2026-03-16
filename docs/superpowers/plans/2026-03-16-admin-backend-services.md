# weCapture4U — Admin Backend: Services, Routers & APScheduler

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all service-layer business logic, FastAPI routers, and APScheduler for the admin module. Covers clients (with atomic portal account creation), appointments, jobs (with stage email notifications), invoices (with subtotal/total/balance_due recalculation), notifications, settings (app settings, session types, job stages), and the daily APScheduler notification job.

**Architecture:** Each domain has a service module (`backend/services/`) that contains async functions taking an `AsyncSession`. Routers call services and never contain business logic. Invoice totals are recalculated and persisted in Python on every item mutation. APScheduler is initialized in `backend/scheduler.py` and started/stopped via FastAPI lifespan. Accounting integration (journal entries, payment recording) is deferred to Plan 8 — Plan 4 stores deposit and revenue FK columns but does not create journal entries.

**Depends on:** Plan 1 (Foundation), Plan 2 (Auth — `get_current_user` dependency, auth router, profile router, `send_email` helper), Plan 3 (Admin Backend Models & Schemas — all SQLAlchemy models and Pydantic schemas).

**Tech Stack:** SQLAlchemy 2 async, FastAPI, APScheduler 3, Resend, Pillow (avatar upload already in Plan 2 profile router), pytest + httpx.

---

## File Structure

```
backend/
  services/
    clients.py          # CRUD + portal account creation + total_spent + deactivation
    appointments.py     # CRUD
    jobs.py             # CRUD + stage change email + delivery_url email
    invoices.py         # CRUD + subtotal/total/balance_due recalculation
    notifications.py    # create_notification() + send_notification_email()
    settings.py         # app_settings CRUD + session_types CRUD + job_stages CRUD
  routers/
    clients.py          # /api/clients endpoints
    appointments.py     # /api/appointments + /api/booking-requests endpoints
    jobs.py             # /api/jobs + /api/job-stages endpoints
    invoices.py         # /api/invoices endpoints
    notifications.py    # /api/notifications endpoints
    settings.py         # /api/settings + /api/session-types endpoints
  scheduler.py          # APScheduler setup + daily notification job
  main.py               # Updated: register all new routers + APScheduler lifespan
  tests/
    test_services_clients.py
    test_services_invoices.py
    test_services_jobs.py
    test_routers_clients.py
    test_routers_appointments.py
    test_routers_jobs.py
    test_routers_invoices.py
    test_routers_notifications.py
    test_routers_settings.py
    test_scheduler.py
```

---

## Chunk 1: Services

### Task 1: Notification service

The notification service is a shared dependency used by multiple other services (jobs, appointments, scheduler). Build it first.

**Files:**
- Create: `backend/services/notifications.py`
- Create: `backend/tests/test_services_notifications.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_services_notifications.py
import pytest
import uuid
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from backend.services.notifications import create_notification


@pytest.mark.asyncio
async def test_create_notification_inserts_row():
    db = AsyncMock(spec=AsyncSession)
    user_id = uuid.uuid4()

    notification = await create_notification(
        db=db,
        user_id=user_id,
        type_="appointment_reminder",
        title="Reminder",
        body="Your appointment is tomorrow at 10:00",
        send_email=False,
    )

    db.add.assert_called_once()
    db.flush.assert_called_once()
    assert notification.type == "appointment_reminder"
    assert notification.read is False
    assert notification.sent_email is False


@pytest.mark.asyncio
async def test_create_notification_calls_resend_when_send_email_true():
    db = AsyncMock(spec=AsyncSession)
    user_id = uuid.uuid4()

    with patch("backend.services.notifications.send_email") as mock_send:
        mock_send.return_value = None
        await create_notification(
            db=db,
            user_id=user_id,
            type_="birthday",
            title="Happy Birthday!",
            body="Wishing your client a happy birthday.",
            send_email=True,
            recipient_email="client@example.com",
        )
        mock_send.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_services_notifications.py -v
```
Expected: `ImportError` — module doesn't exist yet.

- [ ] **Step 3: Create `backend/services/notifications.py`**

```python
import uuid
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.notification import Notification
from backend.services.email import send_email  # email helper from Plan 2 auth service

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type_: str,
    title: str,
    body: str,
    send_email: bool = False,
    recipient_email: Optional[str] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        body=body,
        read=False,
        sent_email=False,
    )
    db.add(notification)
    await db.flush()

    if send_email and recipient_email:
        try:
            await send_email(to=recipient_email, subject=title, html=f"<p>{body}</p>")
            notification.sent_email = True
        except Exception:
            # Email failures do not crash the app — log and continue
            logger.exception("Failed to send notification email to %s", recipient_email)

    return notification
```

> **Note:** `send_email` is the shared helper in `backend/services/email.py` created in Plan 2 (Auth) for password reset emails. It wraps the Resend API call.

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_services_notifications.py -v
```
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/notifications.py backend/tests/test_services_notifications.py
git commit -m "feat: add notification service"
```

---

### Task 2: Settings service (app_settings + session_types + job_stages)

**Files:**
- Create: `backend/services/settings.py`
- Create: `backend/tests/test_services_settings.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_services_settings.py
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from backend.services.settings import (
    get_app_settings,
    validate_stage_position_set,
)


@pytest.mark.asyncio
async def test_validate_stage_position_set_raises_on_mismatch():
    from fastapi import HTTPException
    existing_ids = {uuid.uuid4(), uuid.uuid4()}
    incoming_ids = {uuid.uuid4()}  # different set
    with pytest.raises(HTTPException) as exc:
        validate_stage_position_set(existing_ids, incoming_ids)
    assert exc.value.status_code == 422
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_services_settings.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/services/settings.py`**

```python
import uuid
import logging
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.settings import AppSettings
from backend.models.session_type import SessionType
from backend.models.job import JobStage, Job

logger = logging.getLogger(__name__)


async def get_app_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    settings = result.scalar_one_or_none()
    if settings is None:
        # Seed the single row if it doesn't exist (first run after migration)
        settings = AppSettings(id=1, tax_enabled=False, tax_rate=0, pdf_invoices_enabled=False)
        db.add(settings)
        await db.flush()
    return settings


async def update_app_settings(
    db: AsyncSession,
    *,
    tax_enabled: Optional[bool] = None,
    tax_rate=None,
    pdf_invoices_enabled: Optional[bool] = None,
) -> AppSettings:
    settings = await get_app_settings(db)
    if tax_enabled is not None:
        settings.tax_enabled = tax_enabled
    if tax_rate is not None:
        settings.tax_rate = tax_rate
    if pdf_invoices_enabled is not None:
        settings.pdf_invoices_enabled = pdf_invoices_enabled
    await db.flush()
    return settings


# --- Session Types ---

async def list_session_types(db: AsyncSession) -> list[SessionType]:
    result = await db.execute(select(SessionType).order_by(SessionType.name))
    return list(result.scalars().all())


async def create_session_type(db: AsyncSession, *, name: str) -> SessionType:
    st = SessionType(name=name)
    db.add(st)
    await db.flush()
    return st


async def update_session_type(db: AsyncSession, *, id: uuid.UUID, name: str) -> SessionType:
    result = await db.execute(select(SessionType).where(SessionType.id == id))
    st = result.scalar_one_or_none()
    if st is None:
        raise HTTPException(status_code=404, detail="Session type not found")
    st.name = name
    await db.flush()
    return st


async def delete_session_type(db: AsyncSession, *, id: uuid.UUID) -> None:
    from backend.models.appointment import Appointment
    result = await db.execute(select(SessionType).where(SessionType.id == id))
    st = result.scalar_one_or_none()
    if st is None:
        raise HTTPException(status_code=404, detail="Session type not found")
    # Block if referenced by any appointment
    appt_count = await db.scalar(
        select(func.count()).select_from(Appointment).where(Appointment.session_type_id == id)
    )
    if appt_count and appt_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {appt_count} appointment(s) reference this session type. Reassign them first.",
        )
    await db.delete(st)
    await db.flush()


# --- Job Stages ---

async def list_job_stages(db: AsyncSession) -> list[JobStage]:
    result = await db.execute(select(JobStage).order_by(JobStage.position))
    return list(result.scalars().all())


async def create_job_stage(
    db: AsyncSession, *, name: str, color: str, is_terminal: bool = False
) -> JobStage:
    # Position = max existing position + 1
    max_pos = await db.scalar(select(func.max(JobStage.position)))
    position = (max_pos or 0) + 1
    stage = JobStage(name=name, color=color, position=position, is_terminal=is_terminal)
    db.add(stage)
    await db.flush()
    return stage


async def update_job_stage(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: Optional[str] = None,
    color: Optional[str] = None,
    is_terminal: Optional[bool] = None,
) -> JobStage:
    result = await db.execute(select(JobStage).where(JobStage.id == id))
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Job stage not found")
    if name is not None:
        stage.name = name
    if color is not None:
        stage.color = color
    if is_terminal is not None:
        stage.is_terminal = is_terminal
    await db.flush()
    return stage


def validate_stage_position_set(
    existing_ids: set[uuid.UUID], incoming_ids: set[uuid.UUID]
) -> None:
    """Ensure the reorder payload contains exactly the same IDs as exist in DB."""
    if existing_ids != incoming_ids:
        raise HTTPException(
            status_code=422,
            detail="Stage position payload must contain exactly the same stage IDs as currently exist.",
        )


async def reorder_job_stages(
    db: AsyncSession, *, stages: list[dict]
) -> list[JobStage]:
    existing = await list_job_stages(db)
    existing_ids = {s.id for s in existing}
    incoming_ids = {uuid.UUID(str(s["id"])) for s in stages}
    validate_stage_position_set(existing_ids, incoming_ids)

    stage_map = {s.id: s for s in existing}
    for item in stages:
        stage_map[uuid.UUID(str(item["id"]))].position = item["position"]
    await db.flush()
    return sorted(existing, key=lambda s: s.position)


async def delete_job_stage(db: AsyncSession, *, id: uuid.UUID) -> None:
    result = await db.execute(select(JobStage).where(JobStage.id == id))
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Job stage not found")
    job_count = await db.scalar(
        select(func.count()).select_from(Job).where(Job.stage_id == id)
    )
    if job_count and job_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"{job_count} job(s) are in this stage. Reassign them first.",
        )
    await db.delete(stage)
    await db.flush()
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_services_settings.py -v
```
Expected: 1 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/settings.py backend/tests/test_services_settings.py
git commit -m "feat: add settings service (app_settings, session_types, job_stages)"
```

---

### Task 3: Invoice service (subtotal/total/balance_due recalculation)

This is the most critical service. Invoice totals are always recalculated from items in Python — never trusted from the client.

**Files:**
- Create: `backend/services/invoices.py`
- Create: `backend/tests/test_services_invoices.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_services_invoices.py
import pytest
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from backend.services.invoices import compute_item_amount, compute_invoice_totals


def test_compute_item_amount():
    assert compute_item_amount(Decimal("3"), Decimal("150")) == Decimal("450")


def test_compute_item_amount_fractional():
    assert compute_item_amount(Decimal("1.5"), Decimal("200")) == Decimal("300.00")


def test_compute_invoice_totals_no_discount_no_tax():
    items = [
        MagicMock(amount=Decimal("500")),
        MagicMock(amount=Decimal("200")),
    ]
    subtotal, total, balance_due = compute_invoice_totals(
        items=items, discount=Decimal("0"), tax=Decimal("0"), payments_sum=Decimal("0")
    )
    assert subtotal == Decimal("700")
    assert total == Decimal("700")
    assert balance_due == Decimal("700")


def test_compute_invoice_totals_with_discount_and_tax():
    items = [MagicMock(amount=Decimal("1000"))]
    subtotal, total, balance_due = compute_invoice_totals(
        items=items, discount=Decimal("100"), tax=Decimal("50"), payments_sum=Decimal("200")
    )
    assert subtotal == Decimal("1000")
    assert total == Decimal("950")   # 1000 - 100 + 50
    assert balance_due == Decimal("750")  # 950 - 200


def test_compute_invoice_totals_fully_paid():
    items = [MagicMock(amount=Decimal("500"))]
    _, total, balance_due = compute_invoice_totals(
        items=items, discount=Decimal("0"), tax=Decimal("0"), payments_sum=Decimal("500")
    )
    assert balance_due == Decimal("0")
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_services_invoices.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/services/invoices.py`**

```python
import uuid
import logging
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.invoice import Invoice, InvoiceItem

logger = logging.getLogger(__name__)


def compute_item_amount(quantity: Decimal, unit_price: Decimal) -> Decimal:
    return (quantity * unit_price).quantize(Decimal("0.01"))


def compute_invoice_totals(
    items: list,
    discount: Decimal,
    tax: Decimal,
    payments_sum: Decimal,
) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum((item.amount for item in items), Decimal("0"))
    total = (subtotal - discount + tax).quantize(Decimal("0.01"))
    balance_due = max(Decimal("0"), (total - payments_sum).quantize(Decimal("0.01")))
    return subtotal.quantize(Decimal("0.01")), total, balance_due


async def _payments_sum(db: AsyncSession, invoice_id: uuid.UUID) -> Decimal:
    """Sum all non-voided invoice_payments for this invoice.
    invoice_payments table is created by 003_accounting.sql.
    Returns 0 until Plan 8 adds payment recording."""
    try:
        from sqlalchemy import text
        result = await db.execute(
            text(
                "SELECT COALESCE(SUM(amount), 0) FROM invoice_payments "
                "WHERE invoice_id = :id AND voided_at IS NULL"
            ),
            {"id": str(invoice_id)},
        )
        return Decimal(str(result.scalar()))
    except Exception:
        return Decimal("0")


async def _recalculate_and_persist(db: AsyncSession, invoice: Invoice) -> None:
    """Recompute subtotal, total, balance_due from items and persist."""
    await db.refresh(invoice, ["items"])
    payments_sum = await _payments_sum(db, invoice.id)
    subtotal, total, balance_due = compute_invoice_totals(
        items=invoice.items,
        discount=invoice.discount,
        tax=invoice.tax,
        payments_sum=payments_sum,
    )
    invoice.subtotal = subtotal
    invoice.total = total
    invoice.balance_due = balance_due
    await db.flush()


# --- Invoice CRUD ---

async def list_invoices(
    db: AsyncSession,
    *,
    status: Optional[str] = None,
    client_id: Optional[uuid.UUID] = None,
    job_id: Optional[uuid.UUID] = None,
) -> list[Invoice]:
    q = select(Invoice)
    if status:
        q = q.where(Invoice.status == status)
    if client_id:
        q = q.where(Invoice.client_id == client_id)
    if job_id:
        q = q.where(Invoice.job_id == job_id)
    result = await db.execute(q.order_by(Invoice.created_at.desc()))
    return list(result.scalars().all())


async def get_invoice(db: AsyncSession, *, id: uuid.UUID) -> Invoice:
    result = await db.execute(select(Invoice).where(Invoice.id == id))
    invoice = result.scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.refresh(invoice, ["items"])
    return invoice


async def create_invoice(
    db: AsyncSession,
    *,
    client_id: uuid.UUID,
    job_id: Optional[uuid.UUID] = None,
    status: str = "draft",
    discount: Decimal = Decimal("0"),
    tax: Decimal = Decimal("0"),
    deposit_amount: Decimal = Decimal("0"),
    due_date=None,
) -> Invoice:
    invoice = Invoice(
        client_id=client_id,
        job_id=job_id,
        status=status,
        subtotal=Decimal("0"),
        discount=discount,
        tax=tax,
        total=Decimal("0"),
        deposit_amount=deposit_amount,
        balance_due=Decimal("0"),
        due_date=due_date,
    )
    db.add(invoice)
    await db.flush()
    return invoice


async def update_invoice(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    status: Optional[str] = None,
    discount: Optional[Decimal] = None,
    tax: Optional[Decimal] = None,
    deposit_amount: Optional[Decimal] = None,
    due_date=None,
) -> Invoice:
    invoice = await get_invoice(db, id=id)
    if status is not None:
        invoice.status = status
    if discount is not None:
        invoice.discount = discount
    if tax is not None:
        invoice.tax = tax
    if deposit_amount is not None:
        invoice.deposit_amount = deposit_amount
    if due_date is not None:
        invoice.due_date = due_date
    await _recalculate_and_persist(db, invoice)
    return invoice


async def delete_invoice(db: AsyncSession, *, id: uuid.UUID) -> None:
    invoice = await get_invoice(db, id=id)
    if invoice.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft invoices can be deleted.",
        )
    await db.delete(invoice)
    await db.flush()


# --- Invoice Items ---

async def add_invoice_item(
    db: AsyncSession,
    *,
    invoice_id: uuid.UUID,
    description: str,
    quantity: Decimal,
    unit_price: Decimal,
    revenue_account_id: Optional[uuid.UUID] = None,
) -> InvoiceItem:
    invoice = await get_invoice(db, id=invoice_id)
    amount = compute_item_amount(quantity, unit_price)
    item = InvoiceItem(
        invoice_id=invoice_id,
        description=description,
        quantity=quantity,
        unit_price=unit_price,
        amount=amount,
        revenue_account_id=revenue_account_id,
    )
    db.add(item)
    await db.flush()
    await _recalculate_and_persist(db, invoice)
    return item


async def update_invoice_item(
    db: AsyncSession,
    *,
    invoice_id: uuid.UUID,
    item_id: uuid.UUID,
    description: Optional[str] = None,
    quantity: Optional[Decimal] = None,
    unit_price: Optional[Decimal] = None,
    revenue_account_id: Optional[uuid.UUID] = None,
) -> InvoiceItem:
    result = await db.execute(
        select(InvoiceItem).where(
            InvoiceItem.id == item_id, InvoiceItem.invoice_id == invoice_id
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Invoice item not found")
    if description is not None:
        item.description = description
    if quantity is not None:
        item.quantity = quantity
    if unit_price is not None:
        item.unit_price = unit_price
    if revenue_account_id is not None:
        item.revenue_account_id = revenue_account_id
    item.amount = compute_item_amount(item.quantity, item.unit_price)
    await db.flush()
    invoice = await get_invoice(db, id=invoice_id)
    await _recalculate_and_persist(db, invoice)
    return item


async def delete_invoice_item(
    db: AsyncSession, *, invoice_id: uuid.UUID, item_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(InvoiceItem).where(
            InvoiceItem.id == item_id, InvoiceItem.invoice_id == invoice_id
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Invoice item not found")
    await db.delete(item)
    await db.flush()
    invoice = await get_invoice(db, id=invoice_id)
    await _recalculate_and_persist(db, invoice)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_services_invoices.py -v
```
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/invoices.py backend/tests/test_services_invoices.py
git commit -m "feat: add invoice service with subtotal/total/balance_due recalculation"
```

---

### Task 4: Client service

**Files:**
- Create: `backend/services/clients.py`
- Create: `backend/tests/test_services_clients.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_services_clients.py
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from backend.services.clients import validate_portal_access_request


def test_validate_portal_access_requires_password_when_portal_true():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        validate_portal_access_request(portal_access=True, temp_password=None)
    assert exc.value.status_code == 422


def test_validate_portal_access_ok_when_password_provided():
    # Should not raise
    validate_portal_access_request(portal_access=True, temp_password="TempPass123!")


def test_validate_portal_access_ok_when_portal_false():
    # No password needed when portal_access=False
    validate_portal_access_request(portal_access=False, temp_password=None)
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_services_clients.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/services/clients.py`**

```python
import uuid
import logging
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.client import Client
from backend.models.user import User
from backend.models.auth import RefreshToken
from backend.services.auth import hash_password  # from Plan 2
from backend.services.email import send_email    # from Plan 2

logger = logging.getLogger(__name__)


def validate_portal_access_request(portal_access: bool, temp_password: Optional[str]) -> None:
    if portal_access and not temp_password:
        raise HTTPException(
            status_code=422,
            detail="temp_password is required when portal_access is true",
        )


async def list_clients(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    tag: Optional[str] = None,
) -> list[Client]:
    q = select(Client)
    if search:
        q = q.where(
            (Client.name.ilike(f"%{search}%")) | (Client.email.ilike(f"%{search}%"))
        )
    if tag:
        q = q.where(Client.tags.contains([tag]))
    result = await db.execute(q.order_by(Client.name))
    return list(result.scalars().all())


async def get_client(db: AsyncSession, *, id: uuid.UUID) -> Client:
    result = await db.execute(select(Client).where(Client.id == id))
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


async def get_client_total_spent(db: AsyncSession, *, client_id: uuid.UUID) -> Decimal:
    """Sum of all posted journal line credits on revenue accounts for this client.
    Returns 0 until Plan 8 (Accounting) adds journal line querying."""
    try:
        result = await db.execute(
            text(
                """
                SELECT COALESCE(SUM(jl.amount), 0)
                FROM journal_lines jl
                JOIN journal_entries je ON jl.entry_id = je.id
                JOIN invoices i ON je.invoice_id = i.id
                JOIN accounts a ON jl.account_id = a.id
                WHERE i.client_id = :client_id
                  AND je.status = 'posted'
                  AND a.type = 'revenue'
                  AND jl.credit > 0
                """
            ),
            {"client_id": str(client_id)},
        )
        return Decimal(str(result.scalar()))
    except Exception:
        return Decimal("0")


async def create_client(
    db: AsyncSession,
    *,
    name: str,
    email: str,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    tags: list[str] = None,
    birthday=None,
    notes: Optional[str] = None,
    portal_access: bool = False,
    temp_password: Optional[str] = None,
) -> Client:
    validate_portal_access_request(portal_access, temp_password)
    tags = tags or []

    if portal_access and temp_password:
        # Atomic: create user row + client row in the same transaction
        user = User(
            email=email,
            hashed_password=hash_password(temp_password),
            role="client",
            full_name=name,
            is_active=True,
        )
        db.add(user)
        await db.flush()  # get user.id

        client = Client(
            user_id=user.id,
            name=name,
            email=email,
            phone=phone,
            address=address,
            tags=tags,
            birthday=birthday,
            notes=notes,
        )
        db.add(client)
        await db.flush()

        try:
            await send_email(
                to=email,
                subject="Your weCapture4U portal account is ready",
                html=(
                    f"<p>Hi {name},</p>"
                    f"<p>Your client portal account has been created.</p>"
                    f"<p>Email: <strong>{email}</strong><br>"
                    f"Temporary password: <strong>{temp_password}</strong></p>"
                    f"<p>Please change your password after logging in.</p>"
                ),
            )
        except Exception:
            logger.exception("Failed to send portal credentials email to %s", email)
    else:
        client = Client(
            name=name,
            email=email,
            phone=phone,
            address=address,
            tags=tags,
            birthday=birthday,
            notes=notes,
        )
        db.add(client)
        await db.flush()

    return client


async def update_client(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    tags: Optional[list[str]] = None,
    birthday=None,
    notes: Optional[str] = None,
) -> Client:
    client = await get_client(db, id=id)
    if name is not None:
        client.name = name
    if email is not None:
        client.email = email
    if phone is not None:
        client.phone = phone
    if address is not None:
        client.address = address
    if tags is not None:
        client.tags = tags
    if birthday is not None:
        client.birthday = birthday
    if notes is not None:
        client.notes = notes
    await db.flush()
    return client


async def delete_client(db: AsyncSession, *, id: uuid.UUID) -> None:
    from backend.models.job import Job
    from backend.models.invoice import Invoice

    client = await get_client(db, id=id)

    job_count = await db.scalar(
        select(func.count()).select_from(Job).where(Job.client_id == id)
    )
    if job_count and job_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: client has {job_count} job(s).",
        )
    invoice_count = await db.scalar(
        select(func.count()).select_from(Invoice).where(Invoice.client_id == id)
    )
    if invoice_count and invoice_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: client has {invoice_count} invoice(s).",
        )
    await db.delete(client)
    await db.flush()


async def create_portal_access(
    db: AsyncSession, *, client_id: uuid.UUID, temp_password: str
) -> Client:
    client = await get_client(db, id=client_id)
    if client.user_id is not None:
        raise HTTPException(status_code=409, detail="Client already has a portal account.")

    user = User(
        email=client.email,
        hashed_password=hash_password(temp_password),
        role="client",
        full_name=client.name,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    client.user_id = user.id
    await db.flush()

    try:
        await send_email(
            to=client.email,
            subject="Your weCapture4U portal account is ready",
            html=(
                f"<p>Hi {client.name},</p>"
                f"<p>Your portal account: <strong>{client.email}</strong> / "
                f"<strong>{temp_password}</strong></p>"
            ),
        )
    except Exception:
        logger.exception("Failed to send portal credentials email to %s", client.email)

    return client


async def toggle_portal_access(
    db: AsyncSession, *, client_id: uuid.UUID, is_active: bool
) -> Client:
    client = await get_client(db, id=client_id)
    if client.user_id is None:
        raise HTTPException(status_code=404, detail="Client has no portal account.")

    result = await db.execute(select(User).where(User.id == client.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Portal user record not found.")

    user.is_active = is_active

    if not is_active:
        # Revoke all active refresh tokens immediately
        from datetime import datetime, timezone
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        for token in result.scalars().all():
            token.revoked_at = datetime.now(timezone.utc)

    await db.flush()
    return client
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_services_clients.py -v
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/clients.py backend/tests/test_services_clients.py
git commit -m "feat: add client service with portal account creation and deactivation"
```

---

### Task 5: Appointment + Job services

**Files:**
- Create: `backend/services/appointments.py`
- Create: `backend/services/jobs.py`
- Create: `backend/tests/test_services_jobs.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_services_jobs.py
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from backend.services.jobs import should_send_stage_email, should_send_delivery_email


def test_stage_email_sent_when_stage_changes():
    assert should_send_stage_email(
        old_stage_id=uuid.uuid4(), new_stage_id=uuid.uuid4(), has_portal=True
    ) is True


def test_stage_email_not_sent_when_stage_unchanged():
    same = uuid.uuid4()
    assert should_send_stage_email(
        old_stage_id=same, new_stage_id=same, has_portal=True
    ) is False


def test_stage_email_not_sent_when_no_portal():
    assert should_send_stage_email(
        old_stage_id=uuid.uuid4(), new_stage_id=uuid.uuid4(), has_portal=False
    ) is False


def test_delivery_email_sent_when_url_goes_from_none_to_value():
    assert should_send_delivery_email(old_url=None, new_url="https://example.com/gallery") is True


def test_delivery_email_not_sent_when_url_was_already_set():
    assert should_send_delivery_email(old_url="https://old.com", new_url="https://new.com") is False


def test_delivery_email_not_sent_when_url_cleared():
    assert should_send_delivery_email(old_url="https://old.com", new_url=None) is False
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_services_jobs.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/services/appointments.py`**

```python
import uuid
import logging
from decimal import Decimal
from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.appointment import Appointment

logger = logging.getLogger(__name__)


async def list_appointments(
    db: AsyncSession,
    *,
    status: Optional[str] = None,
    session_type_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> list[Appointment]:
    q = select(Appointment)
    if status:
        q = q.where(Appointment.status == status)
    if session_type_id:
        q = q.where(Appointment.session_type_id == session_type_id)
    if start_date:
        q = q.where(Appointment.starts_at >= start_date)
    if end_date:
        q = q.where(Appointment.starts_at <= end_date)
    result = await db.execute(q.order_by(Appointment.starts_at))
    return list(result.scalars().all())


async def get_appointment(db: AsyncSession, *, id: uuid.UUID) -> Appointment:
    result = await db.execute(select(Appointment).where(Appointment.id == id))
    appt = result.scalar_one_or_none()
    if appt is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


async def create_appointment(db: AsyncSession, *, data: dict) -> Appointment:
    appt = Appointment(**data)
    db.add(appt)
    await db.flush()
    return appt


async def update_appointment(
    db: AsyncSession, *, id: uuid.UUID, data: dict
) -> Appointment:
    appt = await get_appointment(db, id=id)
    for key, value in data.items():
        if value is not None:
            setattr(appt, key, value)
    await db.flush()
    return appt


async def delete_appointment(db: AsyncSession, *, id: uuid.UUID) -> None:
    from backend.models.job import Job
    appt = await get_appointment(db, id=id)
    from sqlalchemy import func
    job_count = await db.scalar(
        select(func.count()).select_from(Job).where(Job.appointment_id == id)
    )
    if job_count and job_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: a job is linked to this appointment.",
        )
    await db.delete(appt)
    await db.flush()
```

- [ ] **Step 4: Create `backend/services/jobs.py`**

```python
import uuid
import logging
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.job import Job, JobStage
from backend.models.client import Client
from backend.models.user import User
from backend.services.email import send_email

logger = logging.getLogger(__name__)


def should_send_stage_email(
    old_stage_id: uuid.UUID, new_stage_id: uuid.UUID, has_portal: bool
) -> bool:
    return has_portal and old_stage_id != new_stage_id


def should_send_delivery_email(old_url: Optional[str], new_url: Optional[str]) -> bool:
    return old_url is None and new_url is not None


async def list_jobs(
    db: AsyncSession,
    *,
    stage_id: Optional[uuid.UUID] = None,
    client_id: Optional[uuid.UUID] = None,
) -> list[Job]:
    q = select(Job)
    if stage_id:
        q = q.where(Job.stage_id == stage_id)
    if client_id:
        q = q.where(Job.client_id == client_id)
    result = await db.execute(q.order_by(Job.created_at.desc()))
    return list(result.scalars().all())


async def get_job(db: AsyncSession, *, id: uuid.UUID) -> Job:
    result = await db.execute(select(Job).where(Job.id == id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def create_job(db: AsyncSession, *, data: dict) -> Job:
    job = Job(**data)
    db.add(job)
    await db.flush()
    return job


async def update_job(db: AsyncSession, *, id: uuid.UUID, data: dict) -> Job:
    job = await get_job(db, id=id)

    old_stage_id = job.stage_id
    old_delivery_url = job.delivery_url
    new_stage_id = data.get("stage_id", old_stage_id)
    new_delivery_url = data.get("delivery_url", old_delivery_url)

    for key, value in data.items():
        if value is not None:
            setattr(job, key, value)
    await db.flush()

    # Load client to check for portal account
    client_result = await db.execute(select(Client).where(Client.id == job.client_id))
    client = client_result.scalar_one_or_none()
    has_portal = client is not None and client.user_id is not None

    if has_portal and client:
        # Stage change email
        if should_send_stage_email(old_stage_id, new_stage_id, has_portal):
            stage_result = await db.execute(select(JobStage).where(JobStage.id == new_stage_id))
            new_stage = stage_result.scalar_one_or_none()
            stage_name = new_stage.name if new_stage else "a new stage"
            try:
                await send_email(
                    to=client.email,
                    subject=f"Your job '{job.title}' has been updated",
                    html=f"<p>Hi {client.name},</p><p>Your job <strong>{job.title}</strong> has moved to <strong>{stage_name}</strong>.</p>",
                )
            except Exception:
                logger.exception("Failed to send stage change email for job %s", id)

        # Photos ready email
        if should_send_delivery_email(old_delivery_url, new_delivery_url):
            try:
                await send_email(
                    to=client.email,
                    subject=f"Your photos are ready — {job.title}",
                    html=(
                        f"<p>Hi {client.name},</p>"
                        f"<p>Your photos from <strong>{job.title}</strong> are ready.</p>"
                        f'<p><a href="{new_delivery_url}">View your photos</a></p>'
                    ),
                )
            except Exception:
                logger.exception("Failed to send delivery email for job %s", id)

    return job


async def delete_job(db: AsyncSession, *, id: uuid.UUID) -> None:
    from backend.models.invoice import Invoice
    job = await get_job(db, id=id)
    invoice_count = await db.scalar(
        select(func.count()).select_from(Invoice).where(Invoice.job_id == id)
    )
    if invoice_count and invoice_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: an invoice is linked to this job.",
        )
    await db.delete(job)
    await db.flush()
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_services_jobs.py -v
```
Expected: 6 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/services/appointments.py backend/services/jobs.py \
        backend/tests/test_services_jobs.py
git commit -m "feat: add appointment and job services with email notifications"
```

---

### Task 6: APScheduler — daily notification job

**Files:**
- Create: `backend/scheduler.py`
- Create: `backend/tests/test_scheduler.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_scheduler.py
import pytest
from datetime import date, timedelta, timezone, datetime
from unittest.mock import AsyncMock, MagicMock, patch


def test_is_birthday_today_match():
    from backend.scheduler import is_birthday_today
    today = date.today()
    assert is_birthday_today(date(1990, today.month, today.day)) is True


def test_is_birthday_today_no_match():
    from backend.scheduler import is_birthday_today
    yesterday = date.today() - timedelta(days=1)
    assert is_birthday_today(date(1990, yesterday.month, yesterday.day)) is False


def test_is_invoice_overdue():
    from backend.scheduler import is_invoice_overdue
    yesterday = date.today() - timedelta(days=1)
    assert is_invoice_overdue(yesterday, "sent") is True


def test_invoice_not_overdue_if_paid():
    from backend.scheduler import is_invoice_overdue
    yesterday = date.today() - timedelta(days=1)
    assert is_invoice_overdue(yesterday, "paid") is False


def test_invoice_not_overdue_if_due_date_in_future():
    from backend.scheduler import is_invoice_overdue
    tomorrow = date.today() + timedelta(days=1)
    assert is_invoice_overdue(tomorrow, "sent") is False
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_scheduler.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Create `backend/scheduler.py`**

```python
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from sqlalchemy import select

from backend.database import AsyncSessionLocal
from backend.models.appointment import Appointment
from backend.models.client import Client
from backend.models.invoice import Invoice
from backend.models.user import User
from backend.services.notifications import create_notification

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def is_birthday_today(birthday: Optional[date]) -> bool:
    if birthday is None:
        return False
    today = date.today()
    return birthday.month == today.month and birthday.day == today.day


def is_invoice_overdue(due_date: Optional[date], status: str) -> bool:
    if due_date is None or status in ("paid", "draft"):
        return False
    return due_date < date.today()


async def run_daily_notifications() -> None:
    """Daily job: appointment reminders, birthday alerts, invoice overdue notices.
    Runs at 08:00 UTC via APScheduler. Missed runs are not recovered."""
    logger.info("Running daily notification job")
    now = datetime.now(timezone.utc)
    window_start = now
    window_end = now + timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        async with db.begin():
            # 1. Appointment reminders — appointments starting within the next 24h
            result = await db.execute(
                select(Appointment).where(
                    Appointment.starts_at >= window_start,
                    Appointment.starts_at <= window_end,
                    Appointment.status != "cancelled",
                )
            )
            appointments = result.scalars().all()
            for appt in appointments:
                client_result = await db.execute(
                    select(Client).where(Client.id == appt.client_id)
                )
                client = client_result.scalar_one_or_none()
                if client is None:
                    continue
                # Find admin user to attach the notification to
                admin_result = await db.execute(
                    select(User).where(User.role == "admin").limit(1)
                )
                admin = admin_result.scalar_one_or_none()
                if admin is None:
                    continue
                await create_notification(
                    db=db,
                    user_id=admin.id,
                    type_="appointment_reminder",
                    title=f"Appointment tomorrow: {appt.title}",
                    body=f"Appointment with {client.name} at {appt.starts_at.strftime('%H:%M UTC')}",
                    send_email=True,
                    recipient_email=admin.email,
                )

            # 2. Birthday alerts — clients with birthday today
            client_result = await db.execute(select(Client))
            all_clients = client_result.scalars().all()
            birthday_clients = [c for c in all_clients if is_birthday_today(c.birthday)]

            if birthday_clients:
                admin_result = await db.execute(
                    select(User).where(User.role == "admin").limit(1)
                )
                admin = admin_result.scalar_one_or_none()
                if admin:
                    for client in birthday_clients:
                        await create_notification(
                            db=db,
                            user_id=admin.id,
                            type_="birthday",
                            title=f"Birthday: {client.name}",
                            body=f"{client.name}'s birthday is today!",
                            send_email=False,
                        )

            # 3. Invoice overdue — invoices past due date
            invoice_result = await db.execute(
                select(Invoice).where(Invoice.status.in_(["sent", "partially_paid"]))
            )
            invoices = invoice_result.scalars().all()
            overdue = [i for i in invoices if is_invoice_overdue(i.due_date, i.status)]

            if overdue:
                admin_result = await db.execute(
                    select(User).where(User.role == "admin").limit(1)
                )
                admin = admin_result.scalar_one_or_none()
                if admin:
                    for invoice in overdue:
                        await create_notification(
                            db=db,
                            user_id=admin.id,
                            type_="invoice_overdue",
                            title=f"Invoice overdue",
                            body=f"Invoice #{str(invoice.id)[:8]} is past its due date.",
                            send_email=False,
                        )

    logger.info("Daily notification job complete")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        run_daily_notifications,
        trigger="cron",
        hour=8,
        minute=0,
        timezone="UTC",
        id="daily_notifications",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started")
    yield
    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped")
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_scheduler.py -v
```
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/scheduler.py backend/tests/test_scheduler.py
git commit -m "feat: add APScheduler with daily notification job"
```

---

## Chunk 2: Routers

### Task 7: Settings + Session Types router

**Files:**
- Create: `backend/routers/settings.py`
- Create: `backend/tests/test_routers_settings.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_routers_settings.py
import pytest
from httpx import AsyncClient
from backend.main import app
from backend.tests.conftest import auth_headers  # admin JWT headers helper from Plan 2


@pytest.mark.asyncio
async def test_get_settings_requires_auth(test_client):
    resp = await test_client.get("/api/settings")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_settings_ok(test_client, admin_auth_headers):
    resp = await test_client.get("/api/settings", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "tax_enabled" in data
    assert "pdf_invoices_enabled" in data


@pytest.mark.asyncio
async def test_patch_settings(test_client, admin_auth_headers):
    resp = await test_client.patch(
        "/api/settings",
        json={"tax_enabled": True, "tax_rate": "8.00"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["tax_enabled"] is True


@pytest.mark.asyncio
async def test_list_session_types_public(test_client):
    resp = await test_client.get("/api/session-types")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_session_type_requires_auth(test_client):
    resp = await test_client.post("/api/session-types", json={"name": "Wedding"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_session_type_blocked_when_in_use(test_client, admin_auth_headers, db_session):
    # Create session type + appointment referencing it, then try to delete
    from backend.models.session_type import SessionType
    st = SessionType(name="Portrait")
    db_session.add(st)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/session-types/{st.id}", headers=admin_auth_headers
    )
    # No appointments reference it yet — should succeed
    assert resp.status_code == 204
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_routers_settings.py -v
```
Expected: `ImportError` or 404 (router not registered).

- [ ] **Step 3: Create `backend/routers/settings.py`**

```python
import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.dependencies import get_current_admin  # from Plan 2
from backend.schemas.settings import (
    AppSettingsOut, AppSettingsUpdate,
    SessionTypeCreate, SessionTypeUpdate, SessionTypeOut,
)
from backend.services import settings as svc

router = APIRouter()

DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(get_current_admin)]


# --- App Settings ---

@router.get("/settings", response_model=AppSettingsOut)
async def get_settings(db: DB, _: Admin):
    return await svc.get_app_settings(db)


@router.patch("/settings", response_model=AppSettingsOut)
async def update_settings(body: AppSettingsUpdate, db: DB, _: Admin):
    async with db.begin():
        return await svc.update_app_settings(
            db,
            tax_enabled=body.tax_enabled,
            tax_rate=body.tax_rate,
            pdf_invoices_enabled=body.pdf_invoices_enabled,
        )


# --- Session Types ---

@router.get("/session-types", response_model=list[SessionTypeOut])
async def list_session_types(db: DB):
    # Public — no auth required (used by client booking form)
    return await svc.list_session_types(db)


@router.post("/session-types", response_model=SessionTypeOut, status_code=201)
async def create_session_type(body: SessionTypeCreate, db: DB, _: Admin):
    async with db.begin():
        return await svc.create_session_type(db, name=body.name)


@router.patch("/session-types/{id}", response_model=SessionTypeOut)
async def update_session_type(id: uuid.UUID, body: SessionTypeUpdate, db: DB, _: Admin):
    async with db.begin():
        return await svc.update_session_type(db, id=id, name=body.name)


@router.delete("/session-types/{id}", status_code=204)
async def delete_session_type(id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        await svc.delete_session_type(db, id=id)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_routers_settings.py -v
```
Expected: all PASS (router not yet registered — update main.py in Task 12).

- [ ] **Step 5: Commit**

```bash
git add backend/routers/settings.py backend/tests/test_routers_settings.py
git commit -m "feat: add settings and session-types router"
```

---

### Task 8: Clients router

**Files:**
- Create: `backend/routers/clients.py`
- Create: `backend/tests/test_routers_clients.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_routers_clients.py
import pytest
from uuid import uuid4


@pytest.mark.asyncio
async def test_list_clients_requires_auth(test_client):
    resp = await test_client.get("/api/clients")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_client_minimal(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/clients",
        json={"name": "Alice Smith", "email": "alice@example.com"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alice Smith"
    assert data["user_id"] is None


@pytest.mark.asyncio
async def test_create_client_duplicate_email_fails(test_client, admin_auth_headers):
    payload = {"name": "Bob", "email": "bob@example.com"}
    await test_client.post("/api/clients", json=payload, headers=admin_auth_headers)
    resp = await test_client.post("/api/clients", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_client_blocked_with_jobs(test_client, admin_auth_headers, db_session):
    from backend.models.client import Client
    from backend.models.job import Job, JobStage

    client = Client(name="Dave", email="dave@example.com", tags=[])
    db_session.add(client)
    stage = JobStage(name="Booked", color="#000", position=1)
    db_session.add(stage)
    await db_session.flush()

    job = Job(client_id=client.id, title="Wedding", stage_id=stage.id)
    db_session.add(job)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/clients/{client.id}", headers=admin_auth_headers
    )
    assert resp.status_code == 409
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_routers_clients.py -v
```
Expected: 401 for auth test, ImportError or 404 for others.

- [ ] **Step 3: Create `backend/routers/clients.py`**

```python
import uuid
import logging
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.dependencies import get_current_admin
from backend.schemas.clients import (
    ClientCreate, ClientUpdate, ClientOut, ClientWithStats,
    PortalAccessToggle, CreatePortalAccess,
)
from backend.services import clients as svc

logger = logging.getLogger(__name__)
router = APIRouter()

DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(get_current_admin)]


@router.get("/clients", response_model=list[ClientOut])
async def list_clients(
    db: DB, _: Admin,
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
):
    return await svc.list_clients(db, search=search, tag=tag)


@router.post("/clients", response_model=ClientOut, status_code=201)
async def create_client(body: ClientCreate, db: DB, _: Admin):
    try:
        async with db.begin():
            return await svc.create_client(
                db,
                name=body.name,
                email=body.email,
                phone=body.phone,
                address=body.address,
                tags=body.tags,
                birthday=body.birthday,
                notes=body.notes,
                portal_access=body.portal_access,
                temp_password=body.temp_password,
            )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="A client with this email already exists.")
        raise


@router.get("/clients/{id}", response_model=ClientWithStats)
async def get_client(id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        client = await svc.get_client(db, id=id)
        total_spent = await svc.get_client_total_spent(db, client_id=id)

        is_active = None
        if client.user_id is not None:
            from sqlalchemy import select
            from backend.models.user import User
            result = await db.execute(select(User.is_active).where(User.id == client.user_id))
            is_active = result.scalar_one_or_none()

        out = ClientWithStats.model_validate(client)
        out.total_spent = float(total_spent)
        out.is_active = is_active
        return out


@router.patch("/clients/{id}", response_model=ClientOut)
async def update_client(id: uuid.UUID, body: ClientUpdate, db: DB, _: Admin):
    async with db.begin():
        return await svc.update_client(
            db, id=id,
            name=body.name, email=body.email, phone=body.phone,
            address=body.address, tags=body.tags, birthday=body.birthday,
            notes=body.notes,
        )


@router.delete("/clients/{id}", status_code=204)
async def delete_client(id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        await svc.delete_client(db, id=id)


@router.post("/clients/{id}/portal-access", response_model=ClientOut, status_code=201)
async def create_portal_access(id: uuid.UUID, body: CreatePortalAccess, db: DB, _: Admin):
    async with db.begin():
        return await svc.create_portal_access(db, client_id=id, temp_password=body.temp_password)


@router.patch("/clients/{id}/portal-access", response_model=ClientOut)
async def toggle_portal_access(id: uuid.UUID, body: PortalAccessToggle, db: DB, _: Admin):
    async with db.begin():
        return await svc.toggle_portal_access(db, client_id=id, is_active=body.is_active)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_routers_clients.py -v
```
Expected: all PASS after main.py registers router.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/clients.py backend/tests/test_routers_clients.py
git commit -m "feat: add clients router"
```

---

### Task 9: Appointments + Jobs routers

**Files:**
- Create: `backend/routers/appointments.py`
- Create: `backend/routers/jobs.py`
- Create: `backend/tests/test_routers_appointments.py`
- Create: `backend/tests/test_routers_jobs.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_routers_appointments.py
import pytest
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_create_appointment(test_client, admin_auth_headers, db_session):
    from backend.models.client import Client
    client = Client(name="Eve", email="eve@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "Portrait session",
            "starts_at": "2026-07-01T10:00:00Z",
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Portrait session"
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_delete_appointment_blocked_with_job(test_client, admin_auth_headers, db_session):
    from backend.models.client import Client
    from backend.models.appointment import Appointment
    from backend.models.job import Job, JobStage

    client = Client(name="Frank", email="frank@example.com", tags=[])
    db_session.add(client)
    stage = JobStage(name="Booked", color="#000", position=1)
    db_session.add(stage)
    await db_session.flush()

    appt = Appointment(
        client_id=client.id, title="Wedding", starts_at=datetime(2026, 8, 1, tzinfo=timezone.utc)
    )
    db_session.add(appt)
    await db_session.flush()

    job = Job(client_id=client.id, appointment_id=appt.id, title="Wedding job", stage_id=stage.id)
    db_session.add(job)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/appointments/{appt.id}", headers=admin_auth_headers
    )
    assert resp.status_code == 409
```

```python
# backend/tests/test_routers_jobs.py
import pytest


@pytest.mark.asyncio
async def test_create_job(test_client, admin_auth_headers, db_session):
    from backend.models.client import Client
    from backend.models.job import JobStage

    client = Client(name="Grace", email="grace@example.com", tags=[])
    db_session.add(client)
    stage = JobStage(name="Booked", color="#f59e0b", position=1)
    db_session.add(stage)
    await db_session.flush()

    resp = await test_client.post(
        "/api/jobs",
        json={"client_id": str(client.id), "title": "Family photos", "stage_id": str(stage.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Family photos"


@pytest.mark.asyncio
async def test_reorder_stages_invalid_ids(test_client, admin_auth_headers):
    import uuid
    resp = await test_client.patch(
        "/api/job-stages/positions",
        json={"stages": [{"id": str(uuid.uuid4()), "position": 1}]},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_routers_appointments.py tests/test_routers_jobs.py -v
```
Expected: `ImportError` or 404.

- [ ] **Step 3: Create `backend/routers/appointments.py`**

```python
import uuid
from typing import Annotated, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.dependencies import get_current_admin
from backend.schemas.appointments import AppointmentCreate, AppointmentUpdate, AppointmentOut
from backend.services import appointments as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(get_current_admin)]


@router.get("/appointments", response_model=list[AppointmentOut])
async def list_appointments(
    db: DB, _: Admin,
    status: Optional[str] = Query(None),
    session_type_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
):
    return await svc.list_appointments(
        db, status=status, session_type_id=session_type_id,
        start_date=start_date, end_date=end_date
    )


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
async def create_appointment(body: AppointmentCreate, db: DB, _: Admin):
    async with db.begin():
        data = body.model_dump(exclude_unset=False)
        return await svc.create_appointment(db, data=data)


@router.get("/appointments/{id}", response_model=AppointmentOut)
async def get_appointment(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_appointment(db, id=id)


@router.patch("/appointments/{id}", response_model=AppointmentOut)
async def update_appointment(id: uuid.UUID, body: AppointmentUpdate, db: DB, _: Admin):
    async with db.begin():
        return await svc.update_appointment(db, id=id, data=body.model_dump(exclude_unset=True))


@router.delete("/appointments/{id}", status_code=204)
async def delete_appointment(id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        await svc.delete_appointment(db, id=id)
```

- [ ] **Step 4: Create `backend/routers/jobs.py`**

```python
import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.dependencies import get_current_admin
from backend.schemas.jobs import (
    JobCreate, JobUpdate, JobOut, JobDetailOut,
    JobStageCreate, JobStageUpdate, JobStageOut,
    StagePositionReorder,
)
from backend.services import jobs as job_svc
from backend.services import settings as settings_svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(get_current_admin)]


# --- Jobs ---

@router.get("/jobs", response_model=list[JobOut])
async def list_jobs(
    db: DB, _: Admin,
    stage_id: Optional[uuid.UUID] = Query(None),
    client_id: Optional[uuid.UUID] = Query(None),
):
    return await job_svc.list_jobs(db, stage_id=stage_id, client_id=client_id)


@router.post("/jobs", response_model=JobOut, status_code=201)
async def create_job(body: JobCreate, db: DB, _: Admin):
    async with db.begin():
        return await job_svc.create_job(db, data=body.model_dump(exclude_unset=False))


@router.get("/jobs/{id}", response_model=JobDetailOut)
async def get_job(id: uuid.UUID, db: DB, _: Admin):
    return await job_svc.get_job(db, id=id)


@router.patch("/jobs/{id}", response_model=JobOut)
async def update_job(id: uuid.UUID, body: JobUpdate, db: DB, _: Admin):
    async with db.begin():
        return await job_svc.update_job(db, id=id, data=body.model_dump(exclude_unset=True))


@router.delete("/jobs/{id}", status_code=204)
async def delete_job(id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        await job_svc.delete_job(db, id=id)


# --- Job Stages ---

@router.get("/job-stages", response_model=list[JobStageOut])
async def list_job_stages(db: DB, _: Admin):
    return await settings_svc.list_job_stages(db)


@router.post("/job-stages", response_model=JobStageOut, status_code=201)
async def create_job_stage(body: JobStageCreate, db: DB, _: Admin):
    async with db.begin():
        return await settings_svc.create_job_stage(
            db, name=body.name, color=body.color, is_terminal=body.is_terminal
        )


@router.patch("/job-stages/positions", response_model=list[JobStageOut])
async def reorder_job_stages(body: StagePositionReorder, db: DB, _: Admin):
    async with db.begin():
        stages = [{"id": str(s.id), "position": s.position} for s in body.stages]
        return await settings_svc.reorder_job_stages(db, stages=stages)


@router.patch("/job-stages/{id}", response_model=JobStageOut)
async def update_job_stage(id: uuid.UUID, body: JobStageUpdate, db: DB, _: Admin):
    async with db.begin():
        return await settings_svc.update_job_stage(
            db, id=id, name=body.name, color=body.color, is_terminal=body.is_terminal
        )


@router.delete("/job-stages/{id}", status_code=204)
async def delete_job_stage(id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        await settings_svc.delete_job_stage(db, id=id)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_routers_appointments.py tests/test_routers_jobs.py -v
```
Expected: all PASS after main.py registers routers.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/appointments.py backend/routers/jobs.py \
        backend/tests/test_routers_appointments.py backend/tests/test_routers_jobs.py
git commit -m "feat: add appointments and jobs routers"
```

---

### Task 10: Invoices router

**Files:**
- Create: `backend/routers/invoices.py`
- Create: `backend/tests/test_routers_invoices.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_routers_invoices.py
import pytest
from decimal import Decimal


@pytest.mark.asyncio
async def test_create_invoice(test_client, admin_auth_headers, db_session):
    from backend.models.client import Client
    client = Client(name="Henry", email="henry@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    resp = await test_client.post(
        "/api/invoices",
        json={"client_id": str(client.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert data["subtotal"] == "0.00"


@pytest.mark.asyncio
async def test_add_item_recalculates_totals(test_client, admin_auth_headers, db_session):
    from backend.models.client import Client
    client = Client(name="Iris", email="iris@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    inv_resp = await test_client.post(
        "/api/invoices",
        json={"client_id": str(client.id)},
        headers=admin_auth_headers,
    )
    inv_id = inv_resp.json()["id"]

    item_resp = await test_client.post(
        f"/api/invoices/{inv_id}/items",
        json={"description": "Session fee", "quantity": "1", "unit_price": "500.00"},
        headers=admin_auth_headers,
    )
    assert item_resp.status_code == 201

    inv_detail = await test_client.get(f"/api/invoices/{inv_id}", headers=admin_auth_headers)
    assert inv_detail.json()["subtotal"] == "500.00"
    assert inv_detail.json()["total"] == "500.00"


@pytest.mark.asyncio
async def test_delete_non_draft_invoice_blocked(test_client, admin_auth_headers, db_session):
    from backend.models.client import Client
    from backend.models.invoice import Invoice

    client = Client(name="Jack", email="jack@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    invoice = Invoice(client_id=client.id, status="sent")
    db_session.add(invoice)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/invoices/{invoice.id}", headers=admin_auth_headers
    )
    assert resp.status_code == 409
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_routers_invoices.py -v
```
Expected: 404 (router not registered).

- [ ] **Step 3: Create `backend/routers/invoices.py`**

```python
import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.dependencies import get_current_admin
from backend.schemas.invoices import (
    InvoiceCreate, InvoiceUpdate, InvoiceOut,
    InvoiceItemCreate, InvoiceItemUpdate, InvoiceItemOut,
)
from backend.services import invoices as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(get_current_admin)]


@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    db: DB, _: Admin,
    status: Optional[str] = Query(None),
    client_id: Optional[uuid.UUID] = Query(None),
    job_id: Optional[uuid.UUID] = Query(None),
):
    return await svc.list_invoices(db, status=status, client_id=client_id, job_id=job_id)


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
async def create_invoice(body: InvoiceCreate, db: DB, _: Admin):
    async with db.begin():
        return await svc.create_invoice(
            db,
            client_id=body.client_id,
            job_id=body.job_id,
            status=body.status,
            discount=body.discount,
            tax=body.tax,
            deposit_amount=body.deposit_amount,
            due_date=body.due_date,
        )


@router.get("/invoices/{id}", response_model=InvoiceOut)
async def get_invoice(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_invoice(db, id=id)


@router.patch("/invoices/{id}", response_model=InvoiceOut)
async def update_invoice(id: uuid.UUID, body: InvoiceUpdate, db: DB, _: Admin):
    async with db.begin():
        return await svc.update_invoice(
            db, id=id,
            status=body.status,
            discount=body.discount,
            tax=body.tax,
            deposit_amount=body.deposit_amount,
            due_date=body.due_date,
        )


@router.delete("/invoices/{id}", status_code=204)
async def delete_invoice(id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        await svc.delete_invoice(db, id=id)


@router.post("/invoices/{id}/items", response_model=InvoiceItemOut, status_code=201)
async def add_invoice_item(id: uuid.UUID, body: InvoiceItemCreate, db: DB, _: Admin):
    async with db.begin():
        return await svc.add_invoice_item(
            db,
            invoice_id=id,
            description=body.description,
            quantity=body.quantity,
            unit_price=body.unit_price,
            revenue_account_id=body.revenue_account_id,
        )


@router.patch("/invoices/{id}/items/{item_id}", response_model=InvoiceItemOut)
async def update_invoice_item(
    id: uuid.UUID, item_id: uuid.UUID, body: InvoiceItemUpdate, db: DB, _: Admin
):
    async with db.begin():
        return await svc.update_invoice_item(
            db, invoice_id=id, item_id=item_id,
            description=body.description,
            quantity=body.quantity,
            unit_price=body.unit_price,
            revenue_account_id=body.revenue_account_id,
        )


@router.delete("/invoices/{id}/items/{item_id}", status_code=204)
async def delete_invoice_item(id: uuid.UUID, item_id: uuid.UUID, db: DB, _: Admin):
    async with db.begin():
        await svc.delete_invoice_item(db, invoice_id=id, item_id=item_id)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_routers_invoices.py -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/invoices.py backend/tests/test_routers_invoices.py
git commit -m "feat: add invoices router"
```

---

### Task 11: Notifications router

**Files:**
- Create: `backend/routers/notifications.py`
- Create: `backend/tests/test_routers_notifications.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_routers_notifications.py
import pytest


@pytest.mark.asyncio
async def test_list_notifications_empty(test_client, admin_auth_headers):
    resp = await test_client.get("/api/notifications", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_notifications_limit(test_client, admin_auth_headers, db_session, admin_user):
    from backend.models.notification import Notification
    for i in range(10):
        db_session.add(Notification(
            user_id=admin_user.id, type="test", title=f"N{i}", body="body", read=False, sent_email=False
        ))
    await db_session.flush()

    resp = await test_client.get(
        "/api/notifications?limit=5", headers=admin_auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 5


@pytest.mark.asyncio
async def test_mark_notification_read(test_client, admin_auth_headers, db_session, admin_user):
    from backend.models.notification import Notification
    notif = Notification(
        user_id=admin_user.id, type="test", title="T", body="B", read=False, sent_email=False
    )
    db_session.add(notif)
    await db_session.flush()

    resp = await test_client.patch(
        f"/api/notifications/{notif.id}/read", headers=admin_auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["read"] is True
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_routers_notifications.py -v
```
Expected: 404.

- [ ] **Step 3: Create `backend/routers/notifications.py`**

```python
import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.dependencies import get_current_admin, get_current_user
from backend.models.notification import Notification
from backend.schemas.notifications import NotificationOut

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(get_current_admin)]


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    db: DB,
    current_user=Depends(get_current_user),
    unread: Optional[bool] = Query(None),
    type: Optional[str] = Query(None),
    limit: Optional[int] = Query(None),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread is True:
        q = q.where(Notification.read.is_(False))
    if type:
        q = q.where(Notification.type == type)
    q = q.order_by(Notification.created_at.desc())
    if limit:
        q = q.limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.patch("/notifications/{id}/read", response_model=NotificationOut)
async def mark_notification_read(
    id: uuid.UUID, db: DB, current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == id, Notification.user_id == current_user.id
        )
    )
    notif = result.scalar_one_or_none()
    if notif is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    async with db.begin():
        notif.read = True
    return notif


@router.post("/notifications/read-all", status_code=200)
async def mark_all_read(db: DB, current_user=Depends(get_current_user)):
    from sqlalchemy import update
    async with db.begin():
        await db.execute(
            update(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.read.is_(False),
            )
            .values(read=True)
        )
    return {"status": "ok"}
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_routers_notifications.py -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/notifications.py backend/tests/test_routers_notifications.py
git commit -m "feat: add notifications router"
```

---

### Task 12: Wire all routers into main.py + APScheduler lifespan

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Read current main.py**

```bash
cat backend/main.py
```

- [ ] **Step 2: Update `backend/main.py`** — add router registrations and APScheduler lifespan

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.scheduler import lifespan

# Routers
from backend.routers.health import router as health_router
from backend.routers.auth import router as auth_router          # Plan 2
from backend.routers.profile import router as profile_router    # Plan 2
from backend.routers.clients import router as clients_router
from backend.routers.appointments import router as appointments_router
from backend.routers.jobs import router as jobs_router
from backend.routers.invoices import router as invoices_router
from backend.routers.notifications import router as notifications_router
from backend.routers.settings import router as settings_router

app = FastAPI(title="weCapture4U API", lifespan=lifespan)

# CORS — origins loaded from env var; startup error if missing in production
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if settings.ENVIRONMENT == "production" and not allowed_origins:
    raise RuntimeError("ALLOWED_ORIGINS env var must be set in production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(profile_router, prefix="/api", tags=["profile"])
app.include_router(clients_router, prefix="/api", tags=["clients"])
app.include_router(appointments_router, prefix="/api", tags=["appointments"])
app.include_router(jobs_router, prefix="/api", tags=["jobs"])
app.include_router(invoices_router, prefix="/api", tags=["invoices"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(settings_router, prefix="/api", tags=["settings"])
```

- [ ] **Step 3: Run the full backend test suite**

```bash
pytest tests/ -v
```
Expected: all tests PASS. No regressions from Plans 1, 2, or 3.

- [ ] **Step 4: Verify the server starts**

```bash
uvicorn backend.main:app --reload --port 8000
```
Expected: server starts without errors. APScheduler logs "APScheduler started".

- [ ] **Step 5: Smoke test key endpoints**

```bash
curl http://localhost:8000/api/health
# → {"status": "ok"}

curl http://localhost:8000/api/session-types
# → []  (empty list — public endpoint, no auth needed)

curl http://localhost:8000/api/clients
# → {"detail": "Not authenticated"}  (401 without token)
```

- [ ] **Step 6: Commit**

```bash
git add backend/main.py
git commit -m "feat: register all admin routers and APScheduler lifespan in main.py"
```
