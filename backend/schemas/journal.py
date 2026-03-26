import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


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
    description: str
    lines: list[JournalLineCreate]


class JournalEntryUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    lines: Optional[list[JournalLineCreate]] = None


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
