import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.jobs import (
    JobCreate, JobUpdate, JobOut, JobDetailOut,
    JobStageCreate, JobStageUpdate, JobStageOut,
    StagePositionReorder,
)
from schemas.invoices import InvoiceOut
from services import jobs as job_svc
from services import settings as settings_svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


# --- Jobs ---

@router.get("/jobs", response_model=list[JobOut])
async def list_jobs(
    db: DB, _: Admin,
    stage_id: Optional[uuid.UUID] = Query(None),
    client_id: Optional[uuid.UUID] = Query(None),
):
    return await job_svc.list_jobs(db, stage_id=stage_id, client_id=client_id)


@router.post("/jobs", response_model=JobOut, status_code=201)
async def create_job(body: JobCreate, db: DB, _: Admin):
    return await job_svc.create_job(db, data=body.model_dump(exclude_unset=False))


@router.get("/jobs/{id}", response_model=JobDetailOut)
async def get_job(id: uuid.UUID, db: DB, _: Admin):
    return await job_svc.get_job_detail(db, id=id)


@router.patch("/jobs/{id}", response_model=JobOut)
async def update_job(id: uuid.UUID, body: JobUpdate, db: DB, _: Admin):
    return await job_svc.update_job(db, id=id, data=body.model_dump(exclude_unset=True))


@router.delete("/jobs/{id}", status_code=204)
async def delete_job(id: uuid.UUID, db: DB, _: Admin):
    await job_svc.delete_job(db, id=id)


@router.post("/jobs/{id}/invoice", response_model=InvoiceOut, status_code=201)
async def create_job_invoice(id: uuid.UUID, db: DB, _: Admin):
    return await job_svc.create_job_invoice(db, id=id)


# --- Job Stages ---

@router.get("/job-stages", response_model=list[JobStageOut])
async def list_job_stages(db: DB, _: Admin):
    return await settings_svc.list_job_stages(db)


@router.post("/job-stages", response_model=JobStageOut, status_code=201)
async def create_job_stage(body: JobStageCreate, db: DB, _: Admin):
    return await settings_svc.create_job_stage(
        db, name=body.name, color=body.color, is_terminal=body.is_terminal
    )


@router.patch("/job-stages/positions", response_model=list[JobStageOut])
async def reorder_job_stages(body: StagePositionReorder, db: DB, _: Admin):
    stages = [{"id": str(s.id), "position": s.position} for s in body.stages]
    return await settings_svc.reorder_job_stages(db, stages=stages)


@router.patch("/job-stages/{id}", response_model=JobStageOut)
async def update_job_stage(id: uuid.UUID, body: JobStageUpdate, db: DB, _: Admin):
    return await settings_svc.update_job_stage(
        db, id=id, name=body.name, color=body.color, is_terminal=body.is_terminal
    )


@router.delete("/job-stages/{id}", status_code=204)
async def delete_job_stage(id: uuid.UUID, db: DB, _: Admin):
    await settings_svc.delete_job_stage(db, id=id)
