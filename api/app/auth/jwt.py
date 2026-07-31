from datetime import datetime, timedelta, timezone
import jwt
from jwt.exceptions import PyJWTError
from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
MFA_PENDING_EXPIRE_MINUTES = 5


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "role": role,
        "typ": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_mfa_pending_token(subject: str) -> str:
    """
    Jeton de courte duree emis apres verification du mot de passe mais avant
    le second facteur. Porte "typ": "mfa_pending" (pas de role) pour qu il ne
    puisse jamais etre accepte par get_current_user comme un vrai access token
    — seul /auth/mfa/verify sait le consommer.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=MFA_PENDING_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "typ": "mfa_pending",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except PyJWTError as exc:
        raise ValueError("Invalid token") from exc
