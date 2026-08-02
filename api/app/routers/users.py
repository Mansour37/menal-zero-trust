from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
import bcrypt
from sqlalchemy.orm import Session
from app.auth.dependencies import require_role
from app.database import get_engine
from app.models.user import User
from app.models.role import Role
import uuid

router = APIRouter(prefix="/users", tags=["users"])

# bcrypt tronque silencieusement au-dela de 72 octets ; on borne explicitement
# pour eviter un 500 et un faux sentiment de robustesse sur les longs mots de passe.
BCRYPT_MAX_BYTES = 72


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    # Politique minimale : au moins 12 caracteres. Auparavant aucune contrainte
    # (le mot de passe "1" etait accepte).
    password: str = Field(min_length=12, max_length=BCRYPT_MAX_BYTES)
    role_name: str = "viewer"


@router.get("/", response_model=list[UserOut])
def list_users(current_user: dict = Depends(require_role("admin"))):
    engine = get_engine()
    with Session(engine) as session:
        users = session.query(User).all()
        return [
            UserOut(
                id=str(u.id),
                email=u.email,
                role=u.role.name if u.role else "unknown",
                is_active=u.is_active,
            )
            for u in users
        ]


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: dict = Depends(require_role("admin")),
):
    engine = get_engine()
    with Session(engine) as session:
        existing = session.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        role = session.query(Role).filter(Role.name == payload.role_name).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{payload.role_name}' not found",
            )
        user = User(
            id=uuid.uuid4(),
            email=payload.email,
            hashed_password=bcrypt.hashpw(payload.password.encode("utf-8")[:BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode(),
            role_id=role.id,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return UserOut(
            id=str(user.id),
            email=user.email,
            role=role.name,
            is_active=user.is_active,
        )
