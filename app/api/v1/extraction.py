from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.extraction import ExtractionRequest, ExtractionResponse

router = APIRouter()


@router.post("/json", response_model=ExtractionResponse)
async def extract_json(
    request: ExtractionRequest,
    db: AsyncSession = Depends(get_db),
) -> ExtractionResponse:
    from app.services.extraction_service import ExtractionService

    service = ExtractionService(db)
    return await service.extract(request)
