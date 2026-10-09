import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_tenant_id, require_tenant
from app.core.database import get_db
from app.models.assistant import Assistant
from app.models.tenant import Tenant

router = APIRouter()


class AssistantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=2000)
    system_prompt: str = Field(min_length=1, max_length=10000)
    model: str = Field(default="openai/gpt-4o-mini", max_length=128)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    icon: str = Field(default="bot", max_length=8)


class AssistantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=2000)
    system_prompt: str | None = Field(default=None, min_length=1, max_length=10000)
    model: str | None = Field(default=None, max_length=128)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    icon: str | None = Field(default=None, max_length=8)


class AssistantOut(BaseModel):
    id: str
    name: str
    description: str | None
    system_prompt: str
    model: str
    temperature: float
    icon: str
    created_at: str
    updated_at: str


class AssistantListOut(BaseModel):
    assistants: list[AssistantOut]
    total: int


def _to_out(a: Assistant) -> AssistantOut:
    return AssistantOut(
        id=str(a.id),
        name=a.name,
        description=a.description,
        system_prompt=a.system_prompt,
        model=a.model,
        temperature=a.temperature,
        icon=a.icon,
        created_at=a.created_at.isoformat(),
        updated_at=a.updated_at.isoformat(),
    )


@router.get("", response_model=AssistantListOut, summary="List assistants")
async def list_assistants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> AssistantListOut:
    tid = get_tenant_id(tenant)
    total = (await db.execute(
        select(func.count(Assistant.id)).where(Assistant.tenant_id == tid)
    )).scalar_one()
    result = await db.execute(
        select(Assistant)
        .where(Assistant.tenant_id == tid)
        .order_by(Assistant.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    assistants = result.scalars().all()
    return AssistantListOut(
        assistants=[_to_out(a) for a in assistants],
        total=total,
    )


@router.post("", response_model=AssistantOut, status_code=201, summary="Create assistant")
async def create_assistant(
    body: AssistantCreate,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> AssistantOut:
    tid = get_tenant_id(tenant)
    a = Assistant(
        tenant_id=tid,
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
        model=body.model,
        temperature=body.temperature,
        icon=body.icon,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return _to_out(a)


@router.get("/{assistant_id}", response_model=AssistantOut, summary="Get assistant")
async def get_assistant(
    assistant_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> AssistantOut:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Assistant).where(Assistant.id == assistant_id, Assistant.tenant_id == tid)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return _to_out(a)


@router.patch("/{assistant_id}", response_model=AssistantOut, summary="Update assistant")
async def update_assistant(
    assistant_id: uuid.UUID,
    body: AssistantUpdate,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> AssistantOut:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Assistant).where(Assistant.id == assistant_id, Assistant.tenant_id == tid)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assistant not found")

    for field in ("name", "description", "system_prompt", "model", "temperature", "icon"):
        val = getattr(body, field)
        if val is not None:
            setattr(a, field, val)

    await db.commit()
    await db.refresh(a)
    return _to_out(a)


@router.delete("/{assistant_id}", status_code=204, summary="Delete assistant")
async def delete_assistant(
    assistant_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Assistant).where(Assistant.id == assistant_id, Assistant.tenant_id == tid)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assistant not found")
    await db.delete(a)
    await db.commit()
