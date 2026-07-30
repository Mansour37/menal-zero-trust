from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
import bcrypt
from sqlalchemy.orm import Session
from app.auth.dependencies import require_role
from app.database import get_engine
from app.models.user import User
from app.models.role import Role
import uuid

router = APIRouter(prefix="/users", tags=["users"])


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
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
            hashed_password=bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode(),
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
