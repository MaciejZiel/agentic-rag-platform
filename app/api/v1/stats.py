from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import cast, func, select, Date
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


class DailyStats(BaseModel):
    date: str
    queries: int
    tokens: int
    cost: float
    extractions: int


class ModelBreakdown(BaseModel):
    model: str
    queries: int
    tokens: int
    cost: float


class DocumentStatusBreakdown(BaseModel):
    status: str
    count: int


class DashboardTimeseries(BaseModel):
    daily: list[DailyStats]
    by_model: list[ModelBreakdown]
    by_status: list[DocumentStatusBreakdown]


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


@router.get("/timeseries", response_model=DashboardTimeseries)
async def get_stats_timeseries(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
) -> DashboardTimeseries:
    """Aggregated stats for dashboard charts."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    date_col = cast(ChatQuery.created_at, Date)
    ext_date_col = cast(ExtractionRequest.created_at, Date)

    # Daily query stats
    query_daily = (await db.execute(
        select(
            date_col.label("date"),
            func.count(ChatQuery.id).label("queries"),
            func.coalesce(func.sum(ChatQuery.token_usage), 0).label("tokens"),
            func.coalesce(func.sum(ChatQuery.cost_usd), 0.0).label("cost"),
        )
        .where(ChatQuery.created_at >= since)
        .group_by(date_col)
        .order_by(date_col)
    )).all()

    # Daily extraction stats
    ext_daily = (await db.execute(
        select(
            ext_date_col.label("date"),
            func.count(ExtractionRequest.id).label("extractions"),
        )
        .where(ExtractionRequest.created_at >= since)
        .group_by(ext_date_col)
    )).all()

    ext_map = {str(row.date): row.extractions for row in ext_daily}

    # Fill in all days in range
    daily: list[DailyStats] = []
    query_map = {str(row.date): row for row in query_daily}
    today = datetime.now(timezone.utc).date()
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        ds = str(d)
        row = query_map.get(ds)
        daily.append(DailyStats(
            date=ds,
            queries=row.queries if row else 0,
            tokens=int(row.tokens) if row else 0,
            cost=float(row.cost) if row else 0.0,
            extractions=ext_map.get(ds, 0),
        ))

    # Model breakdown
    model_rows = (await db.execute(
        select(
            ChatQuery.model,
            func.count(ChatQuery.id).label("queries"),
            func.coalesce(func.sum(ChatQuery.token_usage), 0).label("tokens"),
            func.coalesce(func.sum(ChatQuery.cost_usd), 0.0).label("cost"),
        )
        .group_by(ChatQuery.model)
        .order_by(func.count(ChatQuery.id).desc())
    )).all()

    by_model = [
        ModelBreakdown(
            model=row.model,
            queries=row.queries,
            tokens=int(row.tokens),
            cost=float(row.cost),
        )
        for row in model_rows
    ]

    # Document status breakdown
    status_rows = (await db.execute(
        select(
            Document.status,
            func.count(Document.id).label("count"),
        )
        .group_by(Document.status)
    )).all()

    by_status = [
        DocumentStatusBreakdown(status=row.status, count=row.count)
        for row in status_rows
    ]

    return DashboardTimeseries(
        daily=daily,
        by_model=by_model,
        by_status=by_status,
    )


class RateLimitStatus(BaseModel):
    queries_used: int
    queries_limit: int
    tokens_used: int
    tokens_limit: int
    extractions_used: int
    extractions_limit: int
    window_minutes: int
    resets_at: str


@router.get("/rate-limits", response_model=RateLimitStatus)
async def get_rate_limit_status(
    db: AsyncSession = Depends(get_db),
) -> RateLimitStatus:
    """Current usage within the rate limit window."""
    window_minutes = 60
    window_start = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    reset_time = window_start + timedelta(minutes=window_minutes * 2)

    queries_used = (await db.execute(
        select(func.count(ChatQuery.id)).where(ChatQuery.created_at >= window_start)
    )).scalar_one()

    tokens_used = (await db.execute(
        select(func.coalesce(func.sum(ChatQuery.token_usage), 0))
        .where(ChatQuery.created_at >= window_start)
    )).scalar_one()

    extractions_used = (await db.execute(
        select(func.count(ExtractionRequest.id))
        .where(ExtractionRequest.created_at >= window_start)
    )).scalar_one()

    return RateLimitStatus(
        queries_used=queries_used,
        queries_limit=100,
        tokens_used=int(tokens_used),
        tokens_limit=500_000,
        extractions_used=extractions_used,
        extractions_limit=50,
        window_minutes=window_minutes,
        resets_at=reset_time.isoformat(),
    )
