"""Create users table

Revision ID: 005
Revises: 004
Create Date: 2024-01-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("full_name", sa.String(256), nullable=False),
        sa.Column("account_type", sa.String(32), nullable=False, server_default="personal"),
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("email_verification_code", sa.String(6), nullable=True),
        sa.Column("totp_secret", sa.String(64), nullable=True),
        sa.Column("is_2fa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_users_tenant_id")
    op.drop_index("ix_users_email")
    op.drop_table("users")
