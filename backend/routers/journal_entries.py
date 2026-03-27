import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.journal import JournalEntryCreate, JournalEntryListOut, JournalEntryOut, JournalEntryUpdate
from services import journal_entries as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/journal-entries", response_model=list[JournalEntryListOut])
async def list_entries(
    db: DB, _: Admin,
    status: Optional[str] = Query(None),
    reference_type: Optional[str] = Query(None),
):
    return await svc.list_entries(db, status=status, reference_type=reference_type)


@router.post("/journal-entries", response_model=JournalEntryOut, status_code=201)
async def create_journal_entry(body: JournalEntryCreate, db: DB, _: Admin):
    return await svc.create_entry(db, date=body.date, description=body.description, lines=body.lines)


@router.get("/journal-entries/{id}", response_model=JournalEntryOut)
async def get_entry(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_entry(db, id=id)


@router.patch("/journal-entries/{id}", response_model=JournalEntryOut)
async def update_journal_entry(id: uuid.UUID, body: JournalEntryUpdate, db: DB, _: Admin):
    return await svc.update_entry(
        db,
        id=id,
        date=body.date,
        description=body.description,
        lines=body.lines,
    )


@router.post("/journal-entries/{id}/post", response_model=JournalEntryOut)
async def post_journal_entry(id: uuid.UUID, db: DB, _: Admin):
    return await svc.post_entry(db, id=id)


@router.post("/journal-entries/{id}/void", response_model=JournalEntryOut)
async def void_journal_entry(id: uuid.UUID, db: DB, _: Admin):
    return await svc.void_entry(db, id=id)
