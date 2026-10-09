from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.auth import require_tenant
from app.core.database import get_db
from app.core.dependencies import get_llm_client, get_vector_store
from app.core.rate_limit import limiter
from app.models.query import ChatQuery
from app.models.tenant import Tenant
from app.schemas.qa import AskRequest, AskResponse
from app.services.qa_service import QAService

router = APIRouter()


@router.get("/history", summary="Get query history")
async def get_query_history(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> list[dict]:
    from sqlalchemy import select
    result = await db.execute(
        select(ChatQuery)
        .where(ChatQuery.tenant_id == tenant.id)
        .order_by(ChatQuery.created_at.desc())
        .offset(skip).limit(limit)
    )
    return [
        {
            "id": str(q.id),
            "question": q.question,
            "answer": q.answer,
            "model": q.model,
            "token_usage": q.token_usage,
            "cost_usd": q.cost_usd,
            "created_at": q.created_at.isoformat(),
        }
        for q in result.scalars().all()
    ]


@router.post("/ask", response_model=AskResponse, summary="Ask question (RAG)")
@limiter.limit("30/minute")
async def ask_question(
    request: Request,
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> AskResponse:
    service = QAService(db, llm, vector_store, tenant_id=tenant.id)
    return await service.ask(body)


@router.post("/ask/stream", summary="Ask question (streaming)")
@limiter.limit("30/minute")
async def ask_question_stream(
    request: Request,
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> StreamingResponse:
    service = QAService(db, llm, vector_store, tenant_id=tenant.id)
    stream = await service.ask_stream(body)
    return StreamingResponse(stream, media_type="text/event-stream")
