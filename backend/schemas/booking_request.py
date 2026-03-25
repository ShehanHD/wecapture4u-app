import uuid
from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel


class BookingRequestOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    preferred_date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]
    session_type_id: Optional[uuid.UUID]
    addons: list[str]
    message: Optional[str]
    status: Literal["pending", "confirmed", "rejected"]
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class BookingRequestUpdate(BaseModel):
    status: Literal["confirmed", "rejected"]
    admin_notes: Optional[str] = None
