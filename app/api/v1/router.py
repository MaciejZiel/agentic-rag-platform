from fastapi import APIRouter

from app.api.v1 import documents, extraction, health, jobs, models, qa

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(qa.router, prefix="/qa", tags=["qa"])
api_router.include_router(extraction.router, prefix="/extract", tags=["extraction"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
