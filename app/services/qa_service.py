import json
import uuid
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient, estimate_cost
from app.clients.qdrant_client import VectorStoreClient
from app.core.config import settings
from app.core.logging import get_logger
from app.models.query import ChatQuery
from app.repositories.document_repository import DocumentRepository
from app.repositories.query_repository import QueryRepository
from app.schemas.qa import AskRequest, AskResponse, SourceCitation

logger = get_logger(__name__)


class QAService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.llm = LLMClient()
        self.vector_store = VectorStoreClient()
        self.doc_repo = DocumentRepository(db)
        self.query_repo = QueryRepository(db)

    async def ask(self, request: AskRequest) -> AskResponse:
        # Embed the question
        query_embeddings = await self.llm.create_embeddings([request.question])
        query_vector = query_embeddings[0]

        # Search vector store
        results = self.vector_store.search(
            query_vector=query_vector,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )

        # Fetch chunk contents from DB
        chunk_ids = [uuid.UUID(r["payload"]["chunk_id"]) for r in results]
        chunks = await self.doc_repo.get_chunks_by_ids(chunk_ids)
        chunk_map = {str(c.id): c for c in chunks}

        # Build context and sources
        context_parts: list[str] = []
        sources: list[SourceCitation] = []
        for r in results:
            chunk = chunk_map.get(r["payload"]["chunk_id"])
            if not chunk:
                continue
            context_parts.append(f"[Source {chunk.chunk_index}]: {chunk.content}")
            sources.append(
                SourceCitation(
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content[:500],
                    score=r["score"],
                )
            )

        context = "\n\n".join(context_parts)

        # Generate answer
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that answers questions based on the provided "
                    "context. Always cite your sources using [Source N] notation. If the context "
                    "doesn't contain enough information, say so clearly."
                ),
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {request.question}",
            },
        ]

        answer, prompt_tokens, completion_tokens = await self.llm.chat_completion(messages)
        total_tokens = prompt_tokens + completion_tokens
        cost = estimate_cost(settings.chat_model, prompt_tokens, completion_tokens)

        # Persist the query
        doc_ids_json = json.dumps([str(s.document_id) for s in sources])
        source_json = json.dumps([s.model_dump(mode="json") for s in sources])
        chat_query = ChatQuery(
            question=request.question,
            answer=answer,
            document_ids=doc_ids_json,
            source_chunks=source_json,
            model=settings.chat_model,
            token_usage=total_tokens,
            cost_usd=cost,
        )
        await self.query_repo.create_chat_query(chat_query)

        logger.info("qa_completed", tokens=total_tokens, sources=len(sources))
        return AskResponse(
            answer=answer,
            sources=sources,
            model=settings.chat_model,
            token_usage=total_tokens,
            cost_usd=cost,
        )

    async def ask_stream(self, request: AskRequest) -> AsyncGenerator[str, None]:
        # Embed and search
        query_embeddings = await self.llm.create_embeddings([request.question])
        query_vector = query_embeddings[0]

        results = self.vector_store.search(
            query_vector=query_vector,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )

        chunk_ids = [uuid.UUID(r["payload"]["chunk_id"]) for r in results]
        chunks = await self.doc_repo.get_chunks_by_ids(chunk_ids)
        chunk_map = {str(c.id): c for c in chunks}

        context_parts: list[str] = []
        sources: list[dict] = []
        for r in results:
            chunk = chunk_map.get(r["payload"]["chunk_id"])
            if not chunk:
                continue
            context_parts.append(f"[Source {chunk.chunk_index}]: {chunk.content}")
            sources.append({
                "document_id": str(chunk.document_id),
                "chunk_index": chunk.chunk_index,
                "score": r["score"],
            })

        context = "\n\n".join(context_parts)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that answers questions based on the provided "
                    "context. Always cite your sources using [Source N] notation."
                ),
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {request.question}",
            },
        ]

        # Send sources first as SSE event
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        # Stream the answer
        async for token in self.llm.chat_completion_stream(messages):
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"
