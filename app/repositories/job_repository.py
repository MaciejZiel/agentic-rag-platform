import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job


class JobRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, job: Job) -> Job:
        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    async def get_by_id(self, job_id: uuid.UUID) -> Job | None:
        """Unscoped lookup, for the worker only; API code uses get_for_tenant."""
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        return result.scalar_one_or_none()

    async def get_for_tenant(self, job_id: uuid.UUID, tenant_id: uuid.UUID) -> Job | None:
        result = await self.db.execute(
            select(Job).where(Job.id == job_id, Job.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def update_status(
        self,
        job_id: uuid.UUID,
        status: str,
        result: str | None = None,
        error_message: str | None = None,
        token_usage: int = 0,
        cost_usd: float = 0.0,
    ) -> None:
        job = await self.get_by_id(job_id)
        if job:
            job.status = status
            if result is not None:
                job.result = result
            if error_message is not None:
                job.error_message = error_message
            job.token_usage = token_usage
            job.cost_usd = cost_usd
            await self.db.flush()
