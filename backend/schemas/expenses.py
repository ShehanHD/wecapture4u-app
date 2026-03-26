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
    payment_status: Optional[str] = None  # paid | payable
    payment_account_id: Optional[uuid.UUID] = None
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
