from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from app.auth.dependencies import require_role
from app.database import get_engine
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/logs", tags=["logs"])


class AuditLogOut(BaseModel):
    id: str
    user_id: str | None
    action: str
    resource: str
    ip_address: str | None
    status_code: int
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[AuditLogOut])
def list_logs(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    engine = get_engine()
    with Session(engine) as session:
        logs = (
            session.query(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [
            AuditLogOut(
                id=str(log.id),
                user_id=str(log.user_id) if log.user_id else None,
                action=log.action,
                resource=log.resource,
                ip_address=log.ip_address,
                status_code=log.status_code,
                created_at=log.created_at,
            )
            for log in logs
        ]
