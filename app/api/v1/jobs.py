import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_tenant
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.tenant import Tenant
from app.schemas.job import JobCreateRequest, JobOut
from app.services.job_service import JobService

router = APIRouter()


@router.post("", response_model=JobOut, status_code=201, summary="Create job")
@limiter.limit("10/minute")
async def create_job(
    request: Request,
    body: JobCreateRequest,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> JobOut:
    service = JobService(db)
    return await service.create_job(body, tenant_id=tenant.id)


@router.get("/{job_id}", response_model=JobOut, summary="Get job status")
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_tenant),
) -> JobOut:
    service = JobService(db)
    return await service.get_job(job_id, tenant_id=tenant.id)
