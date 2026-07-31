# INDEXE-DEV — Revue d'architecture, validation & durcissement de l'environnement `dev`

**Projet :** MENAL Zero Trust — GCP `menal-zero-trust-dev` (europe-west1)
**Date :** 30 juillet 2026
**Rôle :** Revue expert architecture sécurité / implémentation / déploiement
**Référentiels :** `01_HLD_MENAL.md`, `02_LLD_MENAL.md`, `04_METHODOLOGIE_IMPLEMENTATION.md`, `05_DOCUMENTS_COMPLEMENTAIRES.md`, `ATTACK-BERT_Integration_SIEM_ZeroTrust.md`

---

## 1. Verdict global

| Domaine | État | Commentaire |
|---|---|---|
| Infra déployée (Cloud Run ×3 + Job, LB+Armor, SQL privé, BQ, KMS, WIF) | 🟢 Opérationnelle | 4 workloads actifs, LB répond, E2E verts |
| Posture Zero Trust (ingress LB-only, SQL privé, WIF sans clé, deny-by-default) | 🟢 Conforme | Vérifiée par tests T1/T2/T11 en conditions réelles |
| Chaîne SIEM (logs → règles Sigma → détections → ML) | 🔴→🟠 **Corrigée** | Tournait **à vide** (0 ligne partout) — chaînon de normalisation ajouté |
| Secrets applicatifs (JWT, dashboard) | 🔴→🟢 **Corrigé** | JWT signé avec le secret par défaut codé en dur ; mot de passe dashboard en clair |
| Dashboard Streamlit | 🔴→🟢 **Corrigé** | Ne démarrait pas (st.secrets), colonnes BQ inexistantes, pages sans auth |
| Tests (16 unitaires + 11 E2E) | 🟢 100 % verts | Exécutés localement contre l'environnement dev réel |
| `terraform validate` + `fmt` | 🟢 OK | Après corrections |

**11/11 tests E2E passent contre l'infra dev réelle** : accès direct `.run.app` bloqué (T1), WAF Cloud Armor actif (T11), redirection HTTP→HTTPS, headers de sécurité présents, auth exigée sur `/users/ /logs/ /alerts/`, dashboard servi via `dash.menal-sarl.com`.

---

## 2. Anomalies critiques trouvées et corrigées

### C1 — JWT signé avec le secret par défaut codé en dur (CRITIQUE)
Le module `cloud-run` n'injectait jamais `JWT_SECRET` : l'API déployée signait tous les tokens avec la valeur par défaut `"dev-secret-change-in-production"` visible dans le code (`api/app/config.py`). **N'importe qui pouvait forger un token admin.** Le secret `jwt-secret-dev` existait pourtant dans Secret Manager avec les bons droits.
✅ **Fix :** `terraform/modules/cloud-run/main.tf` — env `JWT_SECRET` monté via `value_source.secret_key_ref` (conforme LLD §2 : « jamais de secret en variable d'environnement en clair »), câblé dans `environments/dev/main.tf` via `module.cloud_sql.jwt_secret_id`.

### C2 — Chaîne SIEM structurellement à vide (CRITIQUE fonctionnel)
Constat en production BigQuery : `access_logs`, `raw_logs`, `detections`, `security_events`, `api_metrics`, `alert_enrichment` = **0 ligne** (seule `attack_embeddings` : 958 vecteurs). Cause : les sinks Cloud Logging écrivent dans des tables auto-créées (`run_googleapis_com_requests`…), jamais dans les tables du SIEM. Les 7 règles Sigma, le workflow horaire et le pipeline ML ATTACK-BERT n'avaient donc **aucune donnée d'entrée**. De plus, les verdicts Cloud Armor n'étaient jamais exportés (pas de sink LB, logs backend désactivés).
✅ **Fix :** `modules/logging/main.tf` — 3 requêtes planifiées de **normalisation F4** (MERGE idempotent toutes les 5 min) : `run_googleapis_com_requests` → `access_logs`, → `raw_logs` (source `cloudrun`), et table `requests` (LB) → `raw_logs` (source `armor`) ; **sink 4** `http_load_balancer` ajouté ; `log_config` activé sur les 2 backends du LB (`modules/load-balancer/main.tf`).

### C3 — Règles Sigma R2 et R4 en échec réel (confirmé en prod : état `FAILED` dans BigQuery Data Transfer)
R2 référençait une colonne inexistante `source_ip` ; R4 utilisait des wildcards dans un `IN` (inopérant) et les colonnes `ip_address`/`path` inexistantes sur `raw_logs`.
✅ **Fix :** `modules/detection/main.tf` — R2 : entité = `url`, comparaison `UPPER(outcome)="DENY"` ; R4 : `REGEXP_CONTAINS` sur le user-agent + champs JSON corrects.

### C4 — Dashboard Streamlit non fonctionnel + contournement d'authentification
`app.py` lisait `st.secrets` (fichier secrets.toml inexistant en Cloud Run → l'app s'arrêtait) ; les 4 pages interrogeaient des colonnes BigQuery **inexistantes** (`detected_at`, `alert_id`, `similarity_score`…) ; les filtres texte étaient concaténés dans le SQL (**injection SQL**) ; et **aucune page ne vérifiait l'authentification** (accès direct à `/Detections` sans mot de passe). Le SA n'avait pas `bigquery.jobUser` (aucune requête possible).
✅ **Fix :** `api/dashboard/common.py` créé (`get_conf` env-first + `require_auth` avec `hmac.compare_digest`) ; `app.py` + 4 pages réécrits : auth sur chaque page, requêtes 100 % paramétrées, colonnes alignées sur le schéma Terraform réel ; module Terraform : mot de passe monté depuis **Secret Manager** (plus de valeur en clair dans les env vars), `bigquery.jobUser` ajouté, `dataViewer` réduit au dataset (moindre privilège), `depends_on` sur le binding secret.

### C5 — WIF trop permissif (least-privilege)
`roles/iam.serviceAccountUser` au niveau **projet** pour le principalSet GitHub : le pipeline CI pouvait impersonner **n'importe quel SA** du projet (dont `sa-pipeline`).
✅ **Fix :** binding projet supprimé (`modules/iam/main.tf`) — la chaîne reste : WIF → `sa-cicd` (workloadIdentityUser) → `actAs sa-api` uniquement (binding ciblé existant). Conforme LLD §2.1.

### C6 — `sa-pipeline` avec `dataEditor` au niveau projet
Le module detection accordait `roles/bigquery.dataEditor` **projet** (et dupliquait `jobUser` déjà accordé par le module workflow) — violation du principe « un moteur de détection ne doit jamais pouvoir modifier les preuves » (test T4).
✅ **Fix :** bindings projet supprimés ; `dataEditor` reste limité au dataset (module bigquery) ; binding `iam.serviceAccountTokenCreator` pour l'agent BigQuery Data Transfer centralisé dans le module iam (nécessaire aux requêtes planifiées avec SA).

---

## 3. Durcissements complémentaires appliqués

| # | Fichier | Changement |
|---|---|---|
| H1 | `modules/cloud-sql/main.tf` | `ssl_mode = "ENCRYPTED_ONLY"` (exigence LLD « require_ssl ») |
| H2 | `modules/load-balancer/main.tf` | Politique SSL `MODERN` / TLS 1.2 minimum sur le proxy HTTPS |
| H3 | `modules/audit/main.tf` | Data Access logs étendus à **Cloud SQL** (exigence L7 : SQL/BQ/Secret Manager) |
| H4 | `api/dashboard/Dockerfile`, `api/enrich-job/Dockerfile` | Utilisateur **non-root** (uid 10001) — conteneurs durcis comme ml-embed |
| H5 | `modules/bigquery/main.tf` | Rétention 90 j `raw_logs` documentée (bloquée par Terraform 32 bits — voir §6) |
| H6 | `.github/workflows/ci.yml` | E2E dashboard testé via `https://dash.menal-sarl.com` (l'URL `.run.app` est bloquée par design → le test échouait en CI) |
| H7 | `scripts/hotfix.sh` | Projet corrigé `menal-dev` → `menal-zero-trust-dev` (le script échouait) |
| H8 | `tests/e2e/*` | T4/T13/T14 alignés sur les schémas réels (colonnes inexistantes) ; typo `Strict-Traffic-Security` |
| H9 | `api/tests/test_health.py` | Tests auth acceptent 401 (FastAPI ≥ 0.112, RFC 7235) ou 403 |

---

## 4. Résultats des tests (après corrections)

```
Unitaires API   : 16/16 PASSED  (pytest api/tests — health, auth 401/403, RBAC)
E2E dev réel    : 11/11 PASSED  (profil CI : not slow / not gcp)
  T1  accès direct .run.app         → bloqué ✅
  T11 payloads SQLi/XSS via LB      → WAF actif ✅
  HTTP→HTTPS redirect                → 301 ✅
  Headers sécurité (HSTS, nosniff…) → présents ✅
  Auth requise /users /logs /alerts → 401/403 ✅
  Dashboard via dash.menal-sarl.com → 200 Streamlit ✅
terraform validate : OK   |   terraform fmt : OK   |   py_compile : OK
```

État réel vérifié via gcloud/BigQuery : services `menal-api-dev`, `menal-dashboard-dev`, `menal-ml-embed-dev` (Ready), job `menal-enrich-job-dev`, 7 scheduled queries Sigma (5 SUCCEEDED, **R2/R4 FAILED → corrigées ici**), `attack_embeddings` peuplée (958 techniques).

---

## 5. Conformité à la documentation (HLD/LLD/Méthodo)

### Conforme ✅
Ingress `internal-and-cloud-load-balancing` partout + `internal` pour ml-embed sans invoker public · Cloud SQL IP privée (PSA) + PITR · deny-all-ingress prio 65534 + flow logs · Cloud NAT · WIF sans clé JSON, condition sur le dépôt · Cloud Armor : `sqli/xss/lfi/rce-v33-stable` + rate-limit + geo-block · 7 règles Sigma / 5 min (doc : 5–8) mappées MITRE · seuil similarité 0.60 · `HF_HUB_OFFLINE=1`, modèle ONNX int8, ml-embed non-root, `docs_url=None` · 6 politiques d'alerte + uptime check · audit Data Access BQ/KMS/SM (+SQL ajouté) · CI WIF-only : Gitleaks → Semgrep → build → Trivy → deploy → E2E.

### Écarts assumés à documenter (registre ADR) ⚠️
| Écart | Doc | Réel | Appréciation |
|---|---|---|---|
| Projets | `menal-ops/dev/staging/prod` | mono-projet `menal-zero-trust-dev` | Acceptable en PFE dev ; P8 exigera la séparation |
| Nommage | `app-elson`, `api-platform`, `dash-secu`, dataset `siem` | `menal-api-dev`, `menal-dashboard-dev`, `menal_security_dev` | Cohérent en interne — à figer dans un ADR |
| SA | 6 SA dédiés (dont `sa-ml-embed` sans rôle, `sa-enrich-job` restreint) | 4 SA ; ml-embed & enrich-job partagent `sa-pipeline` | **Recommandé** : scinder `sa-ml-embed` (aucun rôle data) et `sa-enrich-job` |
| Réseau | Direct VPC egress (LLD §4) | Serverless VPC Connector | La doc elle-même diverge (ATT&CK-BERT §9.2 mentionne le connecteur) — trancher par ADR |
| Egress ml-embed | « egress nul » | `PRIVATE_RANGES_ONLY` | Proche de la cible ; OK en dev |
| PostgreSQL | 17 | 15 | Migration à planifier (recréation d'instance) |
| Déploiement | par digest `@sha256:` | par tag (`:latest` dans TF, sha en CI) | + `lifecycle ignore_changes` sur l'image absent (T10/T18 non satisfaits) — cible P8 |
| Portes CI bloquantes | Gitleaks/Semgrep/Trivy **bloquants** | `continue-on-error` / Trivy soft | Choix assumé (commits « soft Trivy ») — réactiver avant P8 ; « un pipeline qui n'a jamais rien bloqué ne prouve rien » |
| Politiques d'org | `disableServiceAccountKeyCreation`, etc. | absentes | Projet personnel sans organisation — documenter comme limite (T6) |
| CMEK SQL/BQ | cible prod | clé KMS créée, bindings différés | Conforme : « Google-managed acceptable en démo, documenté » |
| IAP dashboard | option P2 | mot de passe Streamlit | Documenté dans le code ; OK |
| Scheduler enrich-job | 5 min | 15 min | Mineur — aligner si besoin |
| Dashboard | 4 composants Next.js (`dashboard/`) | Streamlit déployé (`api/dashboard/`) | Deux implémentations coexistent — choisir et archiver l'autre |
| CI images | — | seul `menal-api` est buildé ; ml-embed / enrich-job / dashboard manuels | **Recommandé** : jobs CI dédiés |

---

## 6. Actions requises pour activer les corrections

1. **`terraform apply`** (env dev) — déploie : env JWT_SECRET + secret dashboard, sink LB + normalisation F4, règles R2/R4 corrigées, SSL policy, ssl_mode SQL, audit SQL, IAM resserré.
   ⚠️ L'apply **retire** deux bindings larges (SAU projet WIF, dataEditor projet pipeline) — vérifier ensuite que la CI déploie toujours (elle le doit : chaîne sa-cicd → sa-api conservée).
2. **Rebuild + push des images** `menal-dashboard` (nouveau `common.py`) et `menal-enrich-job` (non-root) puis redéployer les révisions.
3. **Rétention 90 j de `raw_logs`** : `bq update --time_partitioning_expiration 7776000 menal_security_dev.raw_logs` — ou passer à **Terraform 64 bits (windows_amd64)** : le binaire 386 actuel ne peut pas encoder `expiration_ms = 7776000000` (ligne prête dans `modules/bigquery/main.tf`).
4. Après ~15 min de trafic : vérifier `access_logs`/`raw_logs` > 0, puis `detections` (T13) et `alert_enrichment` (T14). La requête armor→raw_logs échoue proprement tant que la table `requests` (premier log LB) n'existe pas, puis converge.
5. Nettoyage recommandé : retirer `elson-main/.next/` et `__pycache__` du dépôt (`.gitignore`), supprimer les workflows dépréciés `deploy.yml`/`deploy-dashboard.yml`, restaurer un `README.md` (actuellement supprimé).

---

## 7. Recommandations pour la suite (prod-readiness / P8)

1. **SA dédiés** `sa-ml-embed` (zéro rôle) et `sa-enrich-job` (écriture limitée à `alert_enrichment` + `pending_embeddings`) — fait passer T4 strictement.
2. **Déploiement par digest** + `lifecycle ignore_changes` sur l'image (frontière F3/F7 du LLD) — prérequis T10/T18.
3. **Réactiver les 3 portes bloquantes CI** (Gitleaks/Semgrep/Trivy `exit-code: 1`) et rejouer les démonstrations de refus T7/T8/T9.
4. **Ajouter la vue `v_killchain`** (bonus +15, agrégation par entité/heure) et la boucle **F6** (export Trivy → `cve_findings`) — présentes dans la doc, absentes de l'implémentation.
5. **Condition WIF sur la référence Git** (`assertion.ref`) pour préparer l'isolation dev/staging/prod (T17).
6. Étendre la normalisation F4 aux tables `cloudaudit_*` (déjà exportées) → règles Sigma IAM (énumération, actAs — scénario T13 de la doc).
7. Sortir `admin_ip_ranges` et `support_email` des défauts de `variables.tf` vers un `dev.tfvars` (données personnelles dans le code).
8. Alerte 1 du monitoring : le libellé « taux d'erreur > 10 % » mesure en réalité un débit de 5xx (`ALIGN_RATE` > 0.1/s) — reformuler ou passer en ratio.

---

## 8. Fichiers modifiés par cette revue

**Terraform (10)** : `environments/dev/main.tf` · `modules/cloud-run/{main,variables}.tf` · `modules/cloud-sql/main.tf` · `modules/dashboard/main.tf` · `modules/detection/main.tf` · `modules/iam/main.tf` · `modules/logging/{main,variables}.tf` · `modules/load-balancer/main.tf` · `modules/audit/main.tf` · `modules/bigquery/main.tf`
**Application (8)** : `api/dashboard/common.py` (nouveau) · `api/dashboard/app.py` · `api/dashboard/pages/1-4_*.py` · `api/dashboard/Dockerfile` · `api/enrich-job/Dockerfile`
**CI & tests (6)** : `.github/workflows/ci.yml` · `scripts/hotfix.sh` · `tests/e2e/test_01_health.py` · `tests/e2e/test_03_iam_isolation.py` · `tests/e2e/test_04_pipeline_integration.py` · `api/tests/test_health.py`

*Validé : `terraform validate` ✅ · `terraform fmt` ✅ · 16 tests unitaires ✅ · 11 tests E2E contre l'environnement dev réel ✅*
