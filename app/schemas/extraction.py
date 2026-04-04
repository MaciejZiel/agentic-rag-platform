import uuid
from typing import Any

from pydantic import BaseModel, Field


class ExtractionRequest(BaseModel):
    document_id: uuid.UUID
    schema_definition: dict[str, Any] = Field(
        ..., description="JSON Schema describing the desired output structure"
    )
    instructions: str | None = Field(
        default=None, description="Additional instructions for extraction"
    )


class ExtractionResponse(BaseModel):
    document_id: uuid.UUID
    extracted_data: dict[str, Any]
    model: str
    token_usage: int
    cost_usd: float
