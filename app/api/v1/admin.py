from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import require_tenant
from app.models.document import Document
from app.models.query import ChatQuery, ExtractionRequest
from app.models.conversation import Conversation
from app.models.tenant import Tenant
from app.models.user import User
from app.models.collection import Collection
from app.models.assistant import Assistant
from app.models.audit_log import AuditLog

router = APIRouter()


class SystemHealth(BaseModel):
    status: str
    database: str
    uptime_info: str


class AdminStats(BaseModel):
    total_users: int
    verified_users: int
    total_tenants: int
    total_documents: int
    total_queries: int
    total_extractions: int
    total_conversations: int
    total_collections: int
    total_assistants: int
    total_tokens: int
    total_cost_usd: float


class UserInfo(BaseModel):
    id: str
    email: str
    full_name: str
    account_type: str
    is_email_verified: bool
    is_2fa_enabled: bool
    is_active: bool
    created_at: str


class AdminOverview(BaseModel):
    health: SystemHealth
    stats: AdminStats
    recent_users: list[UserInfo]


@router.get("/overview", response_model=AdminOverview, summary="Get admin overview")
async def admin_overview(
    _tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> AdminOverview:
    # Health
    health = SystemHealth(status="healthy", database="connected", uptime_info="operational")

    # Stats
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    verified_users = (await db.execute(
        select(func.count(User.id)).where(User.is_email_verified.is_(True))
    )).scalar_one()
    total_tenants = (await db.execute(select(func.count(Tenant.id)))).scalar_one()
    total_docs = (await db.execute(select(func.count(Document.id)))).scalar_one()
    total_queries = (await db.execute(select(func.count(ChatQuery.id)))).scalar_one()
    total_extractions = (await db.execute(select(func.count(ExtractionRequest.id)))).scalar_one()
    total_convs = (await db.execute(select(func.count(Conversation.id)))).scalar_one()
    total_colls = (await db.execute(select(func.count(Collection.id)))).scalar_one()
    total_assts = (await db.execute(select(func.count(Assistant.id)))).scalar_one()
    total_tokens = (await db.execute(
        select(func.coalesce(func.sum(ChatQuery.token_usage), 0))
    )).scalar_one()
    ext_tokens = (await db.execute(
        select(func.coalesce(func.sum(ExtractionRequest.token_usage), 0))
    )).scalar_one()
    total_cost = (await db.execute(
        select(func.coalesce(func.sum(ChatQuery.cost_usd), 0.0))
    )).scalar_one()
    ext_cost = (await db.execute(
        select(func.coalesce(func.sum(ExtractionRequest.cost_usd), 0.0))
    )).scalar_one()

    stats = AdminStats(
        total_users=total_users,
        verified_users=verified_users,
        total_tenants=total_tenants,
        total_documents=total_docs,
        total_queries=total_queries,
        total_extractions=total_extractions,
        total_conversations=total_convs,
        total_collections=total_colls,
        total_assistants=total_assts,
        total_tokens=int(total_tokens) + int(ext_tokens),
        total_cost_usd=float(total_cost) + float(ext_cost),
    )

    # Recent users
    users_result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(10)
    )
    recent_users = [
        UserInfo(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            account_type=u.account_type,
            is_email_verified=u.is_email_verified,
            is_2fa_enabled=u.is_2fa_enabled,
            is_active=u.is_active,
            created_at=u.created_at.isoformat(),
        )
        for u in users_result.scalars().all()
    ]

    return AdminOverview(health=health, stats=stats, recent_users=recent_users)


class AuditLogOut(BaseModel):
    id: str
    action: str
    resource_type: str | None
    resource_id: str | None
    detail: str | None
    ip_address: str | None
    user_id: str | None
    created_at: str


@router.get("/audit-logs", response_model=list[AuditLogOut], summary="List audit logs")
async def list_audit_logs(
    skip: int = 0,
    limit: int = 50,
    action: str | None = None,
    _tenant: Tenant = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogOut]:
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.where(AuditLog.action == action)
    query = query.offset(skip).limit(min(limit, 200))
    result = await db.execute(query)
    return [
        AuditLogOut(
            id=str(a.id),
            action=a.action,
            resource_type=a.resource_type,
            resource_id=a.resource_id,
            detail=a.detail,
            ip_address=a.ip_address,
            user_id=str(a.user_id) if a.user_id else None,
            created_at=a.created_at.isoformat(),
        )
        for a in result.scalars().all()
    ]
