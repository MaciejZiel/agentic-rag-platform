import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.exceptions import (
    FileTooLargeError,
    NotFoundError,
    UnsupportedFileTypeError,
    ValidationError,
)
from app.core.logging import get_logger
from app.models.document import Document, DocumentStatus
from app.repositories.document_repository import DocumentRepository
from app.schemas.document import DocumentListOut, DocumentOut
from app.utils.text_extraction import SUPPORTED_EXTENSIONS

logger = get_logger(__name__)


class DocumentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = DocumentRepository(db)

    async def upload(self, file: UploadFile, tenant_id: uuid.UUID | None = None) -> DocumentOut:
        if not file.filename:
            raise ValidationError("Filename is required")

        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise UnsupportedFileTypeError(ext)

        file_id = uuid.uuid4()
        file_path = settings.upload_dir / f"{file_id}{ext}"
        max_bytes = settings.max_upload_size_mb * 1024 * 1024

        # Stream to disk in chunks — never hold the full file in memory
        file_size = 0
        try:
            with file_path.open("wb") as f:
                while chunk := await file.read(1024 * 256):  # 256 KB chunks
                    file_size += len(chunk)
                    if file_size > max_bytes:
                        f.close()
                        file_path.unlink(missing_ok=True)
                        raise FileTooLargeError(settings.max_upload_size_mb)
                    f.write(chunk)
        except FileTooLargeError:
            raise
        except Exception:
            file_path.unlink(missing_ok=True)
            raise

        document = Document(
            id=file_id,
            tenant_id=tenant_id,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            file_path=str(file_path),
            status=DocumentStatus.UPLOADED,
        )
        document = await self.repo.create(document)
        await self.db.commit()
        logger.info("document_uploaded", document_id=str(document.id), filename=file.filename)
        return DocumentOut.model_validate(document)

    async def get_document(self, document_id: uuid.UUID) -> DocumentOut:
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", document_id)
        return DocumentOut.model_validate(doc)

    async def list_documents(
        self, skip: int = 0, limit: int = 20, tenant_id: uuid.UUID | None = None,
    ) -> DocumentListOut:
        docs = await self.repo.list_all(skip=skip, limit=limit, tenant_id=tenant_id)
        total = await self.repo.count(tenant_id=tenant_id)
        return DocumentListOut(
            documents=[DocumentOut.model_validate(d) for d in docs],
            total=total,
        )

    async def delete_document(
        self, document_id: uuid.UUID, vector_store: "VectorStoreClient",
    ) -> None:
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", document_id)

        # Clean up vectors from Qdrant
        vector_store.delete_by_document_id(document_id)

        # Delete file from disk
        file_path = Path(doc.file_path)
        file_path.unlink(missing_ok=True)

        # Delete document (cascades to chunks)
        await self.repo.delete_document(document_id)
        await self.db.commit()
        logger.info("document_deleted", document_id=str(document_id))

    async def start_indexing(
        self,
        document_id: uuid.UUID,
        llm: "LLMClient",
        vector_store: "VectorStoreClient",
    ) -> DocumentOut:
        from app.services.indexing_service import IndexingService

        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", document_id)

        if doc.status not in (DocumentStatus.UPLOADED, DocumentStatus.FAILED):
            raise ValidationError(
                f"Document is in '{doc.status}' state and cannot be re-indexed"
            )

        indexing = IndexingService(self.db, llm, vector_store)
        await indexing.index_document(document_id)
        await self.db.commit()

        logger.info("indexing_completed", document_id=str(document_id))
        doc = await self.repo.get_by_id(document_id)
        return DocumentOut.model_validate(doc)
