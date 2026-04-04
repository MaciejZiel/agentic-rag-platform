"""auth and tenants

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("key_prefix", sa.String(12), nullable=False),
        sa.Column("label", sa.String(256), nullable=False, server_default="default"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"])

    # Add tenant_id to documents (nullable for backward compatibility)
    op.add_column("documents", sa.Column("tenant_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_documents_tenant_id", "documents", "tenants", ["tenant_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_documents_tenant_id", "documents", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_documents_tenant_id", table_name="documents")
    op.drop_constraint("fk_documents_tenant_id", "documents", type_="foreignkey")
    op.drop_column("documents", "tenant_id")
    op.drop_index("ix_api_keys_key_hash", table_name="api_keys")
    op.drop_table("api_keys")
    op.drop_table("tenants")
