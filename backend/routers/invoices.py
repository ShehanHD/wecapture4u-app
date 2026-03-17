import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.invoices import (
    InvoiceCreate, InvoiceUpdate, InvoiceOut,
    InvoiceItemCreate, InvoiceItemUpdate, InvoiceItemOut,
    PaymentCreate, PaymentOut,
)
from services import invoices as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


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
    return await svc.create_invoice(
        db,
        client_id=body.client_id,
        job_id=body.job_id,
        status=body.status,
        discount=body.discount,
        tax=body.tax,
        due_date=body.due_date,
    )


@router.get("/invoices/{id}", response_model=InvoiceOut)
async def get_invoice(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_invoice(db, id=id)


@router.patch("/invoices/{id}", response_model=InvoiceOut)
async def update_invoice(id: uuid.UUID, body: InvoiceUpdate, db: DB, _: Admin):
    return await svc.update_invoice(
        db, id=id,
        status=body.status,
        discount=body.discount,
        tax=body.tax,
        due_date=body.due_date,
    )


@router.delete("/invoices/{id}", status_code=204)
async def delete_invoice(id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_invoice(db, id=id)


@router.post("/invoices/{id}/items", response_model=InvoiceItemOut, status_code=201)
async def add_invoice_item(id: uuid.UUID, body: InvoiceItemCreate, db: DB, _: Admin):
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
    return await svc.update_invoice_item(
        db, invoice_id=id, item_id=item_id,
        description=body.description,
        quantity=body.quantity,
        unit_price=body.unit_price,
        revenue_account_id=body.revenue_account_id,
    )


@router.delete("/invoices/{id}/items/{item_id}", status_code=204)
async def delete_invoice_item(id: uuid.UUID, item_id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_invoice_item(db, invoice_id=id, item_id=item_id)


@router.post("/invoices/{id}/payments", response_model=PaymentOut, status_code=201)
async def add_payment(id: uuid.UUID, body: PaymentCreate, db: DB, _: Admin):
    return await svc.add_payment(db, invoice_id=id, amount=body.amount, paid_at=body.paid_at, method=body.method, notes=body.notes)


@router.delete("/invoices/{id}/payments/{pid}", status_code=204)
async def delete_payment(id: uuid.UUID, pid: uuid.UUID, db: DB, _: Admin):
    await svc.delete_payment(db, invoice_id=id, payment_id=pid)


