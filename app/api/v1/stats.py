from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.document import Document
from app.models.query import ChatQuery, ExtractionRequest

router = APIRouter()


class PlatformStats(BaseModel):
    total_documents: int
    indexed_documents: int
    total_chunks: int
    total_queries: int
    total_extractions: int
    total_conversations: int
    total_tokens_used: int
    total_cost_usd: float
    recent_queries: list[dict]


@router.get("", response_model=PlatformStats)
async def get_stats(db: AsyncSession = Depends(get_db)) -> PlatformStats:
    # Document stats
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar_one()
    indexed_count = (await db.execute(
        select(func.count(Document.id)).where(Document.status == "indexed")
    )).scalar_one()
    chunk_sum = (await db.execute(
        select(func.coalesce(func.sum(Document.chunk_count), 0))
    )).scalar_one()

    # Query stats
    query_count = (await db.execute(select(func.count(ChatQuery.id)))).scalar_one()
    query_tokens = (await db.execute(
        select(func.coalesce(func.sum(ChatQuery.token_usage), 0))
    )).scalar_one()
    query_cost = (await db.execute(
        select(func.coalesce(func.sum(ChatQuery.cost_usd), 0.0))
    )).scalar_one()

    # Extraction stats
    extract_count = (await db.execute(select(func.count(ExtractionRequest.id)))).scalar_one()
    extract_tokens = (await db.execute(
        select(func.coalesce(func.sum(ExtractionRequest.token_usage), 0))
    )).scalar_one()
    extract_cost = (await db.execute(
        select(func.coalesce(func.sum(ExtractionRequest.cost_usd), 0.0))
    )).scalar_one()

    # Conversation stats
    conv_count = (await db.execute(select(func.count(Conversation.id)))).scalar_one()

    # Recent queries
    recent = (await db.execute(
        select(ChatQuery).order_by(ChatQuery.created_at.desc()).limit(5)
    )).scalars().all()

    return PlatformStats(
        total_documents=doc_count,
        indexed_documents=indexed_count,
        total_chunks=chunk_sum,
        total_queries=query_count,
        total_extractions=extract_count,
        total_conversations=conv_count,
        total_tokens_used=query_tokens + extract_tokens,
        total_cost_usd=float(query_cost) + float(extract_cost),
        recent_queries=[
            {
                "id": str(q.id),
                "question": q.question[:100],
                "model": q.model,
                "token_usage": q.token_usage,
                "cost_usd": q.cost_usd,
                "created_at": q.created_at.isoformat(),
            }
            for q in recent
        ],
    )
