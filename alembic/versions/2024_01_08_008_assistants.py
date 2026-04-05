"""Create assistants table

Revision ID: 008
Revises: 007
Create Date: 2024-01-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assistants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("model", sa.String(128), nullable=False, server_default="openai/gpt-4o-mini"),
        sa.Column("temperature", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("icon", sa.String(8), nullable=False, server_default="bot"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_assistants_tenant_id", "assistants", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_assistants_tenant_id")
    op.drop_table("assistants")
