import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    tags: list[str] = []
    birthday: Optional[date] = None
    notes: Optional[str] = None
    # Portal access — if True, temp_password must be provided
    portal_access: bool = False
    temp_password: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tags: Optional[list[str]] = None
    birthday: Optional[date] = None
    notes: Optional[str] = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    name: str
    email: str
    phone: Optional[str]
    address: Optional[str]
    tags: list[str]
    birthday: Optional[date]
    notes: Optional[str]
    created_at: datetime


class ClientWithStats(ClientOut):
    """Extended response for client detail view — includes computed stats."""
    total_spent: float = 0.0
    is_active: Optional[bool] = None  # None if no portal account


class PortalAccessToggle(BaseModel):
    is_active: bool


class CreatePortalAccess(BaseModel):
    temp_password: str
