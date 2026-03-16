from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from models.admin import AppSettings
from schemas.portfolio import AboutSettingsOut, AboutSettingsUpdate

router = APIRouter(prefix="/api", tags=["settings"])
DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(require_admin)]


@router.get("/settings/about", response_model=AboutSettingsOut)
async def get_about_settings(db: DbDep, admin: AdminDep):
    result = await db.execute(select(AppSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        return AboutSettingsOut()
    return AboutSettingsOut(
        tagline=settings.tagline,
        bio=settings.bio,
        instagram_url=settings.instagram_url,
        facebook_url=settings.facebook_url,
        contact_headline=settings.contact_headline,
        contact_email=settings.contact_email,
    )


@router.patch("/settings/about", response_model=AboutSettingsOut)
async def update_about_settings(db: DbDep, admin: AdminDep, data: AboutSettingsUpdate):
    result = await db.execute(select(AppSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        raise HTTPException(500, "App settings not initialized. Run migrations.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    await db.commit()
    return await get_about_settings(db, admin)
