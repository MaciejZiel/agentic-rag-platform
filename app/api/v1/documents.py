import uuid

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.auth import get_current_tenant, get_tenant_id
from app.core.database import get_db
from app.core.dependencies import get_llm_client, get_vector_store
from app.models.tenant import Tenant
from app.schemas.document import DocumentListOut, DocumentOut, IndexRequest
from app.services.document_service import DocumentService

router = APIRouter()


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant | None = Depends(get_current_tenant),
) -> DocumentOut:
    service = DocumentService(db)
    return await service.upload(file, tenant_id=get_tenant_id(tenant))


@router.post("/{document_id}/index", response_model=DocumentOut)
async def index_document(
    document_id: uuid.UUID,
    request: IndexRequest | None = None,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> DocumentOut:
    req = request or IndexRequest()
    service = DocumentService(db)
    return await service.start_indexing(
        document_id, llm, vector_store,
        chunk_strategy=req.chunk_strategy,
        max_tokens=req.max_tokens,
        overlap_tokens=req.overlap_tokens,
    )


@router.get("", response_model=DocumentListOut)
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant | None = Depends(get_current_tenant),
) -> DocumentListOut:
    service = DocumentService(db)
    return await service.list_documents(
        skip=skip, limit=limit, tenant_id=get_tenant_id(tenant),
    )


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    service = DocumentService(db)
    return await service.get_document(document_id)


@router.get("/{document_id}/chunks")
async def get_document_chunks(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    from app.repositories.document_repository import DocumentRepository
    repo = DocumentRepository(db)
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


@router.post("/{document_id}/preview-chunks")
async def preview_chunks(
    document_id: uuid.UUID,
    request: IndexRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Preview how a document would be chunked without actually indexing it."""
    from pathlib import Path as _Path

    from app.utils.chunking import ChunkStrategy, chunk_text
    from app.utils.text_extraction import extract_text

    service = DocumentService(db)
    doc_out = await service.get_document(document_id)

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


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> None:
    service = DocumentService(db)
    await service.delete_document(document_id, vector_store)
