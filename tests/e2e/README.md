# P9 — Tests E2E Zero Trust

Statuts T4, T10, T17, T18 rafraîchis le 07-08/08/2026 suite à l'audit E2E staging et à la remédiation Tier 0/1/2 — détail complet et preuves dans `09_AUDIT_E2E_STAGING_2026-08-07.md` et `03_CAS_UTILISATION.md`.

## Plan de tests automatisés (T1–T18)

| Test | Description | Automatisé | Fichier |
|------|-------------|-----------|---------|
| **T1** | Accès direct `.run.app` bloqué (ingress LB-only) | ✅ | `test_02_security_boundaries.py::test_t1_direct_run_app_blocked` |
| **T2** | Connexion PostgreSQL depuis Internet impossible | 🔲 Manuel (vérifier pas d'IP publique) | — |
| **T3** | `ml-embed` sans jeton → 401/403/404 | ✅ Vérifié staging (01/08) | `test_02_security_boundaries.py::test_t3_ml_embed_without_token` — ingress interne renvoie 404, cf commentaire dans le test |
| **T4** | `sa-enrich-job` ne peut pas écrire dans `detections` | 🟡 Probablement corrigé, à rejouer avec les bons credentials | `test_03_iam_isolation.py::test_t4_detections_readonly_for_enrich_job` — le constat "projet" ci-dessus est **périmé** : vérifié en live le 07/08 (`gcloud projects get-iam-policy`), aucun SA applicatif (dont sa-pipeline) n'a de binding `bigquery.dataEditor` au niveau **projet** ; sa-pipeline a bien `dataEditor` mais scopé au **dataset** (`terraform/modules/bigquery/main.tf:17-22`), cohérent avec la création de `sa-enrich-job` dédié (E2, comblé 02/08) qui, lui, n'a que l'écriture sur `alert_enrichment`. `sa-cicd` (différent de sa-pipeline) a aussi été resserré du dataset à `cve_findings` seul le 08/08. À rejouer avec les credentials du bon SA pour clore formellement le test. |
| **T5** | `sa-api-platform` ne peut pas lire les secrets ELSON | ⚠️ Assertion corrigee (etait tautologique), a rejouer avec les bons credentials | `test_03_iam_isolation.py::test_t5_secret_isolation` — meme limite methodologique que T4 |
| **T6** | Création clé JSON de SA refusée | 🔲 Manuel (org policy) | — |
| **T7** | Pipeline rouge sur secret commité | ✅ CI | `.github/workflows/ci.yml` (Gitleaks) |
| **T8** | Pipeline rouge sur injection volontaire | ✅ CI | `.github/workflows/ci.yml` (Semgrep) |
| **T9** | Pipeline rouge sur image vulnérable | ✅ CI | `.github/workflows/ci.yml` (Trivy) |
| **T10** | Déploiement par tag interdit | 🟡 Partiellement fermé le 08/08 | Le chemin CI continue de déployer par tag SHA de commit (traçable, pas un digest cryptographique). Mais le chemin `terraform apply` (bootstrap/disaster recovery), qui retombait auparavant sur `:latest` mutable, résout désormais un digest réel via `data "google_artifact_registry_docker_image"` (`terraform/environments/staging/main.tf`) — no-op sur le régime CI courant (`lifecycle.ignore_changes`), ne joue qu'à une reconstruction. `scripts/hotfix.sh` pousse toujours vers Docker Hub personnel sans lien commit ni scan Trivy — risque assumé (M2), non touché. Aucun contrôle CI qui *bloquerait* un déploiement par tag pur : le test reste non automatisé. |
| **T11** | SQLi bloqué par Cloud Armor | ⚠️ Assertion trop permissive (accepte 200) | `test_02_security_boundaries.py::test_t11_sqli_blocked_by_waf` |
| **T12** | Egress non déclaré bloqué | 🔲 Manuel | — |
| **T13** | Attaque simulée → SIEM enrichi | ⚠️ Partiel | `test_04_pipeline_integration.py::test_t13_simulated_attack_pipeline` |
| **T14** | Détection sémantique sans règle Sigma | ✅ Fonctionnel en staging depuis le 01/08 (vrai ATTACK-BERT, plus d'encodeur simulé) | `test_04_pipeline_integration.py::test_t14_enrichment_processes_new_detections` |
| **T15** | Dérive Terraform détectée | 🔲 Manuel | `terraform plan` |
| **T16** | Scan IaC bloque mauvaise config | 🔲 Manuel | Pipeline infra F7 |
| **T17** | Isolation inter-environnements | ✅ Vérifié le 07/08 | WIF condition — code (`assertion.repository == '...' && assertion.ref == 'refs/heads/main'`) **et** live (`gcloud iam workload-identity-pools providers describe`) confirmés identiques ; n'importe quelle branche autre que `main` se voit refuser le jeton |
| **T18** | Digest identique dev→staging→prod | 🔲 Manuel | Promotion — sans objet pour prod (environnement vide, `terraform/environments/prod/`) ; dev/staging n'ont jamais été comparés par digest |

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
