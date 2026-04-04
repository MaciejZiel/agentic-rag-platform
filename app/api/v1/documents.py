import uuid

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.database import get_db
from app.core.dependencies import get_llm_client, get_vector_store
from app.schemas.document import DocumentListOut, DocumentOut
from app.services.document_service import DocumentService

router = APIRouter()


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    service = DocumentService(db)
    return await service.upload(file)


@router.post("/{document_id}/index", response_model=DocumentOut)
async def index_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> DocumentOut:
    service = DocumentService(db)
    return await service.start_indexing(document_id, llm, vector_store)


@router.get("", response_model=DocumentListOut)
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> DocumentListOut:
    service = DocumentService(db)
    return await service.list_documents(skip=skip, limit=limit)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    service = DocumentService(db)
    return await service.get_document(document_id)
