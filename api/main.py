import uuid
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from app.config import settings
from app.auth.jwt import decode_token
from app.database import get_engine
from app.models.audit_log import AuditLog
from app.auth.router import router as auth_router
from app.routers.users import router as users_router
from app.routers.logs import router as logs_router
from app.routers.alerts import router as alerts_router

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(
    title="MENAL Zero Trust API",
    version="0.3.1",
    description="API FastAPI avec authentification JWT et RBAC",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


_SKIP_AUDIT = {"/health", "/", "/docs", "/openapi.json"}


@app.middleware("http")
async def audit_and_security(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    if request.url.path not in _SKIP_AUDIT:
        try:
            user_id = None
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer "):
                payload = decode_token(auth[7:])
                user_id = uuid.UUID(payload["sub"])
        except Exception:
            pass
        try:
            engine = get_engine()
            with Session(engine) as session:
                session.add(AuditLog(
                    user_id=user_id,
                    action=request.method,
                    resource=request.url.path,
                    ip_address=request.headers.get("x-forwarded-for", request.client.host if request.client else None),
                    user_agent=request.headers.get("user-agent"),
                    status_code=response.status_code,
                ))
                session.commit()
        except Exception:
            pass

    return response


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(logs_router)
app.include_router(alerts_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "menal-api",
        "environment": settings.ENVIRONMENT,
        "version": "0.3.1",
    }


@app.get("/")
def root():
    return {"message": "MENAL Zero Trust API - Phase 3"}
