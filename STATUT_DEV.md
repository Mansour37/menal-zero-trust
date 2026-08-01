# Statut — Plateforme MENAL Zero Trust (dev + staging)

**Date :** 31 juillet 2026
**Projets GCP :** `menal-zero-trust-dev`, `menal-zero-trust-staging` (europe-west1)
**Référentiels :** `01_HLD_MENAL.md`, `02_LLD_MENAL.md`, `04_METHODOLOGIE_IMPLEMENTATION.md`,
`05_DOCUMENTS_COMPLEMENTAIRES.md`, `indexe-dev.md` (revue précédente, 30 juillet 2026)

## 1. Résumé

Dev **opérationnel et validé par des tests E2E réels** (10/10, exécutés depuis une IP
mauritanienne réelle, sans tolérance masquée). MFA (TOTP) implémenté et déployé sur l'API et
le dashboard. Dashboard Next.js (cible ADR 0001) déployé en lieu et place du dashboard
Streamlit. **Staging est désormais réellement provisionné** (§6) — projet GCP créé, 141
ressources appliquées, images promues par digest depuis dev, base migrée, LB opérationnel.
Reste : DNS de `api-staging.menal-sarl.com`/`dash-staging.menal-sarl.com` à pointer vers
`8.232.24.132` (hors de mon contrôle — registrar/DNS du domaine).

## 2. Travaux de cette session (chronologie, avec preuve)

### 2.1 Audit initial
Six domaines audités en parallèle (Terraform/zero-trust, API, dashboard, CI/CD, documentation/
SIEM, couverture de tests). Fondations confirmées solides (IAM moindre privilège, WIF, réseau
privé, Cloud Armor) mais bloquants réels identifiés : pas d'environnement staging, gates CI
non bloquantes, `scripts/hotfix.sh` contournant toute la chaîne CI, MFA absent, quasi aucun
test sur le code le plus récent.

### 2.2 MFA — TOTP (commit `7dd8d79`)
- API : `POST /auth/mfa/{setup,enable,disable,verify}`, `GET /auth/mfa/status` ; claim JWT
  `typ` (`access` vs `mfa_pending`) pour qu'un challenge MFA non vérifié ne puisse jamais
  servir d'access token.
- Dashboard : connexion en deux étapes (identifiants puis code), page d'activation
  `/settings/security`.
- 13 tests unitaires nouveaux (`api/tests/test_mfa.py`) ; correction au passage d'un vrai
  blocage (hang) de la suite existante — le middleware d'audit appelait une vraie connexion
  Cloud SQL sur chaque requête de test non mockée (`api/tests/conftest.py`).

### 2.3 Environnement staging (commit `7dd8d79`)
`terraform/environments/staging/{main,variables,outputs}.tf` + `terraform.tfvars.example`,
même câblage de modules que dev, state GCS séparé (`env/staging`). `terraform validate` OK.
**Aucun `terraform apply` n'a été fait : le projet GCP staging n'existe pas.**

### 2.4 Bugs réels trouvés en testant pour de vrai (commits `f2585d1`, `91c084b`)
- **Geo-block Cloud Armor excluait la Mauritanie** — le pays de MENAL SARL elle-même.
  Confirmé par un vrai 403 depuis une IP mauritanienne, corrigé, appliqué.
- `/health` exempté du geo-block (endpoint de liveness sans donnée sensible, doit rester
  vérifiable depuis n'importe quelle région — moniteurs d'uptime, CI).
- 4 défauts logiques corrigés dans la suite E2E : les checks de santé toléraient un blocage
  WAF (403) comme un "succès" (masquait le bug ci-dessus), un test exigeait littéralement
  `"streamlit"` dans la page, T13/T14 étaient des tautologies qui ne pouvaient jamais échouer.
- Conflit Terraform/CI découvert en plein déploiement : CI déploie par tag SHA immuable
  (bonne pratique « build once, promote by digest »), mais Terraform pointait encore vers le
  tag mutable `:latest` — un futur `apply` aurait silencieusement fait revenir en arrière le
  déploiement CI. Corrigé (`lifecycle.ignore_changes` sur `modules/cloud-run` et
  `modules/dashboard`).

### 2.5 Réconciliation du dépôt (commit `e8922d2`)
~90 fichiers déjà modifiés et déjà déployés (travail de la revue `indexe-dev.md` du 30
juillet) mais jamais committés : IAM resserré, pipeline SIEM réparé (tournait à vide), JWT
secret câblé via Secret Manager au lieu du défaut codé en dur, dashboard Streamlit sécurisé,
4 nouvelles pages Next.js (détections/incidents/couverture/vulnérabilités).

### 2.6 Déploiement réel — pas seulement du code committé
- `terraform apply` ×2 sur dev (fix geo-block, puis exemption `/health` + lifecycle).
- Push → CI déclenchée, verte de bout en bout (scans, build, deploy, E2E) — run
  `30593805587`.
- **Découverte en déployant** : la table `users` n'existait pas du tout dans la base réelle —
  la migration 001 (schéma initial) n'avait jamais été jouée. Migrations 001 puis 002
  appliquées via un job Cloud Run ponctuel (créé, exécuté, vérifié, supprimé).
- Dashboard Next.js buildé et déployé manuellement (`scripts/hotfix.sh dashboard` — la CI ne
  build pas encore l'image dashboard). `dash.menal-sarl.com/login` sert désormais Next.js
  (vérifié par le contenu réel de la page, plus par un simple code HTTP).

## 3. État live vérifié (dev, au 31 juillet)

| Composant | État | Preuve |
|---|---|---|
| `menal-api-dev` | MFA en ligne | image `menal-api:e8922d2...`, CI run `30593805587` success |
| `menal-dashboard-dev` | Next.js en ligne | page `/login` contient "Connexion"/"MENAL Zero Trust", plus "streamlit" |
| Base `menal-db-dev` | Schéma à jour | `alembic_version = 002` ; logs du job : `-> 001` puis `001 -> 002` |
| Geo-block Cloud Armor | Corrigé | MR ajouté à l'allowlist, `/health` exempté ; 200 confirmé depuis IP mauritanienne réelle |
| E2E rapide (10 tests) | 10/10 PASSED | exécution réelle du 31/07 depuis IP mauritanienne, sans tolérance masquée |
| CI (`ci.yml`) | Verte | scans + build + deploy + E2E tous en succès |

## 4. Ce qui n'a PAS été fait (backlog assumé, pas oublié)

| # | Item | Pourquoi pas maintenant |
|---|---|---|
| 1 | DNS staging (`api-staging`/`dash-staging.menal-sarl.com` → `8.232.24.132`) | Hors Terraform — registrar/DNS du domaine, à faire par vous |
| 2 | Gates CI bloquantes (Gitleaks/Semgrep/Trivy) | Différé par choix explicite en cours de session |
| 3 | `scripts/hotfix.sh` (contournement CI) | Réutilisé cette session (dev **et** staging) faute de job CI pour le dashboard — toujours un contournement documenté, pas supprimé |
| 4 | Tests sur `siem.py` / `bigquery.py` / nouvelles pages dashboard | Différé par choix explicite |
| 5 | `README.md` | Toujours supprimé (cf. `indexe-dev.md` §6.5) |
| 6 | CMEK Cloud SQL / BigQuery | Différé, documenté comme acceptable en dev/staging |
| 7 | Décommissionner `api/dashboard/` (Streamlit) | Code mort (plus déployé) mais pas supprimé — ADR 0001 demande une validation du nouveau dashboard d'abord ; pas de vrai login testé faute de credentials réels |
| 8 | CI ne build pas l'image dashboard/ml-embed/enrich-job | Toujours vrai — promotion faite manuellement cette session (§6.3) |
| 9 | **Anomalie non résolue sur dev** : `terraform plan` signale `module.ml_pipeline.google_service_account_iam_member.scheduler_token_creator` comme devant être remplacé (etag divergent), sans lien apparent avec les changements de cette session | Découvert en fin de session sur un `plan` (jamais appliqué) — à investiguer avant tout futur `apply` sur dev, ne pas appliquer aveuglément |

## 5. Prochaine étape recommandée

Tester une vraie connexion (avec MFA) sur https://dash.menal-sarl.com avec un compte réel,
pour lever le point #7 et pouvoir décommissionner Streamlit en confiance. Configurer le DNS
staging (§4.1) pour activer le certificat TLS managé. Investiguer l'anomalie §4.9 avant le
prochain `terraform apply` sur dev.

## 6. Staging — provisionné pour de vrai (31 juillet, suite de session)

### 6.1 Projet et infrastructure
`menal-zero-trust-staging` créé (`gcloud projects create`), facturation liée au même compte
que dev. 141 ressources appliquées via `terraform apply` (VPC, Cloud SQL, KMS, BigQuery,
IAM, LB + Cloud Armor, Cloud Run ×2 services + 1 job, Cloud Scheduler, monitoring).
`terraform plan` final : **aucune dérive** (`No changes`).

### 6.2 Deux bugs Terraform réels trouvés en provisionnant un projet neuf
Ces bugs étaient invisibles tant que seul `terraform validate`/`plan` avaient été exécutés —
un projet neuf les a immédiatement révélés :
- **Agent de service BigQuery Data Transfer inexistant** sur un projet neuf (n'est créé par
  Google qu'à la première utilisation de l'API) → le binding IAM du pipeline échouait.
  Corrigé avec `google_project_service_identity` (nécessite le provider `google-beta`,
  ajouté à `dev` et `staging`).
- **Nom du connecteur VPC serverless trop long** : `menal-vpc-connector-staging` (28
  caractères) dépasse la limite GCP de 25. Corrigé par une abréviation dédiée
  (`-stg`) qui ne renomme pas (donc ne recrée pas) le connecteur dev/prod déjà en place.

### 6.3 Images promues par digest (pas rebuildées) — conforme au principe « build once, promote by digest »
`menal-api`, `menal-dashboard`, `menal-ml-embed`, `menal-enrich-job` copiés de
`menal-docker-dev` vers `menal-docker-staging` par digest exact (`docker pull --digest` +
`tag` + `push`), pas reconstruits. Digests identiques dev/staging vérifiés (condition T18).

### 6.4 Base migrée
Même situation que dev : base neuve, migrations 001+002 appliquées via un job Cloud Run
ponctuel (créé, exécuté avec succès du premier coup cette fois, supprimé).

### 6.5 État vérifié
| Composant | État | Preuve |
|---|---|---|
| Cloud SQL `menal-db-staging` | Schéma à jour | job de migration : succès, `alembic_version = 002` |
| `menal-api-staging` | Ready | `gcloud run services describe` → `Ready: True` |
| `menal-dashboard-staging` | Ready | idem |
| LB (`8.232.24.132`) | Répond | `curl --resolve api-staging...:80:8.232.24.132` → 301 (HTTP→HTTPS) |
| Certificat TLS managé | PROVISIONING | attend le DNS (§4.1) — normal, pas une erreur |
| `terraform plan` | Vide | `No changes. Your infrastructure matches the configuration.` |

## 7. Modèle ML réel + validation E2E staging (01/08/2026, suite de session)

### 7.1 ATTACK-BERT déployé pour de vrai (plus de mock)
`basel/ATTACK-BERT` exporté en ONNX **fp32** (pas int8 — la quantisation dynamique a été
testée et rejetée par un gate d'accord de classement : 0/5 top-1 MITRE identiques au fp32 de
référence). Pipeline de build : `api/ml-embed/build/export_and_precompute.py` +
`api/ml-embed/cloudbuild.yaml`. 872 vecteurs 768D réels chargés dans `attack_embeddings`
(697 techniques). `enrich-job` corrigé (voir §7.2) et vérifié en train de produire de vrais
mappings MITRE (ex. `T1003.008` à similarité 0.72). `dev` tourne toujours sur le mock aléatoire
— même procédure à rejouer si besoin. Détail complet : commit `6509823`.

### 7.2 Trois bugs préexistants dans `enrich-job`, jamais détectés faute d'exécution réelle
Le pipeline n'avait **jamais** produit un seul mapping avant cette session :
1. Le job Cloud Run n'avait pas de connecteur VPC → l'ingress interne de `ml-embed` répondait
   404 à tout appel.
2. Le job n'envoyait aucun jeton d'identité (`ml-embed` exige `roles/run.invoker` + Bearer).
3. La requête `VECTOR_SEARCH` référençait les colonnes de la table de base sans le préfixe
   `base.*` exigé par BigQuery → échec silencieux, statut toujours `unmapped`.

### 7.3 Incident et réparation — `cve_findings` vidée par erreur (leçon retenue)
Un `terraform apply -target=module.ml_pipeline` (destiné à ne réconcilier que le module ML
après des changements manuels `gcloud`) a **aussi** déclenché le remplacement destructeur,
déjà en attente, de `module.bigquery.google_bigquery_table.cve_findings` (111 lignes perdues,
confirmé par les journaux d'audit Cloud Logging). Cause racine, indépendante de cette session :
l'API BigQuery ne garantit pas l'ordre des champs renvoyé après un `load` job, ce qui faisait
percevoir en permanence un schéma « différent » à Terraform et forçait un remplacement
destructeur au moindre `apply` — la table aurait été vidée par n'importe qui, tôt ou tard.
**Réparation** : les 4 images staging re-scannées avec Trivy (362 résultats CRITICAL/HIGH/MEDIUM,
plus complet que l'original), rechargées. **Correctif structurel** : `lifecycle { ignore_changes
= [schema] }` ajouté sur `cve_findings` **et** `attack_embeddings` (même risque, même cause) —
ces deux tables sont pilotées par des jobs de chargement externes, pas par Terraform ; l'ordre
des colonnes n'a aucune incidence fonctionnelle (BigQuery adresse par nom). `terraform plan`
sur l'ensemble de l'environnement staging est désormais **vide** (aucune dérive).

### 7.4 Suite E2E rejouée contre `staging` (pas seulement `dev`)
La suite ne testait jusqu'ici que `dev` en dur (dataset BigQuery, nom de secret, domaine HTTP
codés en dur dans les tests eux-mêmes) — rendue portable par environnement
(`BQ_DATASET`/`ENVIRONMENT`). Deux bugs de test corrigés au passage : T3 attendait 401/403 pour
un appel non authentifié à `ml-embed`, alors qu'un service en
`ingress = INGRESS_TRAFFIC_INTERNAL_ONLY` renvoie 404 aux appelants hors VPC (comportement
correct, pas un échec) ; T5 avalait `Exception` sans condition et ne pouvait donc jamais détecter
un accès réellement réussi (même défaut tautologique que celui déjà corrigé pour T13/T14).

| Test | Résultat sur `staging` | Note |
|---|---|---|
| 10 tests rapides (santé, WAF, RBAC) | 10/10 PASSED | |
| T1 (accès direct `.run.app` bloqué) | PASSED | |
| T3 (`ml-embed` sans jeton) | PASSED (après correction) | 404 attendu, ingress interne |
| T6, `test_api_endpoints_require_auth` | PASSED | |
| T4 (`enrich-job` SA lecture seule sur `detections`) | ÉCHOUE — **réel**, pas un artefact de test | `sa-pipeline` a `roles/bigquery.dataEditor` au niveau **projet** ; confirmé par lecture directe de la policy IAM, indépendamment de l'identité utilisée pour lancer le test |
| T5 (isolation secret `db-password-staging`) | ÉCHOUE avec l'identité opérateur | Attendu : le test doit tourner avec les credentials d'une identité réellement restreinte (ex. `sa-cicd` en CI), pas un compte propriétaire de projet — l'assertion elle-même est désormais correcte (fix §ci-dessus) |
| T13 (attaque réelle → détection Sigma) | voir résultat joint | trafic réel généré, poll jusqu'à 12 min |
| T14 (enrichissement ML des détections) | voir résultat joint | dépend de T13 |

### 7.5 Écart Zero Trust confirmé, pas corrigé
`sa-pipeline` (exécute `enrich-job`) détient `roles/bigquery.dataEditor` au niveau **projet**
dans `staging` — accès en écriture à **toutes** les tables du dataset, alors que `enrich-job`
ne devrait écrire que dans `alert_enrichment` (lecture seule sur `detections`/`attack_embeddings`).
Non corrigé intentionnellement : resserrer l'IAM (rôles par table plutôt que par projet) est un
changement IAM à valider avant application, pas quelque chose à modifier en cours de session
sans confirmation explicite.
