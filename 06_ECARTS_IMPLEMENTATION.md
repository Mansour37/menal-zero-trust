# Écarts entre la conception (HLD/LLD) et l'implémentation

**Date :** 2 août 2026 · **Environnement de référence :** `menal-zero-trust-staging`

Ce document recense les écarts **vérifiés dans le code et sur l'infrastructure déployée**
entre `01_HLD_MENAL.md` / `02_LLD_MENAL.md` et ce qui tourne réellement. Il existe pour une
raison simple : une conception qu'on ne confronte pas au déployé finit par décrire un système
qui n'existe pas, et c'est précisément ce genre d'écart silencieux qui a permis à un composant
d'échouer soixante fois d'affilée sans que personne le remarque (voir `STATUT_DEV.md` §8.3).

Chaque écart est classé :

- **Assumé** — décision consciente, la conception reste la cible ou est explicitement révisée.
- **À combler** — la conception a raison, l'implémentation doit rattraper.

---

## 1. Écarts assumés (décision justifiée)

| Réf. | Conception | Réel | Justification |
|---|---|---|---|
| E7 | `ml-embed` en ONNX **int8** (HLD §3, LLD) | **fp32** | La quantisation int8 a été testée et **rejetée par le critère d'acceptation** : accord de classement 0/5 en top-1 MITRE contre le fp32. Le critère documenté (`cos(fp32, int8) > 0,99`) a joué son rôle — c'est un succès du garde-fou, pas un renoncement. |
| E5 | `ml-embed` avec egress **nul** | `PRIVATE_RANGES_ONLY` ; `enrich-job` en `ALL_TRAFFIC` | `ml-embed` est en ingress interne, or les URL `run.app` résolvent vers des IP publiques Google : avec `PRIVATE_RANGES_ONLY` côté job, l'appel contourne le VPC et arrive comme trafic externe (404 ingress). Tout le trafic du job doit transiter par le connecteur ; BigQuery reste joignable via Private Google Access + NAT. |
| E6 | Scheduler d'enrichissement **toutes les 5 min** | **15 min** | Cadence suffisante au regard de la latence d'ingestion (sink → normalisation → règle Sigma). Un cycle plus court multiplierait les réveils du modèle sans gagner en fraîcheur utile. |
| E12 | Trivy bloquant sur CRITICAL **et HIGH non acquittée** (LLD §8) | Bloquant sur **CRITICAL corrigeable** ; HIGH en rapport informatif | `ignore-unfixed` évite de bloquer sur des CVE sans correctif disponible — sans quoi la porte aurait été désactivée dès la première alerte non actionnable, ce qui est le mode d'échec classique des portes trop strictes. Le rapport HIGH reste visible. |
| E15 | Modules Terraform `00-foundation` … `07-observability`, miroir des couches L1–L7 | Modules **thématiques** (`vpc`, `iam`, `bigquery`, `detection`, `ml-pipeline`, …) | Le découpage thématique correspond aux frontières réelles de dépendance. La numérotation par couche suggérerait un ordre d'application que Terraform détermine de toute façon par le graphe. |
| E20 | PostgreSQL 17 | **PostgreSQL 15** | Version disponible et éprouvée à la création de l'instance. Montée de version à planifier, sans urgence. |

## 2. Écarts à combler

| Réf. | Conception | Réel | Impact |
|---|---|---|---|
| E1 | 4 projets : `menal-ops`, dev, staging, prod | **2 projets** (dev, staging) ; `terraform/environments/prod/` est **vide** ; le bucket d'état `menal-tf-state` vit sans projet d'amorçage dédié | La chaîne dev→staging→prod du *Definition of Done* (méthodologie §7) n'est pas atteignable en l'état |
| E4 | **Direct VPC egress** (LLD §4) | **Serverless VPC Connector** (2 × e2-micro minimum, jamais réduits) | Fonctionnellement équivalent, mais coût fixe permanent et palier de montée en charge irréversible |
| E8 | Rôles JWT `admin` / `analyste` / `utilisateur` | Rôles réels `admin` / `viewer` / `service` | Divergence de vocabulaire entre la doc et le code. À trancher : renommer le code ou corriger la doc — mais pas laisser les deux |
| E9 | Endpoints `/incidents/{id}/attack`, `/coverage/attack-matrix`, `/vulnerabilities/prioritized` | `/siem/incidents/{entity}`, `/siem/coverage`, `/siem/vulnerabilities` | Noms et clé d'incident divergents (`entity` et non `incident_id`). Sans conséquence fonctionnelle, mais le contrat annoncé en LLD n'est pas celui servi |
| E10 | Vue `v_killchain` et table `incident_scores` en BigQuery | **Absentes** : le scoring et la chaîne d'attaque sont recalculés en Python dans l'API | Le calcul n'est pas auditable en base et n'est pas réutilisable hors API |
| E13 | Déploiement par **digest** `@sha256:` (LLD §8, « déploiement par tag interdit ») | Déploiement CI par **tag SHA de commit** (`menal-api:<sha>`), puis re-tag `latest` — **partiellement comblé le 08/08** : le chemin `terraform apply` (bootstrap/disaster recovery), qui retombait auparavant sur `:latest` mutable, résout désormais un digest réel via `data "google_artifact_registry_docker_image"` (no-op sur le régime CI courant, protégé par `lifecycle.ignore_changes`) | Le chemin CI reste par tag SHA (traçable au commit mais pas un digest cryptographique). T10 reste non démontrable au sens strict, mais le risque de reconstruction sur artefact non audité est fermé |
| E17 | Dossier `pipeline/` | **Vide** ; `workflows/security-pipeline.yaml` est orphelin et référence un projet `menal-dev` inexistant | Code mort trompeur pour un lecteur |
| E19 | Un dashboard | **Deux** : `dashboard/` (Next.js, déployé, cible ADR 0001) et `api/dashboard/` (Streamlit, code mort) | Ambiguïté sur ce qui est le produit |
| E21 | Cloud KMS (CMEK sur SQL/BQ), HLD §2 et §4.2 | **Cloud SQL : structurellement bloqué** — `encryption_key_name` est immuable à la création (vérifié par `terraform plan` le 08/08 : `must be replaced`, appliquer le CMEK sur l'instance existante détruirait toutes les données). **BigQuery/GCS/Secret Manager : comblé le 08/08** (voir §3) | CMEK sur Cloud SQL nécessiterait un projet de migration dédié (nouvelle instance + bascule applicative), hors portée d'une simple activation |
| E22 | Pas de colonne service/tenant dans les tables SIEM (principe multi-app) | `access_logs` a une colonne `service` ; `detections`, `api_metrics`, `security_events`, `alert_enrichment` n'en ont aucune — `api_metrics` fusionne les agrégats horaires de toutes les apps | Une vraie séparation de preuves contractuelle entre apps/tenants n'est pas possible aujourd'hui (audit du 07/08, non traité en remédiation) |
| E23 | `modules/cloud-sql` réinstanciable par app (principe multi-app) | Peering VPC câblé dans le module — une 2ᵉ instance entrerait en conflit sur `servicenetworking.googleapis.com`. Elson partage `menal-db` via isolation applicative (REVOKE runtime, désormais vérifiée automatiquement chaque jour depuis le 08/08 — voir §3) | Une vraie instance Cloud SQL par app nécessiterait d'extraire le peering dans un module dédié appelé une seule fois par environnement |
| E26 | Redondance du chemin réseau vers Cloud SQL | VPC Connector unique (2× e2-micro, une seule région) — sa perte coupe l'accès Cloud SQL pour TOUS les services simultanément | SPOF non documenté avant l'audit du 07/08, non traité en remédiation (Tier 2 logs/détection décliné, ce point n'était pas dans le périmètre décidé) |
| E27 | `dev` doit pouvoir répéter ce qui tourne en staging | `elson.tf` et 8 variables multi-app (`monitored_services`, `cloud_run_services`, `auth_paths`, `extra_services`...) n'existent que dans l'environnement staging | Dev n'est pas un miroir fidèle ; l'onboarding d'une app ne peut se faire qu'en staging aujourd'hui |
| E28 | Reproductibilité des versions de provider Terraform (LLD §10.2) | `.terraform.lock.hcl` gitignoré ; `terraform.yml` (F7) fait un `init -backend=false` sans lock committé | Aucune garantie que la CI de validation utilise la même version de provider que les `apply` réels sur staging |

## 3. Écarts comblés depuis (traçabilité)

| Réf. | Écart | Résolution |
|---|---|---|
| E2 | 3 comptes de service au lieu des 6 du LLD §2.1 ; `enrich-job` partageait `sa-pipeline` et héritait du droit d'écrire dans `detections` | **`sa-enrich-job` créé** le 02/08 : lecture du dataset, écriture sur la seule table `alert_enrichment`. Le principe cardinal du HLD §5 est tenu et vérifiable (T4). Voir `STATUT_DEV.md` §8.4 |
| E11 | Aucun pipeline infra F7, aucun scan IaC | **`terraform.yml`** ajouté : `fmt` bloquant, `validate` sur dev + staging, scan IaC Trivy bloquant sur CRITICAL. `plan`/`apply` automatisés restent à faire (décision IAM) |
| E14 | Règles Sigma en fenêtre de 5 min, plus courte que la latence d'ingestion | Fenêtres portées à 15 min avec déduplication `NOT EXISTS`. R2, R3 et R6 voient désormais aussi les tentatives bloquées au bord par le WAF |
| E18 | Secret JWT par défaut présent dans le code | Toujours présent comme valeur de repli en dev, mais **fail-closed hors dev** : l'API refuse de démarrer si le secret n'a pas été injecté |
| — | Le CI ne construisait pas l'image du dashboard | Job `dashboard` ajouté au pipeline (build, scan Trivy, déploiement, smoke test). `ml-embed` et `enrich-job` restent promus manuellement |
| E16 | Condition WIF sur le dépôt seulement (pas la branche) | **Fermé le 05/08, reconfirmé le 07/08** (code + live) : `assertion.repository == '...' && assertion.ref == 'refs/heads/main'` (`terraform/modules/iam/main.tf`), vérifié via `gcloud iam workload-identity-pools providers describe` |
| — | `sa-api` avait `secretAccessor` projet-wide | **Fermé** (constaté le 05/08, reconfirmé le 07/08) : bindings ciblés par secret uniquement (`cloud-sql/main.tf`, `app-service/main.tf`) |
| — | Bug détection R5 (filtre `service="cloud-run"` ne matchait jamais, règle structurellement morte) | **Corrigé le 07/08** : filtre retiré, service injecté dans le message (`terraform/modules/detection/main.tf:204-239`) |
| — | Dashboard : `.catch(() => [])` affichait "tout est nominal" pendant une panne API | **Corrigé** (constaté le 07/08) : toutes les pages principales affichent un état d'erreur explicite distinct de l'état vide |
| — | `ci.yml` sans filtre `paths:` (tout push redéploie MENAL) | **Corrigé** (constaté le 07/08) : filtres `paths:` présents sur `ci.yml`, `elson-ci.yml`, `terraform.yml` |
| E21 (partiel) | Cloud SQL zonal (SPOF structurel, écart vs HLD §4.2 « HA ») | **Fermé le 08/08** : `availability_type = REGIONAL` appliqué sur `db-f1-micro` (décision coût/risque explicitement tranchée par l'utilisateur, coût de l'instance doublé) |
| E21 (partiel) | KMS décoratif sur BigQuery/GCS/Secret Manager | **Fermé le 08/08** : CMEK réellement câblé sur le dataset SIEM (nouvelles tables), le bucket média Elson, et les 7 secrets applicatifs (menal + Elson) — 2 clés distinctes (régionale pour SQL/BQ/GCS, globale dédiée pour Secret Manager dont la réplication auto l'exige) |
| — | `sa-cicd` avait `dataEditor` sur tout le dataset SIEM | **Fermé le 08/08** : accès resserré à la seule table `cve_findings` (`google_bigquery_table_iam_member`, même pattern que `sa-enrich-job`) |
| — | Budget de la sonde de démarrage `ml-embed` trop court (70s), cause des 503 du 05/08 | **Fermé le 07/08** : `failure_threshold` élargi (150s), largement au-dessus du pic de cold start mesuré (~94s) |
| — | Rollback Cloud Run jamais testé (procédure écrite seulement) | **Fermé le 07/08** : bascule réelle testée et chronométrée sur `menal-api-staging` (11,6s / 16,5s) |
| — | Isolation SQL Elson/menal faite au runtime, sans détection de dérive | **Amélioré le 08/08** : job planifié quotidien (`elson-sql-isolation-check-staging`) rejoue une vérification read-only et alerte sur échec — reste un geste applicatif, pas de garde-fou Terraform natif, mais la dérive silencieuse n'est plus possible |
| — | Canal d'alerte unique (email personnel) | **Fermé le 08/08** : 2ᵉ canal email ajouté, toutes les politiques d'alerte staging pointent sur les deux |

---

## Comment maintenir ce document

Il n'a de valeur que s'il est confronté au réel. À relire à chaque évolution d'architecture, et
au minimum avant toute revue ou démonstration : un écart qui disparaît doit passer en §3, un
écart nouveau doit apparaître en §1 ou §2. Un document d'écarts qui ne bouge jamais est le
signe qu'on a cessé de comparer.
