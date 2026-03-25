import uuid
import logging
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.job import Job, JobStage, AlbumStage
from models.client import Client
from services import email as email_svc

logger = logging.getLogger(__name__)


def should_send_stage_email(
    old_stage_id: uuid.UUID, new_stage_id: uuid.UUID, has_portal: bool
) -> bool:
    return has_portal and old_stage_id != new_stage_id


def should_send_delivery_email(old_url: Optional[str], new_url: Optional[str]) -> bool:
    return old_url is None and new_url is not None


def _job_options():
    return [
        selectinload(Job.client),
        selectinload(Job.appointment),
        selectinload(Job.stage),
        selectinload(Job.album_stage),
    ]


async def list_jobs(
    db: AsyncSession,
    *,
    stage_id: Optional[uuid.UUID] = None,
    client_id: Optional[uuid.UUID] = None,
) -> list[Job]:
    q = select(Job).options(*_job_options())
    if stage_id:
        q = q.where(Job.stage_id == stage_id)
    if client_id:
        q = q.where(Job.client_id == client_id)
    result = await db.execute(q.order_by(Job.created_at.desc()))
    return list(result.scalars().all())


async def get_job(db: AsyncSession, *, id: uuid.UUID) -> Job:
    result = await db.execute(
        select(Job).options(*_job_options()).where(Job.id == id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def get_job_detail(db: AsyncSession, *, id: uuid.UUID):
    """Return JobDetailOut with appointment session types resolved and full album stages list."""
    from models.session_type import SessionType
    from schemas.jobs import JobDetailOut, AppointmentSummary, SessionTypeSummary, AlbumStageOut

    job = await get_job(db, id=id)
    out = JobDetailOut.model_validate(job)

    if job.appointment and job.appointment.session_type_ids:
        st_result = await db.execute(
            select(SessionType).where(SessionType.id.in_(job.appointment.session_type_ids))
        )
        out.appointment = AppointmentSummary.model_validate(job.appointment)
        out.appointment.session_types = [
            SessionTypeSummary.model_validate(st) for st in st_result.scalars().all()
        ]

    # Embed full ordered album stages for progress bar rendering
    if job.album_stage_id is not None:
        album_stages_result = await db.execute(
            select(AlbumStage).order_by(AlbumStage.position)
        )
        out.album_stages = [
            AlbumStageOut.model_validate(s) for s in album_stages_result.scalars().all()
        ]

    return out


async def create_job(db: AsyncSession, *, data: dict) -> Job:
    job = Job(**data)
    db.add(job)
    await db.flush()

    # Auto-assign first album stage if the appointment has the 'album' addon
    if job.appointment_id:
        from models.appointment import Appointment
        appt = await db.get(Appointment, job.appointment_id)
        if appt and 'album' in (appt.addons or []):
            first_stage = await db.scalar(
                select(AlbumStage).order_by(AlbumStage.position).limit(1)
            )
            if first_stage:
                job.album_stage_id = first_stage.id
                await db.flush()
            else:
                logger.warning("No album stages seeded — job %s created without album_stage_id", job.id)

    return job


async def update_job(db: AsyncSession, *, id: uuid.UUID, data: dict) -> Job:
    job = await get_job(db, id=id)

    old_stage_id = job.stage_id
    old_delivery_url = job.delivery_url
    new_stage_id = data.get("stage_id", old_stage_id)
    new_delivery_url = data.get("delivery_url", old_delivery_url)

    for key, value in data.items():
        if value is not None:
            setattr(job, key, value)
    await db.flush()

    # Load client to check for portal account
    client_result = await db.execute(select(Client).where(Client.id == job.client_id))
    client = client_result.scalar_one_or_none()
    has_portal = client is not None and client.user_id is not None

    job_label = job.appointment.title if job.appointment else f"Job {str(id)[:8]}"

    if has_portal and client:
        # Stage change email
        if should_send_stage_email(old_stage_id, new_stage_id, has_portal):
            stage_result = await db.execute(select(JobStage).where(JobStage.id == new_stage_id))
            new_stage = stage_result.scalar_one_or_none()
            stage_name = new_stage.name if new_stage else "a new stage"
            try:
                await email_svc.send_email(
                    to=client.email,
                    subject=f"Your job '{job_label}' has been updated",
                    html=f"<p>Hi {client.name},</p><p>Your job <strong>{job_label}</strong> has moved to <strong>{stage_name}</strong>.</p>",
                )
            except Exception:
                logger.exception("Failed to send stage change email for job %s", id)

        # Photos ready email
        if should_send_delivery_email(old_delivery_url, new_delivery_url):
            try:
                await email_svc.send_email(
                    to=client.email,
                    subject=f"Your photos are ready — {job_label}",
                    html=(
                        f"<p>Hi {client.name},</p>"
                        f"<p>Your photos from <strong>{job_label}</strong> are ready.</p>"
                        f'<p><a href="{new_delivery_url}">View your photos</a></p>'
                    ),
                )
            except Exception:
                logger.exception("Failed to send delivery email for job %s", id)

    return job


async def create_job_invoice(db: AsyncSession, *, id: uuid.UUID):
    """Create a draft invoice with one line item for the job price. Raises 409 if one already exists."""
    from decimal import Decimal
    from datetime import date
    from models.invoice import Invoice, InvoicePayment
    from services.invoices import create_invoice, add_invoice_item, _recalculate_and_persist

    job = await get_job(db, id=id)

    existing = await db.scalar(select(Invoice).where(Invoice.job_id == id).limit(1))
    if existing is not None:
        raise HTTPException(status_code=409, detail="An invoice already exists for this job.")

    appt = job.appointment
    if not appt or not appt.price or appt.price <= 0:
        raise HTTPException(status_code=422, detail="No price found on the linked appointment.")

    invoice = await create_invoice(db, client_id=job.client_id, job_id=job.id)
    await add_invoice_item(
        db,
        invoice_id=invoice.id,
        description=appt.title,
        quantity=Decimal("1"),
        unit_price=Decimal(str(appt.price)),
    )
    if appt.deposit_paid and appt.deposit_amount and appt.deposit_amount > 0:
        deposit_payment = InvoicePayment(
            invoice_id=invoice.id,
            amount=Decimal(str(appt.deposit_amount)).quantize(Decimal("0.01")),
            paid_at=appt.created_at.date() if appt.created_at else date.today(),
            method=None,
            notes="Deposit collected at booking",
        )
        db.add(deposit_payment)
        await db.flush()
        await _recalculate_and_persist(db, invoice)
    await db.refresh(invoice, ["items", "payments"])
    return invoice


async def delete_job(db: AsyncSession, *, id: uuid.UUID) -> None:
    from models.invoice import Invoice
    job = await get_job(db, id=id)
    invoice_count = await db.scalar(
        select(func.count()).select_from(Invoice).where(Invoice.job_id == id)
    )
    if invoice_count and invoice_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: an invoice is linked to this job.",
        )
    await db.delete(job)
    await db.flush()
