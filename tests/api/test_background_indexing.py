"""Indexing runs as a background job: the API queues it, the worker executes it."""

import asyncio
import io
import json
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.exceptions import ExternalServiceError
from app.models.document import Document, DocumentStatus
from app.models.job import Job, JobStatus, JobType
from app.models.tenant import Tenant
from tests.conftest import TEST_DB_URL

# ─── API: queueing ───────────────────────────────────────────────


async def _upload(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/v1/documents/upload",
        files={"file": (f"{uuid.uuid4().hex}.txt", io.BytesIO(uuid.uuid4().bytes * 8), "text/plain")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_index_request_queues_a_job_and_returns_immediately(
    client: AsyncClient, mock_llm: MagicMock, mock_vector_store: MagicMock,
):
    doc_id = await _upload(client)
    with patch("app.workers.tasks.run_job_task") as task:
        resp = await client.post(
            f"/api/v1/documents/{doc_id}/index",
            json={"chunk_strategy": "sentence", "max_tokens": 256, "overlap_tokens": 20},
        )

    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "pending"
    assert body["document"]["status"] == "processing"
    task.delay.assert_called_once_with(body["job_id"])
    # Nothing was embedded inside the request.
    mock_llm.create_embeddings.assert_not_called()
    mock_vector_store.upsert_vectors.assert_not_called()

    job = await client.get(f"/api/v1/jobs/{body['job_id']}")
    assert job.status_code == 200
    assert job.json()["job_type"] == "index_document"

    doc = await client.get(f"/api/v1/documents/{doc_id}")
    assert doc.json()["status"] == "processing"


@pytest.mark.asyncio
async def test_document_already_being_indexed_is_not_queued_twice(client: AsyncClient):
    doc_id = await _upload(client)
    with patch("app.workers.tasks.run_job_task") as task:
        first = await client.post(f"/api/v1/documents/{doc_id}/index")
        second = await client.post(f"/api/v1/documents/{doc_id}/index")
    assert first.status_code == 202
    assert second.status_code == 422
    assert task.delay.call_count == 1


@pytest.mark.asyncio
async def test_unknown_chunk_strategy_is_rejected_before_queueing(client: AsyncClient):
    doc_id = await _upload(client)
    with patch("app.workers.tasks.run_job_task") as task:
        resp = await client.post(
            f"/api/v1/documents/{doc_id}/index", json={"chunk_strategy": "nope"},
        )
    assert resp.status_code == 422
    task.delay.assert_not_called()


@pytest.mark.asyncio
async def test_unreachable_queue_fails_the_document_with_503(client: AsyncClient):
    doc_id = await _upload(client)
    with patch("app.workers.tasks.run_job_task") as task:
        task.delay.side_effect = ConnectionError("broker down")
        resp = await client.post(f"/api/v1/documents/{doc_id}/index")
    assert resp.status_code == 503

    doc = (await client.get(f"/api/v1/documents/{doc_id}")).json()
    assert doc["status"] == "failed"
    assert "queue" in doc["error_message"].lower()


# ─── Worker: executing the job ───────────────────────────────────
# The Celery task runs its own event loop, so these tests are synchronous and
# talk to the SQLite test database through a NullPool engine.


def _run(coro):
    # Not asyncio.run(): that would reset the main thread's event loop, which
    # the async tests in the same session still use.
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _session_factory():
    engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
    return async_sessionmaker(engine, expire_on_commit=False)


def _seed(tmp_path: Path, text: str) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    path = tmp_path / f"{uuid.uuid4().hex}.txt"
    path.write_text(text)
    tenant_id, doc_id, job_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

    async def seed():
        async with _session_factory()() as s:
            s.add(Tenant(id=tenant_id, name="worker"))
            s.add(Document(
                id=doc_id, tenant_id=tenant_id, filename=path.name, content_type="text/plain",
                file_size=len(text), file_path=str(path), status=DocumentStatus.PROCESSING,
            ))
            s.add(Job(
                id=job_id, tenant_id=tenant_id, job_type=JobType.INDEX_DOCUMENT,
                status=JobStatus.PENDING,
                payload=json.dumps({
                    "document_id": str(doc_id), "chunk_strategy": "paragraph",
                    "max_tokens": 64, "overlap_tokens": 0,
                }),
            ))
            await s.commit()

    _run(seed())
    return tenant_id, doc_id, job_id


def _load(doc_id: uuid.UUID, job_id: uuid.UUID) -> tuple[Document, Job]:
    async def load():
        async with _session_factory()() as s:
            return await s.get(Document, doc_id), await s.get(Job, job_id)

    return _run(load())


def _run_worker(job_id: uuid.UUID, llm: MagicMock, store: MagicMock):
    from app.workers.tasks import run_job_task

    with (
        patch("app.core.database.async_session_factory", _session_factory()),
        patch("app.core.dependencies.get_llm_client", return_value=llm),
        patch("app.core.dependencies.get_vector_store", return_value=store),
    ):
        return run_job_task(str(job_id))


def _fakes() -> tuple[MagicMock, MagicMock]:
    llm = MagicMock(spec=LLMClient)
    llm.create_embeddings = AsyncMock(side_effect=lambda texts: [[0.1] * 4 for _ in texts])
    store = MagicMock(spec=VectorStoreClient)
    return llm, store


def test_worker_indexes_document_and_completes_job(tmp_path: Path):
    tenant_id, doc_id, job_id = _seed(tmp_path, "First paragraph.\n\nSecond paragraph.")
    llm, store = _fakes()

    assert _run_worker(job_id, llm, store)["status"] == "completed"

    doc, job = _load(doc_id, job_id)
    assert doc.status == DocumentStatus.INDEXED
    assert doc.chunk_count >= 1
    assert job.status == JobStatus.COMPLETED
    assert json.loads(job.result)["chunk_count"] == doc.chunk_count
    assert store.upsert_vectors.call_args.kwargs["tenant_id"] == tenant_id


def test_worker_marks_job_failed_without_retry_when_document_has_no_text(tmp_path: Path):
    _, doc_id, job_id = _seed(tmp_path, "   ")
    llm, store = _fakes()

    assert _run_worker(job_id, llm, store)["status"] == "failed"

    doc, job = _load(doc_id, job_id)
    assert doc.status == DocumentStatus.FAILED
    assert job.status == JobStatus.FAILED
    assert job.error_message == "No text extracted"


def test_worker_records_failure_and_rolls_back_partial_chunks(tmp_path: Path):
    _, doc_id, job_id = _seed(tmp_path, "Some text that will fail to embed.")
    llm, store = _fakes()
    llm.create_embeddings = AsyncMock(side_effect=ExternalServiceError("OpenRouter", "boom"))

    with pytest.raises(ExternalServiceError):  # Celery would schedule a retry
        _run_worker(job_id, llm, store)

    doc, job = _load(doc_id, job_id)
    assert doc.status == DocumentStatus.FAILED
    assert doc.chunk_count == 0
    assert job.status == JobStatus.FAILED
    assert "boom" in job.error_message
