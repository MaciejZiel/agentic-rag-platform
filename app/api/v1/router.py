from fastapi import APIRouter

from app.api.v1 import admin, assistants, auth, collections, compare, conversations, documents, extraction, health, jobs, models, notifications, qa, share, stats, tenants, webhooks, workflows

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(qa.router, prefix="/qa", tags=["qa"])
api_router.include_router(extraction.router, prefix="/extract", tags=["extraction"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
api_router.include_router(collections.router, prefix="/collections", tags=["collections"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(assistants.router, prefix="/assistants", tags=["assistants"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(compare.router, prefix="/compare", tags=["compare"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
api_router.include_router(share.router, prefix="/share", tags=["share"])
