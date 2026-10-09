import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Conversation(BaseModel):
    __tablename__ = "conversations"
    __table_args__ = (
        Index("ix_conversations_tenant_id", "tenant_id"),
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="New conversation")

    messages: Mapped[list["ConversationMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan",
        order_by="ConversationMessage.position",
    )


class ConversationMessage(BaseModel):
    __tablename__ = "conversation_messages"
    __table_args__ = (
        Index("ix_conversation_messages_conversation_id", "conversation_id"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    token_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_chunks_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
