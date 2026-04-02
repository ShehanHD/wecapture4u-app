import re
import uuid
from datetime import datetime, date as date_type
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, field_validator

VALID_STATUSES = {"pending", "confirmed", "cancelled"}
VALID_ADDONS = {"album", "thank_you_card", "enlarged_photos"}


class SessionSlot(BaseModel):
    session_type_id: uuid.UUID
    date: date_type
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]
    time: Optional[str] = None

    @field_validator("time")
    @classmethod
    def time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError("time must be HH:MM (00:00–23:59)")
        return v


class AppointmentCreate(BaseModel):
    client_id: uuid.UUID
    title: str
    session_slots: list[SessionSlot] = []
    location: Optional[str] = None
    status: str = "pending"
    addons: list[str] = []
    deposit_paid: bool = False
    deposit_amount: Decimal = Decimal("0")
    deposit_account_id: Optional[uuid.UUID] = None
    contract_signed: bool = False
    price: Decimal = Decimal("0")
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v

    @field_validator("session_slots")
    @classmethod
    def session_slots_not_empty(cls, v: list) -> list:
        if len(v) == 0:
            raise ValueError("At least one session slot is required")
        return v

    @field_validator("addons")
    @classmethod
    def addons_must_be_valid(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_ADDONS
        if invalid:
            raise ValueError(f"invalid addons: {invalid}. Must be subset of {VALID_ADDONS}")
        return v


class AppointmentUpdate(BaseModel):
    session_slots: Optional[list[SessionSlot]] = None
    title: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    addons: Optional[list[str]] = None
    deposit_paid: Optional[bool] = None
    deposit_amount: Optional[Decimal] = None
    deposit_account_id: Optional[uuid.UUID] = None
    contract_signed: Optional[bool] = None
    price: Optional[Decimal] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class SessionTypeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    session_slots: list[SessionSlot]
    session_type_ids: list[uuid.UUID]       # derived from slots, kept for calendar compat
    session_time: Optional[str]             # kept nullable for legacy rows
    session_types: list[SessionTypeSummary] = []  # resolved by service
    title: str
    starts_at: datetime
    ends_at: Optional[datetime]
    location: Optional[str]
    status: str
    addons: list[str]
    deposit_paid: bool
    deposit_amount: Decimal
    deposit_account_id: Optional[uuid.UUID]
    contract_signed: bool
    price: Decimal
    notes: Optional[str]
    created_at: datetime
