import uuid

from sqlalchemy import Column, ForeignKey, Index, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.core.database import Base

collection_documents = Table(
    "collection_documents",
    Base.metadata,
    Column("collection_id", UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
)


class Collection(BaseModel):
    __tablename__ = "collections"
    __table_args__ = (
        Index("ix_collections_tenant_id", "tenant_id"),
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#3b82f6")

    documents: Mapped[list["app.models.document.Document"]] = relationship(
        secondary=collection_documents,
        lazy="selectin",
    )
