"""Webhook delivery with exponential backoff retry.

Delivers webhook payloads to registered URLs with:
- HMAC-SHA256 signature if a secret is configured
- Up to MAX_RETRIES attempts with exponential backoff
- Structured logging for each attempt
"""

import asyncio
import hashlib
import hmac
import json
import uuid

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

MAX_RETRIES = 5
BASE_DELAY_SECONDS = 1.0    # 1s, 2s, 4s, 8s, 16s
TIMEOUT_SECONDS = 10


def _compute_signature(payload_bytes: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


async def deliver_webhook(
    url: str,
    event_type: str,
    payload: dict,
    secret: str | None = None,
    webhook_id: uuid.UUID | None = None,
) -> bool:
    """Deliver a webhook with retries. Returns True if delivered successfully."""
    payload_bytes = json.dumps(payload, default=str).encode()
    delivery_id = uuid.uuid4().hex[:12]

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event_type,
        "X-Delivery-Id": delivery_id,
    }
    if secret:
        headers["X-Webhook-Signature"] = f"sha256={_compute_signature(payload_bytes, secret)}"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                response = await client.post(url, content=payload_bytes, headers=headers)

            if 200 <= response.status_code < 300:
                logger.info(
                    "webhook_delivered",
                    delivery_id=delivery_id,
                    webhook_id=str(webhook_id) if webhook_id else None,
                    url=url,
                    event=event_type,
                    attempt=attempt,
                    status=response.status_code,
                )
                return True

            logger.warning(
                "webhook_delivery_failed",
                delivery_id=delivery_id,
                url=url,
                event=event_type,
                attempt=attempt,
                status=response.status_code,
            )

        except Exception as exc:
            logger.warning(
                "webhook_delivery_error",
                delivery_id=delivery_id,
                url=url,
                event=event_type,
                attempt=attempt,
                error=str(exc),
            )

        if attempt < MAX_RETRIES:
            delay = BASE_DELAY_SECONDS * (2 ** (attempt - 1))
            await asyncio.sleep(delay)

    logger.error(
        "webhook_delivery_exhausted",
        delivery_id=delivery_id,
        webhook_id=str(webhook_id) if webhook_id else None,
        url=url,
        event=event_type,
        max_retries=MAX_RETRIES,
    )
    return False


async def dispatch_event(
    db_session,  # AsyncSession
    event_type: str,
    payload: dict,
    tenant_id: uuid.UUID | None = None,
) -> None:
    """Find all matching webhooks and deliver the event to each."""
    from sqlalchemy import select
    from app.models.webhook import Webhook

    query = select(Webhook).where(Webhook.is_active.is_(True))
    if tenant_id:
        query = query.where(Webhook.tenant_id == tenant_id)

    result = await db_session.execute(query)
    webhooks = result.scalars().all()

    tasks = []
    for wh in webhooks:
        if wh.event_type == "*" or wh.event_type == event_type:
            tasks.append(
                deliver_webhook(
                    url=wh.url,
                    event_type=event_type,
                    payload=payload,
                    secret=wh.secret,
                    webhook_id=wh.id,
                )
            )

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
