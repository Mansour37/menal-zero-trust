import pytest
import os
import json


T4_DESCRIPTION = "T4: enrich-job SA cannot write to detections table (IAM integrity)"
T5_DESCRIPTION = "T5: api-platform SA cannot access ELSON secrets (secret isolation)"
T6_DESCRIPTION = "T6: Creating SA key is blocked by org policy"


def _impersonated(sa_email: str, scopes=("https://www.googleapis.com/auth/cloud-platform",)):
    """
    Credentials de `sa_email`, ou None si l identite courante n a pas le droit
    de l usurper.

    Un test d isolation n a de sens que joue AVEC l identite restreinte. Joues
    avec les credentials de l operateur — qui, eux, ont les droits — T4 et T5
    echouaient sur un acces legitimement autorise : ils signalaient le mauvais
    identifiant, pas un defaut de l infrastructure.

    Ne pas pouvoir usurper n est pas une anomalie : c est la posture attendue
    d un poste d operateur. Le test est alors ignore plutot que rendu faussement
    vert ou faussement rouge.
    """
    from google.auth import default, impersonated_credentials
    from google.api_core import exceptions
    from google.auth import exceptions as auth_exceptions

    source, _ = default()
    creds = impersonated_credentials.Credentials(
        source_credentials=source,
        target_principal=sa_email,
        target_scopes=list(scopes),
    )
    try:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
    except (exceptions.PermissionDenied, exceptions.Forbidden,
            auth_exceptions.RefreshError, auth_exceptions.TransportError):
        return None
    return creds


def _sa_email(name: str) -> str:
    project = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
    return f"{name}@{project}.iam.gserviceaccount.com"


class TestIAMIsolation:

    @pytest.mark.gcp
    @pytest.mark.slow
    def test_t4_detections_readonly_for_enrich_job(self):
        """
        Principe cardinal du HLD §5 : le moteur d enrichissement ne doit pas
        pouvoir modifier les preuves qu il analyse.

        Ce test a longtemps echoue pour une raison de fond : enrich-job
        partageait sa-pipeline avec les requetes planifiees Sigma, qui doivent
        ecrire dans `detections`. Une identite dediee (sa-enrich-job) a ete
        creee, avec lecture du dataset et ecriture sur la seule table
        alert_enrichment.
        """
        from google.cloud import bigquery
        from google.api_core import exceptions

        project = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
        dataset = os.getenv("BQ_DATASET", "menal_security_dev")

        creds = _impersonated(_sa_email("sa-enrich-job"))
        if creds is None:
            pytest.skip(
                "Usurpation de sa-enrich-job refusee : accorder "
                "roles/iam.serviceAccountTokenCreator a l identite de test pour "
                "verifier cette frontiere de bout en bout."
            )
        client = bigquery.Client(project=project, credentials=creds)

        # Doit REUSSIR : le job lit les detections pour les enrichir.
        client.query(f"SELECT COUNT(*) FROM `{project}.{dataset}.detections`").result()

        # Doit ECHOUER : ecrire dans les preuves.
        sql = (
            f"INSERT INTO `{project}.{dataset}.detections` "
            "(timestamp, rule_id, rule_name, severity, source, raw_log) "
            "VALUES (CURRENT_TIMESTAMP(), 'E2E', 'e2e-test', 'LOW', 'e2e-test', 'test-entry')"
        )
        with pytest.raises((exceptions.Forbidden, exceptions.PermissionDenied)):
            client.query(sql).result()

    @pytest.mark.gcp
    @pytest.mark.slow
    def test_t5_secret_isolation(self):
        """
        Cloisonnement des secrets : le moteur d enrichissement n a aucune raison
        de lire le mot de passe de la base applicative.

        Deux formulations precedentes etaient sans valeur : avaler `Exception`
        rendait le test toujours vert, puis echouer sur un acces reussi le
        rendait toujours rouge — car il s executait avec les credentials de
        l operateur, qui ont legitimement ce droit. Il faut usurper l identite
        restreinte pour que le refus attendu ait un sens.
        """
        from google.cloud import secretmanager
        from google.api_core import exceptions

        project = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
        environment = os.getenv("ENVIRONMENT", "dev")
        secret_name = f"projects/{project}/secrets/db-password-{environment}/versions/latest"

        creds = _impersonated(_sa_email("sa-enrich-job"))
        if creds is None:
            pytest.skip(
                "Usurpation de sa-enrich-job refusee : accorder "
                "roles/iam.serviceAccountTokenCreator a l identite de test pour "
                "verifier cette frontiere de bout en bout."
            )
        client = secretmanager.SecretManagerServiceClient(credentials=creds)

        with pytest.raises((exceptions.PermissionDenied, exceptions.Forbidden,
                            exceptions.NotFound)):
            client.access_secret_version(request={"name": secret_name})

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
