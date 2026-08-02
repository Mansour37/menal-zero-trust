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

# T14 attend en plus la PROCHAINE execution du scheduler enrich-job (cadence
# 15 min, cf. modules/ml-pipeline/main.tf google_cloud_scheduler_job). Verifie
# en staging le 01/08 : une detection R1 produite a 02:46:06 (au moment meme
# d un run enrich-job qui l a manquee de justesse) n a ete enrichie que par le
# run SUIVANT a 03:00:47 — 14min41s plus tard, au-dela de l ancien budget de
# 12 min. Le budget doit couvrir un cycle scheduler complet, pas seulement F4+Sigma.
_MAX_WAIT_ENRICH_S = 20 * 60


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
        dataset = os.getenv("BQ_DATASET", "menal_security_dev")
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
        Invariant verifie : toute detection recente finit par recevoir une
        ligne `alert_enrichment` (mapped OU unmapped, peu importe).

        Deux formulations precedentes etaient fausses :
          - `COUNT(*) >= 0` : tautologie, ne pouvait jamais echouer ;
          - « la table a grandi » : mesurait un effet de bord. Tant que
            enrich-job re-enrichissait les memes detections a chaque cycle,
            la table grandissait meme quand rien de neuf n etait traite ;
            depuis la deduplication (enrich-job/main.py, fetch_pending_
            detections), elle NE grandit plus si tout est deja enrichi — ce
            qui est le comportement correct, mais faisait echouer le test.

        On mesure donc la COUVERTURE : combien de detections recentes n ont
        pas encore d enrichissement. Le rapprochement utilise la meme cle que
        le job (JSON {rule_id, timestamp} produit par json.dumps cote Python),
        reconstruite ici en SQL a l identique — d ou le FORMAT_TIMESTAMP et
        les espaces apres ':' et ',', qui doivent correspondre au caractere
        pres a la sortie de json.dumps.
        """
        from google.cloud import bigquery
        from google.api_core import exceptions

        project = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
        dataset = os.getenv("BQ_DATASET", "menal_security_dev")
        bq = bigquery.Client(project=project)

        detection_key_sql = (
            """CONCAT('{"rule_id": "', d.rule_id, '", "timestamp": "',"""
            """ FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%E6S+00:00', d.timestamp), '"}')"""
        )
        unenriched_sql = f"""
            SELECT COUNT(*) AS cnt
            FROM `{project}.{dataset}.detections` d
            WHERE d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
              AND NOT EXISTS (
                SELECT 1 FROM `{project}.{dataset}.alert_enrichment` e
                WHERE e.detection_id = {detection_key_sql}
              )
        """

        try:
            recent = _count(
                bq, project, dataset, "detections",
                "timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)",
            )
        except exceptions.NotFound:
            pytest.skip("Table detections introuvable")
        if recent == 0:
            pytest.skip("Aucune detection recente a enrichir (executer test_t13 d abord)")

        def _unenriched():
            return list(bq.query(unenriched_sql).result())[0].cnt

        try:
            covered = _wait_until(lambda: _unenriched() == 0, max_wait_s=_MAX_WAIT_ENRICH_S)
        except exceptions.NotFound:
            pytest.skip("Table alert_enrichment introuvable")

        assert covered, (
            f"{_unenriched()} des {recent} detection(s) des 2 dernieres heures n ont "
            f"toujours pas d enrichissement apres {_MAX_WAIT_ENRICH_S}s — verifier "
            "le Scheduler enrich-job, l appel ml-embed et la cle detection_id."
        )

    def test_dashboard_ui_components(self, session, dashboard_url):
        resp = session.get(dashboard_url, timeout=10)
        if resp.status_code == 403 and len(resp.text.strip()) < 300 and "403 Forbidden" in resp.text:
            pytest.skip(
                "Page de blocage Cloud Armor generique — runner hors region "
                "autorisee par le geo-block (voir test_01_health.py), pas une "
                "panne du dashboard."
            )
        assert resp.status_code == 200
        page_text = resp.text.lower()
        keywords = ["menal", "zero trust", "sécurité", "security"]
        found = any(kw in page_text for kw in keywords)
        assert found, "Dashboard should display MENAL/Zerotrust branding"
