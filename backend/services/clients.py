import uuid
import logging
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.client import Client
from models.user import User, UserRole
from models.auth import RefreshToken
from services.auth import hash_password
from services import email as email_svc

logger = logging.getLogger(__name__)


def validate_portal_access_request(portal_access: bool, temp_password: Optional[str]) -> None:
    if portal_access and not temp_password:
        raise HTTPException(
            status_code=422,
            detail="temp_password is required when portal_access is true",
        )


async def list_clients(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    tag: Optional[str] = None,
) -> list[Client]:
    q = select(Client)
    if search:
        q = q.where(
            (Client.name.ilike(f"%{search}%")) | (Client.email.ilike(f"%{search}%"))
        )
    if tag:
        q = q.where(Client.tags.contains([tag]))
    result = await db.execute(q.order_by(Client.name))
    return list(result.scalars().all())


async def get_client(db: AsyncSession, *, id: uuid.UUID) -> Client:
    result = await db.execute(select(Client).where(Client.id == id))
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


async def get_client_total_spent(db: AsyncSession, *, client_id: uuid.UUID) -> Decimal:
    """Sum of all posted journal line credits on revenue accounts for this client.
    Returns 0 until Plan 8 (Accounting) adds journal line querying."""
    try:
        result = await db.execute(
            text(
                """
                SELECT COALESCE(SUM(jl.amount), 0)
                FROM journal_lines jl
                JOIN journal_entries je ON jl.entry_id = je.id
                JOIN invoices i ON je.invoice_id = i.id
                JOIN accounts a ON jl.account_id = a.id
                WHERE i.client_id = :client_id
                  AND je.status = 'posted'
                  AND a.type = 'revenue'
                  AND jl.credit > 0
                """
            ),
            {"client_id": str(client_id)},
        )
        return Decimal(str(result.scalar()))
    except Exception:
        return Decimal("0")


async def create_client(
    db: AsyncSession,
    *,
    name: str,
    email: str,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    tags: list[str] = None,
    birthday=None,
    notes: Optional[str] = None,
    portal_access: bool = False,
    temp_password: Optional[str] = None,
) -> Client:
    validate_portal_access_request(portal_access, temp_password)
    tags = tags or []

    if portal_access and temp_password:
        # Atomic: create user row + client row in the same transaction
        user = User(
            email=email,
            hashed_password=hash_password(temp_password),
            role=UserRole.client,
            full_name=name,
            is_active=True,
        )
        db.add(user)
        await db.flush()  # get user.id

        client = Client(
            user_id=user.id,
            name=name,
            email=email,
            phone=phone,
            address=address,
            tags=tags,
            birthday=birthday,
            notes=notes,
        )
        db.add(client)
        await db.flush()

        try:
            await email_svc.send_email(
                to=email,
                subject="Your weCapture4U portal account is ready",
                html=(
                    f"<p>Hi {name},</p>"
                    f"<p>Your client portal account has been created.</p>"
                    f"<p>Email: <strong>{email}</strong><br>"
                    f"Temporary password: <strong>{temp_password}</strong></p>"
                    f"<p>Please change your password after logging in.</p>"
                ),
            )
        except Exception:
            logger.exception("Failed to send portal credentials email to %s", email)
    else:
        client = Client(
            name=name,
            email=email,
            phone=phone,
            address=address,
            tags=tags,
            birthday=birthday,
            notes=notes,
        )
        db.add(client)
        await db.flush()

    return client


async def update_client(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    tags: Optional[list[str]] = None,
    birthday=None,
    notes: Optional[str] = None,
) -> Client:
    client = await get_client(db, id=id)
    if name is not None:
        client.name = name
    if email is not None:
        client.email = email
    if phone is not None:
        client.phone = phone
    if address is not None:
        client.address = address
    if tags is not None:
        client.tags = tags
    if birthday is not None:
        client.birthday = birthday
    if notes is not None:
        client.notes = notes
    await db.flush()
    return client


async def delete_client(db: AsyncSession, *, id: uuid.UUID) -> None:
    from models.job import Job
    from models.invoice import Invoice

    client = await get_client(db, id=id)

    job_count = await db.scalar(
        select(func.count()).select_from(Job).where(Job.client_id == id)
    )
    if job_count and job_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: client has {job_count} job(s).",
        )
    invoice_count = await db.scalar(
        select(func.count()).select_from(Invoice).where(Invoice.client_id == id)
    )
    if invoice_count and invoice_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: client has {invoice_count} invoice(s).",
        )
    await db.delete(client)
    await db.flush()


async def create_portal_access(
    db: AsyncSession, *, client_id: uuid.UUID, temp_password: str
) -> Client:
    client = await get_client(db, id=client_id)
    if client.user_id is not None:
        raise HTTPException(status_code=409, detail="Client already has a portal account.")

    user = User(
        email=client.email,
        hashed_password=hash_password(temp_password),
        role=UserRole.client,
        full_name=client.name,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    client.user_id = user.id
    await db.flush()

    try:
        await email_svc.send_email(
            to=client.email,
            subject="Your weCapture4U portal account is ready",
            html=(
                f"<p>Hi {client.name},</p>"
                f"<p>Your portal account: <strong>{client.email}</strong> / "
                f"<strong>{temp_password}</strong></p>"
            ),
        )
    except Exception:
        logger.exception("Failed to send portal credentials email to %s", client.email)

    return client


async def toggle_portal_access(
    db: AsyncSession, *, client_id: uuid.UUID, is_active: bool
) -> Client:
    client = await get_client(db, id=client_id)
    if client.user_id is None:
        raise HTTPException(status_code=404, detail="Client has no portal account.")

    result = await db.execute(select(User).where(User.id == client.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Portal user record not found.")

    user.is_active = is_active

    if not is_active:
        from datetime import datetime, timezone
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        for token in result.scalars().all():
            token.revoked_at = datetime.now(timezone.utc)

    await db.flush()
    return client
