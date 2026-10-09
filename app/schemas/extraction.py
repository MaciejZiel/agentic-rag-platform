import uuid
from typing import Any

from pydantic import BaseModel, Field


class ExtractionRequest(BaseModel):
    document_id: uuid.UUID
    schema_definition: dict[str, Any] = Field(
        ..., description="JSON Schema describing the desired output structure"
    )
    instructions: str | None = Field(
        default=None, max_length=5000, description="Additional instructions for extraction"
    )
    model: str | None = Field(default=None, max_length=128, description="Override chat model")


class ExtractionResponse(BaseModel):
    document_id: uuid.UUID
    extracted_data: dict[str, Any]
    model: str
    token_usage: int
    cost_usd: float | None
