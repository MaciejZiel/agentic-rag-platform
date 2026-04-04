from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.database import get_db
from app.core.dependencies import get_llm_client, get_vector_store
from app.schemas.qa import AskRequest, AskResponse
from app.services.qa_service import QAService

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
async def ask_question(
    request: AskRequest,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> AskResponse:
    service = QAService(db, llm, vector_store)
    return await service.ask(request)


@router.post("/ask/stream")
async def ask_question_stream(
    request: AskRequest,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> StreamingResponse:
    service = QAService(db, llm, vector_store)
    stream = service.ask_stream(request)
    return StreamingResponse(stream, media_type="text/event-stream")
