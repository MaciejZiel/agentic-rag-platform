import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    Filter,
    FieldCondition,
    MatchAny,
    PointStruct,
    VectorParams,
)

from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.core.logging import get_logger

logger = get_logger(__name__)


class VectorStoreClient:
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
        except Exception as e:
            logger.error("qdrant_init_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e

    def upsert_vectors(
        self,
        ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, str | int]],
    ) -> None:
        try:
            points = [
                PointStruct(id=id_, vector=vector, payload=payload)
                for id_, vector, payload in zip(ids, vectors, payloads)
            ]
            self.client.upsert(collection_name=self.collection, points=points)
            logger.info("vectors_upserted", count=len(points))
        except Exception as e:
            logger.error("qdrant_upsert_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        document_ids: list[uuid.UUID] | None = None,
    ) -> list[dict]:
        try:
            query_filter = None
            if document_ids:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchAny(any=[str(did) for did in document_ids]),
                        )
                    ]
                )

            results = self.client.query_points(
                collection_name=self.collection,
                query=query_vector,
                limit=top_k,
                query_filter=query_filter,
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

    def delete_by_document_id(self, document_id: uuid.UUID) -> None:
        try:
            self.client.delete(
                collection_name=self.collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchAny(any=[str(document_id)]),
                        )
                    ]
                ),
            )
        except Exception as e:
            logger.error("qdrant_delete_error", error=str(e))
            raise ExternalServiceError("Qdrant", str(e)) from e
