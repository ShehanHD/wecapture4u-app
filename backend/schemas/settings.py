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
