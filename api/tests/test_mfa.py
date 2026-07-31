import uuid
import bcrypt
import pyotp
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
from app.auth.jwt import create_access_token, create_mfa_pending_token

client = TestClient(app, raise_server_exceptions=False)

PASSWORD = "correct-horse-battery-staple"
PASSWORD_HASH = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()


def _fake_user(user_id, mfa_enabled=False, mfa_secret=None, is_active=True):
    user = MagicMock()
    user.id = user_id
    user.email = "soc-analyst@menal.mr"
    user.hashed_password = PASSWORD_HASH
    user.is_active = is_active
    user.mfa_enabled = mfa_enabled
    user.mfa_secret = mfa_secret
    user.role = MagicMock(name="admin")
    user.role.name = "admin"
    return user


def _session_returning(user):
    mock_session = MagicMock()
    mock_session.__enter__ = MagicMock(return_value=mock_session)
    mock_session.__exit__ = MagicMock(return_value=False)
    mock_session.query.return_value.filter.return_value.first.return_value = user
    return mock_session


# ── /auth/token ────────────────────────────────────────────────────────────

def test_login_without_mfa_returns_access_token_directly():
    user = _fake_user(uuid.uuid4(), mfa_enabled=False)
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/token",
                data={"username": user.email, "password": PASSWORD},
            )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "mfa_required" not in body


def test_login_with_mfa_enabled_returns_challenge_not_token():
    user = _fake_user(uuid.uuid4(), mfa_enabled=True, mfa_secret=pyotp.random_base32())
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/token",
                data={"username": user.email, "password": PASSWORD},
            )
    assert response.status_code == 200
    body = response.json()
    assert body["mfa_required"] is True
    assert "mfa_token" in body
    assert "access_token" not in body


def test_login_wrong_password_never_reveals_mfa_status():
    user = _fake_user(uuid.uuid4(), mfa_enabled=True, mfa_secret=pyotp.random_base32())
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/token",
                data={"username": user.email, "password": "wrong-password"},
            )
    assert response.status_code == 401


# ── /auth/mfa/verify ─────────────────────────────────────────────────────────

def test_mfa_verify_succeeds_with_valid_totp_code():
    user_id = uuid.uuid4()
    secret = pyotp.random_base32()
    user = _fake_user(user_id, mfa_enabled=True, mfa_secret=secret)
    mfa_token = create_mfa_pending_token(str(user_id))
    valid_code = pyotp.TOTP(secret).now()
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/mfa/verify",
                json={"mfa_token": mfa_token, "code": valid_code},
            )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_mfa_verify_rejects_wrong_code():
    user_id = uuid.uuid4()
    secret = pyotp.random_base32()
    user = _fake_user(user_id, mfa_enabled=True, mfa_secret=secret)
    mfa_token = create_mfa_pending_token(str(user_id))
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/mfa/verify",
                json={"mfa_token": mfa_token, "code": "000000"},
            )
    assert response.status_code == 401


def test_mfa_verify_rejects_a_normal_access_token():
    # Un access token classique n est pas un challenge MFA valide ("typ" != mfa_pending).
    token = create_access_token(str(uuid.uuid4()), "admin")
    response = client.post("/auth/mfa/verify", json={"mfa_token": token, "code": "123456"})
    assert response.status_code == 401


def test_mfa_verify_rejects_expired_challenge():
    from datetime import datetime, timezone, timedelta
    import jwt as pyjwt
    from app.config import settings
    expired_payload = {
        "sub": str(uuid.uuid4()),
        "typ": "mfa_pending",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    token = pyjwt.encode(expired_payload, settings.JWT_SECRET, algorithm="HS256")
    response = client.post("/auth/mfa/verify", json={"mfa_token": token, "code": "123456"})
    assert response.status_code == 401


# ── /auth/mfa/setup + /auth/mfa/enable ──────────────────────────────────────

def test_setup_then_enable_mfa_flow():
    user_id = uuid.uuid4()
    user = _fake_user(user_id, mfa_enabled=False)
    access_token = create_access_token(str(user_id), "admin")

    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            setup_response = client.post(
                "/auth/mfa/setup",
                headers={"Authorization": f"Bearer {access_token}"},
            )
    assert setup_response.status_code == 200
    setup_body = setup_response.json()
    assert "secret" in setup_body
    assert setup_body["otpauth_uri"].startswith("otpauth://totp/")

    # Le secret genere par /setup est stocke sur le mock user (attribution reelle).
    valid_code = pyotp.TOTP(user.mfa_secret).now()

    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            enable_response = client.post(
                "/auth/mfa/enable",
                json={"code": valid_code},
                headers={"Authorization": f"Bearer {access_token}"},
            )
    assert enable_response.status_code == 200
    assert enable_response.json()["enabled"] is True


def test_enable_mfa_without_setup_fails():
    user_id = uuid.uuid4()
    user = _fake_user(user_id, mfa_enabled=False, mfa_secret=None)
    access_token = create_access_token(str(user_id), "admin")
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/mfa/enable",
                json={"code": "123456"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
    assert response.status_code == 400


def test_mfa_setup_requires_authentication():
    response = client.post("/auth/mfa/setup")
    assert response.status_code in (401, 403)


# ── /auth/mfa/disable ────────────────────────────────────────────────────────

def test_disable_mfa_requires_correct_password_and_code():
    user_id = uuid.uuid4()
    secret = pyotp.random_base32()
    user = _fake_user(user_id, mfa_enabled=True, mfa_secret=secret)
    access_token = create_access_token(str(user_id), "admin")
    valid_code = pyotp.TOTP(secret).now()

    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/mfa/disable",
                json={"password": PASSWORD, "code": valid_code},
                headers={"Authorization": f"Bearer {access_token}"},
            )
    assert response.status_code == 200
    assert response.json()["enabled"] is False


def test_disable_mfa_rejects_wrong_password():
    user_id = uuid.uuid4()
    secret = pyotp.random_base32()
    user = _fake_user(user_id, mfa_enabled=True, mfa_secret=secret)
    access_token = create_access_token(str(user_id), "admin")
    valid_code = pyotp.TOTP(secret).now()

    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.post(
                "/auth/mfa/disable",
                json={"password": "not-the-password", "code": valid_code},
                headers={"Authorization": f"Bearer {access_token}"},
            )
    assert response.status_code == 401


# ── /auth/mfa/status ─────────────────────────────────────────────────────────

def test_mfa_status_reflects_user_state():
    user_id = uuid.uuid4()
    user = _fake_user(user_id, mfa_enabled=True, mfa_secret=pyotp.random_base32())
    access_token = create_access_token(str(user_id), "admin")
    with patch("app.auth.router.get_engine"):
        with patch("app.auth.router.Session", return_value=_session_returning(user)):
            response = client.get(
                "/auth/mfa/status",
                headers={"Authorization": f"Bearer {access_token}"},
            )
    assert response.status_code == 200
    assert response.json()["enabled"] is True
