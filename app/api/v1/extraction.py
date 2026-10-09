from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.core.database import get_db
from app.core.dependencies import get_llm_client
from app.core.rate_limit import limiter
from app.schemas.extraction import ExtractionRequest, ExtractionResponse
from app.services.extraction_service import ExtractionService

router = APIRouter()


@router.post("/json", response_model=ExtractionResponse, summary="Extract structured data")
@limiter.limit("20/minute")
async def extract_json(
    request: Request,
    body: ExtractionRequest,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
) -> ExtractionResponse:
    service = ExtractionService(db, llm)
    return await service.extract(body)
