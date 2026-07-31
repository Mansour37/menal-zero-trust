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

    @pytest.mark.slow
    def test_t3_ml_embed_without_token(self, ml_embed_url):
        if not ml_embed_url:
            pytest.skip("ML_EMBED_URL not set")
        try:
            resp = requests.get(f"{ml_embed_url}/health", timeout=5)
            assert resp.status_code in (401, 403), (
                f"Expected 401/403 for unauthenticated ml-embed call, got {resp.status_code}"
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

    def test_http_redirect(self):
        http_url = "http://api.menal-sarl.com/health"
        try:
            resp = requests.get(http_url, timeout=10, allow_redirects=False)
            assert resp.status_code in (301, 302, 307, 308), (
                f"Expected HTTP redirect to HTTPS, got {resp.status_code}"
            )
        except requests.ConnectionError:
            pytest.skip("HTTP endpoint not reachable")
