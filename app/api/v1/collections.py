import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_tenant_id, require_tenant
from app.core.database import get_db
from app.models.collection import Collection, collection_documents
from app.models.document import Document
from app.models.tenant import Tenant
from app.schemas.collection import (
    CollectionCreate,
    CollectionListOut,
    CollectionOut,
    CollectionUpdate,
)

router = APIRouter()


def _to_out(c: Collection) -> CollectionOut:
    return CollectionOut(
        id=str(c.id),
        name=c.name,
        description=c.description,
        color=c.color,
        document_count=len(c.documents),
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


@router.get("", response_model=CollectionListOut, summary="List collections")
async def list_collections(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> CollectionListOut:
    tid = get_tenant_id(tenant)
    total = (await db.execute(
        select(func.count(Collection.id)).where(Collection.tenant_id == tid)
    )).scalar_one()
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.documents))
        .where(Collection.tenant_id == tid)
        .order_by(Collection.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    collections = result.scalars().all()
    return CollectionListOut(
        collections=[_to_out(c) for c in collections],
        total=total,
    )


@router.post("", response_model=CollectionOut, status_code=201, summary="Create collection")
async def create_collection(
    body: CollectionCreate,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> CollectionOut:
    tid = get_tenant_id(tenant)
    c = Collection(
        tenant_id=tid,
        name=body.name,
        description=body.description,
        color=body.color,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c, attribute_names=["documents"])
    return _to_out(c)


@router.get("/{collection_id}", response_model=CollectionOut, summary="Get collection")
async def get_collection(
    collection_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> CollectionOut:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.documents))
        .where(Collection.id == collection_id, Collection.tenant_id == tid)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    return _to_out(c)


@router.patch("/{collection_id}", response_model=CollectionOut, summary="Update collection")
async def update_collection(
    collection_id: uuid.UUID,
    body: CollectionUpdate,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> CollectionOut:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.documents))
        .where(Collection.id == collection_id, Collection.tenant_id == tid)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")

    if body.name is not None:
        c.name = body.name
    if body.description is not None:
        c.description = body.description
    if body.color is not None:
        c.color = body.color

    await db.commit()
    await db.refresh(c, attribute_names=["documents"])
    return _to_out(c)


@router.delete("/{collection_id}", status_code=204, summary="Delete collection")
async def delete_collection(
    collection_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id, Collection.tenant_id == tid)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    await db.delete(c)
    await db.commit()


@router.post(
    "/{collection_id}/documents/{document_id}",
    status_code=204,
    summary="Add document to collection",
)
async def add_document_to_collection(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    tid = get_tenant_id(tenant)
    # Verify collection belongs to tenant
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id, Collection.tenant_id == tid)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Collection not found")

    # The document must belong to the same tenant as the collection
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == tid)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    await db.execute(
        collection_documents.insert().values(
            collection_id=collection_id, document_id=document_id
        )
    )
    await db.commit()


@router.delete(
    "/{collection_id}/documents/{document_id}",
    status_code=204,
    summary="Remove document from collection",
)
async def remove_document_from_collection(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id, Collection.tenant_id == tid)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Collection not found")

    await db.execute(
        delete(collection_documents).where(
            collection_documents.c.collection_id == collection_id,
            collection_documents.c.document_id == document_id,
        )
    )
    await db.commit()
