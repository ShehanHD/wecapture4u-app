# backend/services/dashboard.py
from datetime import datetime, date, timezone
from decimal import Decimal

from sqlalchemy import select, func, and_, case, extract
from sqlalchemy.ext.asyncio import AsyncSession

from models.account import Account
from models.client import Client
from models.invoice import Invoice, InvoicePayment
from models.job import Job, JobStage, AlbumStage
from models.appointment import Appointment
from models.journal import JournalEntry, JournalLine


async def _asset_balance_by_name(db: AsyncSession, name_fragment: str) -> float:
    """
    Sum current balances of posted-journal asset accounts whose name
    contains name_fragment (case-insensitive).
    Asset accounts are debit-normal: balance = total_debit - total_credit.
    """
    posted_entry_ids = select(JournalEntry.id).where(JournalEntry.status == "posted")

    result = await db.execute(
        select(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0"))
            - func.coalesce(func.sum(JournalLine.credit), Decimal("0"))
        )
        .select_from(Account)
        .join(JournalLine, JournalLine.account_id == Account.id)
        .where(Account.type == "asset")
        .where(Account.archived == False)  # noqa: E712
        .where(Account.name.ilike(f"%{name_fragment}%"))
        .where(JournalLine.entry_id.in_(posted_entry_ids))
    )
    return float(result.scalar_one() or 0)


async def get_dashboard_stats(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    today = date.today()
    month_start = date(today.year, today.month, 1)

    # ── Cash & Bank ────────────────────────────────────────────────────────────
    total_cash = await _asset_balance_by_name(db, "cash")
    total_bank = await _asset_balance_by_name(db, "bank")

    # ── Total Debits & Credits (all posted journal lines, all time) ────────────
    posted_entry_ids = select(JournalEntry.id).where(JournalEntry.status == "posted")
    totals_row = await db.execute(
        select(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0")).label("total_debits"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0")).label("total_credits"),
        )
        .where(JournalLine.entry_id.in_(posted_entry_ids))
    )
    totals = totals_row.one()
    total_debits = float(totals.total_debits)
    total_credits = float(totals.total_credits)

    # ── This month revenue (invoice payments received this month) ──────────────
    this_month_revenue = await db.scalar(
        select(func.coalesce(func.sum(InvoicePayment.amount), Decimal("0")))
        .where(InvoicePayment.payment_date >= month_start)
        .where(InvoicePayment.payment_date <= today)
    )

    # ── Overdue: unpaid invoices where shoot date has passed ───────────────────
    overdue_balance = await db.scalar(
        select(func.coalesce(func.sum(Invoice.balance_due), Decimal("0")))
        .select_from(Invoice)
        .join(Job, Invoice.job_id == Job.id)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .where(Invoice.status != "paid")
        .where(Invoice.balance_due > 0)
        .where(Appointment.starts_at < now)
    )

    # ── Upcoming: unpaid invoices where shoot date is in the future ────────────
    upcoming_balance = await db.scalar(
        select(func.coalesce(func.sum(Invoice.balance_due), Decimal("0")))
        .select_from(Invoice)
        .join(Job, Invoice.job_id == Job.id)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .where(Invoice.status != "paid")
        .where(Invoice.balance_due > 0)
        .where(Appointment.starts_at >= now)
    )

    # ── Jobs ───────────────────────────────────────────────────────────────────
    total_jobs = await db.scalar(select(func.count()).select_from(Job))

    this_month_jobs = await db.scalar(
        select(func.count())
        .select_from(Job)
        .where(extract("year", Job.created_at) == today.year)
        .where(extract("month", Job.created_at) == today.month)
    )

    future_jobs = await db.scalar(
        select(func.count())
        .select_from(Job)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .where(Appointment.starts_at >= now)
    )

    active_jobs = await db.scalar(
        select(func.count())
        .select_from(Job)
        .join(JobStage, Job.stage_id == JobStage.id)
        .where(JobStage.is_terminal == False)  # noqa: E712
    )

    # ── Clients ────────────────────────────────────────────────────────────────
    total_clients = await db.scalar(select(func.count()).select_from(Client))

    # ── Albums ─────────────────────────────────────────────────────────────────
    total_albums = await db.scalar(
        select(func.count())
        .select_from(Job)
        .where(Job.album_stage_id.isnot(None))
    )

    # Upcoming albums: album assigned + shoot date in the future
    upcoming_albums = await db.scalar(
        select(func.count())
        .select_from(Job)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .where(Job.album_stage_id.isnot(None))
        .where(Appointment.starts_at >= now)
    )

    # Ongoing albums: album assigned + shoot date passed + album stage not terminal
    ongoing_albums = await db.scalar(
        select(func.count())
        .select_from(Job)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .join(AlbumStage, Job.album_stage_id == AlbumStage.id)
        .where(Job.album_stage_id.isnot(None))
        .where(Appointment.starts_at < now)
        .where(AlbumStage.is_terminal == False)  # noqa: E712
    )

    return {
        "total_cash": total_cash,
        "total_bank": total_bank,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "this_month_revenue": float(this_month_revenue or 0),
        "overdue_balance": float(overdue_balance or 0),
        "upcoming_balance": float(upcoming_balance or 0),
        "active_jobs": active_jobs or 0,
        "total_jobs": total_jobs or 0,
        "this_month_jobs": this_month_jobs or 0,
        "future_jobs": future_jobs or 0,
        "total_clients": total_clients or 0,
        "total_albums": total_albums or 0,
        "upcoming_albums": upcoming_albums or 0,
        "ongoing_albums": ongoing_albums or 0,
    }
