"""TOTP two-factor authentication: replay/lockout state and recovery codes

Revision ID: 015
Revises: 014
Create Date: 2024-01-15
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_last_used_step", sa.Integer(), nullable=True))
    op.add_column(
        "users",
        sa.Column("totp_failed_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users", sa.Column("totp_locked_until", sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        "user_recovery_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_user_recovery_codes_user_id", "user_recovery_codes", ["user_id"])

    # The previous half-implementation could never confirm a secret, so any
    # stored flag/secret is unverified; start everyone from a clean state.
    op.execute("UPDATE users SET is_2fa_enabled = false, totp_secret = NULL")


def downgrade() -> None:
    op.drop_index("ix_user_recovery_codes_user_id", table_name="user_recovery_codes")
    op.drop_table("user_recovery_codes")
    op.drop_column("users", "totp_locked_until")
    op.drop_column("users", "totp_failed_attempts")
    op.drop_column("users", "totp_last_used_step")
