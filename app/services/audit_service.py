"""Lightweight audit logging service.

Usage:
    await audit(db, action="document.upload", resource_type="document",
                resource_id=str(doc.id), user_id=user.id, request=request)
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.logging import get_logger
from app.models.audit_log import AuditLog

logger = get_logger(__name__)


async def audit(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    detail: str | None = None,
    metadata: dict | None = None,
    tenant_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    request: Request | None = None,
) -> None:
    """Write one audit-log row. Fire-and-forget style — never raises."""
    try:
        ip = None
        ua = None
        if request:
            ip = request.client.host if request.client else None
            ua = request.headers.get("user-agent", "")[:512]

        entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            metadata_json=metadata,
            ip_address=ip,
            user_agent=ua,
        )
        db.add(entry)
        # We intentionally do NOT commit — the caller should commit as part
        # of the surrounding transaction so that the audit entry is atomic
        # with the action being audited.
    except Exception as exc:
        logger.error("audit_log_failed", action=action, error=str(exc))
