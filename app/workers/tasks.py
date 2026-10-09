import asyncio
import json
import uuid

from app.core.logging import get_logger
from app.workers.celery_app import celery

logger = get_logger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task.

    Every task gets a fresh event loop, but the SQLAlchemy engine is a
    process-wide singleton: its pooled asyncpg connections are bound to the
    loop that opened them. Dispose of the pool before closing the loop so the
    next task in this worker process does not reuse a dead connection.
    """
    from app.core.database import engine

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.run_until_complete(engine.dispose())
        loop.close()


@celery.task(name="index_document", bind=True, max_retries=2)
def index_document_task(self, document_id: str) -> dict:
    from app.core.database import async_session_factory
    from app.services.indexing_service import IndexingService

    logger.info("task_index_start", document_id=document_id)

    async def _run():
        from app.core.dependencies import get_llm_client, get_vector_store

        async with async_session_factory() as session:
            service = IndexingService(session, get_llm_client(), get_vector_store())
            await service.index_document(uuid.UUID(document_id))
            await session.commit()

    try:
        _run_async(_run())
        return {"status": "completed", "document_id": document_id}
    except Exception as exc:
        logger.error("task_index_failed", document_id=document_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30)


class PermanentJobError(Exception):
    """A failure that retrying cannot fix (e.g. a document without text)."""


async def _run_indexing_job(session, repo, job, payload: dict) -> None:
    from app.core.dependencies import get_llm_client, get_vector_store
    from app.models.document import DocumentStatus
    from app.models.job import JobStatus
    from app.repositories.document_repository import DocumentRepository
    from app.services.indexing_service import IndexingService
    from app.utils.chunking import ChunkStrategy

    doc_id = uuid.UUID(payload["document_id"])
    service = IndexingService(session, get_llm_client(), get_vector_store())
    await service.index_document(
        doc_id,
        strategy=ChunkStrategy(payload.get("chunk_strategy", ChunkStrategy.FIXED_SIZE)),
        max_tokens=int(payload.get("max_tokens", 512)),
        overlap_tokens=int(payload.get("overlap_tokens", 50)),
    )

    doc = await DocumentRepository(session).get_by_id(doc_id)
    if doc is None or doc.status != DocumentStatus.INDEXED:
        # index_document records soft failures on the document without raising.
        reason = doc.error_message if doc else "Document no longer exists"
        raise PermanentJobError(reason or "Indexing failed")

    await repo.update_status(
        job.id,
        JobStatus.COMPLETED,
        result=json.dumps({"document_id": str(doc_id), "chunk_count": doc.chunk_count}),
    )


@celery.task(name="run_job", bind=True, max_retries=2)
def run_job_task(self, job_id: str) -> dict:
    from app.core.database import async_session_factory
    from app.models.job import JobStatus, JobType
    from app.repositories.job_repository import JobRepository

    logger.info("task_job_start", job_id=job_id)

    async def _run():
        async with async_session_factory() as session:
            repo = JobRepository(session)
            job = await repo.get_by_id(uuid.UUID(job_id))
            if not job:
                logger.error("job_not_found", job_id=job_id)
                return

            await repo.update_status(job.id, JobStatus.RUNNING)
            await session.commit()

            payload = json.loads(job.payload) if job.payload else {}
            # Plain copies: ORM attributes are expired by the rollback below.
            job_pk, job_type = job.id, job.job_type
            try:
                from app.core.dependencies import get_llm_client

                if job.job_type == JobType.INDEX_DOCUMENT:
                    await _run_indexing_job(session, repo, job, payload)

                elif job.job_type == JobType.EXTRACT_JSON:
                    from app.services.extraction_service import ExtractionService
                    from app.schemas.extraction import ExtractionRequest

                    service = ExtractionService(session, get_llm_client())
                    req = ExtractionRequest(**payload)
                    resp = await service.extract(req, tenant_id=job.tenant_id)
                    await repo.update_status(
                        job.id,
                        JobStatus.COMPLETED,
                        result=json.dumps(resp.extracted_data),
                        token_usage=resp.token_usage,
                        cost_usd=resp.cost_usd,
                    )

                await session.commit()

            except Exception as e:
                # Drop partial work (e.g. half-written chunks) before recording the failure.
                await session.rollback()
                await repo.update_status(job_pk, JobStatus.FAILED, error_message=str(e))
                if job_type == JobType.INDEX_DOCUMENT:
                    from app.models.document import DocumentStatus
                    from app.repositories.document_repository import DocumentRepository

                    await DocumentRepository(session).update_status(
                        uuid.UUID(payload["document_id"]),
                        DocumentStatus.FAILED,
                        error_message=str(e),
                    )
                await session.commit()
                raise

    try:
        _run_async(_run())
        return {"status": "completed", "job_id": job_id}
    except PermanentJobError as exc:
        logger.error("task_job_failed", job_id=job_id, error=str(exc), retry=False)
        return {"status": "failed", "job_id": job_id}
    except Exception as exc:
        logger.error("task_job_failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30)
