# P9 — Tests E2E Zero Trust

## Plan de tests automatisés (T1–T18)

| Test | Description | Automatisé | Fichier |
|------|-------------|-----------|---------|
| **T1** | Accès direct `.run.app` bloqué (ingress LB-only) | ✅ | `test_02_security_boundaries.py::test_t1_direct_run_app_blocked` |
| **T2** | Connexion PostgreSQL depuis Internet impossible | 🔲 Manuel (vérifier pas d'IP publique) | — |
| **T3** | `ml-embed` sans jeton → 401/403/404 | ✅ Vérifié staging (01/08) | `test_02_security_boundaries.py::test_t3_ml_embed_without_token` — ingress interne renvoie 404, cf commentaire dans le test |
| **T4** | `sa-enrich-job` ne peut pas écrire dans `detections` | ❌ Échoue réellement | `test_03_iam_isolation.py::test_t4_detections_readonly_for_enrich_job` — `sa-pipeline` a `roles/bigquery.dataEditor` au niveau **projet** en staging (confirmé par lecture directe de la policy IAM) ; a executer avec les credentials du SA, pas un compte operateur |
| **T5** | `sa-api-platform` ne peut pas lire les secrets ELSON | ⚠️ Assertion corrigee (etait tautologique), a rejouer avec les bons credentials | `test_03_iam_isolation.py::test_t5_secret_isolation` — meme limite methodologique que T4 |
| **T6** | Création clé JSON de SA refusée | 🔲 Manuel (org policy) | — |
| **T7** | Pipeline rouge sur secret commité | ✅ CI | `.github/workflows/ci.yml` (Gitleaks) |
| **T8** | Pipeline rouge sur injection volontaire | ✅ CI | `.github/workflows/ci.yml` (Semgrep) |
| **T9** | Pipeline rouge sur image vulnérable | ✅ CI | `.github/workflows/ci.yml` (Trivy) |
| **T10** | Déploiement par tag interdit | ❌ Non implémenté | Aucun contrôle n'existe ; `scripts/hotfix.sh` pousse encore `:latest` |
| **T11** | SQLi bloqué par Cloud Armor | ⚠️ Assertion trop permissive (accepte 200) | `test_02_security_boundaries.py::test_t11_sqli_blocked_by_waf` |
| **T12** | Egress non déclaré bloqué | 🔲 Manuel | — |
| **T13** | Attaque simulée → SIEM enrichi | ⚠️ Partiel | `test_04_pipeline_integration.py::test_t13_simulated_attack_pipeline` |
| **T14** | Détection sémantique sans règle Sigma | ✅ Fonctionnel en staging depuis le 01/08 (vrai ATTACK-BERT, plus d'encodeur simulé) | `test_04_pipeline_integration.py::test_t14_enrichment_processes_new_detections` |
| **T15** | Dérive Terraform détectée | 🔲 Manuel | `terraform plan` |
| **T16** | Scan IaC bloque mauvaise config | 🔲 Manuel | Pipeline infra F7 |
| **T17** | Isolation inter-environnements | 🔲 Manuel | WIF condition |
| **T18** | Digest identique dev→staging→prod | 🔲 Manuel | Promotion |

## Exécution

```bash
# Tests rapides (health, boundaries)
pytest tests/e2e/ -v -m "not slow and not gcp"

# Tests complets (nécessite credentials GCP)
export E2E_RUN_SLOW=1
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
pytest tests/e2e/ -v

# CI uniquement
pytest tests/e2e/ -v -x --timeout=30
```
