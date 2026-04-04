import io
import uuid

import pytest
from httpx import AsyncClient
from unittest.mock import MagicMock

from app.clients.qdrant_client import VectorStoreClient


@pytest.mark.asyncio
async def test_ask_no_sources_returns_controlled_response(client: AsyncClient):
    """When vector search returns nothing, the LLM should not be called."""
    response = await client.post(
        "/api/v1/qa/ask",
        json={"question": "What is this about?", "top_k": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sources"] == []
    assert "No relevant sources found" in data["answer"]
    assert data["token_usage"] == 0


@pytest.mark.asyncio
async def test_ask_with_sources_returns_answer(
    client: AsyncClient, mock_vector_store: VectorStoreClient, mock_llm: MagicMock
):
    """Upload a doc, mock vector results pointing at its chunks, verify full RAG flow."""
    # 1. Upload a document to get a real DB record
    content = b"Climate change is accelerating. Global temperatures have risen by 1.1C."
    upload_resp = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("report.txt", io.BytesIO(content), "text/plain")},
    )
    assert upload_resp.status_code == 201
    doc_id = upload_resp.json()["id"]

    # 2. Manually create a chunk in DB for this document
    from app.models.document import DocumentChunk
    from tests.conftest import TEST_DB_URL
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        chunk = DocumentChunk(
            document_id=uuid.UUID(doc_id),
            chunk_index=0,
            content="Climate change is accelerating. Global temperatures have risen by 1.1C.",
            token_count=15,
        )
        session.add(chunk)
        await session.commit()
        chunk_id = str(chunk.id)
    await engine.dispose()

    # 3. Configure mock vector store to return this chunk
    mock_vector_store.search.return_value = [
        {
            "id": chunk_id,
            "score": 0.92,
            "payload": {
                "document_id": doc_id,
                "chunk_index": 0,
                "chunk_id": chunk_id,
            },
        }
    ]

    # 4. Ask a question
    response = await client.post(
        "/api/v1/qa/ask",
        json={"question": "What is happening with climate?", "top_k": 3},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["answer"] == "Test answer from [Source 1]."
    assert len(data["sources"]) == 1
    assert data["sources"][0]["document_id"] == doc_id
    assert data["sources"][0]["score"] == 0.92
    assert data["token_usage"] == 150
    assert data["cost_usd"] > 0

    # Verify LLM was called with sequential citation
    call_args = mock_llm.chat_completion.call_args
    messages = call_args[0][0]
    assert "[Source 1]:" in messages[1]["content"]


@pytest.mark.asyncio
async def test_ask_stream_no_sources(client: AsyncClient):
    response = await client.post(
        "/api/v1/qa/ask/stream",
        json={"question": "Anything?", "top_k": 3},
    )
    assert response.status_code == 200
    body = response.text
    assert '"type": "sources"' in body
    assert '"type": "done"' in body
    assert "No relevant sources found" in body
