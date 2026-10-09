"""Tenant A must never read, search, modify or count tenant B's data.

These tests authenticate with real API keys (no ``require_tenant`` override),
so the full credential -> tenant resolution path is exercised.
"""

import io
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.auth import generate_api_key
from app.core.cache import _cache_key
from app.core.database import get_db
from app.core.dependencies import get_llm_client, get_vector_store
from app.main import create_app
from app.models.document import DocumentChunk
from app.models.share_link import ShareLink
from app.models.tenant import ApiKey, Tenant
from app.models.user import User
from app.models.webhook import Webhook
from app.services.webhook_service import WebhookService


@dataclass
class Actor:
    tenant: Tenant
    headers: dict[str, str]


async def _make_actor(db: AsyncSession, name: str) -> Actor:
    tenant = Tenant(id=uuid.uuid4(), name=name, is_active=True)
    raw_key, prefix, key_hash = generate_api_key()
    db.add(tenant)
    db.add(ApiKey(tenant_id=tenant.id, key_hash=key_hash, key_prefix=prefix, label="test"))
    await db.commit()
    return Actor(tenant=tenant, headers={"X-API-Key": raw_key})


@pytest.fixture
async def actors(db_session: AsyncSession) -> tuple[Actor, Actor]:
    return await _make_actor(db_session, "Tenant A"), await _make_actor(db_session, "Tenant B")


@pytest.fixture
async def api(
    db_session: AsyncSession, mock_llm: LLMClient, mock_vector_store: VectorStoreClient,
) -> AsyncGenerator[AsyncClient, None]:
    """Client with real authentication; only storage and LLM are faked."""
    app = create_app()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_llm_client] = lambda: mock_llm
    app.dependency_overrides[get_vector_store] = lambda: mock_vector_store
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def _upload(api: AsyncClient, actor: Actor, text: bytes = b"Quarterly revenue grew.") -> str:
    resp = await api.post(
        "/api/v1/documents/upload",
        headers=actor.headers,
        files={"file": (f"{uuid.uuid4().hex}.txt", io.BytesIO(text + uuid.uuid4().bytes.hex().encode()), "text/plain")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _add_chunk(db: AsyncSession, document_id: str, content: str) -> str:
    chunk = DocumentChunk(
        document_id=uuid.UUID(document_id), chunk_index=0, content=content, token_count=5,
    )
    db.add(chunk)
    await db.commit()
    return str(chunk.id)


def _hit(document_id: str, chunk_id: str) -> list[dict]:
    return [{
        "id": chunk_id,
        "score": 0.9,
        "payload": {"document_id": document_id, "chunk_index": 0, "chunk_id": chunk_id},
    }]


# ─── Documents and everything that reads a document ─────────────


@pytest.mark.asyncio
async def test_documents_of_other_tenant_are_invisible(api: AsyncClient, actors):
    a, b = actors
    doc_id = await _upload(api, a)

    listing = await api.get("/api/v1/documents", headers=b.headers)
    assert doc_id not in {d["id"] for d in listing.json()["documents"]}

    for method, path in [
        ("GET", f"/api/v1/documents/{doc_id}"),
        ("GET", f"/api/v1/documents/{doc_id}/chunks"),
        ("POST", f"/api/v1/documents/{doc_id}/preview-chunks"),
        ("POST", f"/api/v1/documents/{doc_id}/index"),
        ("DELETE", f"/api/v1/documents/{doc_id}"),
    ]:
        resp = await api.request(method, path, headers=b.headers)
        assert resp.status_code == 404, (method, path, resp.status_code)

    # Still there for its owner.
    assert (await api.get(f"/api/v1/documents/{doc_id}", headers=a.headers)).status_code == 200


@pytest.mark.asyncio
async def test_other_tenants_document_cannot_be_extracted_compared_shared_or_collected(
    api: AsyncClient, actors,
):
    a, b = actors
    doc_a = await _upload(api, a)
    doc_b = await _upload(api, b)

    extract = await api.post(
        "/api/v1/extract/json",
        headers=b.headers,
        json={"document_id": doc_a, "schema_definition": {"type": "object"}},
    )
    assert extract.status_code == 404

    compare = await api.post(
        "/api/v1/compare",
        headers=b.headers,
        json={"document_id_a": doc_b, "document_id_b": doc_a},
    )
    assert compare.status_code == 404

    share = await api.post("/api/v1/share", headers=b.headers, json={"document_id": doc_a})
    assert share.status_code == 404

    collection = await api.post("/api/v1/collections", headers=b.headers, json={"name": "B"})
    add = await api.post(
        f"/api/v1/collections/{collection.json()['id']}/documents/{doc_a}", headers=b.headers,
    )
    assert add.status_code == 404


@pytest.mark.asyncio
async def test_extraction_requires_authentication(api: AsyncClient, actors):
    a, _ = actors
    doc_a = await _upload(api, a)
    resp = await api.post(
        "/api/v1/extract/json",
        json={"document_id": doc_a, "schema_definition": {"type": "object"}},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_share_link_cannot_be_revoked_by_other_tenant(
    api: AsyncClient, actors, db_session: AsyncSession,
):
    a, b = actors
    doc_a = await _upload(api, a)
    link = await api.post("/api/v1/share", headers=a.headers, json={"document_id": doc_a})
    token = link.json()["token"]

    assert (await api.delete(f"/api/v1/share/{token}", headers=b.headers)).status_code == 404
    link_row = (await db_session.execute(
        select(ShareLink).where(ShareLink.token == token)
    )).scalar_one()
    await db_session.refresh(link_row)
    assert link_row.is_active is True
    assert (await api.delete(f"/api/v1/share/{token}", headers=a.headers)).status_code == 204


@pytest.mark.asyncio
async def test_jobs_are_scoped_to_tenant(api: AsyncClient, actors):
    a, b = actors
    doc_a = await _upload(api, a)
    with patch("app.workers.tasks.run_job_task") as task:
        task.delay = MagicMock()
        foreign = await api.post(
            "/api/v1/jobs",
            headers=b.headers,
            json={"job_type": "extract_json", "payload": {"document_id": doc_a}},
        )
        own = await api.post(
            "/api/v1/jobs",
            headers=a.headers,
            json={"job_type": "index_document", "payload": {"document_id": doc_a}},
        )
    assert foreign.status_code == 404
    assert own.status_code == 201
    job_id = own.json()["id"]
    assert (await api.get(f"/api/v1/jobs/{job_id}", headers=b.headers)).status_code == 404
    assert (await api.get(f"/api/v1/jobs/{job_id}", headers=a.headers)).status_code == 200


# ─── Retrieval (Q&A) ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vector_search_is_filtered_by_callers_tenant(
    api: AsyncClient, actors, mock_vector_store: MagicMock,
):
    _, b = actors
    await api.post("/api/v1/qa/ask", headers=b.headers, json={"question": "revenue?"})
    assert mock_vector_store.search.call_args.kwargs["tenant_id"] == b.tenant.id


@pytest.mark.asyncio
async def test_foreign_chunks_are_dropped_even_if_vector_store_returns_them(
    api: AsyncClient, actors, db_session: AsyncSession, mock_vector_store: MagicMock,
    mock_llm: MagicMock,
):
    """Defence in depth: chunk rows are loaded only from the caller's documents."""
    a, b = actors
    doc_a = await _upload(api, a)
    chunk_a = await _add_chunk(db_session, doc_a, "Tenant A secret: launch date is May 3.")
    mock_vector_store.search.return_value = _hit(doc_a, chunk_a)
    mock_llm.chat_completion.reset_mock()

    resp = await api.post("/api/v1/qa/ask", headers=b.headers, json={"question": "launch?"})

    assert resp.status_code == 200
    assert resp.json()["sources"] == []
    for call in mock_llm.chat_completion.call_args_list:
        assert "launch date" not in str(call)


@pytest.mark.asyncio
async def test_conversations_are_private_to_tenant(
    api: AsyncClient, actors, db_session: AsyncSession, mock_vector_store: MagicMock,
):
    a, b = actors
    doc_a = await _upload(api, a)
    chunk_a = await _add_chunk(db_session, doc_a, "Tenant A only content.")
    mock_vector_store.search.return_value = _hit(doc_a, chunk_a)

    asked = await api.post("/api/v1/qa/ask", headers=a.headers, json={"question": "what?"})
    conv_id = asked.json()["conversation_id"]

    a_list = await api.get("/api/v1/conversations", headers=a.headers)
    assert conv_id in {c["id"] for c in a_list.json()["conversations"]}
    b_list = await api.get("/api/v1/conversations", headers=b.headers)
    assert conv_id not in {c["id"] for c in b_list.json()["conversations"]}

    assert (await api.get(f"/api/v1/conversations/{conv_id}", headers=b.headers)).status_code == 404
    assert (await api.delete(f"/api/v1/conversations/{conv_id}", headers=b.headers)).status_code == 404

    # B cannot append to (or read the history of) A's conversation through Q&A.
    for path in ("/api/v1/qa/ask", "/api/v1/qa/ask/stream"):
        resp = await api.post(
            path, headers=b.headers, json={"question": "repeat", "conversation_id": conv_id},
        )
        assert resp.status_code == 404, path

    conv = await api.get(f"/api/v1/conversations/{conv_id}", headers=a.headers)
    assert len(conv.json()["messages"]) == 2

    history_b = await api.get("/api/v1/qa/history", headers=b.headers)
    assert history_b.status_code == 200
    assert history_b.json() == []
    history_a = await api.get("/api/v1/qa/history", headers=a.headers)
    assert len(history_a.json()) == 1


@pytest.mark.asyncio
async def test_new_conversation_without_sources_can_be_continued(api: AsyncClient, actors):
    a, _ = actors
    first = await api.post("/api/v1/qa/ask", headers=a.headers, json={"question": "hello?"})
    conv_id = first.json()["conversation_id"]
    again = await api.post(
        "/api/v1/qa/ask", headers=a.headers, json={"question": "again?", "conversation_id": conv_id},
    )
    assert again.status_code == 200


def test_answer_cache_key_includes_tenant():
    a = _cache_key(str(uuid.uuid4()), "same question", None, "m")
    b = _cache_key(str(uuid.uuid4()), "same question", None, "m")
    assert a != b


# ─── Statistics and admin overview ───────────────────────────────


@pytest.mark.asyncio
async def test_stats_only_count_callers_tenant(
    api: AsyncClient, actors, db_session: AsyncSession, mock_vector_store: MagicMock,
):
    a, b = actors
    doc_a = await _upload(api, a)
    chunk_a = await _add_chunk(db_session, doc_a, "Numbers.")
    mock_vector_store.search.return_value = _hit(doc_a, chunk_a)
    await api.post("/api/v1/qa/ask", headers=a.headers, json={"question": "numbers?"})

    stats_a = (await api.get("/api/v1/stats", headers=a.headers)).json()
    assert stats_a["total_documents"] == 1
    assert stats_a["total_queries"] == 1
    assert stats_a["total_conversations"] == 1
    assert stats_a["total_tokens_used"] == 150

    stats_b = (await api.get("/api/v1/stats", headers=b.headers)).json()
    assert stats_b["total_documents"] == 0
    assert stats_b["total_queries"] == 0
    assert stats_b["total_conversations"] == 0
    assert stats_b["total_tokens_used"] == 0
    assert stats_b["recent_queries"] == []

    series_b = (await api.get("/api/v1/stats/timeseries?days=3", headers=b.headers)).json()
    assert series_b["by_model"] == []
    assert series_b["by_status"] == []
    assert sum(d["queries"] for d in series_b["daily"]) == 0
    series_a = (await api.get("/api/v1/stats/timeseries?days=3", headers=a.headers)).json()
    assert sum(d["queries"] for d in series_a["daily"]) == 1

    limits_b = (await api.get("/api/v1/stats/rate-limits", headers=b.headers)).json()
    assert limits_b["queries_used"] == 0


@pytest.mark.asyncio
async def test_admin_overview_and_audit_logs_are_tenant_scoped(
    api: AsyncClient, actors, db_session: AsyncSession,
):
    a, b = actors
    db_session.add(User(
        email=f"{uuid.uuid4().hex}@a.example", password_hash="x", full_name="Alice",
        tenant_id=a.tenant.id,
    ))
    await db_session.commit()
    await _upload(api, a)

    overview_b = (await api.get("/api/v1/admin/overview", headers=b.headers)).json()
    assert overview_b["stats"]["total_users"] == 0
    assert overview_b["stats"]["total_documents"] == 0
    assert overview_b["recent_users"] == []
    assert "total_tenants" not in overview_b["stats"]

    overview_a = (await api.get("/api/v1/admin/overview", headers=a.headers)).json()
    assert overview_a["stats"]["total_users"] == 1
    assert overview_a["stats"]["total_documents"] == 1


# ─── Webhooks and the vector store client ────────────────────────


@pytest.mark.asyncio
async def test_indexing_webhooks_only_reach_the_owning_tenant(
    db_session: AsyncSession, actors,
):
    a, b = actors
    db_session.add_all([
        Webhook(tenant_id=a.tenant.id, url="https://a.example/hook", event_type="*"),
        Webhook(tenant_id=b.tenant.id, url="https://b.example/hook", event_type="*"),
    ])
    await db_session.commit()

    post = AsyncMock()
    with patch("httpx.AsyncClient.post", post):
        await WebhookService(db_session).fire_event(
            "indexing.completed", a.tenant.id, {"document_id": "x"},
        )
    urls = {call.args[0] for call in post.call_args_list}
    assert urls == {"https://a.example/hook"}


def _store_with_fake_qdrant() -> tuple[VectorStoreClient, MagicMock]:
    store = VectorStoreClient.__new__(VectorStoreClient)
    store.client = MagicMock()
    store.client.query_points.return_value = MagicMock(points=[])
    store.collection = "documents"
    return store, store.client


def _must_values(query_filter) -> dict[str, object]:
    out = {}
    for cond in query_filter.must:
        match = cond.match
        out[cond.key] = getattr(match, "value", None) or getattr(match, "any", None)
    return out


def test_qdrant_search_always_filters_on_tenant():
    store, qdrant = _store_with_fake_qdrant()
    tenant_id, doc_id = uuid.uuid4(), uuid.uuid4()

    store.search([0.1], tenant_id=tenant_id)
    assert _must_values(qdrant.query_points.call_args.kwargs["query_filter"]) == {
        "tenant_id": str(tenant_id),
    }

    store.search([0.1], tenant_id=tenant_id, document_ids=[doc_id])
    assert _must_values(qdrant.query_points.call_args.kwargs["query_filter"]) == {
        "tenant_id": str(tenant_id),
        "document_id": [str(doc_id)],
    }


def test_qdrant_upsert_and_delete_carry_tenant():
    store, qdrant = _store_with_fake_qdrant()
    tenant_id, doc_id = uuid.uuid4(), uuid.uuid4()

    store.upsert_vectors(
        [str(uuid.uuid4())], [[0.1]], [{"document_id": str(doc_id)}], tenant_id=tenant_id,
    )
    point = qdrant.upsert.call_args.kwargs["points"][0]
    assert point.payload["tenant_id"] == str(tenant_id)

    store.delete_by_document_id(doc_id, tenant_id)
    selector = qdrant.delete.call_args.kwargs["points_selector"]
    assert _must_values(selector) == {"tenant_id": str(tenant_id), "document_id": str(doc_id)}


def test_qdrant_collection_gets_tenant_payload_index():
    qdrant = MagicMock()
    qdrant.get_collections.return_value = MagicMock(collections=[])
    with patch("app.clients.qdrant_client.QdrantClient", return_value=qdrant):
        VectorStoreClient()
    kwargs = qdrant.create_payload_index.call_args.kwargs
    assert kwargs["field_name"] == "tenant_id"
    assert kwargs["field_schema"].is_tenant is True
