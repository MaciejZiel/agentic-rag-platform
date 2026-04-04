from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import generate_api_key
from app.core.database import get_db
from app.models.tenant import ApiKey, Tenant

router = APIRouter()


class CreateTenantRequest(BaseModel):
    name: str


class TenantResponse(BaseModel):
    id: str
    name: str
    api_key: str  # Only returned on creation


@router.post("", response_model=TenantResponse, status_code=201)
async def create_tenant(
    request: CreateTenantRequest,
    db: AsyncSession = Depends(get_db),
) -> TenantResponse:
    tenant = Tenant(name=request.name)
    db.add(tenant)
    await db.flush()

    raw_key, key_prefix, key_hash = generate_api_key()
    api_key = ApiKey(
        tenant_id=tenant.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        label="default",
    )
    db.add(api_key)
    await db.commit()

    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        api_key=raw_key,
    )
