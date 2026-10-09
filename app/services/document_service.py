import hashlib
import json
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.clients.qdrant_client import VectorStoreClient
from app.core.exceptions import (
    FileTooLargeError,
    NotFoundError,
    ServiceUnavailableError,
    UnsupportedFileTypeError,
    ValidationError,
)
from app.core.logging import get_logger
from app.models.document import Document, DocumentStatus
from app.models.job import Job, JobStatus, JobType
from app.repositories.document_repository import DocumentRepository
from app.schemas.document import DocumentListOut, DocumentOut, IndexingJobOut
from app.utils.file_validation import validate_file_magic
from app.utils.text_extraction import SUPPORTED_EXTENSIONS

logger = get_logger(__name__)


class DocumentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = DocumentRepository(db)

    async def upload(self, file: UploadFile, tenant_id: uuid.UUID) -> DocumentOut:
        if not file.filename:
            raise ValidationError("Filename is required")

        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise UnsupportedFileTypeError(ext)

        file_id = uuid.uuid4()
        file_path = settings.upload_dir / f"{file_id}{ext}"
        # Don't rely on the app lifespan having created the directory.
        file_path.parent.mkdir(parents=True, exist_ok=True)
        max_bytes = settings.max_upload_size_mb * 1024 * 1024

        # Stream to disk in chunks — never hold the full file in memory
        file_size = 0
        sha256 = hashlib.sha256()
        try:
            with file_path.open("wb") as f:
                while chunk := await file.read(1024 * 256):  # 256 KB chunks
                    file_size += len(chunk)
                    if file_size > max_bytes:
                        f.close()
                        file_path.unlink(missing_ok=True)
                        raise FileTooLargeError(settings.max_upload_size_mb)
                    f.write(chunk)
                    sha256.update(chunk)
        except FileTooLargeError:
            raise
        except Exception:
            file_path.unlink(missing_ok=True)
            raise

        file_hash = sha256.hexdigest()

        # Validate magic bytes match file extension
        if not validate_file_magic(file_path, ext):
            file_path.unlink(missing_ok=True)
            raise ValidationError(
                f"File content does not match the '{ext}' format. The file may be corrupted or have a wrong extension."
            )

        # Check for duplicate file within the same tenant
        existing = (await self.db.execute(
            select(Document).where(
                Document.file_hash == file_hash,
                Document.tenant_id == tenant_id,
            )
        )).scalar_one_or_none()
        if existing:
            file_path.unlink(missing_ok=True)
            raise ValidationError(
                f"Duplicate file detected: '{existing.filename}' has the same content"
            )

        document = Document(
            id=file_id,
            tenant_id=tenant_id,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            file_path=str(file_path),
            file_hash=file_hash,
            status=DocumentStatus.UPLOADED,
        )
        document = await self.repo.create(document)
        await self.db.commit()
        logger.info("document_uploaded", document_id=str(document.id), filename=file.filename)
        return DocumentOut.model_validate(document)

    async def get_owned(self, document_id: uuid.UUID, tenant_id: uuid.UUID) -> Document:
        """Return the document if it belongs to ``tenant_id``, else raise 404.

        A foreign document is reported exactly like a missing one so that
        callers cannot probe other tenants' document ids.
        """
        doc = await self.repo.get_by_id(document_id)
        if doc is None or doc.tenant_id != tenant_id:
            raise NotFoundError("Document", document_id)
        return doc

    async def get_document(
        self, document_id: uuid.UUID, tenant_id: uuid.UUID,
    ) -> DocumentOut:
        doc = await self.get_owned(document_id, tenant_id)
        return DocumentOut.model_validate(doc)

    async def list_documents(
        self, *, tenant_id: uuid.UUID, skip: int = 0, limit: int = 20,
    ) -> DocumentListOut:
        docs = await self.repo.list_all(skip=skip, limit=limit, tenant_id=tenant_id)
        total = await self.repo.count(tenant_id=tenant_id)
        return DocumentListOut(
            documents=[DocumentOut.model_validate(d) for d in docs],
            total=total,
        )

    async def delete_document(
        self, document_id: uuid.UUID, vector_store: "VectorStoreClient",
        tenant_id: uuid.UUID,
    ) -> None:
        doc = await self.get_owned(document_id, tenant_id)

        # Clean up vectors from Qdrant
        vector_store.delete_by_document_id(document_id, tenant_id)

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
        chunk_strategy: str = "fixed_size",
        max_tokens: int = 512,
        overlap_tokens: int = 50,
        *,
        tenant_id: uuid.UUID,
    ) -> IndexingJobOut:
        """Queue chunking and embedding of a document on the Celery worker.

        The document is marked ``processing`` and an ``index_document`` job is
        recorded; clients poll ``GET /jobs/{job_id}`` (or the document) for
        the outcome instead of holding the request open while embedding.
        """
        from app.utils.chunking import ChunkStrategy

        doc = await self.get_owned(document_id, tenant_id)

        if doc.status not in (DocumentStatus.UPLOADED, DocumentStatus.FAILED):
            raise ValidationError(
                f"Document is in '{doc.status}' state and cannot be re-indexed"
            )
        try:
            ChunkStrategy(chunk_strategy)
        except ValueError:
            raise ValidationError(f"Unknown chunk strategy '{chunk_strategy}'") from None

        job = Job(
            tenant_id=tenant_id,
            job_type=JobType.INDEX_DOCUMENT,
            status=JobStatus.PENDING,
            payload=json.dumps({
                "document_id": str(document_id),
                "chunk_strategy": chunk_strategy,
                "max_tokens": max_tokens,
                "overlap_tokens": overlap_tokens,
            }),
        )
        self.db.add(job)
        doc.status = DocumentStatus.PROCESSING
        doc.error_message = None
        await self.db.commit()

        # Dispatch only after commit so the worker can see the job row.
        from app.workers.tasks import run_job_task

        try:
            run_job_task.delay(str(job.id))
        except Exception as e:
            logger.error("indexing_dispatch_failed", document_id=str(document_id), error=str(e))
            message = "Indexing queue is unavailable; try again later."
            job.status = JobStatus.FAILED
            job.error_message = message
            doc.status = DocumentStatus.FAILED
            doc.error_message = message
            await self.db.commit()
            raise ServiceUnavailableError(message) from e

        logger.info("indexing_queued", document_id=str(document_id), job_id=str(job.id))
        await self.db.refresh(doc)
        return IndexingJobOut(
            job_id=job.id, status=job.status, document=DocumentOut.model_validate(doc),
        )
