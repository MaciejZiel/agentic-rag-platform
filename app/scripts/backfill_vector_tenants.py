"""Stamp tenant_id on Qdrant points indexed before tenant filtering existed.

Vector search now always filters on the ``tenant_id`` payload field, so points
written by older versions (which only carried ``document_id``) are no longer
returned. Run once after upgrading to make them searchable again:

    python -m app.scripts.backfill_vector_tenants

Documents without an owner tenant are skipped; their vectors stay unreachable.
"""

import asyncio

from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.dependencies import get_vector_store
from app.core.logging import get_logger, setup_logging
from app.models.document import Document, DocumentStatus

logger = get_logger(__name__)


async def backfill() -> int:
    store = get_vector_store()
    async with async_session_factory() as session:
        rows = (await session.execute(
            select(Document.id, Document.tenant_id).where(
                Document.status == DocumentStatus.INDEXED,
                Document.tenant_id.is_not(None),
            )
        )).all()
    for document_id, tenant_id in rows:
        store.assign_tenant(document_id, tenant_id)
    logger.info("vector_tenant_backfill_done", documents=len(rows))
    return len(rows)


if __name__ == "__main__":
    setup_logging()
    asyncio.run(backfill())
