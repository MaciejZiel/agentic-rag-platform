import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_tenant_id", "tenant_id"),
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str] = mapped_column(String(256), nullable=False)
    account_type: Mapped[str] = mapped_column(String(32), nullable=False, default="personal")

    # Email verification
    is_email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_verification_code: Mapped[str | None] = mapped_column(String(6), nullable=True)

    # 2FA (TOTP). totp_secret is set by /auth/2fa/setup and only becomes
    # active once /auth/2fa/enable has confirmed a code from it.
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_2fa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Highest TOTP time step accepted so far; codes from it or earlier are replays.
    totp_last_used_step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    totp_failed_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    totp_locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Every user belongs to a tenant (for multi-tenancy / data isolation)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )

    tenant: Mapped["Tenant"] = relationship()  # noqa: F821


class RecoveryCode(BaseModel):
    """Single-use 2FA recovery code; only a SHA-256 hash of the code is stored."""

    __tablename__ = "user_recovery_codes"
    __table_args__ = (
        Index("ix_user_recovery_codes_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
