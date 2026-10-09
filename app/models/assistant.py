import uuid

from sqlalchemy import Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Assistant(BaseModel):
    __tablename__ = "assistants"
    __table_args__ = (
        Index("ix_assistants_tenant_id", "tenant_id"),
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False, default="openai/gpt-4o-mini")
    temperature: Mapped[float] = mapped_column(Float, nullable=False, default=0.7)
    icon: Mapped[str] = mapped_column(String(8), nullable=False, default="bot")
