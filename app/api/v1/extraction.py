from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.core.database import get_db
from app.core.dependencies import get_llm_client
from app.schemas.extraction import ExtractionRequest, ExtractionResponse
from app.services.extraction_service import ExtractionService

router = APIRouter()


@router.post("/json", response_model=ExtractionResponse)
async def extract_json(
    request: ExtractionRequest,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
) -> ExtractionResponse:
    service = ExtractionService(db, llm)
    return await service.extract(request)
