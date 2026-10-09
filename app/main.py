from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.error_handlers import app_error_handler
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError
from app.core.logging import setup_logging, get_logger
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.rate_limit import limiter
from app.middleware.rate_limit_headers import RateLimitHeadersMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    logger = get_logger(__name__)
    logger.info("starting", app=settings.app_name, env=settings.app_env)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield
    logger.info("shutting_down")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    is_dev = settings.app_env == "development"
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if is_dev else origins,
        allow_credentials=True,
        allow_methods=["*"] if is_dev else ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=(
            ["*"]
            if is_dev
            else ["Authorization", "Content-Type", "Accept", "X-API-Key", "X-Request-ID"]
        ),
        expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitHeadersMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.state.limiter = limiter
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.include_router(api_router, prefix=settings.api_prefix)

    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=["/metrics", "/docs", "/redoc", "/openapi.json"],
    ).instrument(app).expose(app, endpoint="/metrics")

    return app


app = create_app()
