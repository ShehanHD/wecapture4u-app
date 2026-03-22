import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.appointment import Appointment
from models.session_type import SessionType
from schemas.appointments import AppointmentOut, SessionTypeSummary

logger = logging.getLogger(__name__)


async def _auto_create_job(db: AsyncSession, appt: "Appointment") -> None:
    """Create a job in the 'Booked' stage for a newly confirmed appointment."""
    from models.job import Job, JobStage

    logger.info("[auto-job] triggered for appointment %s (client=%s title=%r)", appt.id, appt.client_id, appt.title)

    existing = await db.scalar(
        select(Job).where(Job.appointment_id == appt.id).limit(1)
    )
    if existing is not None:
        logger.info("[auto-job] job already exists (%s) — skipping", existing.id)
        return

    stage = await db.scalar(
        select(JobStage).where(func.lower(JobStage.name) == "booked").limit(1)
    )
    logger.info("[auto-job] 'booked' stage lookup: %s", stage)
    if stage is None:
        stage = await db.scalar(
            select(JobStage).order_by(JobStage.position).limit(1)
        )
        logger.info("[auto-job] fallback stage: %s", stage)
    if stage is None:
        logger.warning("[auto-job] no job stages found — cannot create job")
        return

    job = Job(
        client_id=appt.client_id,
        appointment_id=appt.id,
        stage_id=stage.id,
    )
    db.add(job)
    await db.flush()
    logger.info("[auto-job] created job %s in stage '%s'", job.id, stage.name)

    if appt.price and appt.price > 0:
        from services.invoices import create_invoice, add_invoice_item, _recalculate_and_persist
        from models.invoice import InvoicePayment
        from decimal import Decimal
        from datetime import date
        invoice = await create_invoice(db, client_id=appt.client_id, job_id=job.id)
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
            logger.info("[auto-job] recorded deposit payment €%s on invoice %s", appt.deposit_amount, invoice.id)
        logger.info("[auto-job] created invoice %s for job %s (€%s)", invoice.id, job.id, appt.price)


async def _resolve_session_types(db: AsyncSession, ids: list[uuid.UUID]) -> list[SessionTypeSummary]:
    if not ids:
        return []
    result = await db.execute(select(SessionType).where(SessionType.id.in_(ids)))
    return [SessionTypeSummary.model_validate(st) for st in result.scalars().all()]


async def _to_out(db: AsyncSession, appt: Appointment) -> AppointmentOut:
    out = AppointmentOut.model_validate(appt)
    out.session_types = await _resolve_session_types(db, appt.session_type_ids or [])
    return out


async def list_appointments(
    db: AsyncSession,
    *,
    status: Optional[str] = None,
    session_type_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> list[AppointmentOut]:
    q = select(Appointment)
    if status:
        q = q.where(Appointment.status == status)
    if session_type_id:
        q = q.where(Appointment.session_type_ids.any_() == session_type_id)
    if start_date:
        q = q.where(Appointment.starts_at >= start_date)
    if end_date:
        q = q.where(Appointment.starts_at <= end_date)
    result = await db.execute(q.order_by(Appointment.starts_at))
    appts = list(result.scalars().all())
    return [await _to_out(db, a) for a in appts]


async def get_appointment(db: AsyncSession, *, id: uuid.UUID) -> AppointmentOut:
    result = await db.execute(select(Appointment).where(Appointment.id == id))
    appt = result.scalar_one_or_none()
    if appt is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return await _to_out(db, appt)


async def get_appointment_orm(db: AsyncSession, *, id: uuid.UUID) -> Appointment:
    """Raw ORM object — used internally for updates/deletes."""
    result = await db.execute(select(Appointment).where(Appointment.id == id))
    appt = result.scalar_one_or_none()
    if appt is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


async def create_appointment(db: AsyncSession, *, data: dict) -> AppointmentOut:
    appt = Appointment(**data)
    db.add(appt)
    await db.flush()
    if appt.status == "confirmed":
        await _auto_create_job(db, appt)
    return await _to_out(db, appt)


async def update_appointment(
    db: AsyncSession, *, id: uuid.UUID, data: dict
) -> AppointmentOut:
    from models.job import Job

    appt = await get_appointment_orm(db, id=id)
    previous_status = appt.status
    new_status = data.get("status")

    for key, value in data.items():
        if value is not None:
            setattr(appt, key, value)
    await db.flush()

    logger.info("[update-appointment] id=%s previous_status=%r new_status=%r", id, previous_status, new_status)

    if new_status == "confirmed" and previous_status != "confirmed":
        try:
            await _auto_create_job(db, appt)
        except Exception:
            logger.exception("[auto-job] FAILED for appointment %s", id)
            raise
    elif new_status and new_status != "confirmed" and previous_status == "confirmed":
        # Status moved away from confirmed — remove the linked job (and any draft invoices)
        from models.invoice import Invoice
        linked_job = await db.scalar(select(Job).where(Job.appointment_id == id).limit(1))
        if linked_job:
            invoices = (await db.execute(
                select(Invoice).where(Invoice.job_id == linked_job.id)
            )).scalars().all()
            non_draft = [inv for inv in invoices if inv.status != "draft"]
            if non_draft:
                logger.warning(
                    "[auto-job] cannot remove job %s — non-draft invoice(s) exist: %s",
                    linked_job.id, [str(inv.id) for inv in non_draft],
                )
                raise HTTPException(
                    status_code=409,
                    detail="Cannot un-confirm: invoice has already been sent or paid.",
                )
            for inv in invoices:
                await db.delete(inv)
            await db.delete(linked_job)
            await db.flush()
            logger.info(
                "[auto-job] removed job %s and %d draft invoice(s) (appointment un-confirmed)",
                linked_job.id, len(invoices),
            )

    return await _to_out(db, appt)


async def delete_appointment(db: AsyncSession, *, id: uuid.UUID) -> None:
    from models.job import Job
    appt = await get_appointment_orm(db, id=id)
    job_count = await db.scalar(
        select(func.count()).select_from(Job).where(Job.appointment_id == id)
    )
    if job_count and job_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: a job is linked to this appointment.",
        )
    await db.delete(appt)
    await db.flush()
