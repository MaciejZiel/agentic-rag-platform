"""Add file_hash column to documents

Revision ID: 010
Revises: 009
Create Date: 2024-01-10
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("file_hash", sa.String(64), nullable=True))
    op.create_index("ix_documents_file_hash", "documents", ["file_hash"])


def downgrade() -> None:
    op.drop_index("ix_documents_file_hash")
    op.drop_column("documents", "file_hash")
