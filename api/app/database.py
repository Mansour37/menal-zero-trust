from google.cloud.sql.connector import Connector, IPTypes
import sqlalchemy
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

_connector: Connector | None = None
_engine: sqlalchemy.Engine | None = None


def _get_connector() -> Connector:
    global _connector
    if _connector is None:
        _connector = Connector()
    return _connector


def _getconn():
    conn = _get_connector().connect(
        settings.CLOUD_SQL_CONNECTION_NAME,
        "pg8000",
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        db=settings.DB_NAME,
        ip_type=IPTypes.PRIVATE,
    )
    return conn


def get_engine() -> sqlalchemy.Engine:
    global _engine
    if _engine is None:
        _engine = sqlalchemy.create_engine(
            "postgresql+pg8000://",
            creator=_getconn,
            pool_size=5,
            max_overflow=2,
            pool_timeout=30,
            pool_recycle=1800,
        )
    return _engine


SessionLocal = sessionmaker(autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    SessionLocal.configure(bind=get_engine())
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
