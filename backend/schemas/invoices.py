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
    due_date: Optional[date] = None


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    due_date: Optional[date] = None


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
    balance_due: Decimal
    requires_review: bool
    due_date: Optional[date]
    sent_at: Optional[datetime]
    paid_at: Optional[datetime]
    created_at: datetime
    items: list[InvoiceItemOut] = []
    payments: list[PaymentOut] = []
