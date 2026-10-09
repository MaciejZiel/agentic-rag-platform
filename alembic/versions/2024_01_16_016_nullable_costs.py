"""Allow unknown costs on chat queries, extractions and jobs

Models without a verified price no longer get a fabricated 0.0 cost; the
cost is stored as NULL. Existing rows keep their values (0.0 for models the
old three-entry price table did not know).

Revision ID: 016
Revises: 015
Create Date: 2024-01-16
"""
import sqlalchemy as sa
from alembic import op

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None

_TABLES = ("chat_queries", "extraction_requests", "jobs")


def upgrade() -> None:
    for table in _TABLES:
        op.alter_column(
            table, "cost_usd", existing_type=sa.Float(), nullable=True, server_default=None
        )


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"UPDATE {table} SET cost_usd = 0 WHERE cost_usd IS NULL")  # noqa: S608
        op.alter_column(
            table, "cost_usd", existing_type=sa.Float(), nullable=False, server_default="0"
        )
