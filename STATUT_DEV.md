# Statut — Plateforme MENAL Zero Trust (staging = environnement de référence)

**Date :** 2 août 2026
**Projets GCP :** `menal-zero-trust-staging` (référence), `menal-zero-trust-dev` (essais) — europe-west1
**Référentiels :** `01_HLD_MENAL.md`, `02_LLD_MENAL.md`, `04_METHODOLOGIE_IMPLEMENTATION.md`,
`05_DOCUMENTS_COMPLEMENTAIRES.md`, `indexe-dev.md` (revue du 30 juillet 2026)

> Les sections §2 à §7 conservent la chronologie des sessions des 30 juillet – 1er août.
> L'état courant est décrit en **§8**, qui fait foi en cas de divergence.

## 1. Résumé

**`staging` est l'environnement de référence** : c'est lui que le pipeline CI-SEC-CD
construit, scanne, déploie et teste en E2E. `dev` reste disponible pour les essais manuels.
DNS et certificats TLS managés sont actifs (`api-staging` / `dash-staging.menal-sarl.com`).

Le pipeline est **vert de bout en bout** et ses portes ne sont pas décoratives : elles ont
bloqué trois défauts réels le 2 août (§8.2). La chaîne de données SIEM a été auditée maillon
par maillon et corrigée là où elle mentait (§8.3). Le principe cardinal Zero Trust du HLD §5
est désormais **tenu et vérifiable** (§8.4) — c'était le dernier écart majeur entre la
documentation et la réalité.

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

---

# §8. État courant — 2 août 2026 (fait foi)

## 8.1 staging, environnement de référence du CI-SEC-CD

`ci.yml` est entièrement piloté par les **variables GitHub du dépôt** : changer
d'environnement cible se fait en changeant les variables, pas le workflow.

Chaîne complète, vérifiée verte sur staging :

| Étape | État |
|---|---|
| Gitleaks (secrets) + Semgrep (SAST) | bloquants |
| Tests unitaires API (29) | verts |
| Build + Trivy CRITICAL — image API | bloquant |
| Chargement des CVE dans BigQuery (boucle F6) | alimente `cve_findings` |
| Déploiement API + smoke test par domaine réel | vert |
| Build + Trivy CRITICAL — image dashboard | **nouveau job** : le dashboard n'était jamais construit par le CI |
| Déploiement dashboard + smoke test | vert |
| E2E (10 tests rapides) | 10/10 |
| `terraform.yml` : fmt, validate, scan IaC Trivy | vert |

`terraform.yml` est la **première marche du pipeline infra F7** du LLD §8. Restent à
automatiser `plan` et `apply` : ils exigent d'élargir les droits de lecture de `sa-cicd`,
décision IAM à valider explicitement.

Les workflows morts `deploy.yml` / `deploy-dashboard.yml` ont été supprimés.

## 8.2 Trois défauts réels interceptés par les portes du pipeline

1. **Gitleaks ne scannait rien.** Le clone superficiel par défaut ne contient pas la
   révision de départ du `push` : le scan échouait en « unknown revision » après avoir
   parcouru 0 octet. Corrigé par `fetch-depth: 0`.
2. **Trivy a bloqué une CVE CRITICAL réelle** dans l'image du dashboard : `node-tar` 6.2.1
   (déni de service par bombe gzip), embarqué par le `npm` de `node:20-alpine`. Le runtime
   n'exécute que `node server.js` : npm, corepack et yarn ont été retirés de l'image finale.
3. **Le géo-blocage rendait le smoke test aveugle.** Le dashboard répondait 403 aux runners
   GitHub, qui n'ont pas de région fixe. `GET /` et `GET /login` (le mur d'authentification,
   sans donnée) sont exemptés comme l'était déjà `/health` ; `POST /api/login` reste
   géo-bloqué et limité au bord.

## 8.3 Chaîne SIEM auditée maillon par maillon, et corrigée

Trois audits (flux logiques, performance/coûts, disponibilité/résilience) menés sur staging,
chaque constat vérifié par la mesure.

| Défaut | Mesure avant | Après |
|---|---|---|
| `api_metrics` sous-comptait | 4 requêtes stockées pour 73 réelles (−81 % sur 24 h, −62 % sur les blocages WAF) | stocké = réel sur toutes les heures ; historique recalculé (63 lignes) |
| `enrich-job` bouclait | 349 lignes pour 38 détections distinctes (jusqu'à 21 doublons) | une ligne par détection ; le modèle n'est plus réinvoqué à vide |
| Cloud Workflow en panne | **60 exécutions FAILED d'affilée depuis plus de 2 jours**, sans que personne en soit informé | supprimé (voir ci-dessous) |
| Échecs silencieux du job | sortie en code 0 même ml-embed injoignable ; un échec BigQuery s'écrivait `status="unmapped"`, indiscernable d'un vrai non-appariement | les erreurs remontent, la tâche échoue, `max_retries` redevient opérant |
| R4 invisible dans la matrice | T1046 tagué TA0043 alors que MITRE le classe en Discovery (TA0007) : l'intersection par tactique le supprimait | R4 compte dans Discovery |

**Le Cloud Workflow a été supprimé, pas réparé.** Son heredoc n'interpolait pas le nom de
projet et BigQuery recevait un nom de table littéral. Le réparer aurait restauré une double
écriture sans déduplication sur `api_metrics` et `security_events`, tables désormais tenues
par les requêtes planifiées. Ses bindings IAM sont conservés : `sa-pipeline` en a besoin.

**Alerting — l'angle mort qui a laissé passer ces 60 échecs.** Aucun traitement par lots
n'était surveillé ; seule l'API l'était. Trois politiques ajoutées : job d'enrichissement en
échec, requête planifiée BigQuery en échec, ingestion à l'arrêt.

Amélioration de lisibilité du résultat ML : sous le seuil de similarité, la technique et le
score du meilleur candidat sont conservés au lieu d'un `0.0` codé en dur. « Meilleur
candidat T1110 à 0,58, sous le seuil de 0,60 » permet de juger si le seuil est bien réglé ;
un zéro ne dit rien et se confond avec une absence de mesure.

## 8.4 Principe cardinal Zero Trust : tenu (T4 levé)

> « Un moteur de détection ne doit jamais pouvoir modifier les preuves qu'il analyse »
> — HLD §5, LLD §2.1

`enrich-job` partageait `sa-pipeline` avec les requêtes planifiées Sigma, qui elles
**doivent** écrire dans `detections` : le job en héritait le droit d'écrire sur les preuves
mêmes qu'il enrichit. Restreindre `sa-pipeline` était impossible sans casser R1–R7 — seule
une identité dédiée tient le principe (c'est le design à 6 comptes de service du LLD §2.1).

`sa-enrich-job`, droits vérifiés sur staging après application :

| Portée | Rôle |
|---|---|
| projet | `bigquery.jobUser`, `logging.logWriter` — **aucun accès aux données** |
| dataset `menal_security_staging` | `READER` |
| table `alert_enrichment` | `dataEditor` |

La granularité **table** est le cœur de la mesure : c'est la seule portée qui distingue
« écrire son résultat » de « réécrire les preuves ». Validé en exécutant le job sous cette
identité.

T4 et T5 testaient la mauvaise identité : joués avec les credentials de l'opérateur, ils
échouaient sur un accès légitimement autorisé. Ils usurpent désormais `sa-enrich-job` et
s'ignorent proprement quand l'usurpation est refusée — ne pas pouvoir usurper est la posture
attendue d'un poste d'opérateur, pas une anomalie.

## 8.5 Performance, coûts, disponibilité

- **Facturation Cloud Run à la requête** (`cpu_idle`) sur les trois services. Ils tournaient
  en « CPU toujours alloué », réglage hérité jamais déclaré, facturés à l'instance 24/7 alors
  qu'aucun ne traite quoi que ce soit hors requête : environ 60 % de la facture staging sans
  contrepartie.
- **Démarrage à froid du dashboard** : 11,5 s mesurés au premier accès, sur un écran SOC où
  l'on arrive précisément quand quelque chose se passe. Avec une instance chaude : 1,09 s
  puis ~260 ms.
- **Versioning activé sur `gs://menal-tf-state`** (bucket d'amorçage, hors IaC) : un état
  Terraform corrompu ou supprimé était irrécupérable.
- **Anomalie `scheduler_token_creator` résolue** — elle figurait en §4.9 comme inexpliquée.
  Un `data "google_project"` interne au module `ml-pipeline`, différé par le `depends_on` du
  module dès qu'une dépendance avait un changement en attente, rendait `member` inconnu et
  forçait un remplacement fantôme à chaque plan. Le numéro de projet est désormais passé en
  variable depuis la racine.
- **Frontière F3/F7 étendue au pipeline ML** : `ignore_changes` sur l'image du job et du
  service. Un `apply` a failli faire retomber le correctif de déduplication sur le tag
  mutable `:latest`.

## 8.6 Reste à traiter (assumé, chiffré)

| # | Sujet | Élément de décision |
|---|---|---|
| 1 | **Cloud SQL zonal** (`db-f1-micro`, `europe-west1-b`, sans réplica) | Seul SPOF structurel : une panne de zone arrête l'API. Sauvegardes et PITR validés par un test réel (§8.7). Passer en `REGIONAL` est une décision coût/risque à assumer explicitement |
| 2 | Requêtes planifiées : ~78 Go/jour facturés pour un dataset de 24 Mo | Plus de 99 % sont du minimum forfaitaire de 10 Mo par table référencée, multiplié par 3 456 exécutions/jour. Fusionner les 7 règles Sigma en une requête ramènerait le poste sous le palier gratuit |
| 3 | Rétention 90 j des partitions (LLD §5) | Toujours commentée dans `modules/bigquery` (limite d'un binaire Terraform 32 bits). Coût nul aujourd'hui, mais croissance non bornée |
| 4 | `plan`/`apply` Terraform automatisés (F7 complet) | Exige d'élargir les droits de lecture de `sa-cicd` — décision IAM |
| 5 | `scripts/hotfix.sh` contourne le CI | Moins nécessaire depuis que le CI construit le dashboard ; à supprimer une fois `ml-embed` et `enrich-job` intégrés au pipeline |
| 6 | Canal d'alerte unique (email personnel, non vérifié) | L'alerting est lui-même un point unique de défaillance |
| 7 | Tests sur `siem.py` / `bigquery.py` / pages dashboard | Non couverts |
| 8 | Trois tuiles de la page d'accueil | « Requêtes totales », « Taux d'erreur » et « Échecs auth » sont calculées sur les 200 derniers journaux d'audit et plafonnent donc structurellement à 200, alors que `overview.total_requests` est récupéré sans être affiché |
| 9 | Priorisation des CVE par technique observée | `mitre_technique` est NULL sur toutes les lignes (choix documenté : il n'existe pas de correspondance officielle CVE→technique). Le mécanisme annoncé sur la page ne peut donc jamais se déclencher |
| 10 | `api/dashboard/` (Streamlit) | Code mort, plus déployé, non supprimé |
| 11 | Environnement `prod` et projet `menal-ops` | `terraform/environments/prod/` est vide ; la chaîne dev→staging→prod du DoD n'est pas atteignable en l'état |

## 8.7 SLO, restauration testée et runbook (3 août 2026)

Les trois manques qui empêchaient un engagement contractuel sont traités.

**SLO mesurés** — `terraform/modules/monitoring`. Deux objectifs sur 30 jours glissants,
cibles tenables pour l'architecture réelle plutôt que flatteuses : disponibilité API 99 %
(budget d'erreur ~7 h 18) et latence 95 % sous 1 s. Les `4xx` sont exclus du numérateur de
disponibilité — compter un `401` comme une indisponibilité ferait chuter le SLO à chaque
tentative d'intrusion, c'est-à-dire précisément quand la plateforme fait son travail.

S'y ajoute un SLI de **retard d'enrichissement** : `enrich-job` émet à chaque cycle, en JSON
sur sa sortie standard, le nombre de détections en attente et l'âge de la plus ancienne ;
deux métriques de journal l'extraient, et une alerte se déclenche au-delà de 30 minutes.
C'est le plus rentable des trois parce qu'il mesure le **résultat** et non un composant :
une panne de ml-embed, une erreur BigQuery ou un déclencheur muet produisent le même
symptôme, et cet indicateur unique les rend toutes visibles — y compris les pannes dont on
n'a pas anticipé la forme.

**Restauration réellement exécutée**, pas documentée d'après le fournisseur :

| Grandeur | Valeur mesurée |
|---|---|
| RTO (durée de restauration) | **32 min 45 s** (clone PITR, `db-f1-micro`, 10 Go) |
| RPO au point demandé | **0** — 314 lignes attendues, 314 restaurées, 0 manquante, 0 en trop |
| Coupure au bon instant | Vérifiée : les 3 écritures postérieures au point de restauration sont correctement absentes |

Méthode : clone vers une instance **neuve** (jamais par-dessus l'originale, qui reste une
pièce à conviction tant que la cause n'est pas comprise), vérification du contenu par export
via l'API d'administration — sans ajouter d'IP publique, ce qui aurait exposé une copie
complète des données au pire moment. Instance de test et bucket supprimés après contrôle.

Un enseignement du test mérite d'être noté : le premier marqueur choisi passait par `/health`,
qui est explicitement exclu de l'audit applicatif — il n'écrivait donc rien en base et ne
prouvait rien. Le contrôle a été refait sur un point d'accès réellement audité. Un test de
restauration qui ne vérifie pas *quelles* données sont revenues ne teste que la mécanique.

**Runbook** — `08_RUNBOOK.md`. Procédures avec commandes exactes et durées observées : retour
arrière par révision, panne de base, restauration, réponse aux dix alertes, diagnostic du
pipeline ML et des requêtes planifiées. Il consigne aussi ce qu'il ne couvre pas (bascule de
zone impossible, pas de sauvegarde BigQuery, pas de procédure de compromission, pas
d'astreinte désignée) : un runbook qui prétend tout couvrir se fait démentir au premier
incident qu'il n'avait pas prévu.

Le point d'alerte le plus important à traiter reste le **canal unique** sur une adresse
personnelle non vérifiée — l'alerting est aujourd'hui son propre point unique de défaillance.
