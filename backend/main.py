from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from scheduler import lifespan

# Routers
from routers import health, auth
from routers.portfolio import router as portfolio_router
from routers.settings import router as settings_router
from routers.clients import router as clients_router
from routers.appointments import router as appointments_router
from routers.jobs import router as jobs_router
from routers.invoices import router as invoices_router
from routers.notifications import router as notifications_router
from routers.cron import router as cron_router
from routers.profile import router as profile_router
from routers.booking_requests import router as booking_requests_router
from routers.accounts import router as accounts_router
from routers.journal_entries import router as journal_entries_router
from routers.expenses import router as expenses_router
from routers.reports import router as reports_router
<<<<<<< HEAD
=======
from routers.dashboard import router as dashboard_router
from routers.client_portal import router as client_portal_router
>>>>>>> main

app = FastAPI(title="weCapture4U API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(portfolio_router)
app.include_router(settings_router)
app.include_router(clients_router, prefix="/api", tags=["clients"])
app.include_router(appointments_router, prefix="/api", tags=["appointments"])
app.include_router(jobs_router, prefix="/api", tags=["jobs"])
app.include_router(invoices_router, prefix="/api", tags=["invoices"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(cron_router)
app.include_router(profile_router)
app.include_router(booking_requests_router, prefix="/api", tags=["booking-requests"])
app.include_router(accounts_router, prefix="/api", tags=["accounts"])
app.include_router(journal_entries_router, prefix="/api", tags=["journal-entries"])
app.include_router(expenses_router, prefix="/api", tags=["expenses"])
app.include_router(reports_router)
<<<<<<< HEAD
=======
app.include_router(dashboard_router)
app.include_router(client_portal_router)
>>>>>>> main
