# backend/routers/dashboard.py
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from models.client import Client
from models.job import Job
from models.invoice import Invoice
from models.appointment import Appointment

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


class DashboardStats(BaseModel):
    total_clients: int
    active_jobs: int
    overdue_balance: float   # unpaid invoices where shoot date has passed
    upcoming_balance: float  # unpaid invoices where shoot date is in the future


@router.get("/api/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(db: DB, _: Admin):
    now = datetime.now(timezone.utc)

    # Total clients
    client_count = await db.scalar(select(func.count()).select_from(Client))

    # Active jobs (non-terminal stages)
    from models.job import JobStage
    active_jobs_count = await db.scalar(
        select(func.count())
        .select_from(Job)
        .join(JobStage, Job.stage_id == JobStage.id)
        .where(JobStage.is_terminal == False)  # noqa: E712
    )

    # Overdue balance: unpaid invoices where linked appointment shoot date has passed
    overdue_result = await db.scalar(
        select(func.coalesce(func.sum(Invoice.balance_due), 0))
        .select_from(Invoice)
        .join(Job, Invoice.job_id == Job.id)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .where(Invoice.status != 'paid')
        .where(Invoice.balance_due > 0)
        .where(Appointment.starts_at < now)
    )

    # Upcoming balance: unpaid invoices where linked appointment shoot date is in the future
    upcoming_result = await db.scalar(
        select(func.coalesce(func.sum(Invoice.balance_due), 0))
        .select_from(Invoice)
        .join(Job, Invoice.job_id == Job.id)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .where(Invoice.status != 'paid')
        .where(Invoice.balance_due > 0)
        .where(Appointment.starts_at >= now)
    )

    return DashboardStats(
        total_clients=client_count or 0,
        active_jobs=active_jobs_count or 0,
        overdue_balance=float(overdue_result or 0),
        upcoming_balance=float(upcoming_result or 0),
    )
