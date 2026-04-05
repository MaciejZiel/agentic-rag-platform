from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Shallow health check for load balancer probes."""
    return {"status": "ok"}


@router.get("/health/deep")
async def deep_health_check(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Deep health check — verifies database, Redis, and Qdrant connectivity."""
    checks: dict[str, dict[str, str]] = {}

    # PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        logger.error("health_check_db_failed", error=str(e))
        checks["database"] = {"status": "error", "detail": str(e)[:200]}

    # Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=3)
        await r.ping()
        await r.aclose()
        checks["redis"] = {"status": "ok"}
    except Exception as e:
        logger.error("health_check_redis_failed", error=str(e))
        checks["redis"] = {"status": "error", "detail": str(e)[:200]}

    # Qdrant
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(
                f"http://{settings.qdrant_host}:{settings.qdrant_port}/healthz"
            )
            if resp.status_code == 200:
                checks["qdrant"] = {"status": "ok"}
            else:
                checks["qdrant"] = {"status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.error("health_check_qdrant_failed", error=str(e))
        checks["qdrant"] = {"status": "error", "detail": str(e)[:200]}

    all_ok = all(c["status"] == "ok" for c in checks.values())

    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }
