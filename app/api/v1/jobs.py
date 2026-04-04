import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.job import JobCreateRequest, JobOut

router = APIRouter()


@router.post("", response_model=JobOut, status_code=201)
async def create_job(
    request: JobCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> JobOut:
    from app.services.job_service import JobService

    service = JobService(db)
    return await service.create_job(request)


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> JobOut:
    from app.services.job_service import JobService

    service = JobService(db)
    return await service.get_job(job_id)
