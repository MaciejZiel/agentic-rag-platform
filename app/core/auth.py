import hashlib
import secrets
import uuid

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppError
from app.models.tenant import ApiKey, Tenant


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid or missing API key") -> None:
        super().__init__(message=message, status_code=401)


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key. Returns (raw_key, key_prefix, key_hash)."""
    raw_key = f"rag_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:12]
    key_hash = hash_api_key(raw_key)
    return raw_key, key_prefix, key_hash


async def get_current_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Tenant | None:
    """Extract and validate API key from request. Returns None if no key provided (public access)."""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        return None

    key_hash = hash_api_key(api_key)
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    )
    api_key_obj = result.scalar_one_or_none()
    if not api_key_obj:
        raise AuthenticationError()

    result = await db.execute(
        select(Tenant).where(Tenant.id == api_key_obj.tenant_id, Tenant.is_active.is_(True))
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise AuthenticationError("Tenant is disabled")

    return tenant


async def require_tenant(
    tenant: Tenant | None = Depends(get_current_tenant),
) -> Tenant:
    """Require authentication — raises 401 if no valid API key."""
    if tenant is None:
        raise AuthenticationError()
    return tenant


def get_tenant_id(tenant: Tenant | None) -> uuid.UUID | None:
    """Helper to extract tenant_id, returns None for public access."""
    return tenant.id if tenant else None
