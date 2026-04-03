from __future__ import annotations
import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from models.admin import AppSettings
from schemas.portfolio import AboutSettingsOut, AboutSettingsUpdate, DEFAULT_STATS
from schemas.settings import (
    AppSettingsOut, AppSettingsUpdate,
    SessionTypeCreate, SessionTypeUpdate, SessionTypeOut,
)
from services import settings as settings_svc

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
        meta_title=settings.meta_title,
        meta_description=settings.meta_description,
        og_image_url=settings.og_image_url,
        stats=json.loads(settings.stats_json) if settings.stats_json else DEFAULT_STATS,
    )


@router.patch("/settings/about", response_model=AboutSettingsOut)
async def update_about_settings(db: DbDep, admin: AdminDep, data: AboutSettingsUpdate):
    result = await db.execute(select(AppSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        raise HTTPException(500, "App settings not initialized. Run migrations.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == 'stats':
            settings.stats_json = json.dumps(value) if value is not None else None
        else:
            setattr(settings, field, value)
    await db.flush()
    return await get_about_settings(db, admin)


# --- App Settings (tax, PDF invoices) ---

@router.get("/settings", response_model=AppSettingsOut)
async def get_settings(db: DbDep, _: AdminDep):
    return await settings_svc.get_app_settings(db)


@router.patch("/settings", response_model=AppSettingsOut)
async def update_settings(body: AppSettingsUpdate, db: DbDep, _: AdminDep):
    return await settings_svc.update_app_settings(
        db,
        tax_enabled=body.tax_enabled,
        tax_rate=body.tax_rate,
        pdf_invoices_enabled=body.pdf_invoices_enabled,
    )


# --- Session Types ---

@router.get("/session-types", response_model=list[SessionTypeOut])
async def list_session_types(db: DbDep):
    # Public — no auth required (used by client booking form)
    return await settings_svc.list_session_types(db)


@router.post("/session-types", response_model=SessionTypeOut, status_code=201)
async def create_session_type(body: SessionTypeCreate, db: DbDep, _: AdminDep):
    return await settings_svc.create_session_type(
        db, name=body.name, available_days=body.available_days
    )


@router.patch("/session-types/{id}", response_model=SessionTypeOut)
async def update_session_type(id: uuid.UUID, body: SessionTypeUpdate, db: DbDep, _: AdminDep):
    return await settings_svc.update_session_type(
        db, id=id, name=body.name, available_days=body.available_days
    )


@router.delete("/session-types/{id}", status_code=204)
async def delete_session_type(id: uuid.UUID, db: DbDep, _: AdminDep):
    await settings_svc.delete_session_type(db, id=id)
