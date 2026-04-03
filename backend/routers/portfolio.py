from __future__ import annotations
import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile

logger = logging.getLogger(__name__)
from sqlalchemy import delete as sqldel, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from models.admin import AppSettings
from models.portfolio import ContactSubmission, PortfolioCategory, PortfolioPhoto
from models.user import User
import json

from schemas.portfolio import (
    CategoryOut,
    CategoryWithPhotosOut,
    ContactSubmissionCreate,
    DEFAULT_STATS,
    HeroPhotoOut,
    PhotoOut,
    PositionItem,
    PublicSettingsOut,
)
import services.portfolio as portfolio_svc
from services.email import send_email

router = APIRouter(prefix="/api", tags=["portfolio"])
DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(require_admin)]

# ─── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────────


@router.get("/portfolio/hero", response_model=list[HeroPhotoOut])
async def list_hero(db: DbDep):
    return await portfolio_svc.list_hero_photos(db)


@router.get("/portfolio/categories", response_model=list[CategoryOut])
async def list_categories_route(db: DbDep):
    return await portfolio_svc.list_categories(db)


@router.get("/portfolio/categories/{slug}", response_model=CategoryWithPhotosOut)
async def get_category(db: DbDep, slug: str):
    cat = await portfolio_svc.get_category_by_slug(db, slug)
    photos_result = await db.execute(
        select(PortfolioPhoto)
        .where(PortfolioPhoto.category_id == cat.id)
        .order_by(PortfolioPhoto.position)
    )
    return CategoryWithPhotosOut(
        id=cat.id,
        name=cat.name,
        slug=cat.slug,
        cover_url=cat.cover_url,
        position=cat.position,
        photos=[
            PhotoOut(id=p.id, image_url=p.image_url, position=p.position)
            for p in photos_result.scalars().all()
        ],
    )


@router.get("/settings/public", response_model=PublicSettingsOut)
async def public_settings(db: DbDep):
    settings_result = await db.execute(select(AppSettings))
    settings = settings_result.scalar_one_or_none()
    admin_result = await db.execute(
        select(User).where(User.role == "admin").order_by(User.created_at.asc()).limit(1)
    )
    admin = admin_result.scalar_one_or_none()
    return PublicSettingsOut(
        tagline=settings.tagline if settings else None,
        bio=settings.bio if settings else None,
        instagram_url=settings.instagram_url if settings else None,
        facebook_url=settings.facebook_url if settings else None,
        contact_headline=settings.contact_headline if settings else None,
        admin_name=admin.full_name if admin else None,
        admin_avatar_url=admin.avatar_url if admin else None,
        og_image_url=settings.og_image_url if settings else None,
        meta_title=settings.meta_title if settings else None,
        meta_description=settings.meta_description if settings else None,
        stats=json.loads(settings.stats_json) if (settings and settings.stats_json) else DEFAULT_STATS,
    )


@router.post("/contact", status_code=201)
async def submit_contact(db: DbDep, data: ContactSubmissionCreate):
    sub = ContactSubmission(name=data.name, email=data.email, phone=data.phone, message=data.message)
    db.add(sub)
    await db.flush()
    await db.commit()
    # Send email notification (best-effort — never block the response)
    try:
        settings_result = await db.execute(select(AppSettings))
        settings = settings_result.scalar_one_or_none()
        admin_result = await db.execute(
            select(User).where(User.role == "admin").order_by(User.created_at.asc()).limit(1)
        )
        admin = admin_result.scalar_one_or_none()
        recipient = (
            (settings.contact_email if settings and settings.contact_email else None)
            or (admin.email if admin else None)
        )
        if recipient:
            await send_email(
                to=recipient,
                subject=f"New contact: {data.name}",
                html=(
                    f"<p><strong>From:</strong> {data.name} ({data.email})</p>"
                    f"{f'<p><strong>Phone:</strong> {data.phone}</p>' if data.phone else ''}"
                    f"<p>{data.message}</p>"
                ),
            )
    except Exception as exc:
        logger.error("Failed to send contact form notification email: %s", exc)
    return {"id": str(sub.id)}


# ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────


@router.post("/portfolio/hero", response_model=HeroPhotoOut, status_code=201)
async def upload_hero(db: DbDep, admin: AdminDep, photo: UploadFile = File(...)):
    result = await portfolio_svc.upload_hero_photo(db, photo)
    await db.commit()
    return result


@router.patch("/portfolio/hero/positions")
async def reorder_hero(db: DbDep, admin: AdminDep, items: list[PositionItem]):
    await portfolio_svc.reorder_hero_photos(
        db, [{"id": i.id, "position": i.position} for i in items]
    )
    await db.commit()
    return {"ok": True}


@router.delete("/portfolio/hero/{photo_id}", status_code=204)
async def delete_hero(db: DbDep, admin: AdminDep, photo_id: UUID):
    await portfolio_svc.delete_hero_photo(db, photo_id)
    await db.commit()


@router.post("/portfolio/categories", response_model=CategoryOut, status_code=201)
async def create_category_route(
    db: DbDep,
    admin: AdminDep,
    name: str = Form(...),
    cover: UploadFile = File(...),
):
    cat = await portfolio_svc.create_category(db, name, cover)
    await db.commit()
    return cat


@router.patch("/portfolio/categories/positions")
async def reorder_categories(db: DbDep, admin: AdminDep, items: list[PositionItem]):
    from sqlalchemy import update as sqlupt
    existing = (await db.execute(select(PortfolioCategory))).scalars().all()
    existing_ids = {c.id for c in existing}
    submitted_ids = {i.id for i in items}
    if existing_ids != submitted_ids:
        raise HTTPException(422, "Position array must cover all existing items.")
    for item in items:
        await db.execute(
            sqlupt(PortfolioCategory)
            .where(PortfolioCategory.id == item.id)
            .values(position=item.position)
        )
    await db.commit()
    return {"ok": True}


@router.patch("/portfolio/categories/{category_id}", response_model=CategoryOut)
async def update_category_route(
    db: DbDep,
    admin: AdminDep,
    category_id: UUID,
    name: Optional[str] = Form(None),
    cover: Optional[UploadFile] = File(None),
):
    cat = await portfolio_svc.update_category(db, category_id, name=name, cover_file=cover)
    await db.commit()
    return cat


@router.delete("/portfolio/categories/{category_id}", status_code=204)
async def delete_category_route(db: DbDep, admin: AdminDep, category_id: UUID):
    await portfolio_svc.delete_category(db, category_id)
    await db.commit()


@router.post("/portfolio/categories/{category_id}/photos", status_code=201)
async def upload_photos_route(
    db: DbDep,
    admin: AdminDep,
    category_id: UUID,
    photos: list[UploadFile] = File(...),
):
    result = await portfolio_svc.upload_photos(db, category_id, photos)
    await db.commit()
    return [PhotoOut(id=p.id, image_url=p.image_url, position=p.position) for p in result]


@router.patch("/portfolio/categories/{category_id}/photos/positions")
async def reorder_photos_route(
    db: DbDep,
    admin: AdminDep,
    category_id: UUID,
    items: list[PositionItem],
):
    await portfolio_svc.reorder_photos(
        db, category_id, [{"id": i.id, "position": i.position} for i in items]
    )
    await db.commit()
    return {"ok": True}


@router.delete("/portfolio/photos/{photo_id}", status_code=204)
async def delete_photo_route(db: DbDep, admin: AdminDep, photo_id: UUID):
    await portfolio_svc.delete_photo(db, photo_id)
    await db.commit()


@router.get("/contact/submissions")
async def list_contact_submissions(
    db: DbDep,
    admin: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from sqlalchemy import func
    q = (
        select(ContactSubmission)
        .order_by(ContactSubmission.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items_result = await db.execute(q)
    total_result = await db.execute(select(func.count()).select_from(ContactSubmission))
    items = items_result.scalars().all()
    total = total_result.scalar_one()
    return {
        "items": [
            {
                "id": str(s.id),
                "name": s.name,
                "email": s.email,
                "phone": s.phone,
                "message": s.message,
                "created_at": s.created_at.isoformat(),
            }
            for s in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.delete("/contact/submissions/{submission_id}", status_code=204)
async def delete_contact_submission(db: DbDep, admin: AdminDep, submission_id: UUID):
    exists = (await db.execute(select(ContactSubmission.id).where(ContactSubmission.id == submission_id))).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "Submission not found")
    await db.execute(sqldel(ContactSubmission).where(ContactSubmission.id == submission_id))
    await db.commit()


@router.delete("/contact/submissions", status_code=204)
async def batch_delete_contact_submissions(
    db: DbDep,
    admin: AdminDep,
    ids: list[UUID] = Body(...),
):
    if not ids:
        return
    await db.execute(sqldel(ContactSubmission).where(ContactSubmission.id.in_(ids)))
    await db.commit()
