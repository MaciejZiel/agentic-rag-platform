import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Webhook(BaseModel):
    __tablename__ = "webhooks"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(
        String(64), nullable=False
    )  # "indexing.completed", "indexing.failed", "*"
    secret: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
