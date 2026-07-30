from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from app.auth.dependencies import require_role
from app.database import get_engine
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertOut(BaseModel):
    id: str
    user_id: str | None
    action: str
    resource: str
    ip_address: str | None
    status_code: int
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[AlertOut])
def list_alerts(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    """Retourne les événements suspects : requêtes avec status_code >= 400."""
    engine = get_engine()
    with Session(engine) as session:
        alerts = (
            session.query(AuditLog)
            .filter(AuditLog.status_code >= 400)
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [
            AlertOut(
                id=str(a.id),
                user_id=str(a.user_id) if a.user_id else None,
                action=a.action,
                resource=a.resource,
                ip_address=a.ip_address,
                status_code=a.status_code,
                created_at=a.created_at,
            )
            for a in alerts
        ]
