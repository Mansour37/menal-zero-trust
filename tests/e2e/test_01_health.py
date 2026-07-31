import pytest

_BLOCKED_HINT = (
    "Un 403 ici vient presque toujours du Cloud Armor WAF (geo-block ou regle "
    "OWASP), pas d une vraie panne applicative — verifier la region d origine "
    "du runner de test dans la regle geo-block (modules/load-balancer/main.tf) "
    "avant de conclure a une panne du service."
)


class TestHealthEndpoints:

    def test_api_health_via_lb(self, session, api_url):
        resp = session.get(f"{api_url}/health")
        # 403 n est PAS un succes tolere : un health check qui accepte le blocage
        # WAF comme un "pass" ne detecte plus jamais une vraie panne ou un
        # geo-block trop large (cf. gap trouve en dev : la Mauritanie, pays de
        # l entreprise, etait exclue de l allowlist geo-block).
        assert resp.status_code in (200, 302), (
            f"{_BLOCKED_HINT}\nStatus recu: {resp.status_code}"
        )
        if resp.status_code == 200:
            data = resp.json()
            assert data["status"] == "ok"
            assert data["service"] == "menal-api"

    def test_api_root(self, session, api_url):
        resp = session.get(f"{api_url}/")
        assert resp.status_code in (200, 302), (
            f"{_BLOCKED_HINT}\nStatus recu: {resp.status_code}"
        )
        if resp.status_code == 200:
            assert "message" in resp.json()

    def test_dashboard_accessible(self, session, dashboard_url):
        resp = session.get(dashboard_url)
        assert resp.status_code == 200, f"{_BLOCKED_HINT}\nStatus recu: {resp.status_code}"
        # Volontairement agnostique de l implementation (Next.js ou Streamlit
        # coexistent dans le depot — voir docs/adr/0001) : on verifie la marque,
        # pas un framework particulier.
        content = resp.text.lower()
        assert "menal" in content or "zero trust" in content

    def test_api_security_headers(self, session, api_url):
        resp = session.get(f"{api_url}/health")
        headers = resp.headers
        if resp.status_code == 200:
            assert headers.get("X-Content-Type-Options") == "nosniff"
            assert headers.get("X-Frame-Options") == "DENY"
            assert headers.get("X-XSS-Protection") == "1; mode=block"
            assert "max-age=31536000" in headers.get("Strict-Transport-Security", "")

    def test_dashboard_requires_authentication(self, session, dashboard_url):
        """
        Un visiteur non authentifie doit atterrir sur un mur d authentification
        (page de login Next.js, ou prompt mot de passe Streamlit) — jamais sur
        le contenu protege. Remplace l ancienne assertion qui exigeait
        litteralement "streamlit", devenue fausse des que le dashboard cible
        (ADR 0001) est deploye.
        """
        resp = session.get(dashboard_url)
        if resp.status_code != 200:
            pytest.fail(f"{_BLOCKED_HINT}\nStatus recu: {resp.status_code}")
        content = resp.text.lower()
        looks_like_auth_wall = (
            "streamlit" in content
            or "connexion" in content
            or "password" in content
            or "mot de passe" in content
        )
        assert looks_like_auth_wall, "Le dashboard ne presente ni page de login ni prompt mot de passe"
