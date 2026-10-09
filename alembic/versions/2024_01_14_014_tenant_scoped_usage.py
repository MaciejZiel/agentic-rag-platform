"""Scope queries, extractions and jobs to a tenant; backfill conversations

chat_queries, extraction_requests and jobs had no tenant_id, so usage
statistics and job lookups could only be global. conversations already had
the column, but the Q&A service never filled it in.

Backfill strategy (existing rows):

* extraction_requests -- tenant of the referenced document.
* jobs -- tenant of payload["document_id"] when the payload names one.
* chat_queries -- tenant of the first cited document in document_ids.
* conversations with a NULL tenant_id -- tenant of the first document cited
  by one of their assistant messages (source_chunks_json).

Rows that cannot be attributed (no document reference, or the document is
gone) keep tenant_id = NULL. Every read path filters on
``tenant_id = <caller's tenant>``, so such rows are invisible to all tenants:
the migration fails closed rather than guessing an owner.

Revision ID: 014
Revises: 013
Create Date: 2024-01-14
"""
import json
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None

_TABLES = ("chat_queries", "extraction_requests", "jobs")


def _as_uuid(value: object) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _load_json(raw: str | None) -> object:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def _backfill(conn: sa.Connection) -> None:
    doc_tenants = {
        row.id: row.tenant_id
        for row in conn.execute(
            sa.text("SELECT id, tenant_id FROM documents WHERE tenant_id IS NOT NULL")
        )
    }

    def tenant_of(doc_ids: list[object]) -> uuid.UUID | None:
        for raw in doc_ids:
            doc_id = _as_uuid(raw)
            if doc_id is not None and doc_id in doc_tenants:
                return doc_tenants[doc_id]
        return None

    conn.execute(sa.text(
        "UPDATE extraction_requests e SET tenant_id = d.tenant_id "
        "FROM documents d WHERE e.document_id = d.id AND e.tenant_id IS NULL"
    ))

    updates: list[tuple[str, uuid.UUID, uuid.UUID]] = []

    for row in conn.execute(sa.text("SELECT id, payload FROM jobs WHERE tenant_id IS NULL")):
        payload = _load_json(row.payload)
        if isinstance(payload, dict):
            tid = tenant_of([payload.get("document_id")])
            if tid:
                updates.append(("jobs", row.id, tid))

    for row in conn.execute(
        sa.text("SELECT id, document_ids FROM chat_queries WHERE tenant_id IS NULL")
    ):
        ids = _load_json(row.document_ids)
        if isinstance(ids, list):
            tid = tenant_of(ids)
            if tid:
                updates.append(("chat_queries", row.id, tid))

    conv_rows = conn.execute(sa.text(
        "SELECT c.id, m.source_chunks_json FROM conversations c "
        "JOIN conversation_messages m ON m.conversation_id = c.id "
        "WHERE c.tenant_id IS NULL AND m.source_chunks_json IS NOT NULL "
        "ORDER BY c.id, m.position"
    ))
    resolved: set[uuid.UUID] = set()
    for row in conv_rows:
        if row.id in resolved:
            continue
        sources = _load_json(row.source_chunks_json)
        if isinstance(sources, list):
            tid = tenant_of([s.get("document_id") for s in sources if isinstance(s, dict)])
            if tid:
                updates.append(("conversations", row.id, tid))
                resolved.add(row.id)

    for table, row_id, tid in updates:
        conn.execute(
            sa.text(f"UPDATE {table} SET tenant_id = :tid WHERE id = :id"),  # noqa: S608
            {"tid": tid, "id": row_id},
        )


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(table, sa.Column("tenant_id", UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_tenant_id", table, "tenants", ["tenant_id"], ["id"], ondelete="CASCADE"
        )

    op.create_index(
        "ix_chat_queries_tenant_created", "chat_queries", ["tenant_id", "created_at"]
    )
    op.create_index(
        "ix_extraction_requests_tenant_created",
        "extraction_requests",
        ["tenant_id", "created_at"],
    )
    op.create_index("ix_jobs_tenant_id", "jobs", ["tenant_id"])

    _backfill(op.get_bind())


def downgrade() -> None:
    op.drop_index("ix_jobs_tenant_id", table_name="jobs")
    op.drop_index("ix_extraction_requests_tenant_created", table_name="extraction_requests")
    op.drop_index("ix_chat_queries_tenant_created", table_name="chat_queries")
    for table in _TABLES:
        op.drop_constraint(f"fk_{table}_tenant_id", table, type_="foreignkey")
        op.drop_column(table, "tenant_id")
    # Conversation tenant_id values filled in by the backfill are left in place.
