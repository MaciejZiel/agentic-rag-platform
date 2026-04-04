import json
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient, estimate_cost
from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.query import ExtractionRequest as ExtractionRecord
from app.repositories.document_repository import DocumentRepository
from app.repositories.query_repository import QueryRepository
from app.schemas.extraction import ExtractionRequest, ExtractionResponse
from app.utils.text_extraction import extract_text

logger = get_logger(__name__)


class ExtractionService:
    def __init__(self, db: AsyncSession, llm: LLMClient) -> None:
        self.db = db
        self.llm = llm
        self.doc_repo = DocumentRepository(db)
        self.query_repo = QueryRepository(db)

    async def extract(self, request: ExtractionRequest) -> ExtractionResponse:
        doc = await self.doc_repo.get_by_id(request.document_id)
        if not doc:
            raise NotFoundError("Document", request.document_id)

        file_path = Path(doc.file_path)
        text = extract_text(file_path, doc.content_type)

        # Truncate to avoid overly long contexts (~100k chars ≈ 25k tokens)
        max_chars = 100_000
        if len(text) > max_chars:
            text = text[:max_chars]

        data, prompt_tokens, completion_tokens = await self.llm.structured_extraction(
            text=text,
            schema=request.schema_definition,
            instructions=request.instructions,
        )

        total_tokens = prompt_tokens + completion_tokens
        cost = estimate_cost(settings.chat_model, prompt_tokens, completion_tokens)

        # Persist
        record = ExtractionRecord(
            document_id=request.document_id,
            schema_json=json.dumps(request.schema_definition),
            result_json=json.dumps(data),
            model=settings.chat_model,
            token_usage=total_tokens,
            cost_usd=cost,
        )
        await self.query_repo.create_extraction(record)
        await self.db.commit()

        logger.info("extraction_completed", document_id=str(request.document_id), tokens=total_tokens)
        return ExtractionResponse(
            document_id=request.document_id,
            extracted_data=data,
            model=settings.chat_model,
            token_usage=total_tokens,
            cost_usd=cost,
        )
