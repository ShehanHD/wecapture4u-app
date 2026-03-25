import uuid
from decimal import Decimal
from datetime import datetime
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


class AlbumStageCreate(BaseModel):
    name: str
    color: str  # hex e.g. '#6b7280'
    is_terminal: bool = False


class AlbumStageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_terminal: Optional[bool] = None


class AlbumStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    position: int
    is_terminal: bool
    created_at: datetime


class AlbumStagePositionReorder(BaseModel):
    stages: list[StagePositionItem]


class JobCreate(BaseModel):
    client_id: uuid.UUID
    stage_id: uuid.UUID
    appointment_id: Optional[uuid.UUID] = None


class JobUpdate(BaseModel):
    stage_id: Optional[uuid.UUID] = None
    delivery_url: Optional[str] = None
    album_stage_id: Optional[uuid.UUID] = None


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    email: str


class SessionTypeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class AppointmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    starts_at: datetime
    ends_at: Optional[datetime]
    status: str
    location: Optional[str]
    session_time: Optional[str]
    session_type_ids: list[uuid.UUID]
    session_types: list[SessionTypeSummary] = []
    addons: list[str]
    deposit_paid: bool
    deposit_amount: Decimal
    contract_signed: bool
    price: Decimal
    notes: Optional[str]


class StageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    color: str


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    client: Optional[ClientSummary]
    appointment_id: Optional[uuid.UUID]
    appointment: Optional[AppointmentSummary]
    stage_id: uuid.UUID
    stage: Optional[StageSummary]
    delivery_url: Optional[str]
    album_stage_id: Optional[uuid.UUID] = None
    album_stage: Optional[StageSummary] = None
    created_at: datetime


class JobDetailOut(JobOut):
    """Extends JobOut with the full ordered album stage list (for progress bar rendering)."""
    album_stages: list[AlbumStageOut] = []
