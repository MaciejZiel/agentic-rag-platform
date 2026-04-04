import json
import uuid
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient, estimate_cost
from app.clients.qdrant_client import VectorStoreClient
from app.core.cache import get_cached_answer, set_cached_answer
from app.core.config import settings
from app.core.logging import get_logger
from app.models.conversation import Conversation, ConversationMessage
from app.models.query import ChatQuery
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.query_repository import QueryRepository
from app.schemas.qa import AskRequest, AskResponse, SourceCitation

logger = get_logger(__name__)

MAX_HISTORY_MESSAGES = 10  # last N messages to include as context


class QAService:
    def __init__(
        self, db: AsyncSession, llm: LLMClient, vector_store: VectorStoreClient
    ) -> None:
        self.db = db
        self.llm = llm
        self.vector_store = vector_store
        self.doc_repo = DocumentRepository(db)
        self.query_repo = QueryRepository(db)
        self.conv_repo = ConversationRepository(db)

    async def _get_or_create_conversation(
        self, conversation_id: uuid.UUID | None,
    ) -> Conversation:
        if conversation_id:
            conv = await self.conv_repo.get_by_id(conversation_id)
            if conv:
                return conv
        conv = Conversation(title="New conversation")
        return await self.conv_repo.create(conv)

    def _build_history_messages(self, conversation: Conversation) -> list[dict[str, str]]:
        """Build chat history from conversation messages (last N)."""
        msgs = conversation.messages or []
        recent = msgs[-MAX_HISTORY_MESSAGES:]
        return [{"role": m.role, "content": m.content} for m in recent]

    async def ask(self, request: AskRequest) -> AskResponse:
        model = request.model or settings.chat_model
        doc_ids_str = [str(d) for d in request.document_ids] if request.document_ids else None

        # Check cache (only for new conversations without history)
        if not request.conversation_id:
            cached = await get_cached_answer(request.question, doc_ids_str, model)
            if cached:
                return AskResponse(**cached)

        # Conversation handling
        conv = await self._get_or_create_conversation(request.conversation_id)

        # Embed the question
        query_embeddings = await self.llm.create_embeddings([request.question])
        query_vector = query_embeddings[0]

        # Search vector store
        results = self.vector_store.search(
            query_vector=query_vector,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )

        if not results:
            logger.info("qa_no_sources", question=request.question[:100])
            return AskResponse(
                answer="No relevant sources found for this question.",
                sources=[],
                model=model,
                token_usage=0,
                cost_usd=0.0,
                conversation_id=conv.id,
            )

        # Fetch chunk contents from DB
        chunk_ids = [uuid.UUID(r["payload"]["chunk_id"]) for r in results]
        chunks = await self.doc_repo.get_chunks_by_ids(chunk_ids)
        chunk_map = {str(c.id): c for c in chunks}

        # Build context with sequential numbering to reduce citation hallucination
        context_parts: list[str] = []
        sources: list[SourceCitation] = []
        for idx, r in enumerate(results, start=1):
            chunk = chunk_map.get(r["payload"]["chunk_id"])
            if not chunk:
                continue
            context_parts.append(f"[Source {idx}]: {chunk.content}")
            sources.append(
                SourceCitation(
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content[:500],
                    score=r["score"],
                )
            )

        context = "\n\n".join(context_parts)

        # Build messages with history
        messages: list[dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that answers questions based on the provided "
                    "context. Always cite your sources using [Source N] notation. If the context "
                    "doesn't contain enough information, say so clearly."
                ),
            },
        ]
        messages.extend(self._build_history_messages(conv))
        messages.append({
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {request.question}",
        })

        answer, prompt_tokens, completion_tokens = await self.llm.chat_completion(
            messages, model=model,
        )
        total_tokens = prompt_tokens + completion_tokens
        cost = estimate_cost(model, prompt_tokens, completion_tokens)

        # Save messages to conversation
        position = len(conv.messages) if conv.messages else 0
        await self.conv_repo.add_message(ConversationMessage(
            conversation_id=conv.id, role="user", content=request.question, position=position,
        ))
        source_json = json.dumps([s.model_dump(mode="json") for s in sources])
        await self.conv_repo.add_message(ConversationMessage(
            conversation_id=conv.id, role="assistant", content=answer,
            position=position + 1, model=model, token_usage=total_tokens,
            source_chunks_json=source_json,
        ))

        # Persist the query
        doc_ids_json = json.dumps([str(s.document_id) for s in sources])
        chat_query = ChatQuery(
            question=request.question,
            answer=answer,
            document_ids=doc_ids_json,
            source_chunks=source_json,
            model=model,
            token_usage=total_tokens,
            cost_usd=cost,
        )
        await self.query_repo.create_chat_query(chat_query)
        await self.db.commit()

        logger.info("qa_completed", tokens=total_tokens, sources=len(sources))
        response = AskResponse(
            answer=answer,
            sources=sources,
            model=model,
            token_usage=total_tokens,
            cost_usd=cost,
            conversation_id=conv.id,
        )

        # Cache the result
        await set_cached_answer(
            request.question, doc_ids_str, model, response.model_dump(mode="json"),
        )

        return response

    async def ask_stream(self, request: AskRequest) -> AsyncGenerator[str, None]:
        model = request.model or settings.chat_model

        # Conversation handling
        conv = await self._get_or_create_conversation(request.conversation_id)

        # Embed and search
        query_embeddings = await self.llm.create_embeddings([request.question])
        query_vector = query_embeddings[0]

        results = self.vector_store.search(
            query_vector=query_vector,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )

        if not results:
            yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'content': 'No relevant sources found for this question.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': str(conv.id)})}\n\n"
            return

        chunk_ids = [uuid.UUID(r["payload"]["chunk_id"]) for r in results]
        chunks = await self.doc_repo.get_chunks_by_ids(chunk_ids)
        chunk_map = {str(c.id): c for c in chunks}

        context_parts: list[str] = []
        sources: list[dict] = []
        for idx, r in enumerate(results, start=1):
            chunk = chunk_map.get(r["payload"]["chunk_id"])
            if not chunk:
                continue
            context_parts.append(f"[Source {idx}]: {chunk.content}")
            sources.append({
                "document_id": str(chunk.document_id),
                "chunk_index": chunk.chunk_index,
                "score": r["score"],
            })

        context = "\n\n".join(context_parts)

        # Build messages with history
        messages: list[dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that answers questions based on the provided "
                    "context. Always cite your sources using [Source N] notation."
                ),
            },
        ]
        messages.extend(self._build_history_messages(conv))
        messages.append({
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {request.question}",
        })

        # Send sources first as SSE event
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        # Stream the answer
        answer = ""
        async for token in self.llm.chat_completion_stream(messages, model=model):
            answer += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # Save to conversation after streaming completes
        position = len(conv.messages) if conv.messages else 0
        await self.conv_repo.add_message(ConversationMessage(
            conversation_id=conv.id, role="user", content=request.question, position=position,
        ))
        await self.conv_repo.add_message(ConversationMessage(
            conversation_id=conv.id, role="assistant", content=answer,
            position=position + 1, model=model,
        ))
        await self.db.commit()

        yield f"data: {json.dumps({'type': 'done', 'conversation_id': str(conv.id)})}\n\n"
