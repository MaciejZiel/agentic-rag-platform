import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_tenant, get_tenant_id
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.tenant import Tenant
from app.repositories.conversation_repository import ConversationRepository
from app.schemas.qa import ConversationListOut, ConversationOut

router = APIRouter()


@router.get("", response_model=ConversationListOut)
async def list_conversations(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant | None = Depends(get_current_tenant),
) -> ConversationListOut:
    repo = ConversationRepository(db)
    convs = await repo.list_all(skip=skip, limit=limit, tenant_id=get_tenant_id(tenant))
    return ConversationListOut(
        conversations=[
            ConversationOut(
                id=c.id,
                title=c.title,
                created_at=c.created_at.isoformat(),
                updated_at=c.updated_at.isoformat(),
            )
            for c in convs
        ],
        total=len(convs),
    )


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id)
    if not conv:
        raise NotFoundError("Conversation", conversation_id)
    return {
        "id": str(conv.id),
        "title": conv.title,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "model": m.model,
                "token_usage": m.token_usage,
                "created_at": m.created_at.isoformat(),
            }
            for m in conv.messages
        ],
    }


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id)
    if not conv:
        raise NotFoundError("Conversation", conversation_id)
    await repo.delete(conversation_id)
    await db.commit()
