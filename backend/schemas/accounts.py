import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


AccountType = Literal["asset", "liability", "equity", "revenue", "expense"]


class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1)
    type: AccountType


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
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


class AccountLedgerLineOut(BaseModel):
    journal_entry_id: uuid.UUID
    date: date
    description: str
    line_description: Optional[str]
    reference_type: Optional[str]
    debit: Decimal
    credit: Decimal
    running_balance: Decimal


class AccountLedgerOut(BaseModel):
    account_id: uuid.UUID
    account_name: str
    normal_balance: str
    opening_balance: Decimal
    closing_balance: Decimal
    lines: list[AccountLedgerLineOut]
