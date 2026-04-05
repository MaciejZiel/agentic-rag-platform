import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_tenant_id, require_tenant
from app.core.database import get_db
from app.models.notification import Notification
from app.models.tenant import Tenant

router = APIRouter()


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    kind: str
    is_read: bool
    link: str | None
    created_at: str


class NotificationListOut(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> NotificationListOut:
    tid = get_tenant_id(tenant)
    result = await db.execute(
        select(Notification)
        .where(Notification.tenant_id == tid)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()

    unread = (await db.execute(
        select(func.count(Notification.id))
        .where(Notification.tenant_id == tid, Notification.is_read.is_(False))
    )).scalar_one()

    return NotificationListOut(
        notifications=[
            NotificationOut(
                id=str(n.id),
                title=n.title,
                message=n.message,
                kind=n.kind,
                is_read=n.is_read,
                link=n.link,
                created_at=n.created_at.isoformat(),
            )
            for n in notifications
        ],
        unread_count=unread,
    )


@router.post("/read-all", status_code=204)
async def mark_all_read(
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    tid = get_tenant_id(tenant)
    await db.execute(
        update(Notification)
        .where(Notification.tenant_id == tid, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()


@router.post("/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: uuid.UUID,
    tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    tid = get_tenant_id(tenant)
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.tenant_id == tid)
        .values(is_read=True)
    )
    await db.commit()


async def create_notification(
    db: AsyncSession,
    tenant_id: uuid.UUID | None,
    title: str,
    message: str,
    kind: str = "info",
    link: str | None = None,
) -> Notification:
    """Helper to create a notification from other services."""
    n = Notification(
        tenant_id=tenant_id,
        title=title,
        message=message,
        kind=kind,
        link=link,
    )
    db.add(n)
    await db.flush()
    return n
