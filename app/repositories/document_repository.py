import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document, DocumentChunk


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, document: Document) -> Document:
        self.db.add(document)
        await self.db.flush()
        await self.db.refresh(document)
        return document

    async def get_by_id(self, document_id: uuid.UUID) -> Document | None:
        result = await self.db.execute(select(Document).where(Document.id == document_id))
        return result.scalar_one_or_none()

    async def get_with_chunks(self, document_id: uuid.UUID) -> Document | None:
        result = await self.db.execute(
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, skip: int = 0, limit: int = 20) -> list[Document]:
        result = await self.db.execute(
            select(Document).order_by(Document.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(Document.id)))
        return result.scalar_one()

    async def update_status(
        self, document_id: uuid.UUID, status: str, error_message: str | None = None
    ) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            doc.status = status
            if error_message is not None:
                doc.error_message = error_message
            await self.db.flush()

    async def set_chunk_count(self, document_id: uuid.UUID, count: int) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            doc.chunk_count = count
            await self.db.flush()

    async def create_chunks(self, chunks: list[DocumentChunk]) -> list[DocumentChunk]:
        self.db.add_all(chunks)
        await self.db.flush()
        return chunks

    async def get_chunks_by_document(self, document_id: uuid.UUID) -> list[DocumentChunk]:
        result = await self.db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index)
        )
        return list(result.scalars().all())

    async def get_chunks_by_ids(self, chunk_ids: list[uuid.UUID]) -> list[DocumentChunk]:
        result = await self.db.execute(
            select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids))
        )
        return list(result.scalars().all())
