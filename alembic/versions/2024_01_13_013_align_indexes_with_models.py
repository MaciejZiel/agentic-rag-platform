"""Align indexes and unique constraints with the ORM models

Earlier migrations created a few objects the models do not declare
(redundant indexes next to unique constraints, a low-selectivity boolean
index) and missed two tenant_id indexes. This revision makes the schema
match the models so that ``alembic check`` reports no differences.

Revision ID: 013
Revises: 012
Create Date: 2024-01-13
"""
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tenant-scoped lookups on tables that had no tenant_id index yet.
    op.create_index("ix_api_keys_tenant_id", "api_keys", ["tenant_id"])
    op.create_index("ix_webhooks_tenant_id", "webhooks", ["tenant_id"])

    # key_hash is already covered by the api_keys_key_hash_key unique constraint.
    op.drop_index("ix_api_keys_key_hash", table_name="api_keys")

    # users.email is enforced by the unique ix_users_email index; the separate
    # unique constraint only duplicated it.
    op.drop_constraint("users_email_key", "users", type_="unique")

    # share_links.token: replace the unique constraint plus plain index with a
    # single unique index, as declared by the model (unique=True, index=True).
    op.drop_index("ix_share_links_token", table_name="share_links")
    op.drop_constraint("share_links_token_key", "share_links", type_="unique")
    op.create_index("ix_share_links_token", "share_links", ["token"], unique=True)

    # A single-column index on a boolean flag is too unselective to be used;
    # unread counts are filtered by tenant_id first.
    op.drop_index("ix_notifications_is_read", table_name="notifications")


def downgrade() -> None:
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])

    op.drop_index("ix_share_links_token", table_name="share_links")
    op.create_unique_constraint("share_links_token_key", "share_links", ["token"])
    op.create_index("ix_share_links_token", "share_links", ["token"])

    op.create_unique_constraint("users_email_key", "users", ["email"])

    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"])

    op.drop_index("ix_webhooks_tenant_id", table_name="webhooks")
    op.drop_index("ix_api_keys_tenant_id", table_name="api_keys")
