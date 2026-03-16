from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import health, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENVIRONMENT == "production" and not settings.ALLOWED_ORIGINS:
        raise RuntimeError(
            "ALLOWED_ORIGINS must be set in production — "
            "refusing to start with open CORS policy."
        )
    yield


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
