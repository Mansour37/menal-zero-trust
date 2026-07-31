import pytest


def _is_cloud_armor_block_page(resp) -> bool:
    """
    Empreinte de la page de blocage generique GFE/Cloud Armor (pas une reponse
    applicative) : `<!doctype html>...<title>403</title>403 Forbidden`, ~134
    octets, aucune marque MENAL. Sert a distinguer un run CI legitime bloque
    par le geo-block (runner GitHub Actions hors UE/Maghreb/Mauritanie — non
    reproductible depuis un poste reellement geo-autorise) d une vraie panne
    applicative, sans jamais retomber dans l ancien piege ou 403 == succes.
    """
    if resp.status_code != 403:
        return False
    body = resp.text.strip()
    return len(body) < 300 and "403 Forbidden" in body and "menal" not in body.lower()


def _assert_reachable_or_skip_if_waf(resp, hint: str):
    if _is_cloud_armor_block_page(resp):
        pytest.skip(
            f"{hint} Reponse = page de blocage Cloud Armor generique (pas une "
            "erreur applicative) : le runner de ce test n est probablement pas "
            "dans une region autorisee par le geo-block (modules/load-balancer/"
            "main.tf). A rejouer depuis une IP UE/Maghreb/Mauritanie pour une "
            "verification stricte."
        )
    assert resp.status_code in (200, 302), (
        f"{hint} Status recu: {resp.status_code} (pas une page de blocage WAF "
        "reconnue — potentielle vraie panne)."
    )


class TestHealthEndpoints:

    def test_api_health_via_lb(self, session, api_url):
        """
        /health est explicitement exempte du geo-block (voir modules/load-
        balancer/main.tf) precisement pour rester verifiable depuis n importe
        quel runner CI — ce test doit donc TOUJOURS reussir strictement,
        aucune tolerance WAF ici.
        """
        resp = session.get(f"{api_url}/health")
        assert resp.status_code in (200, 302), f"Status recu: {resp.status_code}"
        if resp.status_code == 200:
            data = resp.json()
            assert data["status"] == "ok"
            assert data["service"] == "menal-api"

    def test_api_root(self, session, api_url):
        resp = session.get(f"{api_url}/")
        _assert_reachable_or_skip_if_waf(resp, "GET / (racine API, pas exemptee du geo-block).")
        if resp.status_code == 200:
            assert "message" in resp.json()

    def test_dashboard_accessible(self, session, dashboard_url):
        resp = session.get(dashboard_url)
        _assert_reachable_or_skip_if_waf(resp, "GET dashboard racine.")
        if resp.status_code != 200:
            return
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
        _assert_reachable_or_skip_if_waf(resp, "GET dashboard racine (mur d auth).")
        if resp.status_code != 200:
            return
        content = resp.text.lower()
        looks_like_auth_wall = (
            "streamlit" in content
            or "connexion" in content
            or "password" in content
            or "mot de passe" in content
        )
        assert looks_like_auth_wall, "Le dashboard ne presente ni page de login ni prompt mot de passe"
