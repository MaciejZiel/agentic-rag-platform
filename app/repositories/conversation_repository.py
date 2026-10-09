import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation, ConversationMessage


class ConversationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, conversation: Conversation) -> Conversation:
        self.db.add(conversation)
        await self.db.flush()
        # Load the (empty) messages collection eagerly: touching an unloaded
        # relationship later would trigger a lazy load, which AsyncSession forbids.
        await self.db.refresh(conversation)
        await self.db.refresh(conversation, attribute_names=["messages"])
        return conversation

    async def get_for_tenant(
        self, conversation_id: uuid.UUID, tenant_id: uuid.UUID,
    ) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id, Conversation.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self, *, tenant_id: uuid.UUID, skip: int = 0, limit: int = 20,
    ) -> list[Conversation]:
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.tenant_id == tenant_id)
            .order_by(Conversation.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count(self, tenant_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(Conversation.id)).where(Conversation.tenant_id == tenant_id)
        )
        return result.scalar_one()

    async def add_message(self, message: ConversationMessage) -> ConversationMessage:
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return message

    async def get_message_count(self, conversation_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(ConversationMessage.id)).where(
                ConversationMessage.conversation_id == conversation_id
            )
        )
        return result.scalar_one()

    async def delete(self, conversation: Conversation) -> None:
        await self.db.delete(conversation)
        await self.db.flush()
