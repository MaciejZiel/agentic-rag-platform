from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import LLMClient
from app.clients.qdrant_client import VectorStoreClient
from app.core.database import get_db
from app.core.dependencies import get_llm_client, get_vector_store
from app.core.rate_limit import limiter
from app.schemas.qa import AskRequest, AskResponse
from app.services.qa_service import QAService

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
@limiter.limit("30/minute")
async def ask_question(
    request: Request,
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> AskResponse:
    service = QAService(db, llm, vector_store)
    return await service.ask(body)


@router.post("/ask/stream")
@limiter.limit("30/minute")
async def ask_question_stream(
    request: Request,
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
    vector_store: VectorStoreClient = Depends(get_vector_store),
) -> StreamingResponse:
    service = QAService(db, llm, vector_store)
    stream = service.ask_stream(body)
    return StreamingResponse(stream, media_type="text/event-stream")
