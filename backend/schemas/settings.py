import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    available_days: list[int] = Field(default_factory=list)

    @field_validator("available_days")
    @classmethod
    def validate_day_range(cls, v: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("available_days values must be 0-6 (0=Monday, 6=Sunday)")
        return v


class SessionTypeUpdate(BaseModel):
    name: Optional[str] = None
    available_days: Optional[list[int]] = None

    @field_validator("available_days")
    @classmethod
    def validate_day_range(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        if v is not None and any(d < 0 or d > 6 for d in v):
            raise ValueError("available_days values must be 0-6 (0=Monday, 6=Sunday)")
        return v


class SessionTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    available_days: list[int]
    created_at: datetime
