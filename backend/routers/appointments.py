import uuid
from typing import Annotated, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.appointments import AppointmentCreate, AppointmentUpdate, AppointmentOut
from services import appointments as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/appointments", response_model=list[AppointmentOut])
async def list_appointments(
    db: DB, _: Admin,
    status: Optional[str] = Query(None),
    session_type_id: Optional[uuid.UUID] = Query(None, description="Filter by session type (legacy single-ID filter)"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
):
    return await svc.list_appointments(
        db, status=status, session_type_id=session_type_id,
        start_date=start_date, end_date=end_date
    )


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
async def create_appointment(body: AppointmentCreate, db: DB, _: Admin):
    data = body.model_dump(exclude_unset=False)
    return await svc.create_appointment(db, data=data)


@router.get("/appointments/{id}", response_model=AppointmentOut)
async def get_appointment(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_appointment(db, id=id)


@router.patch("/appointments/{id}", response_model=AppointmentOut)
async def update_appointment(id: uuid.UUID, body: AppointmentUpdate, db: DB, _: Admin):
    return await svc.update_appointment(db, id=id, data=body.model_dump(exclude_unset=True))


@router.delete("/appointments/{id}", status_code=204)
async def delete_appointment(id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_appointment(db, id=id)
