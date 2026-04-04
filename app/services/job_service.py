import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.models.job import Job, JobStatus, JobType
from app.repositories.job_repository import JobRepository
from app.schemas.job import JobCreateRequest, JobOut

logger = get_logger(__name__)


class JobService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = JobRepository(db)

    async def create_job(self, request: JobCreateRequest) -> JobOut:
        valid_types = {t.value for t in JobType}
        if request.job_type not in valid_types:
            raise ValidationError(f"Invalid job type. Must be one of: {valid_types}")

        job = Job(
            job_type=request.job_type,
            status=JobStatus.PENDING,
            payload=json.dumps(request.payload),
        )
        job = await self.repo.create(job)
        await self.db.commit()

        # Dispatch to Celery after commit so the worker can read the job
        from app.workers.tasks import run_job_task

        run_job_task.delay(str(job.id))

        logger.info("job_created", job_id=str(job.id), job_type=request.job_type)
        return JobOut.model_validate(job)

    async def get_job(self, job_id: uuid.UUID) -> JobOut:
        job = await self.repo.get_by_id(job_id)
        if not job:
            raise NotFoundError("Job", job_id)
        return JobOut.model_validate(job)
