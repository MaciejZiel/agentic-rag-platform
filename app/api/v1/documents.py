import uuid

from fastapi import APIRouter, Depends, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.qdrant_client import VectorStoreClient
from app.core.auth import get_current_tenant, get_tenant_id, require_tenant
from app.core.rate_limit import limiter
from app.core.database import get_db
from app.core.dependencies import get_vector_store
from app.models.tenant import Tenant
from app.schemas.document import DocumentListOut, DocumentOut, IndexingJobOut, IndexRequest
from app.services.document_service import DocumentService

router = APIRouter()


@router.post("/upload", response_model=DocumentOut, status_code=201, summary="Upload document")
@limiter.limit("20/minute")
async def upload_document(
    request: Request,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> DocumentOut:
    service = DocumentService(db)
    return await service.upload(file, tenant_id=tenant.id)


@router.post(
    "/{document_id}/index",
    response_model=IndexingJobOut,
    status_code=202,
    summary="Queue document indexing",
)
@limiter.limit("10/minute")
async def index_document(
    request: Request,
    document_id: uuid.UUID,
    body: IndexRequest | None = None,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> IndexingJobOut:
    """Chunking and embedding run on the worker; poll GET /jobs/{job_id}."""
    req = body or IndexRequest()
    service = DocumentService(db)
    return await service.start_indexing(
        document_id,
        chunk_strategy=req.chunk_strategy,
        max_tokens=req.max_tokens,
        overlap_tokens=req.overlap_tokens,
        tenant_id=tenant.id,
    )


@router.get("", response_model=DocumentListOut, summary="List documents")
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> DocumentListOut:
    service = DocumentService(db)
    return await service.list_documents(
        skip=skip, limit=limit, tenant_id=tenant.id,
    )


@router.get("/{document_id}", response_model=DocumentOut, summary="Get document")
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> DocumentOut:
    service = DocumentService(db)
    return await service.get_document(document_id, tenant_id=tenant.id)


@router.get("/{document_id}/chunks", summary="Get document chunks")
async def get_document_chunks(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> list[dict]:
    from app.repositories.document_repository import DocumentRepository
    repo = DocumentRepository(db)
    # Verify document belongs to tenant
    doc = await repo.get_by_id(document_id)
    if not doc or doc.tenant_id != tenant.id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Document", document_id)
    chunks = await repo.get_chunks_by_document(document_id)
    return [
        {
            "id": str(c.id),
            "chunk_index": c.chunk_index,
            "content": c.content,
            "token_count": c.token_count,
            "created_at": c.created_at.isoformat(),
        }
        for c in chunks
    ]


@router.post("/{document_id}/preview-chunks", summary="Preview document chunking")
async def preview_chunks(
    document_id: uuid.UUID,
    request: IndexRequest | None = None,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> dict:
    """Preview how a document would be chunked without actually indexing it."""
    from pathlib import Path as _Path

    from app.utils.chunking import ChunkStrategy, chunk_text
    from app.utils.text_extraction import extract_text

    service = DocumentService(db)
    doc_out = await service.get_document(document_id, tenant_id=tenant.id)

    from app.repositories.document_repository import DocumentRepository
    repo = DocumentRepository(db)
    doc = await repo.get_by_id(document_id)
    file_path = _Path(doc.file_path)

    text = extract_text(file_path, doc.content_type)
    req = request or IndexRequest()
    strategy = ChunkStrategy(req.chunk_strategy)
    chunks = chunk_text(
        text,
        max_tokens=req.max_tokens,
        overlap_tokens=req.overlap_tokens,
        strategy=strategy,
    )
    return {
        "document_id": str(document_id),
        "filename": doc_out.filename,
        "strategy": req.chunk_strategy,
        "max_tokens": req.max_tokens,
        "overlap_tokens": req.overlap_tokens,
        "total_chunks": len(chunks),
        "chunks": [
            {
                "chunk_index": c["chunk_index"],
                "content": c["content"],
                "token_count": c["token_count"],
            }
            for c in chunks
        ],
    }


@router.delete("/{document_id}", status_code=204, summary="Delete document")
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> None:
    service = DocumentService(db)
    await service.delete_document(document_id, vector_store, tenant_id=tenant.id)
