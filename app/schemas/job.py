import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class JobOut(BaseModel):
    id: uuid.UUID
    job_type: str
    status: str
    result: Any | None = None
    error_message: str | None = None
    token_usage: int
    cost_usd: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobCreateRequest(BaseModel):
    job_type: str
    payload: dict[str, Any]
