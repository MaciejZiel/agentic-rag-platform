import uuid

from pydantic import BaseModel, Field


class SourceCitation(BaseModel):
    document_id: uuid.UUID
    chunk_index: int
    content: str
    score: float


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    document_ids: list[uuid.UUID] | None = Field(
        default=None, description="Limit search to specific documents"
    )
    top_k: int = Field(default=5, ge=1, le=20)
    model: str | None = Field(default=None, description="Override chat model")
    conversation_id: uuid.UUID | None = Field(
        default=None, description="Continue an existing conversation"
    )


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    model: str
    token_usage: int
    cost_usd: float | None
    conversation_id: uuid.UUID | None = None


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


class ConversationListOut(BaseModel):
    conversations: list[ConversationOut]
    total: int


class UsageMetadata(BaseModel):
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float | None
