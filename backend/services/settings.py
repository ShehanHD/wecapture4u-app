import uuid
import logging
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.admin import AppSettings
from models.session_type import SessionType
from models.job import JobStage, Job

logger = logging.getLogger(__name__)


async def get_app_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    settings = result.scalar_one_or_none()
    if settings is None:
        # Seed the single row if it doesn't exist (first run after migration)
        settings = AppSettings(id=1, tax_enabled=False, tax_rate=0, pdf_invoices_enabled=False)
        db.add(settings)
        await db.flush()
    return settings


async def update_app_settings(
    db: AsyncSession,
    *,
    tax_enabled: Optional[bool] = None,
    tax_rate=None,
    pdf_invoices_enabled: Optional[bool] = None,
) -> AppSettings:
    settings = await get_app_settings(db)
    if tax_enabled is not None:
        settings.tax_enabled = tax_enabled
    if tax_rate is not None:
        settings.tax_rate = tax_rate
    if pdf_invoices_enabled is not None:
        settings.pdf_invoices_enabled = pdf_invoices_enabled
    await db.flush()
    return settings


# --- Session Types ---

async def list_session_types(db: AsyncSession) -> list[SessionType]:
    result = await db.execute(select(SessionType).order_by(SessionType.name))
    return list(result.scalars().all())


async def create_session_type(db: AsyncSession, *, name: str) -> SessionType:
    st = SessionType(name=name)
    db.add(st)
    await db.flush()
    return st


async def update_session_type(db: AsyncSession, *, id: uuid.UUID, name: str) -> SessionType:
    result = await db.execute(select(SessionType).where(SessionType.id == id))
    st = result.scalar_one_or_none()
    if st is None:
        raise HTTPException(status_code=404, detail="Session type not found")
    st.name = name
    await db.flush()
    return st


async def delete_session_type(db: AsyncSession, *, id: uuid.UUID) -> None:
    from models.appointment import Appointment
    result = await db.execute(select(SessionType).where(SessionType.id == id))
    st = result.scalar_one_or_none()
    if st is None:
        raise HTTPException(status_code=404, detail="Session type not found")
    # Block if referenced by any appointment
    appt_count = await db.scalar(
        select(func.count()).select_from(Appointment).where(Appointment.session_type_ids.contains([id]))
    )
    if appt_count and appt_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {appt_count} appointment(s) reference this session type. Reassign them first.",
        )
    await db.delete(st)
    await db.flush()


# --- Job Stages ---

async def list_job_stages(db: AsyncSession) -> list[JobStage]:
    result = await db.execute(select(JobStage).order_by(JobStage.position))
    return list(result.scalars().all())


async def create_job_stage(
    db: AsyncSession, *, name: str, color: str, is_terminal: bool = False
) -> JobStage:
    max_pos = await db.scalar(select(func.max(JobStage.position)))
    position = (max_pos or 0) + 1
    stage = JobStage(name=name, color=color, position=position, is_terminal=is_terminal)
    db.add(stage)
    await db.flush()
    return stage


async def update_job_stage(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: Optional[str] = None,
    color: Optional[str] = None,
    is_terminal: Optional[bool] = None,
) -> JobStage:
    result = await db.execute(select(JobStage).where(JobStage.id == id))
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Job stage not found")
    if name is not None:
        stage.name = name
    if color is not None:
        stage.color = color
    if is_terminal is not None:
        stage.is_terminal = is_terminal
    await db.flush()
    return stage


def validate_stage_position_set(
    existing_ids: set[uuid.UUID], incoming_ids: set[uuid.UUID]
) -> None:
    """Ensure the reorder payload contains exactly the same IDs as exist in DB."""
    if existing_ids != incoming_ids:
        raise HTTPException(
            status_code=422,
            detail="Stage position payload must contain exactly the same stage IDs as currently exist.",
        )


async def reorder_job_stages(
    db: AsyncSession, *, stages: list[dict]
) -> list[JobStage]:
    existing = await list_job_stages(db)
    existing_ids = {s.id for s in existing}
    incoming_ids = {uuid.UUID(str(s["id"])) for s in stages}
    validate_stage_position_set(existing_ids, incoming_ids)

    stage_map = {s.id: s for s in existing}
    for item in stages:
        stage_map[uuid.UUID(str(item["id"]))].position = item["position"]
    await db.flush()
    return sorted(existing, key=lambda s: s.position)


async def delete_job_stage(db: AsyncSession, *, id: uuid.UUID) -> None:
    result = await db.execute(select(JobStage).where(JobStage.id == id))
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Job stage not found")
    job_count = await db.scalar(
        select(func.count()).select_from(Job).where(Job.stage_id == id)
    )
    if job_count and job_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"{job_count} job(s) are in this stage. Reassign them first.",
        )
    await db.delete(stage)
    await db.flush()
