# backend/routers/client_portal.py
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_client
from models.appointment import Appointment
from models.booking_request import BookingRequest
from models.client import Client
from models.job import Job, JobStage
from models.session_type import SessionType
from models.user import User
from schemas.auth import CurrentUser
from schemas.client_portal import (
    ClientBookingRequestCreate,
    ClientBookingRequestOut,
    ClientBookingRequestSlot,
    ClientJobDetailOut,
    ClientJobOut,
    ClientJobStageOut,
    ClientProfileOut,
    ClientProfileUpdate,
    SessionTypeOut,
)

router = APIRouter(prefix="/api/client", tags=["client-portal"])
DB = Annotated[AsyncSession, Depends(get_db)]
ClientUser = Annotated[CurrentUser, Depends(require_client)]


async def _get_client(db: AsyncSession, user_id: uuid.UUID) -> Client:
    """Resolve the Client record for the current user. Raises 404 if missing."""
    result = await db.execute(select(Client).where(Client.user_id == user_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client record not found")
    return client


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=ClientProfileOut)
async def get_my_profile(db: DB, current_user: ClientUser) -> ClientProfileOut:
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    client = await _get_client(db, current_user.id)
    return ClientProfileOut(name=user.full_name, email=user.email, phone=client.phone)


@router.patch("/me", response_model=ClientProfileOut)
async def update_my_profile(
    body: ClientProfileUpdate, db: DB, current_user: ClientUser
) -> ClientProfileOut:
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    client = await _get_client(db, current_user.id)

    updated = body.model_fields_set
    if "name" in updated and body.name is not None:
        user.full_name = body.name
    if "phone" in updated:
        client.phone = body.phone  # None clears the field

    await db.flush()
    return ClientProfileOut(name=user.full_name, email=user.email, phone=client.phone)


# ─── Jobs ─────────────────────────────────────────────────────────────────────

@router.get("/jobs", response_model=list[ClientJobOut])
async def list_my_jobs(db: DB, current_user: ClientUser) -> list[ClientJobOut]:
    client = await _get_client(db, current_user.id)
    result = await db.execute(
        select(Job, Appointment, JobStage)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .join(JobStage, Job.stage_id == JobStage.id)
        .where(Job.client_id == client.id)
        .order_by(Appointment.starts_at.desc())
    )
    return [
        ClientJobOut(
            id=job.id,
            delivery_url=job.delivery_url,
            appointment_title=appt.title,
            appointment_starts_at=appt.starts_at.isoformat(),
            stage_name=stage.name,
            stage_color=stage.color,
        )
        for job, appt, stage in result.all()
    ]


@router.get("/jobs/{job_id}", response_model=ClientJobDetailOut)
async def get_my_job(job_id: uuid.UUID, db: DB, current_user: ClientUser) -> ClientJobDetailOut:
    client = await _get_client(db, current_user.id)

    result = await db.execute(
        select(Job, Appointment, JobStage)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .join(JobStage, Job.stage_id == JobStage.id)
        .where(Job.id == job_id, Job.client_id == client.id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")
    job, appt, stage = row

    # Load all job stages ordered by position
    stages_result = await db.execute(
        select(JobStage).order_by(JobStage.position)
    )
    all_stages = stages_result.scalars().all()

    # Load session type names for this appointment
    session_type_names: list[str] = []
    if appt.session_type_ids:
        st_result = await db.execute(
            select(SessionType).where(
                SessionType.id.in_(appt.session_type_ids)
            )
        )
        session_type_names = [st.name for st in st_result.scalars().all()]

    return ClientJobDetailOut(
        id=job.id,
        delivery_url=job.delivery_url,
        appointment_title=appt.title,
        appointment_starts_at=appt.starts_at.isoformat(),
        appointment_session_types=session_type_names,
        stage_id=stage.id,
        stage_name=stage.name,
        all_stages=[
            ClientJobStageOut(id=s.id, name=s.name, color=s.color, position=s.position)
            for s in all_stages
        ],
    )


# ─── Session types (for booking form dropdown) ───────────────────────────────

@router.get("/session-types", response_model=list[SessionTypeOut])
async def list_session_types(db: DB, current_user: ClientUser) -> list[SessionTypeOut]:
    result = await db.execute(select(SessionType).order_by(SessionType.name))
    return [
        SessionTypeOut(id=st.id, name=st.name, available_days=st.available_days or [])
        for st in result.scalars().all()
    ]


# ─── Booking requests ─────────────────────────────────────────────────────────

@router.get("/booking-requests", response_model=list[ClientBookingRequestOut])
async def list_my_booking_requests(db: DB, current_user: ClientUser) -> list[ClientBookingRequestOut]:
    client = await _get_client(db, current_user.id)
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.client_id == client.id)
        .order_by(BookingRequest.created_at.desc())
    )
    requests = result.scalars().all()

    # Resolve session type names for all slots in one query
    all_st_ids = {
        uuid.UUID(str(s["session_type_id"]))
        for req in requests
        for s in (req.session_slots or [])
    }
    st_map: dict[uuid.UUID, str] = {}
    if all_st_ids:
        st_result = await db.execute(
            select(SessionType).where(SessionType.id.in_(all_st_ids))
        )
        st_map = {st.id: st.name for st in st_result.scalars().all()}

    out = []
    for req in requests:
        slots = [
            ClientBookingRequestSlot(
                session_type_id=uuid.UUID(str(s["session_type_id"])),
                session_type_name=st_map.get(uuid.UUID(str(s["session_type_id"]))),
                date=s["date"],
                time_slot=s["time_slot"],
            )
            for s in (req.session_slots or [])
        ]
        out.append(ClientBookingRequestOut(
            id=req.id,
            preferred_date=req.preferred_date,
            session_slots=slots,
            time_slot=req.time_slot,
            session_type_name=None,
            message=req.message,
            status=req.status,
            admin_notes=req.admin_notes,
            created_at=req.created_at,
        ))
    return out


@router.post("/booking-requests", response_model=ClientBookingRequestOut, status_code=201)
async def create_booking_request(
    body: ClientBookingRequestCreate, db: DB, current_user: ClientUser
) -> ClientBookingRequestOut:
    client = await _get_client(db, current_user.id)

    slots_dicts = [
        {
            "session_type_id": str(slot.session_type_id),
            "date": str(slot.date),
            "time_slot": slot.time_slot,
        }
        for slot in body.session_slots
    ]
    # preferred_date = earliest slot date (legacy column, kept for scheduler)
    preferred_date = min(slot.date for slot in body.session_slots)
    # time_slot = first slot's time_slot (legacy column)
    first_time_slot = body.session_slots[0].time_slot if body.session_slots else "morning"

    req = BookingRequest(
        client_id=client.id,
        preferred_date=preferred_date,
        time_slot=first_time_slot,
        session_type_id=None,
        session_slots=slots_dicts,
        message=body.message,
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)

    # Resolve session type names
    st_ids = {uuid.UUID(str(s["session_type_id"])) for s in slots_dicts}
    st_result = await db.execute(select(SessionType).where(SessionType.id.in_(st_ids)))
    st_map = {st.id: st.name for st in st_result.scalars().all()}

    slots_out = [
        ClientBookingRequestSlot(
            session_type_id=uuid.UUID(str(s["session_type_id"])),
            session_type_name=st_map.get(uuid.UUID(str(s["session_type_id"]))),
            date=s["date"],
            time_slot=s["time_slot"],
        )
        for s in slots_dicts
    ]

    return ClientBookingRequestOut(
        id=req.id,
        preferred_date=req.preferred_date,
        session_slots=slots_out,
        time_slot=req.time_slot,
        session_type_name=None,
        message=req.message,
        status=req.status,
        admin_notes=req.admin_notes,
        created_at=req.created_at,
    )
