import hashlib
import secrets
import uuid

import jwt as pyjwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppError
from app.models.tenant import ApiKey, Tenant


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid or missing credentials") -> None:
        super().__init__(message=message, status_code=401)


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key. Returns (raw_key, key_prefix, key_hash)."""
    raw_key = f"rag_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:12]
    key_hash = hash_api_key(raw_key)
    return raw_key, key_prefix, key_hash


async def _resolve_tenant_from_api_key(api_key: str, db: AsyncSession) -> Tenant | None:
    """Look up tenant by API key hash."""
    key_hash = hash_api_key(api_key)
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    )
    api_key_obj = result.scalar_one_or_none()
    if not api_key_obj:
        return None

    result = await db.execute(
        select(Tenant).where(Tenant.id == api_key_obj.tenant_id, Tenant.is_active.is_(True))
    )
    return result.scalar_one_or_none()


async def _resolve_tenant_from_jwt(token: str, db: AsyncSession) -> Tenant | None:
    """Decode JWT and look up the tenant."""
    try:
        payload = pyjwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except pyjwt.InvalidTokenError:
        return None

    if payload.get("type") != "access":
        return None

    tenant_id_str = payload.get("tid")
    if not tenant_id_str:
        return None

    try:
        tenant_id = uuid.UUID(tenant_id_str)
    except ValueError:
        return None

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active.is_(True))
    )
    return result.scalar_one_or_none()


async def get_current_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Tenant | None:
    """
    Extract and validate credentials from request.
    Supports both:
      - Authorization: Bearer <JWT>
      - X-API-Key: <key>
    Returns None if no credentials provided (public access).
    """
    # Try JWT Bearer token first
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        tenant = await _resolve_tenant_from_jwt(token, db)
        if tenant:
            return tenant
        raise AuthenticationError("Invalid or expired token")

    # Fall back to API key
    api_key = request.headers.get("X-API-Key")
    if api_key:
        tenant = await _resolve_tenant_from_api_key(api_key, db)
        if tenant:
            return tenant
        raise AuthenticationError("Invalid API key")

    # No credentials — public access
    return None


async def require_tenant(
    tenant: Tenant | None = Depends(get_current_tenant),
) -> Tenant:
    """Require authentication — raises 401 if no valid credentials."""
    if tenant is None:
        raise AuthenticationError()
    return tenant


def get_tenant_id(tenant: Tenant | None) -> uuid.UUID | None:
    """Helper to extract tenant_id, returns None for public access."""
    return tenant.id if tenant else None
