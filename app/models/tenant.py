import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Tenant(BaseModel):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    api_keys: Mapped[list["ApiKey"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )


class ApiKey(BaseModel):
    __tablename__ = "api_keys"
    __table_args__ = (
        Index("ix_api_keys_tenant_id", "tenant_id"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    key_prefix: Mapped[str] = mapped_column(String(12), nullable=False)
    label: Mapped[str] = mapped_column(String(256), nullable=False, default="default")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="api_keys")
