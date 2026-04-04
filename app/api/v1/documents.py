import uuid

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.document import DocumentListOut, DocumentOut

router = APIRouter()


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    from app.services.document_service import DocumentService

    service = DocumentService(db)
    return await service.upload(file)


@router.post("/{document_id}/index", response_model=DocumentOut)
async def index_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    from app.services.document_service import DocumentService

    service = DocumentService(db)
    return await service.start_indexing(document_id)


@router.get("", response_model=DocumentListOut)
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> DocumentListOut:
    from app.services.document_service import DocumentService

    service = DocumentService(db)
    return await service.list_documents(skip=skip, limit=limit)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    from app.services.document_service import DocumentService

    service = DocumentService(db)
    return await service.get_document(document_id)
