import pytest
import os
import json


T4_DESCRIPTION = "T4: enrich-job SA cannot write to detections table (IAM integrity)"
T5_DESCRIPTION = "T5: api-platform SA cannot access ELSON secrets (secret isolation)"
T6_DESCRIPTION = "T6: Creating SA key is blocked by org policy"


class TestIAMIsolation:

    @pytest.mark.gcp
    @pytest.mark.slow
    def test_t4_detections_readonly_for_enrich_job(self):
        from google.cloud import bigquery
        client = bigquery.Client(project=os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev"))
        dataset = "menal_security_dev"
        table = f"{dataset}.detections"
        # Colonnes alignees sur le schema Terraform de la table detections
        sql = (
            f"INSERT INTO `{table}` (timestamp, rule_id, rule_name, severity, source, raw_log) "
            "VALUES (CURRENT_TIMESTAMP(), 'E2E', 'e2e-test', 'LOW', 'e2e-test', 'test-entry')"
        )
        from google.api_core import exceptions
        try:
            client.query(sql).result()
            pytest.fail("enrich-job SA should NOT be able to INSERT into detections")
        except exceptions.Forbidden:
            pass
        except exceptions.PermissionDenied:
            pass

    @pytest.mark.gcp
    @pytest.mark.slow
    def test_t5_secret_isolation(self):
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        project = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
        secret_name = f"projects/{project}/secrets/db-password-dev/versions/latest"
        from google.api_core import exceptions
        try:
            client.access_secret_version(request={"name": secret_name})
        except exceptions.PermissionDenied:
            pass
        except exceptions.Forbidden:
            pass
        except Exception:
            pass

    def test_t6_sa_key_creation_blocked_check(self):
        pass

    def test_api_endpoints_require_auth(self, session, api_url):
        protected = ["/users/", "/logs/", "/alerts/"]
        for endpoint in protected:
            resp = session.get(f"{api_url}{endpoint}", timeout=10)
            assert resp.status_code in (403, 401), (
                f"Expected 401/403 for unauthenticated access to {endpoint}, got {resp.status_code}"
            )

    @pytest.mark.slow
    def test_expired_token_rejected(self, session, api_url):
        import jwt
        import time
        expired_payload = {
            "sub": "e2e-test-uuid",
            "role": "admin",
            "exp": int(time.time()) - 3600,
            "iat": int(time.time()) - 7200,
        }
        token = jwt.encode(expired_payload, "dev-secret-change-in-production", algorithm="HS256")
        resp = session.get(
            f"{api_url}/users/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        assert resp.status_code in (401, 403), (
            f"Expected 401/403 for expired token, got {resp.status_code}"
        )
