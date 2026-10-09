import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.logging import get_logger
from app.models.document import DocumentChunk, DocumentStatus
from app.repositories.document_repository import DocumentRepository
from app.services.webhook_service import WebhookService
from app.utils.chunking import ChunkStrategy, chunk_text
from app.utils.text_extraction import extract_text

logger = get_logger(__name__)

EMBEDDING_BATCH_SIZE = 64


class IndexingService:
    def __init__(
        self, db: AsyncSession, llm: LLMClient, vector_store: VectorStoreClient
    ) -> None:
        self.db = db
        self.repo = DocumentRepository(db)
        self.llm = llm
        self.vector_store = vector_store

    async def index_document(
        self,
        document_id: uuid.UUID,
        strategy: ChunkStrategy = ChunkStrategy.FIXED_SIZE,
        max_tokens: int = 512,
        overlap_tokens: int = 50,
    ) -> None:
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            logger.error("document_not_found", document_id=str(document_id))
            return
        tenant_id = doc.tenant_id
        if tenant_id is None:
            # Vectors are only ever searched within a tenant, so an unowned
            # document could never be retrieved; refuse instead of indexing it.
            await self.repo.update_status(
                document_id, DocumentStatus.FAILED, error_message="Document has no owner tenant"
            )
            return

        try:
            await self.repo.update_status(document_id, DocumentStatus.PROCESSING)

            # Clean up previous indexing artifacts for idempotency
            deleted = await self.repo.delete_chunks_by_document(document_id)
            if deleted:
                self.vector_store.delete_by_document_id(document_id, tenant_id)
                logger.info("previous_index_cleaned", document_id=str(document_id), chunks_deleted=deleted)

            file_path = Path(doc.file_path)
            text = extract_text(file_path, doc.content_type)

            if not text.strip():
                await self.repo.update_status(
                    document_id, DocumentStatus.FAILED, error_message="No text extracted"
                )
                return

            raw_chunks = chunk_text(
                text, max_tokens=max_tokens, overlap_tokens=overlap_tokens, strategy=strategy,
            )

            db_chunks = [
                DocumentChunk(
                    document_id=document_id,
                    chunk_index=c["chunk_index"],
                    content=c["content"],
                    token_count=c["token_count"],
                )
                for c in raw_chunks
            ]
            await self.repo.create_chunks(db_chunks)
            await self.repo.set_chunk_count(document_id, len(db_chunks))

            # Generate embeddings in batches and upsert to vector store
            for batch_start in range(0, len(db_chunks), EMBEDDING_BATCH_SIZE):
                batch = db_chunks[batch_start : batch_start + EMBEDDING_BATCH_SIZE]
                texts = [c.content for c in batch]
                embeddings = await self.llm.create_embeddings(texts)

                ids = [str(c.id) for c in batch]
                payloads = [
                    {
                        "document_id": str(document_id),
                        "chunk_index": c.chunk_index,
                        "chunk_id": str(c.id),
                    }
                    for c in batch
                ]

                self.vector_store.upsert_vectors(ids, embeddings, payloads, tenant_id=tenant_id)

                for c in batch:
                    c.embedding_id = str(c.id)

            await self.db.flush()
            await self.repo.update_status(document_id, DocumentStatus.INDEXED)
            logger.info(
                "document_indexed",
                document_id=str(document_id),
                chunks=len(db_chunks),
            )

            # Fire webhook
            webhook_svc = WebhookService(self.db)
            await webhook_svc.fire_event("indexing.completed", tenant_id, {
                "document_id": str(document_id),
                "chunk_count": len(db_chunks),
            })

        except Exception as e:
            logger.error("indexing_failed", document_id=str(document_id), error=str(e))
            await self.repo.update_status(
                document_id, DocumentStatus.FAILED, error_message=str(e)
            )

            try:
                webhook_svc = WebhookService(self.db)
                await webhook_svc.fire_event("indexing.failed", tenant_id, {
                    "document_id": str(document_id),
                    "error": str(e),
                })
            except Exception:
                pass

            raise
