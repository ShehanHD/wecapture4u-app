import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

VALID_STATUSES = {"pending", "confirmed", "cancelled"}
VALID_ADDONS = {"album", "thank_you_card", "enlarged_photos"}


VALID_SESSION_TIMES = {"morning", "afternoon", "evening"}

class AppointmentCreate(BaseModel):
    client_id: uuid.UUID
    session_type_ids: list[uuid.UUID] = []
    session_time: Optional[str] = None
    title: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    location: Optional[str] = None
    status: str = "pending"
    addons: list[str] = []
    deposit_paid: bool = False
    deposit_amount: Decimal = Decimal("0")
    deposit_account_id: Optional[uuid.UUID] = None
    contract_signed: bool = False
    price: Decimal = Decimal("0")
    notes: Optional[str] = None

    @field_validator("session_time")
    @classmethod
    def session_time_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_SESSION_TIMES:
            raise ValueError(f"session_time must be one of {VALID_SESSION_TIMES}")
        return v

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v

    @field_validator("addons")
    @classmethod
    def addons_must_be_valid(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_ADDONS
        if invalid:
            raise ValueError(f"invalid addons: {invalid}. Must be subset of {VALID_ADDONS}")
        return v


class AppointmentUpdate(BaseModel):
    session_type_ids: Optional[list[uuid.UUID]] = None
    session_time: Optional[str] = None
    title: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
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
    session_type_ids: list[uuid.UUID]
    session_time: Optional[str]
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
