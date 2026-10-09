import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_tenant
from app.core.database import get_db
from app.models.document import Document, DocumentChunk
from app.models.tenant import Tenant
from app.clients.openai_client import LLMClient, estimate_cost

router = APIRouter()
llm = LLMClient()


class CompareRequest(BaseModel):
    document_id_a: str
    document_id_b: str
    model: str | None = None


class CompareResponse(BaseModel):
    document_a: str
    document_b: str
    analysis: str
    model: str
    token_usage: int
    cost_usd: float


@router.post("", response_model=CompareResponse, summary="Compare documents")
async def compare_documents(
    body: CompareRequest,
    _tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> CompareResponse:
    doc_a = (await db.execute(
        select(Document).where(Document.id == uuid.UUID(body.document_id_a))
    )).scalar_one_or_none()
    doc_b = (await db.execute(
        select(Document).where(Document.id == uuid.UUID(body.document_id_b))
    )).scalar_one_or_none()

    if not doc_a or not doc_b:
        raise HTTPException(status_code=404, detail="One or both documents not found")

    chunks_a = (await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == doc_a.id)
        .order_by(DocumentChunk.chunk_index)
        .limit(10)
    )).scalars().all()

    chunks_b = (await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == doc_b.id)
        .order_by(DocumentChunk.chunk_index)
        .limit(10)
    )).scalars().all()

    text_a = "\n---\n".join(c.content for c in chunks_a)[:4000]
    text_b = "\n---\n".join(c.content for c in chunks_b)[:4000]

    prompt = f"""Compare the following two documents and provide a detailed analysis.

## Document A: {doc_a.filename}
{text_a}

## Document B: {doc_b.filename}
{text_b}

Provide:
1. **Summary** of each document
2. **Key similarities** between the documents
3. **Key differences** between the documents
4. **Unique content** in each document
5. **Overall assessment** of how these documents relate to each other"""

    model = body.model or "openai/gpt-4o-mini"
    content, prompt_tokens, completion_tokens = await llm.chat_completion(
        messages=[{"role": "user", "content": prompt}],
        model=model,
    )
    total_tokens = prompt_tokens + completion_tokens
    cost = estimate_cost(model, prompt_tokens, completion_tokens)

    return CompareResponse(
        document_a=doc_a.filename,
        document_b=doc_b.filename,
        analysis=content,
        model=model,
        token_usage=total_tokens,
        cost_usd=cost,
    )
