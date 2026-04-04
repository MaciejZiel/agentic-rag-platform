import hashlib
import hmac
import json
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.webhook import Webhook

logger = get_logger(__name__)


class WebhookService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def fire_event(self, event_type: str, payload: dict) -> None:
        """Fire webhook notifications for the given event type."""
        result = await self.db.execute(
            select(Webhook).where(
                Webhook.is_active.is_(True),
                (Webhook.event_type == event_type) | (Webhook.event_type == "*"),
            )
        )
        webhooks = list(result.scalars().all())

        if not webhooks:
            return

        body = json.dumps({
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        })

        async with httpx.AsyncClient(timeout=10) as client:
            for wh in webhooks:
                headers = {"Content-Type": "application/json"}
                if wh.secret:
                    sig = hmac.new(wh.secret.encode(), body.encode(), hashlib.sha256).hexdigest()
                    headers["X-Webhook-Signature"] = sig

                try:
                    resp = await client.post(wh.url, content=body, headers=headers)
                    logger.info(
                        "webhook_sent",
                        url=wh.url, event=event_type, status=resp.status_code,
                    )
                except Exception as e:
                    logger.error("webhook_failed", url=wh.url, event=event_type, error=str(e))
