import pytest
import os
import time

T13_DESCRIPTION = "T13: Simulated attack (real brute-force traffic) produces a Sigma detection"
T14_DESCRIPTION = "T14: ML enrichment (L6) processes newly produced detections"

# Cycle reel documente (voir modules/logging/main.tf flux F4 et
# modules/detection/main.tf) : sink Cloud Logging -> normalisation F4 (5 min)
# -> regle Sigma planifiee (5 min). On borne l attente au lieu de dormir a
# l aveugle, et on relance a intervalle court pour detecter la convergence des
# qu elle survient plutot qu au bout du delai maximal.
_POLL_INTERVAL_S = 30
_MAX_WAIT_S = 12 * 60


def _count(bq, project, dataset, table, where=""):
    sql = f"SELECT COUNT(*) AS cnt FROM `{project}.{dataset}.{table}`"
    if where:
        sql += f" WHERE {where}"
    return list(bq.query(sql).result())[0].cnt


def _wait_until(predicate, interval_s=_POLL_INTERVAL_S, max_wait_s=_MAX_WAIT_S):
    deadline = time.time() + max_wait_s
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval_s)
    return predicate()


@pytest.mark.slow
class TestPipelineIntegration:

    @pytest.mark.gcp
    def test_t13_simulated_attack_pipeline(self, session, api_url):
        """
        La version precedente de ce test inserait directement une ligne
        synthetique dans `raw_logs` puis affirmait que `detections` restait a
        0 — un test qui passait donc TOUJOURS, que le pipeline fonctionne ou
        non. En realite `access_logs` (source des regles Sigma, voir R1 dans
        modules/detection/main.tf) n est alimentee QUE par la normalisation
        des vrais logs Cloud Run (`run_googleapis_com_requests`) : un insert
        direct dans `raw_logs` ne peut structurellement jamais declencher une
        regle. Ce test genere donc du VRAI trafic HTTP (echecs d authentification
        repetes depuis la meme IP, > 5 en 5 min = seuil R1) et attend la
        propagation reelle bout en bout.
        """
        from google.cloud import bigquery
        from google.api_core import exceptions
        import requests as _requests

        project = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
        dataset = "menal_security_dev"
        bq = bigquery.Client(project=project)

        try:
            before = _count(bq, project, dataset, "detections", "rule_id = 'R1'")
        except exceptions.NotFound:
            pytest.skip("Table detections introuvable")

        try:
            for _ in range(8):
                session.post(
                    f"{api_url}/auth/token",
                    data={"username": "e2e-t13-nonexistent@menal.mr", "password": "wrong-on-purpose"},
                    timeout=10,
                )
        except _requests.RequestException:
            pytest.skip("API non joignable depuis ce runner pour generer le trafic T13")

        found = _wait_until(
            lambda: _count(bq, project, dataset, "detections", "rule_id = 'R1'") > before
        )
        assert found, (
            f"Aucune nouvelle detection R1 apres {_MAX_WAIT_S}s malgre >5 echecs "
            "d authentification generes depuis la meme IP — verifier le sink LB/"
            "Cloud Run, la normalisation F4 (access_logs) et la regle R1."
        )

    @pytest.mark.gcp
    def test_t14_enrichment_processes_new_detections(self):
        """
        L ancienne assertion (`COUNT(*) >= 0`) est une tautologie : un COUNT ne
        peut jamais etre negatif, donc ce test ne pouvait jamais echouer et ne
        verifiait rien. La vraie valeur ajoutee de L6 (voir enrich-job/main.py)
        est de produire une ligne `alert_enrichment` (mapped OU unmapped, peu
        importe) pour chaque detection recente — c est ce qu on verifie ici,
        par un delta avant/apres borne dans le temps plutot qu un seuil absolu
        qui serait faux dans un environnement fraichement provisionne.
        """
        from google.cloud import bigquery
        from google.api_core import exceptions

        project = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
        dataset = "menal_security_dev"
        bq = bigquery.Client(project=project)

        try:
            recent_detections = _count(
                bq, project, dataset, "detections",
                "timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)",
            )
        except exceptions.NotFound:
            pytest.skip("Table detections introuvable")
        if recent_detections == 0:
            pytest.skip("Aucune detection recente a enrichir (executer test_t13 d abord)")

        try:
            before = _count(bq, project, dataset, "alert_enrichment")
        except exceptions.NotFound:
            pytest.skip("Table alert_enrichment introuvable")

        found = _wait_until(
            lambda: _count(bq, project, dataset, "alert_enrichment") > before
        )
        assert found, (
            f"alert_enrichment n a pas grandi apres {_MAX_WAIT_S}s alors que "
            f"{recent_detections} detection(s) recente(s) existent — verifier "
            "le Scheduler enrich-job et l appel ml-embed."
        )

    def test_dashboard_ui_components(self, session, dashboard_url):
        resp = session.get(dashboard_url, timeout=10)
        assert resp.status_code == 200
        page_text = resp.text.lower()
        keywords = ["menal", "zero trust", "sécurité", "security"]
        found = any(kw in page_text for kw in keywords)
        assert found, "Dashboard should display MENAL/Zerotrust branding"
