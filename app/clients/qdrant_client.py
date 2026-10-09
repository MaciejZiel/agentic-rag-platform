import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    KeywordIndexParams,
    KeywordIndexType,
    MatchAny,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.core.logging import get_logger

logger = get_logger(__name__)

TENANT_FIELD = "tenant_id"


def _tenant_condition(tenant_id: uuid.UUID) -> FieldCondition:
    return FieldCondition(key=TENANT_FIELD, match=MatchValue(value=str(tenant_id)))


class VectorStoreClient:
    """Qdrant wrapper. Every read and write is scoped to a single tenant.

    All tenants share one collection; isolation is enforced by a mandatory
    ``tenant_id`` payload filter on every query, and the field carries a
    tenant payload index so the filter is cheap.
    """

    def __init__(self) -> None:
        self.client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        self.collection = settings.qdrant_collection
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        try:
            collections = [c.name for c in self.client.get_collections().collections]
            if self.collection not in collections:
                self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config=VectorParams(
                        size=settings.embedding_dimensions,
                        distance=Distance.COSINE,
                    ),
                )
                logger.info("collection_created", collection=self.collection)
            # Idempotent: a no-op when the index already exists.
            self.client.create_payload_index(
                collection_name=self.collection,
                field_name=TENANT_FIELD,
                field_schema=KeywordIndexParams(type=KeywordIndexType.KEYWORD, is_tenant=True),
            )
        except Exception as e:
            logger.error("qdrant_init_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e

    def upsert_vectors(
        self,
        ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, str | int]],
        tenant_id: uuid.UUID,
    ) -> None:
        try:
            points = [
                PointStruct(
                    id=id_, vector=vector, payload={**payload, TENANT_FIELD: str(tenant_id)}
                )
                for id_, vector, payload in zip(ids, vectors, payloads, strict=True)
            ]
            self.client.upsert(collection_name=self.collection, points=points)
            logger.info("vectors_upserted", count=len(points))
        except Exception as e:
            logger.error("qdrant_upsert_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e

    def search(
        self,
        query_vector: list[float],
        tenant_id: uuid.UUID,
        top_k: int = 5,
        document_ids: list[uuid.UUID] | None = None,
    ) -> list[dict]:
        try:
            must = [_tenant_condition(tenant_id)]
            if document_ids:
                must.append(
                    FieldCondition(
                        key="document_id",
                        match=MatchAny(any=[str(did) for did in document_ids]),
                    )
                )

            results = self.client.query_points(
                collection_name=self.collection,
                query=query_vector,
                limit=top_k,
                query_filter=Filter(must=must),
                with_payload=True,
            )

            return [
                {
                    "id": str(hit.id),
                    "score": hit.score,
                    "payload": hit.payload,
                }
                for hit in results.points
            ]
        except Exception as e:
            logger.error("qdrant_search_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e

    def delete_by_document_id(self, document_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        try:
            self.client.delete(
                collection_name=self.collection,
                points_selector=Filter(
                    must=[
                        _tenant_condition(tenant_id),
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=str(document_id)),
                        ),
                    ]
                ),
            )
        except Exception as e:
            logger.error("qdrant_delete_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e

    def assign_tenant(self, document_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        """Stamp ``tenant_id`` on every point of a document.

        Used once to migrate points indexed before tenant filtering existed;
        see ``app.scripts.backfill_vector_tenants``.
        """
        try:
            self.client.set_payload(
                collection_name=self.collection,
                payload={TENANT_FIELD: str(tenant_id)},
                points=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=str(document_id)),
                        )
                    ]
                ),
            )
        except Exception as e:
            logger.error("qdrant_set_payload_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e
