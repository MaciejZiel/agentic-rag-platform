import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class JobOut(BaseModel):
    id: uuid.UUID
    job_type: str
    status: str
    result: Any | None = None
    error_message: str | None = None
    token_usage: int
    cost_usd: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobCreateRequest(BaseModel):
    job_type: str = Field(min_length=1, max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)
