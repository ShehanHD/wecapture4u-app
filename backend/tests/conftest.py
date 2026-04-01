import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from main import app
from database import engine, get_db
from models.user import User, UserRole
from models.client import Client
from services.auth import hash_password, create_access_token


@pytest.fixture
async def client() -> AsyncClient:
    """Existing fixture — basic test client (no DB override)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture
async def db_session() -> AsyncSession:
    """
    Transaction-isolated DB session.
    All data written during the test is rolled back on teardown.
    Uses join_transaction_mode='create_savepoint' so routers can call
    db.begin() (which creates a SAVEPOINT rather than a real transaction).
    """
    async with engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create a transient admin user scoped to the test transaction."""
    user = User(
        email=f"admin_{uuid.uuid4().hex[:8]}@test.internal",
        hashed_password=hash_password("TestPass123!"),
        role=UserRole.admin,
        full_name="Test Admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def admin_auth_headers(admin_user: User) -> dict:
    """JWT Bearer headers for the test admin user."""
    token = create_access_token({"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def client_user(db_session: AsyncSession) -> User:
    """Create a transient client user scoped to the test transaction."""
    user = User(
        email=f"client_{uuid.uuid4().hex[:8]}@test.internal",
        hashed_password=hash_password("ClientPass123!"),
        role=UserRole.client,
        full_name="Test Client",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def client_record(db_session: AsyncSession, client_user: User) -> Client:
    """Create a Client record linked to client_user."""
    record = Client(
        user_id=client_user.id,
        phone="555-0100",
    )
    db_session.add(record)
    await db_session.flush()
    return record


@pytest.fixture
async def client_auth_headers(client_user: User) -> dict:
    """JWT Bearer headers for the test client user."""
    token = create_access_token({"sub": str(client_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_client(db_session: AsyncSession) -> AsyncClient:
    """
    HTTP test client whose get_db dependency is overridden to use the
    same transaction-isolated session as db_session.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
