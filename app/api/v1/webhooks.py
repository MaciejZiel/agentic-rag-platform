import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_tenant, get_tenant_id
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.tenant import Tenant
from app.models.webhook import Webhook

router = APIRouter()


class WebhookCreate(BaseModel):
    url: str
    event_type: str = Field(default="*", description="Event type filter or * for all")
    secret: str | None = None


class WebhookOut(BaseModel):
    id: uuid.UUID
    url: str
    event_type: str
    is_active: bool

    model_config = {"from_attributes": True}


@router.post("", response_model=WebhookOut, status_code=201)
async def create_webhook(
    request: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant | None = Depends(get_current_tenant),
) -> WebhookOut:
    wh = Webhook(
        tenant_id=get_tenant_id(tenant),
        url=request.url,
        event_type=request.event_type,
        secret=request.secret,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return WebhookOut.model_validate(wh)


@router.get("", response_model=list[WebhookOut])
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    tenant: Tenant | None = Depends(get_current_tenant),
) -> list[WebhookOut]:
    query = select(Webhook).where(Webhook.is_active.is_(True))
    tid = get_tenant_id(tenant)
    if tid:
        query = query.where(Webhook.tenant_id == tid)
    result = await db.execute(query)
    return [WebhookOut.model_validate(w) for w in result.scalars().all()]


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    wh = result.scalar_one_or_none()
    if not wh:
        raise NotFoundError("Webhook", webhook_id)
    await db.delete(wh)
    await db.commit()
