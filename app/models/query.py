import uuid

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ChatQuery(BaseModel):
    __tablename__ = "chat_queries"

    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    source_chunks: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    token_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)


class ExtractionRequest(BaseModel):
    __tablename__ = "extraction_requests"

    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    schema_json: Mapped[str] = mapped_column(Text, nullable=False)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    token_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
