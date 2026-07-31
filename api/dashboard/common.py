"""Helpers partagés par toutes les pages du dashboard MENAL."""
import hmac
import os

import streamlit as st


def get_conf(key: str, default: str = "") -> str:
    """Config env-first (Cloud Run), avec repli sur st.secrets (dev local)."""
    value = os.getenv(key)
    if value:
        return value
    try:
        return st.secrets[key]
    except Exception:
        return default


def require_auth() -> None:
    """Porte d'authentification — à appeler en tête de CHAQUE page."""
    password = get_conf("DASHBOARD_PASSWORD")
    if not password:
        st.error("DASHBOARD_PASSWORD not configured")
        st.stop()

    if st.session_state.get("authenticated"):
        return

    supplied = st.text_input("Password", type="password")
    if st.button("Login"):
        if hmac.compare_digest(supplied or "", password):
            st.session_state.authenticated = True
            st.rerun()
        else:
            st.error("Invalid password")
    st.stop()
