import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class JobStageCreate(BaseModel):
    name: str
    color: str  # hex e.g. '#f59e0b'
    is_terminal: bool = False


class JobStageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_terminal: Optional[bool] = None


class JobStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    position: int
    is_terminal: bool
    created_at: datetime


class StagePositionItem(BaseModel):
    id: uuid.UUID
    position: int


class StagePositionReorder(BaseModel):
    stages: list[StagePositionItem]


class JobCreate(BaseModel):
    client_id: uuid.UUID
    title: str
    stage_id: uuid.UUID
    appointment_id: Optional[uuid.UUID] = None
    shoot_date: Optional[date] = None
    delivery_deadline: Optional[date] = None
    notes: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    stage_id: Optional[uuid.UUID] = None
    appointment_id: Optional[uuid.UUID] = None
    shoot_date: Optional[date] = None
    delivery_deadline: Optional[date] = None
    delivery_url: Optional[str] = None
    notes: Optional[str] = None


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    email: str


class AppointmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    starts_at: datetime
    status: str


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    client: Optional[ClientSummary]
    appointment_id: Optional[uuid.UUID]
    title: str
    stage_id: uuid.UUID
    shoot_date: Optional[date]
    delivery_deadline: Optional[date]
    delivery_url: Optional[str]
    notes: Optional[str]
    created_at: datetime


class JobDetailOut(JobOut):
    """Extended response for job detail view."""
    appointment: Optional[AppointmentSummary]
