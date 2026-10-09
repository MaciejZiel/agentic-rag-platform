import asyncio
import uuid
from collections.abc import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.auth import require_tenant
from app.core.database import Base, get_db
from app.core.dependencies import get_llm_client, get_vector_store
from app.main import create_app
from app.models.tenant import Tenant

TEST_DB_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def mock_llm() -> LLMClient:
    mock = MagicMock(spec=LLMClient)
    mock.create_embeddings = AsyncMock(return_value=[[0.1] * 1536])
    mock.chat_completion = AsyncMock(return_value=("Test answer from [Source 1].", 100, 50))
    mock.chat_completion_stream = AsyncMock(return_value=_async_iter(["Test ", "answer"]))
    mock.structured_extraction = AsyncMock(return_value=({"key": "value"}, 100, 50))
    return mock


@pytest.fixture
def mock_vector_store() -> VectorStoreClient:
    mock = MagicMock(spec=VectorStoreClient)
    mock.upsert_vectors = MagicMock()
    mock.search = MagicMock(return_value=[])
    mock.delete_by_document_id = MagicMock()
    return mock


@pytest.fixture
async def mock_tenant(db_session: AsyncSession) -> Tenant:
    """A persisted tenant that auth-protected endpoints resolve to."""
    tenant = Tenant(id=uuid.uuid4(), name="Test Tenant", is_active=True)
    db_session.add(tenant)
    await db_session.commit()
    return tenant


@pytest.fixture
async def client(
    db_session: AsyncSession, mock_llm: LLMClient, mock_vector_store: VectorStoreClient,
    mock_tenant: Tenant,
) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_llm_client] = lambda: mock_llm
    app.dependency_overrides[get_vector_store] = lambda: mock_vector_store
    app.dependency_overrides[require_tenant] = lambda: mock_tenant

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


async def _async_iter(items):
    for item in items:
        yield item
