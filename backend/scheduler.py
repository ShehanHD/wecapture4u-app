import logging
import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from sqlalchemy import select

from database import AsyncSessionLocal
from models.appointment import Appointment
from models.client import Client
from models.invoice import Invoice
from models.user import User
from services.notifications import create_notification

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def is_birthday_today(birthday: Optional[date]) -> bool:
    if birthday is None:
        return False
    today = date.today()
    return birthday.month == today.month and birthday.day == today.day


def is_invoice_overdue(due_date: Optional[date], status: str) -> bool:
    if due_date is None or status in ("paid", "draft"):
        return False
    return due_date < date.today()


async def run_daily_notifications() -> None:
    """Daily job: appointment reminders, birthday alerts, invoice overdue notices.
    Runs at 08:00 UTC via APScheduler. Missed runs are not recovered."""
    logger.info("Running daily notification job")
    now = datetime.now(timezone.utc)
    window_start = now
    window_end = now + timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        async with db.begin():
            # 1. Appointment reminders — appointments starting within the next 24h
            result = await db.execute(
                select(Appointment).where(
                    Appointment.starts_at >= window_start,
                    Appointment.starts_at <= window_end,
                    Appointment.status != "cancelled",
                )
            )
            appointments = result.scalars().all()
            for appt in appointments:
                client_result = await db.execute(
                    select(Client).where(Client.id == appt.client_id)
                )
                client = client_result.scalar_one_or_none()
                if client is None:
                    continue
                admin_result = await db.execute(
                    select(User).where(User.role == "admin").limit(1)
                )
                admin = admin_result.scalar_one_or_none()
                if admin is None:
                    continue
                await create_notification(
                    db=db,
                    user_id=admin.id,
                    type_="appointment_reminder",
                    title=f"Appointment tomorrow: {appt.title}",
                    body=f"Appointment with {client.name} at {appt.starts_at.strftime('%H:%M UTC')}",
                    send_email=True,
                    recipient_email=admin.email,
                )

            # 2. Birthday alerts — clients with birthday today
            client_result = await db.execute(select(Client))
            all_clients = client_result.scalars().all()
            birthday_clients = [c for c in all_clients if is_birthday_today(c.birthday)]

            if birthday_clients:
                admin_result = await db.execute(
                    select(User).where(User.role == "admin").limit(1)
                )
                admin = admin_result.scalar_one_or_none()
                if admin:
                    for client in birthday_clients:
                        await create_notification(
                            db=db,
                            user_id=admin.id,
                            type_="birthday",
                            title=f"Birthday: {client.name}",
                            body=f"{client.name}'s birthday is today!",
                            send_email=False,
                        )

            # 3. Invoice overdue — invoices past due date
            invoice_result = await db.execute(
                select(Invoice).where(Invoice.status.in_(["sent", "partially_paid"]))
            )
            invoices = invoice_result.scalars().all()
            overdue = [i for i in invoices if is_invoice_overdue(i.due_date, i.status)]

            if overdue:
                admin_result = await db.execute(
                    select(User).where(User.role == "admin").limit(1)
                )
                admin = admin_result.scalar_one_or_none()
                if admin:
                    for invoice in overdue:
                        await create_notification(
                            db=db,
                            user_id=admin.id,
                            type_="invoice_overdue",
                            title="Invoice overdue",
                            body=f"Invoice #{str(invoice.id)[:8]} is past its due date.",
                            send_email=False,
                        )

    logger.info("Daily notification job complete")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from config import settings as app_settings

    if app_settings.ENVIRONMENT == "production" and not app_settings.ALLOWED_ORIGINS:
        raise RuntimeError(
            "ALLOWED_ORIGINS must be set in production — "
            "refusing to start with open CORS policy."
        )

    # Vercel is serverless — no persistent process to run APScheduler.
    # Scheduling is handled by Vercel Cron Jobs hitting /api/cron/daily-notifications.
    on_vercel = os.environ.get("VERCEL") == "1"
    if not on_vercel:
        scheduler.add_job(
            run_daily_notifications,
            trigger="cron",
            hour=8,
            minute=0,
            timezone="UTC",
            id="daily_notifications",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("APScheduler started")

    yield

    if not on_vercel:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
