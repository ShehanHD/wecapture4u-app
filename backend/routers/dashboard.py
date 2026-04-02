# backend/routers/dashboard.py
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from services.dashboard import get_dashboard_stats

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


class DashboardStats(BaseModel):
    total_cash: float
    total_bank: float
    total_liabilities: float
    total_receivables: float
    this_month_revenue: float
    overdue_balance: float
    upcoming_balance: float
    active_jobs: int
    total_jobs: int
    this_month_jobs: int
    future_jobs: int
    total_clients: int
    total_albums: int
    upcoming_albums: int
    ongoing_albums: int


@router.get("/api/dashboard", response_model=DashboardStats)
async def dashboard_stats(db: DB, _: Admin):
    data = await get_dashboard_stats(db)
    return DashboardStats(**data)
