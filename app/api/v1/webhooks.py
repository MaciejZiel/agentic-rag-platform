import uuid
from ipaddress import ip_address
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_tenant
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.tenant import Tenant
from app.models.webhook import Webhook

router = APIRouter()

# Private/reserved IP ranges that webhooks must not target
_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def _is_private_ip(host: str) -> bool:
    try:
        return ip_address(host).is_private
    except ValueError:
        return host.lower() in _BLOCKED_HOSTS


class WebhookCreate(BaseModel):
    url: str
    event_type: str = Field(default="*", description="Event type filter or * for all")
    secret: str | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        parsed = urlparse(v)
        if parsed.scheme not in ("https", "http"):
            raise ValueError("Webhook URL must use http or https scheme")
        if not parsed.hostname:
            raise ValueError("Webhook URL must have a valid hostname")
        if _is_private_ip(parsed.hostname):
            raise ValueError("Webhook URL must not point to a private/internal address")
        return v


class WebhookOut(BaseModel):
    id: uuid.UUID
    url: str
    event_type: str
    is_active: bool

    model_config = {"from_attributes": True}


@router.post("", response_model=WebhookOut, status_code=201, summary="Create webhook")
async def create_webhook(
    request: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> WebhookOut:
    wh = Webhook(
        tenant_id=tenant.id,
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
    tenant: Tenant = Depends(require_tenant),
) -> list[WebhookOut]:
    query = select(Webhook).where(
        Webhook.is_active.is_(True),
        Webhook.tenant_id == tenant.id,
    )
    result = await db.execute(query)
    return [WebhookOut.model_validate(w) for w in result.scalars().all()]


@router.delete("/{webhook_id}", status_code=204, summary="Delete webhook")
async def delete_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> None:
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.tenant_id == tenant.id)
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise NotFoundError("Webhook", webhook_id)
    await db.delete(wh)
    await db.commit()
