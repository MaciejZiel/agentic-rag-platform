import asyncio
from collections.abc import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import create_app

# Use SQLite for tests — no external DB needed
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
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_llm_client():
    with patch("app.clients.openai_client.LLMClient") as mock:
        instance = mock.return_value
        instance.create_embeddings = AsyncMock(return_value=[[0.1] * 1536])
        instance.chat_completion = AsyncMock(return_value=("Test answer", 100, 50))
        instance.chat_completion_stream = MagicMock()
        instance.structured_extraction = AsyncMock(
            return_value=({"key": "value"}, 100, 50)
        )
        yield instance


@pytest.fixture
def mock_vector_store():
    with patch("app.clients.qdrant_client.VectorStoreClient") as mock:
        instance = mock.return_value
        instance.upsert_vectors = MagicMock()
        instance.search = MagicMock(return_value=[])
        instance.delete_by_document_id = MagicMock()
        yield instance
