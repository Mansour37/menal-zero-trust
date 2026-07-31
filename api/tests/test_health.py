import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app, raise_server_exceptions=False)


# ── Tests /health et / ────────────────────────────────────────────────────────

def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_returns_service_name():
    response = client.get("/health")
    assert response.json()["service"] == "menal-api"


def test_health_returns_version():
    response = client.get("/health")
    assert response.json()["version"] == "0.3.1"


def test_root_returns_message():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


# ── Tests security headers ─────────────────────────────────────────────────────

def test_security_headers_present():
    response = client.get("/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"


# ── Tests JWT (sans BDD) ──────────────────────────────────────────────────────

def test_create_and_decode_token():
    from app.auth.jwt import create_access_token, decode_token
    token = create_access_token("user-uuid", "admin")
    payload = decode_token(token)
    assert payload["sub"] == "user-uuid"
    assert payload["role"] == "admin"


def test_decode_invalid_token_raises():
    from app.auth.jwt import decode_token
    with pytest.raises(ValueError):
        decode_token("this.is.not.a.valid.token")


# ── Tests RBAC ────────────────────────────────────────────────────────────────

def test_users_requires_auth():
    response = client.get("/users/")
    # 401 (FastAPI >= 0.112, RFC 7235) ou 403 (anciennes versions de HTTPBearer)
    assert response.status_code in (401, 403)


def test_logs_requires_auth():
    response = client.get("/logs/")
    # 401 (FastAPI >= 0.112, RFC 7235) ou 403 (anciennes versions de HTTPBearer)
    assert response.status_code in (401, 403)


def test_alerts_requires_auth():
    response = client.get("/alerts/")
    # 401 (FastAPI >= 0.112, RFC 7235) ou 403 (anciennes versions de HTTPBearer)
    assert response.status_code in (401, 403)


def test_viewer_cannot_access_users():
    from app.auth.jwt import create_access_token
    token = create_access_token("some-uuid", "viewer")
    response = client.get("/users/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_admin_can_list_users():
    from app.auth.jwt import create_access_token
    token = create_access_token("some-uuid", "admin")
    mock_session = MagicMock()
    mock_session.__enter__ = MagicMock(return_value=mock_session)
    mock_session.__exit__ = MagicMock(return_value=False)
    mock_session.query.return_value.all.return_value = []
    with patch("app.routers.users.get_engine"):
        with patch("app.routers.users.Session", return_value=mock_session):
            response = client.get("/users/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []


def test_viewer_can_list_logs():
    from app.auth.jwt import create_access_token
    token = create_access_token("some-uuid", "viewer")
    mock_session = MagicMock()
    mock_session.__enter__ = MagicMock(return_value=mock_session)
    mock_session.__exit__ = MagicMock(return_value=False)
    (mock_session.query.return_value
     .order_by.return_value
     .offset.return_value
     .limit.return_value
     .all.return_value) = []
    with patch("app.routers.logs.get_engine"):
        with patch("app.routers.logs.Session", return_value=mock_session):
            response = client.get("/logs/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []


def test_viewer_can_list_alerts():
    from app.auth.jwt import create_access_token
    token = create_access_token("some-uuid", "viewer")
    mock_session = MagicMock()
    mock_session.__enter__ = MagicMock(return_value=mock_session)
    mock_session.__exit__ = MagicMock(return_value=False)
    (mock_session.query.return_value
     .filter.return_value
     .order_by.return_value
     .offset.return_value
     .limit.return_value
     .all.return_value) = []
    with patch("app.routers.alerts.get_engine"):
        with patch("app.routers.alerts.Session", return_value=mock_session):
            response = client.get("/alerts/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []


def test_expired_token_returns_401():
    from datetime import datetime, timezone, timedelta
    import jwt
    from app.config import settings
    expired_payload = {
        "sub": "uuid",
        "role": "admin",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    token = jwt.encode(expired_payload, settings.JWT_SECRET, algorithm="HS256")
    response = client.get("/users/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


# ── Test /auth/token ──────────────────────────────────────────────────────────

def test_token_rejects_bad_credentials():
    mock_session = MagicMock()
    mock_session.__enter__ = MagicMock(return_value=mock_session)
    mock_session.__exit__ = MagicMock(return_value=False)
    mock_session.query.return_value.filter.return_value.first.return_value = None
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=mock_session):
            response = client.post(
                "/auth/token",
                data={"username": "unknown@menal.mr", "password": "wrong"},
            )
    assert response.status_code == 401
