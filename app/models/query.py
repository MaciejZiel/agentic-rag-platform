import uuid

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ChatQuery(BaseModel):
    __tablename__ = "chat_queries"
    __table_args__ = (
        Index("ix_chat_queries_tenant_created", "tenant_id", "created_at"),
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True
    )

    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    source_chunks: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    token_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Null when the model has no verified price (see app/config/model_pricing.toml).
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)


class ExtractionRequest(BaseModel):
    __tablename__ = "extraction_requests"
    __table_args__ = (
        Index("ix_extraction_requests_tenant_created", "tenant_id", "created_at"),
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True
    )

    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    schema_json: Mapped[str] = mapped_column(Text, nullable=False)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    token_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Null when the model has no verified price (see app/config/model_pricing.toml).
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
