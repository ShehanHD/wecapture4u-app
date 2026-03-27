import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


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
    description: str = Field(min_length=1)
    lines: list[JournalLineCreate] = Field(min_length=1)


class JournalEntryUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = Field(None, min_length=1)
    lines: Optional[list[JournalLineCreate]] = Field(None, min_length=1)


class JournalEntryListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    description: str
    status: str
    created_by: str
    reference_type: Optional[str]
    void_of: Optional[uuid.UUID]
    created_at: datetime
    total_debit: Decimal
    total_credit: Decimal


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
