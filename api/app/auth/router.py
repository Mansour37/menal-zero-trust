import uuid
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
import bcrypt
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.auth.jwt import create_access_token, create_mfa_pending_token, decode_token
from app.auth.mfa import generate_secret, provisioning_uri, verify_totp
from app.auth.dependencies import get_current_user
from app.database import get_engine
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _real_client_ip(request: Request) -> str:
    """
    Cle du filet de securite applicatif. NE PAS considerer comme l IP du client.

    Le GFE ajoute toujours "<pair>, <gfe-ip>" en fin de X-Forwarded-For, donc
    l avant-dernier maillon resiste a une falsification du debut de l en-tete.
    Mais cela ne donne le vrai client que sur l appel DIRECT a l API
    (client -> LB -> API).

    Sur le trajet reel du dashboard il y a DEUX traversees du LB
    (client -> LB -> Next.js -> LB -> API, voir app/api/login/route.ts) : le GFE
    ajoute une seconde paire, et l avant-dernier maillon devient l IP de sortie
    PARTAGEE du dashboard. La cle est alors commune a tous les utilisateurs —
    d ou AUTH_BACKSTOP_LIMIT volontairement large. Le controle anti-brute-force
    par client reel est applique au bord par Cloud Armor (priorite 1450).
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        if len(hops) >= 2:
            return hops[-2]
        if hops:
            return hops[0]
    return get_remote_address(request)


limiter = Limiter(key_func=_real_client_ip)

# Filet de securite applicatif, PAS le controle anti-brute-force principal.
# Celui-ci est applique au bord par Cloud Armor (10/min par IP REELLE + ban),
# voir terraform/modules/load-balancer/main.tf priorite 1450 : c est le seul
# point qui connaisse la vraie IP du client.
# Ici la cle (_real_client_ip) se replie sur l IP de sortie PARTAGEE du dashboard
# quand la requete est relayee (double traversee du LB) : un seuil serre y
# devenait donc un verrou global — 12 requetes non authentifiees suffisaient a
# bloquer la connexion de TOUS les analystes. Le seuil est volontairement large :
# il ne sert qu a arreter un emballement, jamais a identifier un attaquant.
AUTH_BACKSTOP_LIMIT = "60/minute"


def _verify_password(plain: str, hashed: str) -> bool:
    # bcrypt n exploite que les 72 premiers octets et LEVE au-dela (bcrypt>=4.1).
    # On borne + on capture pour renvoyer un simple echec d auth (401) au lieu
    # d un 500 declenchable par un appel non authentifie avec un mot de passe long.
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode())
    except (ValueError, TypeError):
        return False


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MfaChallenge(BaseModel):
    mfa_required: bool = True
    mfa_token: str


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    code: str


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class MfaEnableRequest(BaseModel):
    code: str


class MfaDisableRequest(BaseModel):
    password: str
    code: str


class MfaStatus(BaseModel):
    enabled: bool


def _user_by_sub(session: Session, sub: str) -> User | None:
    try:
        user_id = uuid.UUID(sub)
    except (ValueError, TypeError):
        return None
    return session.query(User).filter(User.id == user_id).first()


@router.post("/token", response_model=Union[Token, MfaChallenge])
@limiter.limit(AUTH_BACKSTOP_LIMIT)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    engine = get_engine()
    with Session(engine) as session:
        user = session.query(User).filter(User.email == form_data.username).first()
        if not user or not _verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled",
            )
        if user.mfa_enabled:
            return MfaChallenge(mfa_token=create_mfa_pending_token(str(user.id)))
        role_name = user.role.name if user.role else "viewer"
        token = create_access_token(subject=str(user.id), role=role_name)
        return Token(access_token=token)


@router.post("/mfa/verify", response_model=Token)
@limiter.limit(AUTH_BACKSTOP_LIMIT)
def verify_mfa(request: Request, body: MfaVerifyRequest):
    try:
        payload = decode_token(body.mfa_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired MFA challenge",
        )
    if payload.get("typ") != "mfa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA challenge",
        )
    engine = get_engine()
    with Session(engine) as session:
        user = _user_by_sub(session, payload.get("sub", ""))
        if not user or not user.mfa_enabled or not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="MFA not configured for this account",
            )
        if not verify_totp(user.mfa_secret, body.code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid verification code",
            )
        role_name = user.role.name if user.role else "viewer"
        token = create_access_token(subject=str(user.id), role=role_name)
        return Token(access_token=token)


@router.get("/mfa/status", response_model=MfaStatus)
def mfa_status(current_user: dict = Depends(get_current_user)):
    engine = get_engine()
    with Session(engine) as session:
        user = _user_by_sub(session, current_user.get("sub", ""))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return MfaStatus(enabled=user.mfa_enabled)


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def setup_mfa(current_user: dict = Depends(get_current_user)):
    engine = get_engine()
    with Session(engine) as session:
        user = _user_by_sub(session, current_user.get("sub", ""))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="MFA is already enabled for this account",
            )
        secret = generate_secret()
        user.mfa_secret = secret
        session.commit()
        return MfaSetupResponse(secret=secret, otpauth_uri=provisioning_uri(secret, user.email))


@router.post("/mfa/enable", response_model=MfaStatus)
@limiter.limit(AUTH_BACKSTOP_LIMIT)
def enable_mfa(request: Request, body: MfaEnableRequest, current_user: dict = Depends(get_current_user)):
    engine = get_engine()
    with Session(engine) as session:
        user = _user_by_sub(session, current_user.get("sub", ""))
        if not user or not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Call /auth/mfa/setup first",
            )
        if not verify_totp(user.mfa_secret, body.code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid verification code",
            )
        user.mfa_enabled = True
        session.commit()
        return MfaStatus(enabled=True)


@router.post("/mfa/disable", response_model=MfaStatus)
@limiter.limit(AUTH_BACKSTOP_LIMIT)
def disable_mfa(request: Request, body: MfaDisableRequest, current_user: dict = Depends(get_current_user)):
    engine = get_engine()
    with Session(engine) as session:
        user = _user_by_sub(session, current_user.get("sub", ""))
        if not user or not _verify_password(body.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
            )
        if user.mfa_enabled and not verify_totp(user.mfa_secret, body.code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid verification code",
            )
        user.mfa_enabled = False
        user.mfa_secret = None
        session.commit()
        return MfaStatus(enabled=False)
