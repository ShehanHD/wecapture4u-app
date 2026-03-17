from uuid import uuid4
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
from config import settings

# Supabase uses pgbouncer in transaction mode.
# NullPool lets pgbouncer own the pooling; unique statement names prevent
# "prepared statement already exists" collisions across pooled connections.
_db_url = settings.DATABASE_URL
if "?" not in _db_url:
    _db_url += "?prepared_statement_cache_size=0"
else:
    _db_url += "&prepared_statement_cache_size=0"

engine = create_async_engine(
    _db_url,
    echo=settings.ENVIRONMENT == "development",
    poolclass=NullPool,
    connect_args={
        "ssl": "require",
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    },
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
