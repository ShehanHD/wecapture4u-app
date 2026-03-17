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
