import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_tenant
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.models.document import Document
from app.models.share_link import ShareLink
from app.models.tenant import Tenant

router = APIRouter()


class CreateShareLinkRequest(BaseModel):
    document_id: str
    expires_in_hours: int | None = 72


class ShareLinkOut(BaseModel):
    id: str
    document_id: str
    token: str
    expires_at: str | None
    is_active: bool
    created_at: str


class SharedDocumentOut(BaseModel):
    filename: str
    content_type: str
    file_size: int
    status: str
    chunk_count: int
    chunks: list[dict]


@router.post("", response_model=ShareLinkOut, status_code=201, summary="Create share link")
async def create_share_link(
    request: CreateShareLinkRequest,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> ShareLinkOut:
    doc_id = uuid.UUID(request.document_id)
    doc = (await db.execute(
        select(Document).where(Document.id == doc_id, Document.tenant_id == tenant.id)
    )).scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document", doc_id)

    token = secrets.token_urlsafe(32)
    expires_at = None
    if request.expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=request.expires_in_hours)

    link = ShareLink(
        document_id=doc_id,
        token=token,
        expires_at=expires_at,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    return ShareLinkOut(
        id=str(link.id),
        document_id=str(link.document_id),
        token=link.token,
        expires_at=link.expires_at.isoformat() if link.expires_at else None,
        is_active=link.is_active,
        created_at=link.created_at.isoformat(),
    )


@router.get("/{token}", response_model=SharedDocumentOut, summary="Access shared document")
async def get_shared_document(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> SharedDocumentOut:
    link = (await db.execute(
        select(ShareLink).where(ShareLink.token == token, ShareLink.is_active == True)
    )).scalar_one_or_none()

    if not link:
        raise NotFoundError("Share link", token)

    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise ValidationError("This share link has expired")

    doc = (await db.execute(
        select(Document).where(Document.id == link.document_id)
    )).scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document", link.document_id)

    from app.repositories.document_repository import DocumentRepository
    repo = DocumentRepository(db)
    chunks = await repo.get_chunks_by_document(doc.id)

    return SharedDocumentOut(
        filename=doc.filename,
        content_type=doc.content_type,
        file_size=doc.file_size,
        status=doc.status,
        chunk_count=doc.chunk_count,
        chunks=[
            {
                "chunk_index": c.chunk_index,
                "content": c.content,
                "token_count": c.token_count,
            }
            for c in chunks
        ],
    )


@router.delete("/{token}", status_code=204, summary="Revoke share link")
async def revoke_share_link(
    token: str,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> None:
    link = (await db.execute(
        select(ShareLink)
        .join(Document, Document.id == ShareLink.document_id)
        .where(ShareLink.token == token, Document.tenant_id == tenant.id)
    )).scalar_one_or_none()
    if not link:
        raise NotFoundError("Share link", token)

    link.is_active = False
    await db.commit()
