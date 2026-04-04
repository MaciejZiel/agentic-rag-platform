import hashlib
import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis: aioredis.Redis | None = None

DEFAULT_TTL = 3600  # 1 hour


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _cache_key(question: str, document_ids: list[str] | None, model: str) -> str:
    """Generate a deterministic cache key from query parameters."""
    parts = {
        "q": question.strip().lower(),
        "docs": sorted(document_ids) if document_ids else [],
        "model": model,
    }
    raw = json.dumps(parts, sort_keys=True)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"qa_cache:{digest}"


async def get_cached_answer(
    question: str, document_ids: list[str] | None, model: str,
) -> dict[str, Any] | None:
    try:
        r = get_redis()
        key = _cache_key(question, document_ids, model)
        data = await r.get(key)
        if data:
            logger.info("cache_hit", key=key)
            return json.loads(data)
    except Exception as e:
        logger.warning("cache_get_error", error=str(e))
    return None


async def set_cached_answer(
    question: str,
    document_ids: list[str] | None,
    model: str,
    answer_data: dict[str, Any],
    ttl: int = DEFAULT_TTL,
) -> None:
    try:
        r = get_redis()
        key = _cache_key(question, document_ids, model)
        await r.set(key, json.dumps(answer_data), ex=ttl)
        logger.info("cache_set", key=key, ttl=ttl)
    except Exception as e:
        logger.warning("cache_set_error", error=str(e))
