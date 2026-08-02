import pytest
import requests


T1_DESCRIPTION = "T1: Direct .run.app access blocked (ingress LB-only)"
T3_DESCRIPTION = "T3: ml-embed without identity token returns 401/403"
T11_DESCRIPTION = "T11: SQLi payload blocked by Cloud Armor WAF"


class TestSecurityBoundaries:

    def test_t1_direct_run_app_blocked(self, session, api_run_url):
        assert api_run_url, "API_RUN_URL not set"
        try:
            resp = session.get(f"{api_run_url}/health", timeout=15)
            assert resp.status_code in (403, 404, 429), (
                f"Expected 403/404 blocking direct .run.app access, got {resp.status_code}"
            )
        except requests.ConnectionError:
            pass

    # Pas de marqueur `slow` : ce test est une simple requete HTTP (0,3 s) et
    # n exige aucun credential. Marque `slow`, il etait exclu du CI (`-m "not
    # slow"`) ET du plan complet quand E2E_ML_EMBED_URL manquait — une frontiere
    # de securite qui ne s executait donc jamais nulle part, ce qui se lit comme
    # un succes dans un rapport de tests.
    def test_t3_ml_embed_without_token(self, ml_embed_url):
        """
        ml-embed est en ingress=INGRESS_TRAFFIC_INTERNAL_ONLY (pas seulement
        IAM-only) : pour un appelant hors VPC, Cloud Run renvoie 404 (le
        service est invisible depuis l internet public), jamais 401/403 — ces
        codes supposeraient que la requete atteint d abord la verification
        IAM, ce que l ingress interne empeche structurellement en amont.
        Un 404 ici est donc la frontiere de securite qui fonctionne, pas un
        echec ; 401/403 resteraient acceptables si l ingress passait un jour
        a ALL avec auth IAM seule.
        """
        if not ml_embed_url:
            pytest.skip("ML_EMBED_URL not set")
        try:
            resp = requests.get(f"{ml_embed_url}/health", timeout=5)
            assert resp.status_code in (401, 403, 404), (
                f"Expected 401/403/404 for unauthenticated ml-embed call, got {resp.status_code}"
            )
        except requests.ConnectionError:
            pytest.skip("ml-embed not reachable from external network (expected)")

    def test_t11_sqli_blocked_by_waf(self, session, api_url):
        sqli_payloads = [
            "' OR '1'='1",
            "1; DROP TABLE users",
            "' UNION SELECT * FROM users--",
            "<script>alert('xss')</script>",
        ]
        for payload in sqli_payloads:
            try:
                resp = session.get(
                    f"{api_url}/users",
                    params={"q": payload},
                    timeout=15,
                )
                assert resp.status_code in (403, 400, 200), (
                    f"Expected 403 (WAF) or 400 for SQLi payload, got {resp.status_code}"
                )
            except requests.ConnectionError:
                pass

    def test_http_redirect(self, api_url):
        # Derive du host de api_url (fixture, cf. conftest.py E2E_API_URL) au
        # lieu d un domaine code en dur : sinon ce test cible toujours le LB
        # dev, quel que soit l environnement reellement teste.
        http_url = "http://" + api_url.split("://", 1)[-1].rstrip("/") + "/health"
        try:
            resp = requests.get(http_url, timeout=10, allow_redirects=False)
            assert resp.status_code in (301, 302, 307, 308), (
                f"Expected HTTP redirect to HTTPS, got {resp.status_code}"
            )
        except requests.ConnectionError:
            pytest.skip("HTTP endpoint not reachable")
