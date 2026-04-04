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
        await self.db.refresh(conversation)
        return conversation

    async def get_by_id(self, conversation_id: uuid.UUID) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self, skip: int = 0, limit: int = 20, tenant_id: uuid.UUID | None = None,
    ) -> list[Conversation]:
        query = select(Conversation)
        if tenant_id is not None:
            query = query.where(Conversation.tenant_id == tenant_id)
        result = await self.db.execute(
            query.order_by(Conversation.updated_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

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

    async def delete(self, conversation_id: uuid.UUID) -> None:
        conv = await self.get_by_id(conversation_id)
        if conv:
            await self.db.delete(conv)
            await self.db.flush()
