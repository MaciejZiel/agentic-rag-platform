from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.qa import AskRequest, AskResponse

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
async def ask_question(
    request: AskRequest,
    db: AsyncSession = Depends(get_db),
) -> AskResponse:
    from app.services.qa_service import QAService

    service = QAService(db)
    return await service.ask(request)


@router.post("/ask/stream")
async def ask_question_stream(
    request: AskRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    from app.services.qa_service import QAService

    service = QAService(db)
    stream = service.ask_stream(request)
    return StreamingResponse(stream, media_type="text/event-stream")
