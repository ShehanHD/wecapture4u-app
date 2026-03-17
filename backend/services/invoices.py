import uuid
import logging
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.invoice import Invoice, InvoiceItem

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
    Returns 0 until Plan 8 adds payment recording."""
    try:
        from sqlalchemy import text
        async with db.begin_nested():
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
        subtotal=Decimal("0.00"),
        discount=discount.quantize(Decimal("0.01")) if discount else Decimal("0.00"),
        tax=tax.quantize(Decimal("0.01")) if tax else Decimal("0.00"),
        total=Decimal("0.00"),
        deposit_amount=deposit_amount.quantize(Decimal("0.01")) if deposit_amount else Decimal("0.00"),
        balance_due=Decimal("0.00"),
        due_date=due_date,
    )
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice, ["items"])
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
