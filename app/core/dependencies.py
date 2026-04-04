from functools import lru_cache

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    return LLMClient()


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStoreClient:
    return VectorStoreClient()
