import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_tenant_id, require_tenant
from app.core.database import get_db
from app.models.workflow import Workflow
from app.models.tenant import Tenant

router = APIRouter()


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=2000)
    definition: dict | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=2000)
    definition: dict | None = None
    status: str | None = Field(default=None, max_length=32)


class WorkflowOut(BaseModel):
    id: str
    name: str
    description: str | None
    definition: dict
    status: str
    created_at: str
    updated_at: str


class WorkflowListOut(BaseModel):
    workflows: list[WorkflowOut]
    total: int


def _to_out(w: Workflow) -> WorkflowOut:
    try:
        definition = json.loads(w.definition_json)
    except (json.JSONDecodeError, TypeError):
        definition = {}
    return WorkflowOut(
        id=str(w.id),
        name=w.name,
        description=w.description,
        definition=definition,
        status=w.status,
        created_at=w.created_at.isoformat(),
        updated_at=w.updated_at.isoformat(),
    )


@router.get("", response_model=WorkflowListOut, summary="List workflows")
async def list_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkflowListOut:
    tid = get_tenant_id(tenant)
    total = (await db.execute(
        select(func.count(Workflow.id)).where(Workflow.tenant_id == tid)
    )).scalar_one()
    result = await db.execute(
        select(Workflow)
        .where(Workflow.tenant_id == tid)
        .order_by(Workflow.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    workflows = result.scalars().all()
    return WorkflowListOut(
        workflows=[_to_out(w) for w in workflows],
        total=total,
    )


@router.post("", response_model=WorkflowOut, status_code=201, summary="Create workflow")
async def create_workflow(
    body: WorkflowCreate,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    tid = get_tenant_id(tenant)
    w = Workflow(
        tenant_id=tid,
        name=body.name,
        description=body.description,
        definition_json=json.dumps(body.definition or {"nodes": [], "edges": []}),
    )
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return _to_out(w)


@router.get("/{workflow_id}", response_model=WorkflowOut, summary="Get workflow")
async def get_workflow(
    workflow_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.tenant_id == tid)
    )
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _to_out(w)


@router.patch("/{workflow_id}", response_model=WorkflowOut, summary="Update workflow")
async def update_workflow(
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.tenant_id == tid)
    )
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if body.name is not None:
        w.name = body.name
    if body.description is not None:
        w.description = body.description
    if body.definition is not None:
        w.definition_json = json.dumps(body.definition)
    if body.status is not None:
        w.status = body.status

    await db.commit()
    await db.refresh(w)
    return _to_out(w)


@router.delete("/{workflow_id}", status_code=204, summary="Delete workflow")
async def delete_workflow(
    workflow_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.tenant_id == tid)
    )
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(w)
    await db.commit()
