import uuid
from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ClientProfileOut(BaseModel):
    name: str
    email: str
    phone: Optional[str]


class ClientProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    phone: Optional[str] = None


class ClientJobStageOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    position: int


class ClientJobOut(BaseModel):
    id: uuid.UUID
    delivery_url: Optional[str]
    appointment_title: str
    appointment_starts_at: str
    stage_name: str
    stage_color: str


class ClientJobDetailOut(BaseModel):
    id: uuid.UUID
    delivery_url: Optional[str]
    appointment_title: str
    appointment_starts_at: str
    appointment_session_types: list[str]
    stage_id: uuid.UUID
    stage_name: str
    all_stages: list[ClientJobStageOut]


class SessionTypeOut(BaseModel):
    id: uuid.UUID
    name: str
    available_days: list[int]


class ClientBookingRequestSlot(BaseModel):
    session_type_id: uuid.UUID
    session_type_name: Optional[str]
    date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]


class ClientBookingRequestOut(BaseModel):
    id: uuid.UUID
    preferred_date: date
    session_slots: list[ClientBookingRequestSlot]
    # Legacy fields — kept for backwards compat, not written by new code
    time_slot: Optional[Literal["morning", "afternoon", "evening", "all_day"]]
    session_type_name: Optional[str]
    message: Optional[str]
    status: Literal["pending", "confirmed", "rejected"]
    admin_notes: Optional[str]
    created_at: datetime


class ClientBookingRequestSlotCreate(BaseModel):
    session_type_id: uuid.UUID
    date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]


class ClientBookingRequestCreate(BaseModel):
    session_slots: list[ClientBookingRequestSlotCreate]
    message: Optional[str] = None
