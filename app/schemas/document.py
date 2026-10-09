import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    file_size: int
    status: str
    chunk_count: int
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListOut(BaseModel):
    documents: list[DocumentOut]
    total: int


class IndexingJobOut(BaseModel):
    """Returned when indexing is queued; poll GET /jobs/{job_id} for progress."""

    job_id: uuid.UUID
    status: str
    document: DocumentOut


class IndexRequest(BaseModel):
    chunk_strategy: str = Field(
        default="fixed_size",
        description="Chunking strategy: fixed_size, sentence, or paragraph",
    )
    max_tokens: int = Field(default=512, ge=64, le=2048)
    overlap_tokens: int = Field(default=50, ge=0, le=256)


class DocumentChunkOut(BaseModel):
    id: uuid.UUID
    chunk_index: int
    content: str
    token_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
