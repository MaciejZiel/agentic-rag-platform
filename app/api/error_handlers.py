from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.exceptions import AppError
from app.core.logging import get_logger

logger = get_logger(__name__)


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    logger.error("app_error", message=exc.message, status_code=exc.status_code, detail=exc.detail)
    body: dict[str, object] = {"error": exc.message}
    if exc.detail is not None:
        body["detail"] = exc.detail
    return JSONResponse(status_code=exc.status_code, content=body)
