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
