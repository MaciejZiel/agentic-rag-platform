import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.query import ChatQuery, ExtractionRequest


class QueryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_chat_query(self, query: ChatQuery) -> ChatQuery:
        self.db.add(query)
        await self.db.flush()
        await self.db.refresh(query)
        return query

    async def get_chat_query(self, query_id: uuid.UUID) -> ChatQuery | None:
        result = await self.db.execute(select(ChatQuery).where(ChatQuery.id == query_id))
        return result.scalar_one_or_none()

    async def create_extraction(self, extraction: ExtractionRequest) -> ExtractionRequest:
        self.db.add(extraction)
        await self.db.flush()
        await self.db.refresh(extraction)
        return extraction

    async def get_extraction(self, extraction_id: uuid.UUID) -> ExtractionRequest | None:
        result = await self.db.execute(
            select(ExtractionRequest).where(ExtractionRequest.id == extraction_id)
        )
        return result.scalar_one_or_none()
