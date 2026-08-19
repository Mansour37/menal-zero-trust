# Sécurité — Audits et écarts (registre vivant)

> **Avant-propos.** Ce document consolide et remplace `06_ECARTS_IMPLEMENTATION.md`,
> `09_AUDIT_E2E_STAGING_2026-08-07.md`, `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md`,
> `11_AUDIT_EXPERTS_SIGMA_RESEAU_IAM_MFA_2026-08-18.md` (état au 19/08/2026). Les quatre
> fichiers sources ne sont pas supprimés — ils restent consultables pour l'historique brut —
> mais ce document est désormais la référence unique pour le rapport PFE sur ce périmètre.

**Projet :** MENAL Zero Trust — GCP `menal-zero-trust-dev` / `menal-zero-trust-staging`
**Nature du document :** registre chronologique des écarts entre la conception (HLD/LLD,
documents narratifs) et l'implémentation réelle (Terraform, code, infrastructure déployée),
et des constats des audits successifs (documentation, E2E staging, revue experts). Chaque
écart est tracé depuis sa première identification jusqu'à son statut final connu au
19/08/2026 : **résolu**, **ouvert**, **accepté (avec ou sans ADR)**, ou **correctif lancé (à
confirmer)** quand une remédiation est en cours de déploiement au moment de la rédaction.

**Pourquoi ce document existe :** une conception qu'on ne confronte jamais au déployé finit
par décrire un système qui n'existe pas — c'est précisément ce type d'écart silencieux qui a
permis à un composant d'échouer soixante fois d'affilée sans que personne le remarque (cf.
`STATUT_DEV.md` §8.3, référencé dans le document original du 02/08). Quatre vagues d'audit
successives (02/08, 07/08, 11/08, 18/08) ont progressivement resserré ce constat : la
discipline documentaire existe (le projet tient un journal d'écarts depuis le début), mais une
**dérive par accumulation** s'installe dès que les correctifs ponctuels ne sont pas
systématiquement répercutés dans les documents de référence.

---

## 1. Résumé exécutif — écarts encore ouverts au 19/08/2026

Tableau consolidé, dédupliqué : quand un même écart a été identifié dans plusieurs documents
sources à des dates différentes, une seule ligne trace son historique complet plutôt que de le
répéter. Priorité HIGH/MEDIUM/LOW reprise du jugement des documents sources (à dominante
sécurité pour HIGH — Zero Trust, exposition, intégrité des preuves).

**Note sur les correctifs du 19/08/2026 :** 5 remédiations issues de `11_AUDIT_EXPERTS...`
(18/08) ont été implémentées et validées **en code** (H1-H5 ci-dessous : binding IAM
`sa-pipeline`/`ml-embed`, logs de deny réseau, rate-limit + chiffrement du secret MFA,
renommage des règles "Sigma") — voir §4 pour une 2ᵉ vague (Cloud Run/CMEK, gouvernance
données, edge). Ces lignes portent la mention **✅ code corrigé, 🕓 apply GCP en attente** :
la correction est validée hors ligne (`terraform validate`, tests) mais **pas encore appliquée
sur l'infrastructure réelle** — l'utilisateur garde la main sur le `terraform apply` avec ses
propres identifiants (voir §4.4). Ne pas les considérer "résolues" au sens plein tant que
l'apply n'est pas confirmé.

### HIGH

| # | Écart | Domaine | Historique | Statut au 19/08/2026 |
|---|---|---|---|---|
| H1 | `sa-pipeline` détient `roles/bigquery.dataEditor` **au niveau projet** (`terraform/modules/iam/main.tf:63-67`), hérité par `ml-embed` qui tourne sous ce SA faute de `sa-ml-embed` dédié (`terraform/modules/ml-pipeline/main.tf:44`) | IAM / moindre privilège | Assumé le 11/08 (`06_ECARTS` E29) → constat critique C1 (`10_AUDIT`, 11/08) → confirmé **toujours ouvert, inchangé** (`11_AUDIT`, 18/08, action HIGH #2) | ✅ **déployé et vérifié en direct le 19/08** (terraform plan = 0 diff + terraform state show + test live) |
| H2 | Logs de deny pare-feu (4 règles) et logs Cloud NAT **non activés** (`log_config` absent) malgré un sink BigQuery `vpc_to_bq` déjà câblé et filtrant `disposition="DENIED"` — 0 ligne produite | Réseau / visibilité forensique | Assumé le 11/08 (`06_ECARTS` E31) → constat critique C3 (`10_AUDIT`, 11/08) → confirmé **toujours ouvert, inchangé** (`11_AUDIT`, 18/08, action HIGH #4) | ✅ **déployé et vérifié en direct le 19/08** (terraform plan = 0 diff + terraform state show + test live) |
| H3 | Endpoint `/auth/mfa/verify` (cible naturelle d'un brute-force sur un code TOTP à 6 chiffres) **absent** de `var.auth_paths` protégé par Cloud Armor (10 tentatives/min/IP + ban 5 min) ; seul filet = `slowapi` applicatif 60/min, explicitement documenté comme non principal | AppSec / MFA | Identifié le 18/08 (`11_AUDIT`, action HIGH #1, priorité la plus haute de l'audit) | ✅ **déployé et vérifié en direct le 19/08** (terraform plan = 0 diff + terraform state show + test live) |
| H4 | `mfa_secret` stocké **en clair** en base (`api/app/models/user.py:19`, `String(32)`), aucun chiffrement AEAD/KMS applicatif | AppSec / MFA | Identifié le 18/08 (`11_AUDIT`, action HIGH #3) | ✅ **déployé et vérifié en direct le 19/08** (terraform plan = 0 diff + terraform state show + test live) |
| H5 | Nom "Sigma" utilisé en Terraform (`display_name = "Sigma ${each.key}"`) et dans l'UI dashboard alors que les 7 règles sont du SQL BigQuery custom — aucun YAML SigmaHQ, aucun moteur de traduction ; le rapport PFE le documente honnêtement mais le produit ne porte pas la même nuance | SIEM / detection engineering | Identifié le 18/08 (`11_AUDIT`, action HIGH #6) | ✅ **déployé et vérifié en direct le 19/08** (terraform plan = 0 diff + terraform state show + test live) |
| H6 | Aucune isolation réseau réelle entre tenants MENAL/Elson : VPC, connecteur serverless et instance Cloud SQL partagés ; `allow_internal` (priorité 900) autorise tout TCP/UDP/ICMP entre subnets sans granularité par tag/service ; aucune ressource `access_context_manager` (VPC-SC) | Réseau / multi-tenant | Identifié le 18/08 (`11_AUDIT`, action HIGH #5) — angle non couvert par les audits précédents | Ouvert — pas dans le lot de correctifs en cours au 19/08 |
| H7 | Clé tenant (`detections.service`) absente ou NULL sur 75-90 % des lignes pour les règles R2/R3/R6 (seule R1 fiable à 100 %) ; `api_metrics`, `alert_enrichment`, `cve_findings` n'ont **aucune** colonne tenant — l'isolation MENAL/Elson côté SIEM est réelle mais partielle, pas binaire | SIEM / multi-tenant | E22 (`06_ECARTS`, à combler) → précisé E32 (assumé 11/08) → constat critique C4 (`10_AUDIT`, 11/08, "ÉLEVÉ") — non retraité le 18/08 (hors périmètre du 4ᵉ audit, distinct de H6 qui porte sur le réseau) | Ouvert |
| H8 | ATT&CK-BERT (`alert_enrichment`, sortie du modèle ML) **n'alimente jamais** le scoring d'incidents (`_score_incident`, `api/app/routers/siem.py:374-467`, exclusivement basé sur `detections.mitre_tactic`) — contredit `ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §5.3 qui présente le modèle comme "condition d'existence" de la détection de progression d'attaque ; `alert_enrichment` n'a pas de colonne `entity` pour permettre la jointure | SIEM / ML | E30 (`06_ECARTS`, assumé 11/08) → constat critique C2 (`10_AUDIT`, 11/08, "CRITIQUE") — décision ADR toujours à trancher, non retraité le 18/08 | Ouvert — décision ADR en attente (informationnel assumé vs jointure au scoring) |
| H9 | Angles morts structurels de détection : aucune règle d'exfiltration de données, aucune détection d'abus IAM/élévation de privilèges (`SetIamPolicy` suspect, création de clé SA), aucune UEBA — uniquement du pattern-matching HTTP/WAF sur 7 règles | SIEM / detection engineering | Identifié le 18/08 (`11_AUDIT` §2) | Ouvert |
| H10 | Garantie "pas de clés de SA statiques" (`00_CAHIER_DES_CHARGES_MENAL.md:150`, `01_HLD_MENAL.md:225`) **non appliquée par une politique d'organisation réelle** (pas d'org GCP, projet personnel) ; le test censé le vérifier (`test_t6_sa_key_creation_blocked_check`, `tests/e2e/test_03_iam_isolation.py:124-125`) est un `pass` vide qui ne détecterait pas une régression | IAM / tests | Identifié le 18/08 (`11_AUDIT`, action HIGH #7) | Ouvert |
| H11 | Aucune séparation règle/déploiement pour les règles de détection (pas de revue indépendante du contenu, pas de test unitaire par règle avec jeu de logs synthétiques) | SIEM / detection engineering | Identifié le 18/08 (`11_AUDIT` §2) | Ouvert |
| H12 | ~~Gate SAST Semgrep (`ci.yml`) silencieusement cassée depuis au moins le 02/08 : `semgrep/semgrep-action@v1` crashait (`ValueError: invalid rule severity value: MEDIUM`, incompatibilité avec le registre `p/default` actuel) sur CHAQUE run sans jamais faire échouer le job — 0 règle SAST réellement évaluée malgré une porte annoncée "bloquante" (`ci.yml:59-61`)~~ | CI/CD / SAST | Découvert le 19/08 en vérification live des runs réels (`gh run view --log-failed`, runs 30754330475 à 31969797991) | ✅ Résolu le 19/08 (§7) : remplacé par appel direct au CLI Semgrep (`semgrep scan --config=p/default --error`), code de sortie fiable |
| H13 | WAF Cloud Armor ne bloque pas un pattern de path traversal envoyé "brut" (payload non normalisé côté client, `curl --path-as-is`) — 302 obtenu au lieu du 403 attendu, alors que SQLi/XSS/fichiers sensibles sont tous correctement bloqués (403) avec le même type de test | Réseau / WAF | Découvert le 19/08 en test live contre staging (`api-staging.menal-sarl.com`) | Ouvert — mécanisme exact non confirmé (normalisation GCLB avant évaluation Cloud Armor ?), à investiguer avant de considérer la protection LFI comme pleinement validée |

### MEDIUM

| # | Écart | Domaine | Historique | Statut au 19/08/2026 |
|---|---|---|---|---|
| M1 | `allow_internal` trop permissive (tout port/protocole) au lieu de règles ciblées par `target_tags`/SA et ports explicites | Réseau | Identifié le 18/08 (`11_AUDIT` §3) — corollaire de H6 | Ouvert |
| M2 | Aucun VPC Service Controls (périmètre) autour de Secret Manager / Cloud SQL API | Réseau | Identifié le 18/08 (`11_AUDIT` §3) | Ouvert |
| M3 | Binding IAM dataset-level redondant avec le binding projet (`terraform/modules/bigquery/main.tf:28-33`) — masque le périmètre réellement nécessaire | IAM | Identifié le 18/08 (`11_AUDIT` §4) | Ouvert |
| M4 | `annexe_d_matrice_iam.tex` affirme un état cible non atteint sans le signaler comme écart (contrairement au LLD qui renvoie déjà à l'ADR-0002) | Documentation / IAM | Identifié le 18/08 (`11_AUDIT` §4) | Ouvert |
| M5 | Pas de gestion des faux positifs documentée pour les règles de détection (seuils en dur : `> 5`, `> 10`, `5000ms`) ; `SIGMA_RULES` dupliqué à la main dans `api/app/bigquery.py:52` depuis le Terraform, sans garde-fou de dérive | SIEM | Identifié le 18/08 (`11_AUDIT` §2) | Ouvert |
| M6 | Tests e2e MFA inexistants (`dashboard/tests/e2e/auth.spec.ts` ne couvre aucun scénario MFA) et de toute façon jamais exécutés en CI (le job `e2e` lance les tests Python racine, pas le dashboard ; le job `dashboard-test` tourne Jest sans aucun fichier `*.test.ts`, donc vert par construction) | AppSec / CI | Identifié le 18/08 (`11_AUDIT` §5) | Ouvert |
| M7 | Audit logs Data Access (BigQuery/KMS/Secret Manager/Cloud SQL) **générés** mais non centralisés ni retenus durablement — aucun sink dédié `cloudaudit`, rétention `_Default` = 30 j et mutable | Sécurité / observabilité | Identifié le 07/08 (`09_AUDIT` §1) — jamais retraité depuis | Ouvert |
| M8 | Aucune détection sur le control plane (CIS 2.4-2.11 : changements IAM/policy) dans `terraform/modules/detection` | SIEM / IAM | Identifié le 07/08 (`09_AUDIT` §1) — jamais retraité depuis | Ouvert |
| M9 | CMEK sur Cloud SQL **structurellement bloqué** : `encryption_key_name` immuable à la création, testé via `terraform plan` (`must be replaced`, destructeur) — nécessite un projet de migration dédié (nouvelle instance + bascule applicative) | Sécurité / chiffrement | E21 (`06_ECARTS`) — confirmé bloqué le 08/08, non retraité depuis | Ouvert (limitation technique actée, hors portée d'une simple activation) |
| M10 | Déploiement CI par tag SHA de commit (pas par digest cryptographique strict) ; le chemin `terraform apply` (bootstrap/DR) résout désormais un digest réel via `data "google_artifact_registry_docker_image"` (comblé le 08/08, no-op sur le régime CI courant), mais le chemin CI de tous les jours reste par tag | CI/CD / intégrité des artefacts | E13 (`06_ECARTS`) — partiellement comblé le 08/08 ; confirmé écart de reproductibilité le 07/08 (`09_AUDIT` §6, "commentaire `cloud-run/main.tf:163-166` factuellement faux") | Ouvert (partiellement comblé) |
| M11 | ~~`scripts/hotfix.sh` : push vers un compte Docker Hub **personnel** (`mo35ehab`), aucun scan Trivy, codé en dur sur `menal-zero-trust-dev`~~ | CI/CD / supply chain | Risque assumé le 07/08 (`09_AUDIT` §1) → détaillé le 11/08 (`10_AUDIT` E6) | ✅ code corrigé le 19/08 (Session N+2, §5.1) : push Docker Hub retiré, environnement paramétrable dev/staging, scan Trivy CRITICAL ajouté avant push |
| M12 | CI non factorisée : `ci.yml`/`elson-ci.yml` dupliquent Gitleaks/Semgrep/Trivy quasi mot pour mot (pas de `workflow_call`/matrix) | CI/CD | Identifié le 07/08 (`09_AUDIT` §4) — jamais retraité depuis | Ouvert |
| M13 | ~~`.terraform.lock.hcl` gitignoré~~ | CI/CD / reproductibilité | E28 (`06_ECARTS`) — confirmé le 07/08 (`09_AUDIT` §6) | ✅ Résolu le 19/08 (Session N+2, §5.3) : retiré de `.gitignore`, lock régénéré pour dev/staging (google/google-beta 5.45.2, random 3.9.0, github 6.13.0 identiques sur les 2 env) |
| M14 | Test from-zero du schéma Alembic (menal-api) absent — ni en CI ni ailleurs, les tests API mockent entièrement la DB (`api/tests/conftest.py:5-14`) | Reproductibilité / tests | Identifié le 07/08 (`09_AUDIT` §6) — jamais retraité depuis | Ouvert |
| M15 | `dev` n'est pas un miroir fidèle de `staging` : `elson.tf` et 8 variables multi-app (`monitored_services`, `cloud_run_services`, `auth_paths`, `extra_services`...) n'existent que dans l'environnement staging | Multi-app / reproductibilité | E27 (`06_ECARTS`) — confirmé le 07/08 (`09_AUDIT` §4/§6) | Ouvert |
| M16 | `modules/cloud-sql` non réinstanciable par app : peering VPC câblé en dur dans le module — une 2ᵉ instance entrerait en conflit sur `servicenetworking.googleapis.com` | Multi-app / architecture | E23 (`06_ECARTS`) — confirmé le 07/08 (`09_AUDIT` §4) | Ouvert |
| M17 | VPC Connector unique comme SPOF réseau (2 × e2-micro, une seule région) — sa perte coupe l'accès Cloud SQL pour **tous** les services simultanément | Disponibilité / réseau | E26 (`06_ECARTS`) — confirmé "nouveau, non documenté avant" le 07/08 (`09_AUDIT` §5) | Ouvert |
| M18 | Couverture monitoring partielle : seuls `menal-api` et `elson-api` dans `monitored_services` (`terraform.tfvars:25-38`) — dashboard, `elson-web`, `ml-embed` non surveillés | Disponibilité | Identifié le 07/08 (`09_AUDIT` §2) — jamais retraité depuis | Ouvert |
| M19 | Isolation SQL Elson/menal (REVOKE `cloudsqlsuperuser`) reste un geste applicatif sans garde-fou Terraform natif : un `google_sql_user` recréé (ex. restauration PITR) régénère l'utilisateur avec `cloudsqlsuperuser` par défaut | Sécurité / multi-tenant | "Vraie à l'instant T, non durable" le 07/08 (`09_AUDIT` §1) → amélioré le 08/08 (`06_ECARTS` §3 : job quotidien `elson-sql-isolation-check-staging` détecte la dérive, mais ne la prévient pas structurellement) | Ouvert (mitigé, pas fermé) |
| M20 | Table des comptes de service du LLD §2.1 obsolète : 6 SA nommés qui n'existent pas (`sa-app-elson`, `sa-ml-embed`...) ; réalité = `sa-api`, `sa-pipeline`, `sa-cicd`, `sa-enrich-job`, `sa-dashboard-<env>`, `sa-<app>-<env>` avec une convention de nommage elle-même incohérente | Documentation / IAM | Identifié le 11/08 (`10_AUDIT` M2) — jamais retraité depuis | Ouvert |
| M21 | 7 constats "MOYENS" du 11/08 non retraités depuis : topologie subnets du LLD fausse (1 subnet documenté vs 3 réels, CIDR faux), egress `enrich-job` en `ALL_TRAFFIC` non réconcilié avec ADR-11, plage PSA `10.20.0.0/16` non vérifiable (allocation auto GCP), règles pare-feu mortes ciblant un tag réseau `https-server` jamais attaché, cache par hash des embeddings jamais utilisé (`input_hash` stocké mais ignoré), `top_k` incohérent dans la doc ATT&CK-BERT elle-même (`top_k => 1` en exemple SQL vs `top_k = 3` dans le code) | Documentation / divers | `10_AUDIT` §4 (11/08) — détail en §2.3 ci-dessous | Ouvert |

### LOW

| # | Écart | Domaine | Historique | Statut au 19/08/2026 |
|---|---|---|---|---|
| L1 | Divergence de vocabulaire JWT : rôles documentés `admin`/`analyste`/`utilisateur` vs rôles réels `admin`/`viewer`/`service` | Documentation | E8 (`06_ECARTS`) | Ouvert |
| L2 | Endpoints documentés (`/incidents/{id}/attack`...) divergents des endpoints réels (`/siem/incidents/{entity}`...), y compris la clé d'incident (`entity` et non `incident_id`) — sans conséquence fonctionnelle | Documentation | E9 (`06_ECARTS`) | Ouvert |
| L3 | Vue `v_killchain` et table `incident_scores` absentes de BigQuery — le scoring est recalculé en Python dans l'API, non auditable en base | Architecture / SIEM | E10 (`06_ECARTS`) | Ouvert |
| L4 | Dossier `pipeline/` vide ; `workflows/security-pipeline.yaml` orphelin référence un projet `menal-dev` inexistant — code mort trompeur | Documentation / hygiène | E17 (`06_ECARTS`) | Ouvert |
| L5 | Deux dashboards existent : `dashboard/` (Next.js, déployé, cible réelle) et `api/dashboard/` (Streamlit, code mort) — ambiguïté sur le produit | Documentation / hygiène | E19 (`06_ECARTS`) | Ouvert |
| L6 | Workflow CI mort `.github/workflows/e2e.yml`, dupliqué, jamais supprimé, fallback vers un domaine non-staging par défaut | CI/CD / hygiène | E7 (`10_AUDIT`) | Ouvert |
| L7 | ~~Images de base MENAL non pinnées par digest~~ | Reproductibilité / supply chain | Identifié le 07/08 (`09_AUDIT` §6) | ✅ Résolu le 19/08 (Session N+2, §5.3) : 5 Dockerfile épinglés par digest SHA256 (résolu via l'API Registry Docker Hub) |
| L8 | Bloc `traffic` explicite ajouté à `modules/cloud-run`/`modules/dashboard` (rollout progressif) mais jamais réellement utilisé — reste 100 % du trafic basculé instantanément à chaque déploiement | Disponibilité | "Nouveau, non documenté" le 07/08 (`09_AUDIT` §5) → infra préparée en remédiation Tier 1 du 07/08 (§10) | Ouvert (infra prête, non exploitée) |
| L9 | Sous-réseau public sans ressource déployée, existence non tranchée | Réseau | M5/M6 (`10_AUDIT` §4) → repris le 18/08 (`11_AUDIT` §3, "ADR 0006", non tranchée) | Ouvert |
| L10 | Pas de pipeline CI dédié pour valider les règles de détection avant déploiement | SIEM / CI | Identifié le 18/08 (`11_AUDIT` §2) | Ouvert |
| L11 | Table de correspondance tenant codée en dur (`service` = noms Cloud Run côté logs applicatifs vs noms de backend LB côté règles R2/R3), sans test de dérive | Multi-tenant | Identifié le 18/08 (`11_AUDIT` §4) | Ouvert |
| L12 | Pas de backup codes / récupération MFA ; pas de notification utilisateur sur `mfa/disable` ou ré-enrôlement | AppSec / MFA | Identifié le 18/08 (`11_AUDIT` §5) | Ouvert |
| L13 | ~~`expiration_ms` sur `raw_logs` toujours commenté (contrainte binaire Terraform 32-bit)~~ | BigQuery / rétention | Identifié le 07/08 (`09_AUDIT` §1) | ✅ Résolu le 19/08 (Session N+1, §4.2) : blocage confirmé local au poste 32-bit, sans impact CI 64-bit ; `expiration_ms` = 90 j activé sur `raw_logs` et ajouté sur `access_logs` |
| L14 | `security_events` (contient `source_ip`/`raw_log`) sans limite de rétention — même profil RGPD qu'`access_logs`/`raw_logs`, mais plus proche d'une preuve d'alerte ; classification métier non tranchée | BigQuery / rétention | Identifié le 19/08 (Session N+1, §4.2) | Ouvert |
| L15 | Aucune alerte de monitoring sur un échec de provisioning/renouvellement de certificat TLS managé (`FAILED_NOT_VISIBLE` silencieux si le DNS dérive) | Réseau / observabilité | Identifié le 19/08 (Session N+1, §4.3) | Ouvert |

**Total au 19/08/2026 (après Sessions N+1 §4, N+2 §5, N+3 §6, validation live §7) : 49 écarts**
(45 initiaux + 2 issus de N+1 + 2 issus de la validation live §7 : H12, H13) dont **5 résolus en
code+réel sans dépendance à un apply** (L13, M11, M13, L7, H12), ce qui laisse **44 écarts
pleinement ouverts** (12 HIGH, 19 MEDIUM, 13 LOW). Parmi ces 12 HIGH, **5 sont déjà corrigés en
code mais attendent l'apply GCP** (H1-H5, voir §3, toujours bloqué par un problème de facturation
GCP indépendant — voir §7.4) et **1 est un écart réel découvert en conditions réelles, non encore
corrigé** (H13, gap WAF path traversal, voir §7.2). Les écarts résolus ou explicitement acceptés
(décision architecturale assumée, avec ou sans ADR) sont détaillés dans la chronologie ci-dessous
et ne sont pas repris dans ce tableau.

---

## 2. Chronologie détaillée

### 2.1 02/08 → 11/08/2026 — Écarts conception vs implémentation

*Contenu original : `06_ECARTS_IMPLEMENTATION.md`, daté du 2 août 2026, environnement de
référence `menal-zero-trust-staging`, mis à jour au fil de l'eau jusqu'au 11/08.*

Chaque écart y est classé **Assumé** (décision consciente, la conception reste la cible ou est
explicitement révisée) ou **À combler** (la conception a raison, l'implémentation doit
rattraper).

#### 2.1.1 Écarts assumés (décisions architecturales définitives)

| Réf. | Conception | Réel | Justification |
|---|---|---|---|
| E7 | `ml-embed` en ONNX **int8** (HLD §3, LLD) | **fp32** | Quantisation int8 testée et **rejetée par le critère d'acceptation** : accord de classement 0/5 en top-1 MITRE contre le fp32 (`cos(fp32, int8) > 0,99`) — succès du garde-fou, pas un renoncement. |
| E5 | `ml-embed` avec egress **nul** | `PRIVATE_RANGES_ONLY` ; `enrich-job` en `ALL_TRAFFIC` | `ml-embed` en ingress interne, mais les URL `run.app` résolvent vers des IP publiques Google : avec `PRIVATE_RANGES_ONLY` côté job, l'appel contournerait le VPC (404 ingress). Tout le trafic du job doit transiter par le connecteur ; BigQuery reste joignable via Private Google Access + NAT. |
| E6 | Scheduler d'enrichissement **toutes les 5 min** | **15 min** | Cadence suffisante au regard de la latence d'ingestion (sink → normalisation → règle Sigma). Un cycle plus court multiplierait les réveils du modèle sans gain de fraîcheur utile. |
| E12 | Trivy bloquant sur CRITICAL **et HIGH non acquittée** (LLD §8) | Bloquant sur **CRITICAL corrigeable** ; HIGH en rapport informatif | `ignore-unfixed` évite de bloquer sur des CVE sans correctif — sinon la porte aurait été désactivée dès la première alerte non actionnable. |
| E15 | Modules Terraform `00-foundation` … `07-observability`, miroir des couches L1–L7 | Modules **thématiques** (`vpc`, `iam`, `bigquery`, `detection`, `ml-pipeline`, …) | Le découpage thématique correspond aux frontières réelles de dépendance ; Terraform détermine l'ordre par le graphe de toute façon. |
| E20 | PostgreSQL 17 | **PostgreSQL 15** | Version disponible et éprouvée à la création de l'instance. Montée de version à planifier, sans urgence. |

Ces six écarts sont des décisions consciemment tranchées ; ils ne figurent pas dans le tableau
récapitulatif de la section 1 (ce ne sont pas des gaps ouverts, mais l'état cible réel).

Quatre écarts supplémentaires ont été ajoutés le **11/08/2026** dans cette même catégorie
"Assumé", mais leur description reconnaît explicitement qu'il s'agit d'un **report** plutôt que
d'un choix — ce sont les mêmes constats que les critiques C1-C4 du document du 11/08 (§2.3
ci-dessous) et sont donc traités comme **ouverts** dans le résumé exécutif (H1, H8, H2, H7) :

| Réf. | Conception | Réel | Renvoi |
|---|---|---|---|
| E29 | `sa-ml-embed` sans rôle de données (LLD §2.1) | `ml-embed` tourne sous `sa-pipeline`, qui a `bigquery.dataEditor` **au niveau projet** | = H1 / C1 (§2.3) |
| E30 | ATT&CK-BERT « condition d'existence » du scoring kill-chain (doc ATT&CK-BERT §5.3) | Le scoring n'utilise que `detections.mitre_tactic` (règles Sigma) ; le modèle ML n'est exposé qu'en KPI agrégé | = H8 / C2 (§2.3) |
| E31 | Logs de deny pare-feu + NAT actifs et alimentant le SIEM (LLD §4, HLD §4-5) | Aucune des 4 règles ni le NAT n'a `log_config` activé ; le sink existe mais reste vide | = H2 / C3 (§2.3) |
| E32 | Colonne `service`/tenant fiable dans le SIEM | `detections.service` NULL sur 75-90 % des lignes pour R2/R3/R6 (seule R1 fiable à 100 %) | = H7 / C4 (§2.3) |

#### 2.1.2 Écarts à combler (ouverts au 11/08, cf. tableau §1 pour le statut au 19/08)

| Réf. | Conception | Réel | Impact | Renvoi §1 |
|---|---|---|---|---|
| E1 | 4 projets : `menal-ops`, dev, staging, prod | **2 projets** (dev, staging) ; `terraform/environments/prod/` vide ; bucket d'état sans projet d'amorçage dédié | Chaîne dev→staging→prod du *Definition of Done* non atteignable | — (structurel, non repris en table) |
| E4 | **Direct VPC egress** (LLD §4) | **Serverless VPC Connector** (2 × e2-micro minimum, jamais réduits) | Fonctionnellement équivalent, coût fixe permanent | Confirmé "exact" le 11/08 (`10_AUDIT` §5) — présentation LLD seule à corriger |
| E8 | Rôles JWT `admin`/`analyste`/`utilisateur` | Rôles réels `admin`/`viewer`/`service` | Divergence de vocabulaire doc/code | L1 |
| E9 | Endpoints `/incidents/{id}/attack`, `/coverage/attack-matrix`, `/vulnerabilities/prioritized` | `/siem/incidents/{entity}`, `/siem/coverage`, `/siem/vulnerabilities` | Contrat LLD non celui servi, sans conséquence fonctionnelle | L2 |
| E10 | Vue `v_killchain` et table `incident_scores` en BigQuery | **Absentes** : scoring recalculé en Python dans l'API | Non auditable en base, non réutilisable hors API | L3 |
| E13 | Déploiement par **digest** `@sha256:` (LLD §8) | CI par **tag SHA de commit**, puis re-tag `latest` — partiellement comblé le 08/08 (`terraform apply` résout un digest réel) | Chemin CI reste par tag traçable mais pas cryptographique | M10 |
| E17 | Dossier `pipeline/` | **Vide** ; `workflows/security-pipeline.yaml` orphelin, référence `menal-dev` inexistant | Code mort trompeur | L4 |
| E19 | Un dashboard | **Deux** : `dashboard/` (Next.js, déployé) et `api/dashboard/` (Streamlit, code mort) | Ambiguïté produit | L5 |
| E21 | Cloud KMS (CMEK sur SQL/BQ), HLD §2 et §4.2 | **Cloud SQL : structurellement bloqué** (`encryption_key_name` immuable, `terraform plan` du 08/08 : `must be replaced`). **BigQuery/GCS/Secret Manager : comblé le 08/08** | Migration dédiée nécessaire pour Cloud SQL | M9 |
| E22 | Pas de colonne service/tenant (principe multi-app) | `access_logs` a `service` ; `detections`, `api_metrics`, `security_events`, `alert_enrichment` n'en ont aucune | Séparation de preuves contractuelle impossible aujourd'hui | H7 |
| E23 | `modules/cloud-sql` réinstanciable par app | Peering VPC câblé en dur — conflit `servicenetworking.googleapis.com` en cas de 2ᵉ instance | Extraction du peering nécessaire pour vraie multi-instance | M16 |
| E26 | Redondance du chemin réseau vers Cloud SQL | VPC Connector unique (2× e2-micro, une région) — SPOF pour tous les services | Non traité en remédiation (hors périmètre Tier 2) | M17 |
| E27 | `dev` doit répéter ce qui tourne en staging | `elson.tf` et 8 variables multi-app n'existent qu'en staging | Onboarding d'une app impossible hors staging | M15 |
| E28 | Reproductibilité des versions de provider Terraform (LLD §10.2) | `.terraform.lock.hcl` gitignoré ; `terraform.yml` (F7) fait `init -backend=false` sans lock | Aucune garantie CI = staging réel | M13 |

#### 2.1.3 Écarts comblés (traçabilité complète, résolus)

| Réf. | Écart | Résolution |
|---|---|---|
| E2 | 3 comptes de service au lieu des 6 du LLD §2.1 ; `enrich-job` partageait `sa-pipeline` et héritait du droit d'écrire dans `detections` | **`sa-enrich-job` créé** le 02/08 : lecture du dataset, écriture sur la seule table `alert_enrichment`. |
| E11 | Aucun pipeline infra F7, aucun scan IaC | **`terraform.yml`** ajouté : `fmt` bloquant, `validate` dev+staging, scan IaC Trivy bloquant sur CRITICAL. `plan`/`apply` automatisés restent à faire (décision IAM). |
| E14 | Règles Sigma en fenêtre de 5 min, plus courte que la latence d'ingestion | Fenêtres portées à 15 min avec déduplication `NOT EXISTS`. R2/R3/R6 voient aussi les tentatives bloquées au bord par le WAF. |
| E18 | Secret JWT par défaut présent dans le code | Toujours présent comme valeur de repli en dev, mais **fail-closed hors dev**. |
| — | Le CI ne construisait pas l'image du dashboard | Job `dashboard` ajouté au pipeline (build, scan Trivy, déploiement, smoke test). `ml-embed`/`enrich-job` restent promus manuellement. |
| E16 | Condition WIF sur le dépôt seulement (pas la branche) | **Fermé le 05/08, reconfirmé le 07/08** : `assertion.repository == '...' && assertion.ref == 'refs/heads/main'` (`terraform/modules/iam/main.tf`). |
| — | `sa-api` avait `secretAccessor` projet-wide | **Fermé** (05/08, reconfirmé 07/08) : bindings ciblés par secret uniquement. |
| — | Bug détection R5 (filtre `service="cloud-run"` ne matchait jamais, règle structurellement morte) | **Corrigé le 07/08** : filtre retiré, service injecté dans le message (`terraform/modules/detection/main.tf:204-239`). |
| — | Dashboard : `.catch(() => [])` affichait "tout est nominal" pendant une panne API | **Corrigé** (constaté le 07/08) : états d'erreur explicites distincts de l'état vide. |
| — | `ci.yml` sans filtre `paths:` (tout push redéploie MENAL) | **Corrigé** (constaté le 07/08) : filtres `paths:` sur `ci.yml`, `elson-ci.yml`, `terraform.yml`. |
| E21 (partiel) | Cloud SQL zonal (SPOF, écart vs HLD §4.2 « HA ») | **Fermé le 08/08** : `availability_type = REGIONAL` sur `db-f1-micro` (décision coût/risque tranchée par l'utilisateur, coût doublé). |
| E21 (partiel) | KMS décoratif sur BigQuery/GCS/Secret Manager | **Fermé le 08/08** : CMEK câblé sur le dataset SIEM, le bucket média Elson, et 7 secrets applicatifs — 2 clés distinctes (régionale SQL/BQ/GCS, globale Secret Manager). |
| — | `sa-cicd` avait `dataEditor` sur tout le dataset SIEM | **Fermé le 08/08** : accès resserré à la seule table `cve_findings`. |
| — | Sonde de démarrage `ml-embed` trop courte (70s), cause des 503 du 05/08 | **Fermé le 07/08** : `failure_threshold` élargi à 150s, au-dessus du pic mesuré (~94s). |
| — | Rollback Cloud Run jamais testé | **Fermé le 07/08** : bascule testée et chronométrée sur `menal-api-staging` (11,6s / 16,5s). |
| — | Isolation SQL Elson/menal sans détection de dérive | **Amélioré le 08/08** : job planifié quotidien rejoue une vérification read-only et alerte sur échec — reste un geste applicatif (cf. M19). |
| — | Canal d'alerte unique (email personnel) | **Fermé le 08/08** : 2ᵉ canal email ajouté sur toutes les politiques d'alerte staging. |

---

### 2.2 07/08/2026 — Audit E2E staging

*Contenu original : `09_AUDIT_E2E_STAGING_2026-08-07.md`. Environnement audité :
`menal-zero-trust-staging` — MENAL (API, dashboard, pipeline ML) + Elson (onboardé le jour
même). Méthode : revue de code + Terraform (statique) confrontée à des vérifications **live
read-only** (`gcloud`/`bq`/`curl`, `list`/`describe`/`get-iam-policy` uniquement — aucune
commande de charge, de création ou de suppression). Décision explicite : pas de test de charge
ni de chaos engineering actif sur cet environnement de référence. Ce document n'est ni un test
de charge, ni un pentest actif, ni une validation formelle par un tiers.*

**Cadrage :** audit + validation légère (coût quasi nul, zéro risque de casser staging),
séquentiel par dimension avec revue entre chaque étape. 6 dimensions couvertes : Sécurité,
Disponibilité, Performance, Scalabilité, Résilience, Reproductibilité, + validation E2E légère.

#### Sécurité

| Point | Statut au 07/08 | Preuve |
|---|---|---|
| Condition WIF sur la branche | ✅ Corrigé, code + live | `terraform/modules/iam/main.tf:126` |
| `secretAccessor` projet-wide sur `sa-api` | ✅ Corrigé, code + live | Bindings ciblés par secret |
| Audit logs Data Access (BigQuery/KMS/Secret Manager/Cloud SQL) | 🟡 Amélioré — désormais générés | `terraform/modules/audit/main.tf` |
| Centralisation/rétention de ces logs | ❌ Ouvert (= M7) | Aucun sink dédié `cloudaudit` ; `_Default` = 30j, mutable |
| Détection sur le control plane (CIS 2.4–2.11) | ❌ Ouvert (= M8) | Aucune règle IAM/policy dans `terraform/modules/detection` |
| KMS / CMEK | ❌ Toujours décoratif à cette date | 1 seule clé, aucun binding consommateur — fermé partiellement le lendemain (§2.1.3) |
| `expiration_ms` raw_logs | ❌ Toujours commenté (= L13) | Contrainte binaire Terraform 32-bit |
| `sa-cicd` dataEditor à portée dataset (pas table) | ❌ Ouvert à cette date | `bq show` confirme `WRITER` sur tout `menal_security_staging` — fermé le 08/08 (§2.1.3) |
| Docker Hub personnel (`mo35ehab`) | ➖ Risque assumé, inchangé (= M11) | `scripts/hotfix.sh:6` |
| Isolation SQL Elson/menal | 🟡 Vraie à l'instant T, non durable (= M19) | Aucune ressource Terraform ne modélise le durcissement |

#### Disponibilité

| Point | Statut | Preuve |
|---|---|---|
| SLO/uptime/alerting | ✅ Réels | 16 `google_monitoring_alert_policy`, 2 uptime checks, 4 SLO |
| Couverture des services surveillés | ❌ Partielle (= M18) | Seuls `menal-api`/`elson-api` ; dashboard, `elson-web`, `ml-embed` non couverts |
| Cold start `menal-api` (`min_instances=0`) | ➖ Assumé, documenté | A fait relâcher le SLO latence de 800ms → 1s |
| Cloud SQL zonal, sans réplica | ❌ SPOF confirmé | `ZONAL`, `db-f1-micro`, `europe-west1-b` — fermé le 08/08 (régional) |
| Canal d'alerte | ❌ Unique, email perso | 1 seul canal — fermé le 08/08 (2ᵉ canal) |
| Signal réel 7 jours | ✅ Sain | 3 erreurs 5xx seulement, 0 rollback détecté |
| SLI « couverture d'enrichissement » | 🟡 Implémenté différemment | Métrique backlog/âge en Python, fonctionnellement équivalente à la requête `LEFT JOIN` envisagée le 02/08 |

#### Performance

| Point | Statut | Preuve |
|---|---|---|
| Cause racine des 503 `ml-embed` du 05/08 | ✅ Identifiée | Cold start moyen **~27s**, pic **~94s**, budget sonde = 70s max — modèle ONNX fp32 ~440 Mo |
| Mismatch timeout `ml-embed` (60s service) vs `enrich-job` (120s client) | ✅ Confirmé actif | Limite réelle 60s, les 120s côté client sont un faux sentiment de marge |
| Pic de latence `/siem/overview` (3,2–3,5s le 07/08 14h05) | ✅ Cause identifiée | 5 requêtes BigQuery synchrones séquentielles (`api/app/routers/siem.py:141-188`), confirme E10 |
| Latence API globale | ✅ Saine | p95 48h entre 9,5ms et 1004ms, 1 seul point > 800ms |
| Partitionnement BigQuery | ✅ Exploité | Toutes les tables partitionnées par jour |
| Clustering BigQuery | ❌ Non exploité | Aucun `clustering = [...]` déclaré |
| Dashboard cold start (~10,5s) | ➖ Dominé par le sandbox Cloud Run, pas le code | `output: standalone` déjà actif |
| Capacité (`max_instance_count`) | ✅ Suffisante | Jusqu'à 240 requêtes concurrentes sur l'API |

#### Scalabilité (onboarding d'une 3ᵉ app)

| Point | Statut | Preuve |
|---|---|---|
| Bug détection R5 | ✅ Corrigé le 07/08 | `terraform/modules/detection/main.tf:204-239` |
| Filtre `paths:` CI | ✅ Corrigé | `ci.yml:7-25`, `elson-ci.yml:24-35`, `terraform.yml:7-13` |
| Gap monitoring multi-service | 🟡 Config seulement | 2 lignes de `tfvars` manquantes, module déjà générique |
| `modules/cloud-sql` réinstanciable | ❌ Non — structurel (= M16) | Peering VPC câblé en dur |
| Clé tenant/service dans les tables SIEM | ❌ Absente sauf `access_logs` (= H7) | `api_metrics` fusionne les agrégats horaires de menal-api et elson-api |
| Pattern IAM par app | ✅ Existe (module `app-service`) | Instancié par `elson.tf:39-67` — 4 SA cœur du socle restent fixes |
| CI factorisée | ❌ Toujours absente (= M12) | `ci.yml`/`elson-ci.yml` dupliquent Gitleaks/Semgrep/Trivy |
| `dev` multi-app | ❌ Toujours absent (= M15) | Aucune variable multi-app dans `dev/variables.tf` |
| `prod/` | ❌ Toujours vide | `.gitkeep` uniquement |
| Estimation onboarding 3ᵉ app | — | ~30min tfvars + 2-4h fichier `.tf` dédié + ~1 jour DNS/CI + geste manuel obligatoire pour l'isolation SQL |

#### Résilience

| Point | Statut | Preuve |
|---|---|---|
| Backups Cloud SQL | ✅ Sains en live | 7 backups automatiques quotidiens, tous `SUCCESSFUL` |
| RTO/RPO restauration DB | ✅ Mesurés le 03/08 | **32min45s / RPO 0** (`08_RUNBOOK.md` §3) |
| Rollback Cloud Run par révision | ❌ Écrit, jamais testé | Fermé le 07/08 en cours d'audit (§10) |
| `.catch(() => [])` dashboard | ✅ Corrigé depuis le 05/08 | Résidu mineur sur `settings/security/page.tsx:23` |
| SPOF VPC Connector unique | ❌ Nouveau, non documenté avant (= M17) | 2×e2-micro, une seule région |
| Pas de canary/rollout progressif | ❌ Nouveau, non documenté avant (= L8) | Aucun bloc `traffic`/`percent` |
| `enrich-job` sans retry sur `ml-embed` | ➖ Mitigé | `max_retries=2` job + fenêtre de rattrapage 2h |
| `migrate.ts --from-zero` (Elson) idempotence | 🟡 Partielle | 13 `CREATE INDEX` sans `IF NOT EXISTS` — 2ᵉ exécution échoue proprement, pas silencieusement |
| Bascule applicative post-restauration chronométrée | ❌ Toujours non | Le runbook l'admet lui-même |
| Référence documentaire `STATUT_DEV.md` §8.6 | ✅ Fausse alerte, corrigée | cf. §9 ci-dessous |

#### Reproductibilité

| Point | Statut | Preuve |
|---|---|---|
| Déploiement CI par tag SHA vs `terraform apply` par `:latest` | ❌ Écart critique nouveau (= M10) | CI par `github.sha` ; toute reconstruction Terraform redéploierait `:latest` mutable |
| `scripts/hotfix.sh` | ❌ Plus problématique que documenté (= M11) | Tag horodaté sans lien commit, aucun scan Trivy, hardcodé `dev` |
| Test from-zero du schéma Alembic (menal-api) | ❌ Absent (= M14) | Tests API mockent entièrement la DB |
| Test from-zero DB Elson | 🟡 Existe, imparfait | `elson-ci.yml` job `backend` — 2ᵉ passage ne rejoue pas réellement `init.sql` |
| `dev` vs `staging` | ❌ Divergence structurelle (= M15) | `elson.tf` et 8 variables multi-app n'existent qu'en staging |
| `.terraform.lock.hcl` | ❌ Gitignoré (= M13) | CI Terraform `init -backend=false` sans lock committé |
| Bucket d'état Terraform | ✅ Sain | Versionné, verrouillage natif GCS, préfixes dev/staging séparés |
| Lockfiles applicatifs | 🟡 Mixte | JS OK (`npm ci`) ; Python `requirements.txt` en `==` sans hash-lock des transitives |
| Images de base pinnées par digest | 🟡 Mixte (= L7) | Elson oui, MENAL non |
| Déterminisme des tests CI | ✅ Aucune flakiness identifiée | — |

#### Validation fonctionnelle E2E légère

Verdict : la chaîne E2E staging est vivante, avec preuves directes (pas seulement
déclaratives) : `GET /api/ready` (Elson) → 200, `db: connected` ; `/siem/overview`,
`/siem/detections` sans token → `403 Not authenticated` (endpoint vivant et audité) ;
**fraîcheur BigQuery en direct** — `security_events` a une ligne vieille de **4 minutes** au
moment du test, `detections` a 46 lignes sur 48h ; boucle requête → log confirmée en moins de 2
minutes ; côté Elson, `/api/auth/registration-status` et `/api/community/flash/active`
renvoient une vraie logique métier. Correction en cours d'audit : `audit_logs` est une table
**Postgres/Cloud SQL**, pas BigQuery — la preuve de boucle a été faite via les logs Cloud Run.

#### Pour validation par un expert humain (sécurité / SRE)

Ce document ne remplace pas : un pentest actif, un test de charge réel, un chaos engineering
réel, une revue de conformité formelle (RGPD, ISO 27001). Checklist suggérée pour un tiers :
confirmer indépendamment les 10 points de sécurité (en particulier la portée réelle de
`sa-cicd` et la durabilité de l'isolation SQL) ; rejouer T4/T5/T17 du plan de tests avec les
bons comptes de service ; trancher formellement le SPOF Cloud SQL zonal ; décider si le
déploiement par tag SHA est un risque acceptable ; valider que toutes les commandes `gcloud`/
`bq` utilisées sont bien en lecture seule.

#### Incident de process pendant l'audit (§9 du document original)

Un des agents d'audit read-only de cette session a supprimé `STATUT_DEV.md` et
`indexe-dev.md` du disque malgré une consigne explicite de ne modifier aucun fichier. Détecté
via `git status` (comparaison avec l'état git du début de conversation), investigué, et
restauré sans perte depuis `HEAD` (`git checkout HEAD -- STATUT_DEV.md indexe-dev.md`, derniers
commits 03/08 et 31/07 respectivement). Conséquence : la référence `08_RUNBOOK.md` →
`STATUT_DEV.md` §8.6, un temps signalée "morte" (fichier absent au moment précis du test), était
en réalité valide — §8.6 existe et correspond exactement à la citation du runbook. **Leçon
retenue :** même des agents explicitement instruits "read-only" gardent un accès Bash complet
et peuvent exécuter des commandes destructives par erreur — `git status` doit être vérifié
après toute session multi-agents, pas seulement avant.

#### Remédiation appliquée le 07/08/2026 (Tier 0 + Tier 1)

**Tier 0 (quasi gratuit) :**
- Budget de la sonde de démarrage `ml-embed` élargi (`failure_threshold` 6→14, soit 70s→150s).
  Appliqué sur staging, vérifié (`terraform plan` : 1 changement, 0 effet de bord).
- 2 commentaires Terraform trompeurs corrigés (`cloud-run/main.tf`, `dashboard/main.tf`).
- Rollback Cloud Run réellement testé sur `menal-api-staging` : bascule vers `00024-lgn` en
  **11,6s** ; retour vers la dernière révision en **16,5s** (cold start observé au retour,
  cohérent avec `min_instances=0`).
- 2ᵉ canal d'alerte : reporté, faute de cible fournie (webhook ou email) — fait le lendemain.

**Tier 1 (effort borné, coût quasi nul) :**
- `sa-cicd` : accès BigQuery resserré du dataset entier à la seule table `cve_findings`.
  Vérifié en live (`bq get-iam-policy`). Note : la vue `access[]` du dataset continue de lister
  `sa-cicd` — vue agrégée héritée de BigQuery, pas une preuve d'accès dataset-wide ; la policy
  IAM réellement appliquée (table) fait foi.
- Déploiement par digest : 4 `data "google_artifact_registry_docker_image"` ajoutées (menal-api,
  dashboard, ml-embed, enrich-job), résolvant `:latest` en digest immuable. `terraform plan`
  confirmé no-op sur les services déjà déployés (protégés par `lifecycle.ignore_changes`).
- Canary/traffic-splitting : bloc `traffic` explicite ajouté (100% latest, identique au défaut
  actuel) à `modules/cloud-run` et `modules/dashboard`, plus `traffic` en `ignore_changes` —
  infra prête pour un rollout progressif, comportement inchangé (`terraform plan` : no changes).
- Vérification automatique de l'isolation SQL : nouveau script read-only
  `elson-main/backend/src/scripts/sql-isolation-check.ts`, nouveau Cloud Run Job
  `elson-sql-isolation-check-staging`, déclenché quotidiennement (4h UTC) par Cloud Scheduler,
  alerte sur échec. **Dépendance non résolue à cette date** : l'image `elson-backend:latest`
  déployée ne contenait pas encore ce script — la CI devait reconstruire l'image avant la
  première exécution du 08/08 4h UTC, sinon fausse alerte.

#### Remédiation Tier 2 (07-08/08/2026) — décisions coût/risque tranchées par l'utilisateur

- **Cloud SQL zonal → régional** : décision utilisateur = régional. Appliqué
  (`availability_type = REGIONAL`), la crainte initiale que les tiers *shared-core* ne
  supportent pas la HA PostgreSQL s'est révélée infondée pour cette config précise (apply réel
  réussi en 11min2s). SPOF zonal fermé sur staging, confirmé en live.
- **KMS/CMEK réel** : câblé sur BigQuery (dataset SIEM, nouvelles tables seulement), GCS (bucket
  média Elson), et **7 secrets Secret Manager**. Trois découvertes en cours de route, chacune
  vérifiée par test avant d'agir :
  1. `encryption_key_name` sur l'instance Cloud SQL est **immuable à la création** — testé via
     `terraform plan` (`must be replaced`, destructeur), volontairement non appliqué.
  2. La réplication `auto` de Secret Manager n'accepte que des clés KMS en location `global` —
     une 2ᵉ clé dédiée (`menal-secrets-key-staging`) créée en globale ; la clé régionale reste
     pour BigQuery/GCS.
  3. Limite Terraform : un bloc `dynamic` dont le `for_each` référence l'ID d'une ressource KMS
     créée dans le même apply ne se résout pas de façon fiable — contourné en deux applies
     successifs.
  4. Un premier apply a échoué proprement (agents de service GCS/BigQuery/Secret Manager pas
     encore provisionnés) — provisionnés explicitement puis apply rejoué avec succès. Un
     `terraform plan` a aussi révélé un état local divergent (CMEK jamais réellement appliqué
     côté API suite à l'échec) — corrigé par `terraform apply -refresh-only`.
  Vérifié en live après coup : `gcloud secrets describe db-password-staging` confirme le CMEK
  actif, `terraform plan` final = aucune dérive.
- **Logs d'audit centralisés + détection control-plane** : non traité, non demandé dans cette
  passe (= M7, M8 toujours ouverts).

#### Coût de l'audit et de la remédiation

Phase d'audit : aucune ressource GCP créée/modifiée/supprimée, aucune commande de charge. Phase
Tier 2 : Cloud SQL régional double le coût de calcul de l'instance `db-f1-micro` (seul coût
récurrent réel, décidé explicitement) ; CMEK à coût marginal. Phase de remédiation (Tier 0/1) :
toutes les modifications à coût marginal ou nul (1 champ modifié sur un service Cloud Run
existant, 1 binding IAM détruit/recréé, 4 data sources en lecture, 2 blocs `traffic` no-op,
1 nouveau Cloud Run Job + 1 Scheduler + 1 alert policy à l'ordre du centime/mois).

---

### 2.3 11/08/2026 — Audit écarts documentation

*Contenu original : `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md`. Revue croisée documentation
↔ implémentation (réseau/IAM, SIEM/ML, CI/CD, dashboard/multi-tenant). Méthode : 4 relectures
indépendantes, chacune opposant les documents de référence (HLD, LLD, `06_ECARTS`,
`07_ONBOARDING_APPLICATION.md`, `08_RUNBOOK.md`, `09_AUDIT_E2E_STAGING`,
`ATTACK-BERT_Integration_SIEM_ZeroTrust.md`, `STATUT_DEV.md`, `GUIDE_DEMO.md`,
`GUIDE_DEMO_ELSON.md`, `ETAT_ELSON_STAGING.md`) au code réellement déployé et à l'historique
git jusqu'au commit `3e024fa` (10/08/2026 22:03 UTC). Périmètre exclu : ce qui est déjà traité
correctement par `06_ECARTS_IMPLEMENTATION.md` (listé en §5 de l'original, repris en §2.1
ci-dessus).*

#### Verdict global au 11/08

| Domaine | État documentation | Sévérité dominante |
|---|---|---|
| IAM / moindre privilège | 🔴 Table des SA obsolète, écart Zero Trust réel non tracké (`ml-embed`) | **CRITIQUE** |
| SIEM — scoring incidents / kill-chain | 🔴 L'argument central du doc ATT&CK-BERT est **faux** vis-à-vis du code | **CRITIQUE** |
| Réseau — logs deny/NAT | 🔴 Contrôle documenté comme actif mais **non configuré** (0 ligne) | **CRITIQUE** |
| Multi-tenant — clé `service` | 🟠 Isolation réelle mais partielle (75-90 % NULL sur 3 règles/7) | **ÉLEVÉ** |
| WAF / Cloud Armor | 🟠 Géo-blocage entier non documenté ; seuils rate-limit faux dans le LLD | **ÉLEVÉ** |
| CI/CD | 🟠 Fix du 10/08 (enrich-job) non répercuté ; contradiction sur `hotfix.sh` | **ÉLEVÉ** |
| Dashboard — filtre tenant | 🟠 4 pages/8 affichent le sélecteur mais l'ignorent ; couverture tests réelle 2,99 %, pas ~20 % | **ÉLEVÉ** |
| Topologie réseau (subnets/CIDR) | 🟡 LLD décrit un schéma différent du Terraform réel | MOYEN |
| Journal de décisions (ADR) | 🟡 1 seul ADR existait à cette date, ~20 choix sans rationale | MOYEN |
| Cahier des charges | 🔴 **Inexistant** à cette date | STRUCTUREL |

**Constat transverse du document :** `06_ECARTS_IMPLEMENTATION.md` et `STATUT_DEV.md` jouent
bien leur rôle de journal d'écarts vivant — le problème n'est pas l'absence de discipline
documentaire, mais une **dérive par accumulation** : chaque correctif ponctuel (WIF, dashboard,
tenant, CI enrich-job) a été appliqué et parfois noté localement, sans revalidation systématique
des documents de référence.

#### Constats CRITIQUES (C1-C4)

**C1 — `ml-embed` tourne sous `sa-pipeline`, qui détient `bigquery.dataEditor` au niveau projet.**
Doc : `02_LLD_MENAL.md:68` affirme *« sa-ml-embed | Aucun rôle de données »*. Réalité : aucun
`sa-ml-embed` n'existe. `terraform/modules/ml-pipeline/main.tf:44` fait tourner `ml-embed` sous
`sa-pipeline` (`var.pipeline_sa_email`), qui a `roles/bigquery.dataEditor` au niveau projet
depuis le commit initial (`terraform/modules/iam/main.tf:63-67`), jamais restreint. Gravité :
classe de violation Zero Trust déjà corrigée deux fois ailleurs (WIF trop permissif,
`sa-pipeline` avait aussi `dataEditor` côté détection). `STATUT_DEV.md:206-208` documente le
problème côté `enrich-job` (déjà isolé) mais personne n'avait fait le lien avec `ml-embed`.
Action proposée : créer `sa-ml-embed` dédié sans rôle BigQuery, ou ADR explicite avec date de
remédiation. → **H1 du résumé exécutif, confirmé toujours ouvert le 18/08, correctif lancé le
19/08 (à confirmer).**

**C2 — Le pipeline ATT&CK-BERT n'alimente pas le scoring d'incidents malgré ce qu'affirme sa
propre documentation.** Doc : `ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §5.3 : *« Avec le
modèle, [le champ tactic] existe pour tous les événements. Le modèle est donc la condition
d'existence de la détection de progression d'attaque. »* Réalité : `api/app/routers/siem.py:
374-467` (`_score_incident`) calcule le bonus kill-chain exclusivement à partir de
`detections.mitre_tactic` (peuplé uniquement par les 7 règles Sigma). `alert_enrichment` n'est
jamais jointe — elle ne peut d'ailleurs pas l'être, faute de colonne `entity`
(`terraform/modules/bigquery/main.tf:205-241`). Le modèle n'est exposé qu'en KPI agrégé
(`/siem/enrichment-quality`). Gravité : c'est l'argument de valeur central du document technique
le plus long du dépôt (919 lignes). Action proposée : ADR explicite « ATT&CK-BERT :
enrichment informationnel en l'état, jointure au scoring en backlog » et mise à jour §5.3/§9.4/
§9.6, ou implémentation de la jointure avant rédaction du rapport final. → **H8 du résumé
exécutif, décision ADR toujours en attente.**

**C3 — Logs de deny pare-feu et logs NAT documentés comme actifs, mais non configurés (0 ligne).**
Doc : `02_LLD_MENAL.md:119`, `01_HLD_MENAL.md:203` (« Les deny journalisés alimentent le
SIEM »). Réalité : aucune des 4 règles (`terraform/modules/vpc/main.tf`) ni le Cloud NAT n'ont de
bloc `log_config`. Le sink BigQuery `vpc_to_bq` (`terraform/modules/logging/main.tf:30-47`) est
câblé et filtre `disposition="DENIED"` mais ne recevra jamais rien tant que le logging n'est pas
activé à la source. Aucun sink même pour les logs NAT. Gravité : la détection de mouvement
latéral revendiquée en HLD §4/§5 est aujourd'hui impossible à démontrer — chaîne apparemment
complète (sink prêt) mais vide en amont. Action proposée : activer `log_config` sur les 4 règles
+ NAT (coût BigQuery à chiffrer), ou retirer la revendication du HLD. → **H2 du résumé
exécutif, confirmé toujours ouvert le 18/08, correctif lancé le 19/08 (à confirmer).**

**C4 — Clé tenant (`service`) absente ou NULL sur 75-90 % des lignes pour 3 règles Sigma sur 7.**
Doc : `GUIDE_DEMO_ELSON.md` se contredit lui-même (§2 dit qu'aucune colonne tenant n'existe hors
`access_logs`, §6 dit que `detections.service` existe et est utilisée). Réalité :
`detections.service` existe et est utilisée par l'API (`api/app/bigquery.py:73-88`,
`api/app/routers/siem.py:73-78`), mais n'est fiable que pour R1 (100 %) — R2/R3/R6 à 75-90 %
NULL. `api_metrics`, `alert_enrichment`, `cve_findings` n'ont aucune colonne tenant. Résultat :
les pages `/vulnerabilities` et `/rules` du dashboard restent globalement fusionnées MENAL+Elson
quel que soit le sélecteur affiché. Action proposée : uniformiser le tagging `service` sur les 7
règles (R1 comme modèle), ou documenter précisément le taux de couverture par table sans
généraliser à « le SIEM est multi-tenant ». → **H7 du résumé exécutif.**

#### Constats ÉLEVÉS

| # | Sujet | Doc | Réalité | Fichier(s) |
|---|---|---|---|---|
| E1 | Géo-blocage Cloud Armor (deny hors UE+Maghreb+Mauritanie) | Non mentionné (HLD/LLD) | Règle priorité 410 active, bloque l'essentiel du trafic mondial | `terraform/modules/load-balancer/main.tf:56-65` |
| E2 | Jeu de règles WAF/rate-limit | LLD : ~100 req/min sur `/api/*`, 4 règles, "mode preview" | Réalité : 2 couches de rate-limit (10 req/min sur `auth_paths`, 1000 req/min global), **5** règles (RFI en plus), deny direct sans mode preview | `02_LLD_MENAL.md:43-44` vs `load-balancer/main.tf:116-178` |
| E3 | Architecture WIF/CI (pool `menal-ops`, `sa-ci-infra`, promotion 3 paliers) | LLD décrit un schéma à 3 SA par palier | Réalité : 1 pool par projet, 1 seul `sa-cicd`, condition statique `refs/heads/main` | `terraform/modules/iam/main.tf:75-142` |
| E4 | Périmètre `sa-cicd` | LLD : `iam.serviceAccountUser` sur "les SA runtime", aucun accès données | Réalité : `actAs` sur 3 SA distincts + écriture BigQuery `cve_findings` + `bigquery.jobUser` projet | `iam/main.tf:94-98`, `bigquery/main.tf:79-91` |
| E5 | Fix CI enrich-job (commit `3e024fa`, image figée 5 jours, jointure `detections.id` cassée silencieusement) | Absent de `08_RUNBOOK.md`, `STATUT_DEV.md`, `06_ECARTS` | Corrigé en CI le 10/08 ; `ml-embed` reste dans le même angle mort (aucun déploiement CI) | commit `3e024fa` |
| E6 | `scripts/hotfix.sh` "réutilisé (dev et staging)" | `STATUT_DEV.md` §4 item 3 | Codé en dur sur `menal-zero-trust-dev` — ne peut pas cibler staging | `scripts/hotfix.sh` |
| E7 | Workflow CI mort non documenté | Aucune mention | `.github/workflows/e2e.yml` dupliqué, jamais supprimé, fallback non-staging | `.github/workflows/e2e.yml` |
| E8 | Latence "cold start" ml-embed | ATTACK-BERT doc : "≈2-4 s" | Mesuré réellement : moyenne ~27s, p99 jusqu'à 94s — a causé les 503 du 05/08 | vs `09_AUDIT` |
| E9 | Cadence enrich-job | ATTACK-BERT doc : "/5min" | `*/15 * * * *` (déjà tracké E6 de `06_ECARTS`, jamais corrigé dans le doc narratif) | `ml-pipeline/main.tf:216-224` |
| E10 | Schéma `alert_enrichment`/`attack_embeddings` | ATTACK-BERT doc §9.4 : colonnes `entity`, `alert_id`, `name`, `loaded_at`… | Colonnes réelles différentes (`timestamp`, `detection_id`, `technique_name`, `created_at`…), pas de `entity` (cf. C2) | `bigquery/main.tf:205-241` |
| E11 | Pages dashboard démontrées | `GUIDE_DEMO.md` liste 5 pages | 8 pages réelles, filtre tenant non mentionné | `dashboard/src/components/Sidebar.tsx:12-36` |
| E12 | Couverture de tests dashboard | Non chiffrée dans les docs, rapport daté du 08/08 périmé | **2,99 % lignes / 3,22 % instructions / 1,75 % branches** — toutes les pages `src/app/*` à 0 % | `dashboard/coverage/lcov-report/index.html` |
| E13 | Sélecteur tenant affiché mais inerte sur 4 pages/8 | Non documenté | `/logs`, `/alerts`, `/vulnerabilities`, `/rules` affichent le sélecteur sans l'utiliser | `dashboard/src/app/page.tsx:41-50`, `TenantFilter.tsx:19-22` |
| E14 | Stockage fichiers Elson "en cours de migration vers GCS" | `07_ONBOARDING_APPLICATION.md:100-101` | Driver GCS déjà complet et **actif** en staging (`STORAGE_DRIVER=gcs`) | `elson-main/backend/src/services/storage/gcs.ts`, `elson.tf:242` |

#### Constats MOYENS

| # | Sujet | Doc | Réalité |
|---|---|---|---|
| M1 | Topologie subnets | LLD : un seul subnet privé `10.10.0.0/24` | 2 subnets (public + privé) + subnet connecteur, CIDR réels `10.0.1.0/24` / `10.0.2.0/24` / `10.0.3.0/28` |
| M2 | Table des comptes de service | LLD §2.1 : 6 SA nommés `sa-app-elson`, `sa-api-platform`, `sa-ml-embed`, `sa-ci-deploy`, `sa-scheduler`… | Aucun de ces noms n'existe ; réalité = `sa-api`, `sa-pipeline`, `sa-cicd`, `sa-enrich-job`, `sa-dashboard-<env>`, `sa-<app>-<env>` — convention incohérente |
| M3 | Egress `enrich-job` | ADR-11 (HLD) ne documente que l'exception `ml-embed` (egress nul) | `enrich-job` tourne aussi en `ALL_TRAFFIC` egress, non réconcilié avec ADR-11 |
| M4 | Plage réservée PSA | LLD : `10.20.0.0/16` | Allocation automatique GCP, non vérifiable comme correspondant à cette valeur |
| M5 | Règles pare-feu mortes | Non documenté | `allow-https-ingress`/`allow-health-checks` ciblent un tag réseau `https-server` que rien n'attache jamais |
| M6 | Cache par hash des embeddings | ATTACK-BERT doc §6.2 : "les événements récurrents ne sont encodés qu'une fois" | `input_hash` stocké mais jamais utilisé pour éviter un ré-encodage |
| M7 | `top_k` incohérent dans le doc lui-même | ATTACK-BERT doc §9.5 exemple SQL : `top_k => 1` | §4 et le code réel utilisent `top_k = 3` (avec `alternates`) |

*(Ces 7 constats forment la ligne M21 du résumé exécutif.)*

#### Candidats ADR identifiés le 11/08 (1 seul ADR existait alors : ADR-0001, dashboard)

IAM/sécurité : (1) acceptation temporaire de `sa-pipeline` avec `dataEditor` projet ; (2)
pourquoi `ml-embed` n'a pas de SA dédié ; (3) pourquoi `ml-embed` est exclu du pipeline CI.
Réseau : (4) liste des pays du géo-blocage ; (5) conception à deux couches du rate-limiting ;
(6) existence du subnet public ; (7) pourquoi les logs deny/NAT ne sont pas activés. SIEM/ML :
(8) choix fp32 vs int8 (déjà bien documenté, modèle à suivre) ; (9) cadence 15 min de
l'enrich-job ; (10) découpage des tables BigQuery ; (11) `VECTOR_SEARCH` BigQuery plutôt qu'une
base vectorielle dédiée ; (12) statut informationnel de `alert_enrichment`. Multi-tenant/
dashboard : (13) élargissement du socle à N applications ; (14) double convention de nommage
tenant ; (15) déploiement Elson mono-instance ; (16) séparation des clés CMEK.

#### Plan de remédiation proposé le 11/08

Ordre suggéré : (1) trancher rapidement C1-C4 (assumé documenté vs corrigé) avant toute
réécriture — bloque le reste ; (2) rédiger le cahier des charges (en parallèle) ; (3) mettre à
jour LLD (IAM §2.1, réseau §1/§4, WAF) et ATTACK-BERT (§3, §5.3, §9.4, §9.6) une fois (1)
tranché ; (4) mettre à jour RUNBOOK/STATUT_DEV/06_ECARTS pour l'incident enrich-job ; (5)
rédiger les ADR listés ci-dessus, IAM/sécurité d'abord ; (6) mettre à jour GUIDE_DEMO/
GUIDE_DEMO_ELSON/ONBOARDING pour les 8 pages et l'isolation tenant réelle ; (7) consolidation
finale + PDF.

---

### 2.4 18/08/2026 — Audit experts Sigma / Réseau / IAM / MFA

*Contenu original : `11_AUDIT_EXPERTS_SIGMA_RESEAU_IAM_MFA_2026-08-18.md`. Revue par 4 profils
experts indépendants (posture "équipe sécurité Google/Meta"), un par domaine : Detection
Engineering/SIEM, Architecture réseau cloud/Zero Trust GCP, IAM cloud, AppSec/Authentification
(MFA). Méthode : 4 lectures indépendantes du code réel, sans partage de contexte entre experts,
chacun mandaté pour trancher "est-ce commercialisable / défendable devant un auditeur" plutôt
que produire une liste neutre. Lecture seule. Ce document est additif à `10_AUDIT` : il ne
réplique pas C1/C3/E3/E4 déjà tracés, il confirme leur statut au 18/08 (toujours non corrigés)
et ajoute des constats nouveaux (nommage "Sigma", MFA) non couverts le 11/08.*

#### Verdict global au 18/08

| Domaine | Note | Verdict commercialisation | Sévérité dominante |
|---|---|---|---|
| Règles "Sigma" (détection SIEM) | — | 🟠 Nom **non justifié techniquement** (SQL custom, pas de moteur Sigma réel) mais honnêtement documenté dans le rapport PFE | ÉLEVÉ |
| Réseau / segmentation | 6/10 | 🟠 Bon en périmètre nord-sud (WAF, Cloud Armor), **insuffisant** en segmentation est-ouest multi-tenant | ÉLEVÉ |
| IAM / moindre privilège | 6/10 | 🟠 Discipline resource-level solide sauf **un écart structurel connu et non corrigé depuis le 11/08** | ÉLEVÉ |
| MFA dashboard | 6/10 | 🟠 Cœur cryptographique solide, mais **un endpoint MFA non protégé par le WAF** | ÉLEVÉ |

**Constat transverse :** aucun des 4 domaines n'est "mauvais" — chacun a un noyau technique
correct (WAF réel, WIF bien contrainte, TOTP RFC 6238 correctement implémenté, logique de
détection MITRE cohérente). La même famille de défaut empêche une note ≥ 8/10 partout : **un
contrôle périphérique manquant autour d'un cœur solide** (pas de rate-limit edge sur l'endpoint
MFA le plus sensible, pas de segmentation réseau autour d'un IAM par ailleurs bien scopé, pas de
vrai moteur Sigma autour de règles de détection par ailleurs bien pensées).

#### Règles "Sigma" — positionnement et qualité

**Constat factuel :** `terraform/modules/detection/main.tf` définit 7 règles
(`r1_bruteforce`…`r7_sensitive_files`) écrites directement en SQL BigQuery, déployées en
`google_bigquery_data_transfer_config` (`display_name = "Sigma ${each.key}: ..."`, ligne 404).
Aucun fichier YAML Sigma natif (format SigmaHQ) dans le dépôt, aucune dépendance `pysigma`/
`sigma-cli`. `api/app/bigquery.py:52` recopie un dict Python `SIGMA_RULES` à la main depuis le
Terraform, non synchronisé automatiquement. Point à l'honneur du projet :
`rapport PFE/CH2_Etat_de_l_art_et_positionnement.md:240-263` documente lui-même, sans
complaisance, qu'il n'existe pas de backend Sigma officiel ciblant BigQuery et que la traduction
est manuelle — c'est le code (Terraform, `dashboard/rules/page.tsx:55` "R1–R7 · Sigma") qui
présente la chose de façon plus flatteuse que la doc technique interne.

**Verdict :** le nom "Sigma" n'est pas justifié au sens du standard mais n'est pas mensonger —
choix de conception assumé et documenté dans le rapport PFE. Le risque est la présentation
produit (UI, Terraform) qui ne porte pas la même nuance que la doc technique.

**Bonnes pratiques respectées :** déduplication rigoureuse (`NOT EXISTS`) + fenêtre 15 min
correctement dimensionnée (E14 de `06_ECARTS`) ; mapping MITRE tactic/technique par règle,
corrigé a posteriori et tracé (R4 → TA0007, ligne 190-196) ; R3/R6 couvrent le trafic bloqué par
le WAF **et** celui qui atteint l'appli (évite l'angle mort "le WAF cache l'attaque") ;
séparation des privilèges au niveau table (`detections` écriture seule pour le moteur,
`docs/adr/0009`).

**Écarts priorisés :** HIGH — aucune séparation règle/déploiement, aucun test unitaire par
règle (= H11) ; HIGH — angles morts structurels : exfiltration, abus IAM/élévation de
privilèges, UEBA (= H9) ; MEDIUM — pas de gestion des faux positifs documentée, `SIGMA_RULES`
dupliqué sans garde-fou de dérive (= M5) ; LOW — pas de pipeline CI dédié aux règles (= L10).

**Recommandations :** (1) renommer "règles de détection SQL (inspirées Sigma)" en code/UI,
retirer "Sigma" du `display_name` Terraform et du dashboard ; (2) extraire les règles en
artefacts versionnés séparés (YAML condition/seuil/MITRE → génération SQL) ; (3) tests unitaires
par règle ; (4) combler au moins un angle mort HIGH (règle d'abus IAM) ; (5) documenter le
tuning/faux positifs.

#### Réseau / segmentation

**Constat factuel par composant :**
- **VPC** (`terraform/modules/vpc/main.tf`) : `deny_all_ingress` par défaut = bon garde-fou.
  Mais `allow_internal` (l.87-109, priorité 900) autorise **tout TCP/UDP/ICMP** entre subnets
  sans restriction par tag/service — logique de confiance de zone, pas de moindre privilège
  port-à-port (= M1).
- **Load Balancer / Cloud Armor** (`terraform/modules/load-balancer/main.tf`) : point fort réel
  — géo-blocage (ADR 0004), WAF OWASP complet, rate-limiting à deux couches (ADR 0005), TLS 1.2
  MODERN, 100 % des backends (API, dashboard, extra_services) derrière la même `security_policy`
  (l.204/236/274/305) — pas de point d'entrée oublié.
- **Cloud Run** : `ingress = INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` + `egress =
  PRIVATE_RANGES_ONLY` — conforme.
- **Cloud SQL** : `ipv4_enabled = false`, Private Service Access, `ssl_mode = ENCRYPTED_ONLY` —
  conforme à l'état de l'art.
- **Multi-app MENAL/Elson** : un seul VPC, un seul connecteur serverless, une seule instance
  Cloud SQL partagés. Isolation actuelle = **applicative uniquement** (SA dédié, DB/utilisateur
  Cloud SQL dédiés) — aucune isolation réseau réelle : `allow_internal` autorise tout trafic
  entre les deux subnets sans distinction de service source. Pas de VPC Service Controls (= H6).

**Toujours ouvert depuis le 11/08 (confirmation explicite) :** logs de deny pare-feu et NAT
toujours désactivés (ADR 0007) — perte de visibilité forensique confirmée inchangée (= H2, C3).

**Écarts priorisés :** HIGH — pas d'isolation réseau entre tenants (= H6) ; HIGH — logs de deny
pare-feu + NAT toujours désactivés, report depuis C3, aucune date de remédiation fixée (= H2) ;
MEDIUM — aucun VPC-SC autour de Secret Manager/Cloud SQL API (= M2) ; MEDIUM — `allow_internal`
trop permissive (= M1) ; LOW — subnet public fantôme non tranchée, ADR 0006 (= L9).

**Recommandations :** (1) activer `log_config` sur les 4 règles + NAT, fixer une date ; (2)
remplacer `allow_internal` par des règles ciblées tag/SA + ports explicites ; (3) segmentation
réseau réelle par tenant avant d'onboarder un 3ᵉ client ; (4) évaluer un périmètre VPC-SC
minimal avant tout argumentaire commercial "Zero Trust" ; (5) trancher l'ADR 0006.

#### IAM / moindre privilège

**Constat factuel :** 4 SA (`sa-api`, `sa-pipeline`, `sa-cicd`, `sa-enrich-job`) + SA dédiés par
app (`app-service`/`dashboard`, ADR-0012). Aucun `roles/editor`/`roles/owner` nulle part.
Discipline resource-level solide et récemment durcie : `sa-enrich-job` scopé à
`alert_enrichment`, `sa-api` scopé à `analyst_verdicts`, `sa-cicd` resserré à `cve_findings`
(07/08). WIF bien contrainte (`attribute_condition` repo + ref, pas de `serviceAccountUser`
projet). Aucune `google_service_account_key` en Terraform.

**Écart HIGH toujours ouvert depuis le 11/08 (inchangé) :** `sa-pipeline` détient
`roles/bigquery.dataEditor` au niveau projet (`terraform/modules/iam/main.tf:63-67`), hérité par
`ml-embed` qui ne devrait avoir aucun rôle de données (ADR-0002). → **H1.**

**Nouveau constat :** la garantie "pas de clés de SA statiques" (`00_CAHIER_DES_CHARGES_MENAL.md
:150`, `01_HLD_MENAL.md:225`) n'est pas appliquée par une politique d'organisation réelle
(`indexe-dev.md:104` : « Politiques d'org absentes — projet personnel sans organisation »). Le
test censé le vérifier, `test_t6_sa_key_creation_blocked_check`
(`tests/e2e/test_03_iam_isolation.py:124-125`), est un `pass` vide : aucune vérification réelle.
→ **H10.**

**Écarts priorisés :** HIGH — `sa-pipeline` dataEditor projet (= H1) ; HIGH — garantie clés
statiques non appliquée, test T6 vide (= H10) ; MEDIUM — binding dataset-level redondant avec le
binding projet (= M3) ; MEDIUM — `annexe_d_matrice_iam.tex` affirme un état cible non atteint
sans le signaler (= M4) ; LOW — table de correspondance tenant codée en dur, sans test de dérive
(= L11).

**Recommandations :** (1) créer `sa-ml-embed` sans rôle BigQuery, détacher de `sa-pipeline`
(déjà écrit dans ADR-0002, toujours non appliqué) ; (2) retirer le binding projet une fois
`ml-embed` détaché, ne garder que le binding dataset ; (3) provisionner une organisation GCP
minimale pour activer réellement `disableServiceAccountKeyCreation`, ou documenter honnêtement
l'absence comme risque ouvert ; (4) remplacer T6 par un test réel ou le retirer du rapport de
couverture ; (5) synchroniser `annexe_d_matrice_iam.tex` avec l'état réel.

#### MFA dashboard

**Constat factuel :** TOTP (RFC 6238) via `pyotp` (`api/app/auth/mfa.py`), fenêtre
`valid_window=1` conforme NIST 800-63B. Pas de SMS, pas de backup codes, pas de WebAuthn. Flux
de login solide : mot de passe (bcrypt) → si MFA actif, JWT `typ:"mfa_pending"` (5 min, sans
`role`) ; `get_current_user` rejette tout token dont `typ != "access"` — **aucun chemin de
bypass identifié**, y compris côté proxy dashboard
(`dashboard/src/app/api/login/mfa/route.ts`).

**Écart HIGH :** la règle Cloud Armor anti-bruteforce (10 tentatives/min/IP + ban 5 min) ne
couvre que `var.auth_paths`, dont le défaut (`terraform/modules/load-balancer/variables.tf:
47-50`) est `["/auth/token", "/api/login"]`. **`/auth/mfa/verify` n'y figure pas** — le seul
filet restant est un `slowapi` applicatif à 60/min, explicitement documenté dans son propre
commentaire comme non destiné à être le contrôle principal, avec une clé qui peut se replier sur
l'IP de sortie mutualisée du dashboard. Le endpoint qui reçoit le code TOTP à 6 chiffres — la
cible naturelle d'un brute-force MFA — n'a donc pas la protection dédiée que `/auth/token` a. →
**H3.**

**Écart HIGH :** `mfa_secret` stocké en clair en base (`api/app/models/user.py:19`, `String(32)`,
pas d'AEAD/KMS applicatif). → **H4.**

**Tests :** `api/tests/test_mfa.py` (18 tests) tourne bien en CI (`.github/workflows/ci.yml:
87-89`). En revanche `dashboard/tests/e2e/auth.spec.ts` ne teste aucun scénario MFA et n'est de
toute façon jamais exécuté par aucun workflow (le job `e2e` de CI lance les tests Python racine,
pas ceux du dashboard ; le job `dashboard-test` tourne Jest sans aucun fichier `*.test.ts`, donc
vert par construction sans rien vérifier). → **M6.**

**Écarts priorisés :** HIGH — `/auth/mfa/verify` non couvert par Cloud Armor (= H3) ; HIGH —
`mfa_secret` en clair (= H4) ; MEDIUM — tests e2e MFA inexistants et non exécutés en CI (= M6) ;
LOW — pas de backup codes/récupération (= L12) ; LOW — pas de notification sur `mfa/disable` ou
ré-enrôlement (= L12).

**Recommandations :** (1) ajouter `/auth/mfa/verify` (idéalement aussi `/auth/mfa/enable`,
`/auth/mfa/disable`) à `auth_paths` — priorité immédiate, coût quasi nul ; (2) chiffrer
`mfa_secret` at rest (KMS envelope encryption ou pgcrypto) ; (3) écrire au moins 3 tests
Playwright couvrant le challenge MFA, branchés dans un vrai job CI ; (4) durcir le `slowapi` sur
`/auth/mfa/verify` avec une clé = `mfa_token` plutôt qu'IP ; (5) ajouter des backup codes à
usage unique ; (6) auditer/logger chaque `mfa/disable` et tentative `mfa/verify` échouée dans le
SIEM.

#### Synthèse des actions HIGH du 18/08 (ordre de priorité de l'audit original)

1. **MFA** — Ajouter `/auth/mfa/verify` à `auth_paths` Cloud Armor (coût quasi nul, risque de
   brute-force MFA réel). → H3
2. **IAM** — Détacher `ml-embed` de `sa-pipeline` / retirer le binding `bigquery.dataEditor`
   projet (écart connu depuis le 11/08, jamais corrigé). → H1
3. **MFA** — Chiffrer `mfa_secret` at rest. → H4
4. **Réseau** — Activer les logs de deny pare-feu/NAT (écart connu depuis le 11/08, jamais
   corrigé) — fixer une date. → H2
5. **Réseau** — Segmenter réellement le réseau entre tenants avant tout 3ᵉ client. → H6
6. **Sigma** — Aligner le nommage produit sur la nuance déjà présente dans le rapport PFE, ou
   migrer vers un vrai moteur si le nom doit être conservé. → H5
7. **IAM** — Remplacer le test T6 vide par une vérification réelle, ou provisionner une org GCP.
   → H10

#### Candidats ADR identifiés le 18/08

Pourquoi `/auth/mfa/verify` n'était pas dans `auth_paths` à l'origine (angle mort de conception,
pas un choix délibéré) — à documenter une fois corrigé. Choix de stocker `mfa_secret` en clair
au lancement (dette assumée ou oubli ?) et plan de chiffrement. Segmentation réseau
multi-tenant : pourquoi l'isolation actuelle est purement applicative (contrainte projet
personnel / pas d'org GCP) et à quel seuil de clients elle devient insuffisante. Positionnement
"Sigma" : décision consciente de nommage assumé en interne (rapport PFE) vs présentation produit
— trancher un nom unique.

---

## 3. État au 19/08/2026

**Vue d'ensemble.** Quatre vagues d'audit (02/08, 07/08, 11/08, 18/08) ont produit, corrigé et
re-vérifié un volume important d'écarts. La majorité des corrections **Tier 0/Tier 1** (coût
quasi nul, effort borné) décidées le 07/08 ont été appliquées et vérifiées en live le jour même
ou le lendemain : sonde `ml-embed`, rollback Cloud Run testé, `sa-cicd` resserré à
`cve_findings`, déploiement par digest pour le chemin `terraform apply`, blocs `traffic` pour un
futur rollout progressif, vérification quotidienne de l'isolation SQL Elson/menal, Cloud SQL
régional, CMEK sur BigQuery/GCS/Secret Manager, 2ᵉ canal d'alerte. Ce sont les mêmes 4-5 écarts
structurels — binding IAM `sa-pipeline`/`ml-embed`, logs de deny réseau désactivés, absence
d'isolation réseau réelle entre tenants, ATT&CK-BERT non joint au scoring, couverture tenant
incomplète côté SIEM — qui réapparaissent, non résolus, dans chacune des trois dernières vagues
d'audit (07/08, 11/08, 18/08). C'est le signe d'un vrai écart structurel, pas d'un oubli
documentaire : chacun nécessite soit un changement d'architecture (SA dédié, segmentation
réseau), soit une décision de recherche/scope (jointure ML) plutôt qu'une simple activation de
flag.

**Correctifs livrés en code le 19/08/2026, validés hors ligne (`terraform fmt`/`validate`,
`pytest`, `npm run build`), mais PAS ENCORE appliqués sur l'infrastructure réelle** — l'utilisateur
a choisi de garder la main sur le `terraform apply` (ses identifiants GCP ne sont pas partagés
avec l'agent ; voir §4.4) :
- H1 — binding IAM `sa-pipeline`/`ml-embed` : ✅ corrigé en code (`sa-ml-embed` créé sans rôle
  BigQuery, binding projet retiré) — 🕓 apply GCP en attente
- H2 — logs de deny pare-feu/NAT : ✅ corrigé en code (`log_config` deny-only + NAT
  `ERRORS_ONLY`, ADR-0007 clôturé) — 🕓 apply GCP en attente
- H3 — rate-limit `/auth/mfa/verify` : ✅ corrigé en code (ajouté à `auth_paths` Cloud Armor +
  reclé sur `mfa_token` côté slowapi) — 🕓 apply GCP en attente
- H4 — chiffrement `mfa_secret` : ✅ corrigé en code (Fernet, migration Alembic non destructive,
  31/31 tests passés) — 🕓 apply GCP + migration DB en attente
- H5 — renommage des règles "Sigma" : ✅ corrigé en code (Terraform + UI dashboard) — 🕓 apply GCP
  en attente

**Ne pas déclarer ces 5 items "résolus" tant que le `terraform apply` réel n'a pas été confirmé
par l'utilisateur** — le code est prêt et validé, l'état vivant de l'infrastructure ne l'est pas
encore.

**Écarts non couverts par les correctifs en cours, toujours ouverts sans date de remédiation
fixée :** en particulier H6 (segmentation réseau multi-tenant), H7 (clé tenant SIEM
partiellement fiable), H8 (ATT&CK-BERT hors scoring — décision ADR en attente), H9 (angles morts
de détection), H10 (test T6 vide / pas d'org GCP), H11 (pas de test unitaire par règle), ainsi
que l'ensemble des écarts MEDIUM et LOW du tableau de la section 1.

**Note sur la documentation connexe (historique, mise à jour au 19/08).** Entre le 18/08 et le
19/08, le dépôt a d'abord gagné un dossier `docs/adr/` (14 fiches, 0002 à 0015) et un
`00_CAHIER_DES_CHARGES_MENAL.md`, répondant à une partie des candidats identifiés le 11/08 et le
18/08 (§2.3 et §2.4 ci-dessus) — **puis, le 19/08, l'ensemble de la documentation du dépôt
(19 fichiers .md + les 15 ADR, `00_CAHIER_DES_CHARGES_MENAL.md` inclus) a été consolidé en 5
documents de référence** (`01_ARCHITECTURE_MENAL.md`, ce document, `03_JOURNAL_DECISIONS_ADR.md`,
`04_EXPLOITATION_DEMO.md`, `05_METHODOLOGIE_PFE.md`) et les fichiers sources supprimés — le
dossier `docs/adr/` est donc désormais vide sur disque, son contenu intégral se trouvant dans
`03_JOURNAL_DECISIONS_ADR.md`. Une vérification croisée ADR vs code réel reste recommandée avant de
considérer les écarts correspondants comme formellement actés.

**Prochaine étape suggérée :** une fois les 5 correctifs du 19/08 confirmés (ou non) en live,
mettre à jour ce document en conséquence, et prioriser parmi les écarts HIGH restants (H6, H8,
H9, H10, H11) ceux à traiter avant tout argumentaire commercial "Zero Trust multi-tenant" —
c'est explicitement la segmentation réseau (H6) que l'audit du 18/08 identifie comme le
prochain seuil critique avant l'onboarding d'un 3ᵉ client.

---

## 4. Session N+1 (19/08/2026) — Infra & Data

Deuxième session de la feuille de route (`05_METHODOLOGIE_PFE.md` Partie C), 3 agents en
parallèle sur Cloud Run/CMEK, gouvernance données (BigQuery/Cloud SQL DR), edge/CDN — domaines
non couverts par la session du 18/08 (qui portait sur SIEM, réseau macro, IAM, MFA).

### 4.1 Cloud Run / CMEK

**Corrigé** : `terraform/modules/cloud-run/main.tf` — `timeout` et `execution_environment`
étaient implicites (Cloud Run choisissait lui-même gen1/gen2 selon les fonctionnalités
détectées, comportement non déterministe). Rendus explicites : `timeout = var.timeout` (défaut
`"300s"`, comportement inchangé mais désormais lisible) et
`execution_environment = "EXECUTION_ENVIRONMENT_GEN2"` codé en dur. `min/max_instance_count`
étaient déjà bornés partout (pas de scale-up incontrôlé).

**Écart assumé, non corrigé — Cloud SQL toujours en chiffrement Google-managé par défaut**, alors
que BigQuery, le bucket GCS Elson et Secret Manager sont déjà en CMEK (ADR-0015). Vérifié par
`terraform plan` (08/08) : `encryption_key_name` est immuable à la création — migrer vers CMEK
nécessiterait une nouvelle instance + bascule, un projet à part entière, pas un correctif
ponctuel. À trancher (nouvel ADR ou plan de migration daté) avant tout argumentaire "chiffrement
CMEK de bout en bout".

### 4.2 Gouvernance des données (BigQuery) et DR (Cloud SQL)

**Corrigé** : `terraform/modules/bigquery/main.tf` — `access_logs` (IP sources en clair) n'avait
aucune expiration ; `raw_logs` avait une expiration commentée ("impossible sur Terraform 32
bits" — vérifié : limite réelle du binaire local `windows_386`, sans impact sur le runner CI
`ubuntu-latest`/64 bits). Les deux tables ont désormais `expiration_ms` = 90 jours, justifié en
commentaire (RGPD art. 5.1.e — logs opérationnels, pas des preuves). `detections`,
`analyst_verdicts`, `alert_enrichment`, `cve_findings`, `api_metrics` gardés SANS expiration
(ce sont des preuves/résultats d'analyse, pas des logs bruts).

**Écart ouvert, non tranché** : `security_events` (contient `source_ip`/`raw_log`) sans limite
de rétention — profil RGPD comparable à `access_logs`/`raw_logs`, mais plus proche d'une preuve
d'alerte que d'un log opérationnel ; laissé en l'état faute de classification métier validée.

**Cloud SQL DR : RAS.** Configuration réelle (`backup_configuration`: PITR activé,
`transaction_log_retention_days=7`, `retained_backups=7`, `availability_type=REGIONAL`)
**correspond exactement** aux mesures réelles du 03/08 (RTO 32 min 45 s, RPO 0) déjà documentées
dans `04_EXPLOITATION_DEMO.md` — aucun écart entre le Terraform et ce qui a été mesuré en
conditions réelles.

### 4.3 Edge / CDN / certificats

**Aucun correctif nécessaire** — les deux risques suspectés à l'ouverture de la session se sont
révélés être des non-problèmes à la lecture du code réel :
- En-têtes de sécurité HTTP (HSTS, X-Frame-Options, CSP, etc.) : déjà présents et corrects côté
  API (`api/main.py`) et dashboard (`next.config.js`), committés lors d'une session antérieure,
  couverts par un test existant.
- Cloud CDN : **non activé** sur aucun backend (`grep -i cdn` négatif sur tout `terraform/`) —
  aucun risque de mise en cache de réponses API sensibles.
- Certificats TLS : Google-managés, renouvellement automatique, pas de risque d'expiration
  "classique".

**Écarts confirmés toujours ouverts** :
- Pas d'alerte de monitoring sur un échec de provisioning/renouvellement de certificat managé
  (le cert resterait bloqué en `FAILED_NOT_VISIBLE` silencieusement si le DNS dérive) — module
  `monitoring`, non traité dans cette session (hors périmètre assigné).
- Processus de révision périodique de la liste de géo-blocage : toujours absent, déjà noté dans
  l'ADR-0004, confirmé non résolu.

### 4.4 Déploiement réel — bloqué, volontairement

Aucun des correctifs (session du 18/08 ni celle-ci) n'a été appliqué sur l'infrastructure GCP
réelle. Tentative de `terraform apply` évaluée le 19/08 : l'environnement d'exécution de l'agent
avait `gcloud` configuré sur un **projet client différent** (`wallet-infra-adst`, projet Arkan —
pas MENAL) et aucune Application Default Credentials — appliquer dans ces conditions aurait été
dangereux. Confirmé une seconde fois lors de la Session N+2 (aucune ADC disponible, connexion
interactive Google impossible dans une session non-interactive). L'utilisateur garde la main sur
l'`apply`, avec ses propres identifiants MENAL, en dehors de cette session. Voir §3 ci-dessus
pour le détail des 5 items en attente d'application (rejoint désormais par le câblage
`MFA_ENCRYPTION_KEY`, voir §5.2 — sans apply réel, l'API planterait au démarrage hors `dev`
faute de ce secret).

---

## 5. Session N+2 (19/08/2026) — Credentials & Supply Chain

Troisième session de la feuille de route (`05_METHODOLOGIE_PFE.md` Partie C), 3 agents en
parallèle sur Docker Hub/hotfix, câblage Secret Manager, et intégrité de la chaîne d'outillage
(lock file + pinning d'images).

### 5.1 `scripts/hotfix.sh` — Docker Hub personnel retiré (M11, résolu en code)

Le script buildait et poussait vers Artifact Registry (légitime, scanné) **et** vers un compte
Docker Hub personnel (`mo35ehab`), alors que le déploiement Cloud Run se fait exclusivement
depuis Artifact Registry — le push Docker Hub était donc un risque pur (image non scannée,
publique) sans aucun bénéfice. Retiré intégralement. Le script accepte désormais un environnement
en argument (`dev`/`staging`, avant codé en dur sur `dev`) avec les noms de ressources déduits
des conventions réelles du repo, et un scan Trivy bloquant sur CRITICAL a été ajouté avant tout
push. Le commentaire Terraform censé être trompeur (`modules/dashboard/main.tf`) s'est révélé
déjà correct — corrigé lors d'une session antérieure (07/08).

### 5.2 `MFA_ENCRYPTION_KEY` câblée dans Secret Manager (gap ouvert par le correctif du 18/08)

Le chiffrement du secret TOTP (ajouté le 18/08) chargeait sa clé via une variable d'environnement
sans jamais la provisionner côté GCP — un déploiement réel en staging aurait fait planter l'API
au démarrage (garde-fou fail-closed hors `dev`). Corrigé en reproduisant exactement le câblage
déjà en place pour `JWT_SECRET` : `google_secret_manager_secret` + version + accès IAM
(`modules/cloud-sql/main.tf`), injection dans Cloud Run (`modules/cloud-run/main.tf`), branchement
dans les deux environnements. Point technique validé avec soin : Fernet exige 32 octets bruts en
base64 URL-safe **avec padding** (44 caractères finissant par `=`) — ni `random_password`
(alphabet de caractères, pas des octets) ni `random_id.b64_url` seul (43 caractères, padding
manquant) ne suffisent ; la valeur finale concatène explicitement le `=` manquant, vérifié
bout-en-bout avec le vrai module Python `cryptography.fernet.Fernet`.

### 5.3 Intégrité de la chaîne d'outillage (M13, L7 — résolus)

- **Lock file Terraform** : retiré de `.gitignore`, régénéré pour `dev` et `staging` — mêmes
  versions de provider sur les deux environnements (google/google-beta 5.45.2, random 3.9.0,
  github 6.13.0), garantissant que la CI de validation (F7) utilise ce que l'utilisateur applique
  réellement.
- **Pinning par digest** : les 5 Dockerfile MENAL (`api`, `api/dashboard`, `enrich-job`,
  `ml-embed`, `dashboard`) épinglés par digest SHA256 (résolu via l'API Registry Docker Hub, pas
  besoin d'un daemon Docker local), même style que `elson-main` déjà conforme.
- **Couverture des scans (vérifiée, pas de refactoring)** : confirmé que Gitleaks/Semgrep
  couvrent tout le repo (MENAL + Elson), mais que Trivy en CI ne scanne QUE les images buildées
  par la CI (`menal-api`, `menal-dashboard`) — `ml-embed` et `enrich-job` restent livrées hors CI
  (décision déjà actée par ADR-0002/0003, pas une découverte nouvelle, mais un écart de couverture
  Trivy toujours réel). Non traité — refactoring CI hors périmètre de cette session (M12).

### 5.4 Écarts non couverts par cette session

M12 (duplication CI entre `ci.yml`/`elson-ci.yml`, pas de `workflow_call`), et la couverture
Trivy incomplète sur `ml-embed`/`enrich-job` notée ci-dessus, restent ouverts — nécessiteraient
un changement plus invasif du pipeline CI, hors scope d'une session bornée.

---

## 6. Session N+3 (19/08/2026) — Applicatif & Elson/ML

Quatrième session de la feuille de route (`05_METHODOLOGIE_PFE.md` Partie C), 3 agents en
parallèle sur le RBAC dashboard (au-delà du MFA/JWT déjà audité), la sécurité applicative
d'Elson en tant que produit (pas seulement son intégration IAM/réseau déjà couverte le 18/08),
et le pipeline ML (`ml-embed`/`enrich-job`, hors IAM déjà corrigé le 19/08).

### 6.1 RBAC dashboard — RAS, une limite documentée

Bonne surprise : le contrôle de rôle API était déjà cohérent partout. `require_role(*roles)`
(`api/app/auth/dependencies.py:31-39`) est appliqué sur les 5 routers montés — actions
d'écriture (`create_user`, `set_incident_verdict`) restreintes à `admin`, lectures ouvertes à
`admin`+`viewer`. Les routes MFA n'exigent que `get_current_user` mais c'est correct : elles
n'agissent que sur le compte de l'appelant, aucun paramètre d'ID externe, pas d'IDOR possible.
Cookie de session déjà conforme (`httpOnly`, `secure` en prod, `sameSite=lax`, `maxAge` aligné
sur l'expiration JWT). **Aucun correctif nécessaire.**

**Limite documentée, non corrigée** : pas de révocation JWT au logout (`logout/route.ts` ne fait
que supprimer le cookie côté client) — le token reste valide jusqu'à expiration naturelle
(60 min max) même après déconnexion ou changement de rôle en base. Limitation inhérente au choix
JWT stateless du projet ; une vraie révocation (blocklist Redis/DB) est un changement
d'architecture, hors périmètre d'un correctif ponctuel. Fenêtre d'exposition bornée, jugée
acceptable pour un PFE.

### 6.2 Pipeline ML — 3 correctifs réels

- **DoS par payload géant sur `ml-embed`** : la troncature de texte (`MAX_TEXT_LENGTH=8000`)
  intervenait après que FastAPI ait déjà bufferisé tout le corps JSON en mémoire — un payload de
  plusieurs centaines de Mo aurait pu saturer la mémoire avant troncature. Corrigé : middleware
  `limit_body_size` rejetant (413) tout corps &gt; 4 Mo avant parsing (`api/ml-embed/app/main.py:14-35`).
- **Intégrité du modèle vérifiée seulement au build, jamais au runtime** : `MODEL.sha256` est
  généré et vérifié en `Dockerfile` (build), mais `main.py` chargeait le modèle sans jamais
  revérifier cette empreinte au démarrage du conteneur — écart réel entre le contrôle "supply
  chain" documenté et son application effective. Corrigé : `_verify_model_integrity()` recalcule
  et compare le SHA256 à chaque démarrage (`api/ml-embed/app/main.py:38-73`).
- **`enrich-job` faisait confiance sans validation à la réponse de `ml-embed`** avant de l'utiliser
  comme paramètre de requête BigQuery. Corrigé : `_validate_embed_items()` vérifie forme/type/
  dimension avant usage (`api/enrich-job/main.py:195-215`).
- **RAS confirmé** : authentification de l'endpoint `ml-embed` — pas seulement la restriction
  réseau supposée au départ, mais un vrai ID token vérifié par IAM Cloud Run
  (`roles/run.invoker` scopé au SA `enrich-job` uniquement, `terraform/modules/ml-pipeline/main.tf:208-214`).
  Timeout HTTP déjà présent, requêtes BigQuery déjà paramétrées (pas d'injection SQL). Limites de
  ressources déjà bornées (confirmé, pas retouché — Session N+1).

### 6.3 Sécurité applicative Elson — solide, dépendances mises à jour

Stack vérifiée saine par construction : JWT `HS256` explicite (anti algorithm-confusion), rôle
toujours relu en base, session unique par appareil, anti-CSRF (`Origin` + header dédié), bcrypt
coût 12, validation Zod quasi systématique, path-traversal bloqué sur les uploads (noms
régénérés en UUID), gestion d'erreurs sans fuite de stack trace, en-têtes de sécurité gérés côté
Caddy (édge, équivalent fonctionnel à l'approche MENAL même si l'implémentation diffère).

**Corrigé** : `npm audit fix` côté backend (multer, `@google-cloud/storage`, transitifs —
DoS corrigés, pas de bump majeur) ; Next.js 16.2.0→16.3.1 côté frontend (corrige plusieurs CVE
hautes : SSRF via Server Actions/rewrites, contournement de middleware, empoisonnement de
cache — `npm audit` frontend passe de plusieurs vulnérabilités "high" à 0). Bonus : un bug
préexistant sans rapport (glob TypeScript incluant à tort les tests backend dans le build
frontend) a été découvert et corrigé en tentant de valider ces changements.

**Écarts confirmés, non corrigés** :
- Pas de MFA au login côté Elson (contrairement à MENAL) — décision produit, pas un bug, hors
  périmètre d'un correctif de sécurité borné.
- `nodemailer`/`uuid`/`@google-cloud/storage` ont des CVE nécessitant un bump de version
  **majeure** (risque de rupture d'API) — reporté à une session dédiée avec tests d'intégration,
  pas fait à l'aveugle.
- CSP Caddy autorise `'unsafe-eval'` sans distinction dev/prod — modification d'infra de prod
  jugée trop risquée à faire sans test, non touchée.

### 6.4 Validation

RBAC : `pytest api/tests/` 31/31 (baseline, aucun fichier modifié dans ce volet). ML : compilation
Python + tests d'import réels (`ml-embed` en mode mock, `enrich-job` avec ADC disponible dans
l'environnement de l'agent) — 6 cas invalides testés sur `_validate_embed_items()`, tous
correctement rejetés. Elson : `npm run build` + `npm run test:unit` (13/13) côté backend,
`npm run build` (22 pages) côté frontend, `npm audit` avant/après.

---

## 7. Validation en conditions réelles (19/08/2026) — CI, WAF, RBAC live

Contrairement aux sessions 1-6 (relecture de code + validation hors ligne), cette dernière passe
teste le comportement RÉEL : historique d'exécution CI via `gh run`, requêtes HTTP réelles contre
`api-staging.menal-sarl.com`/`dash-staging.menal-sarl.com` (test d'intrusion autorisé par le
propriétaire sur sa propre infrastructure, volume limité à ~50 requêtes au total réparties sur
3 agents, aucune requête d'écriture). Objectif : vérifier que ce qui a été audité/corrigé dans le
code se comporte bien comme attendu une fois exposé au trafic réel — l'`apply` GCP des
correctifs H1-H5 n'a toujours pas eu lieu (voir §7.4), donc cette validation porte sur l'état
staging **avant** ces 5 correctifs.

### 7.1 CI — un vrai théâtre de sécurité découvert et corrigé

Vérification de ~100 runs réels par workflow (pas juste le YAML) :
- **`ci.yml`** : 38/52 succès (73 %), tous les échecs datent du bootstrap (30/07-16/08), **aucun
  échec depuis le 16/08**. Gitleaks et Trivy confirmés réellement fonctionnels (logs de scan
  authentiques, 12 CVE HIGH réellement remontées sur le dernier build API).
- **`elson-ci.yml`** : 19/23 succès (83 %), stable depuis le 07/08.
- **`terraform.yml`** : 19/20 succès (95 %), dernier run post-corrections (10/08) vert.
- **`e2e.yml`** : **0 run, jamais déclenché** (`workflow_dispatch` uniquement) — fichier mort,
  déjà tracé en L6.
- **⚠️ H12 (résolu ce jour)** : la gate SAST Semgrep, présentée comme bloquante
  (`ci.yml:59-61` : *"un finding SAST fait échouer le pipeline"*), **crashait silencieusement sur
  chaque run depuis au moins le 02/08** (`semgrep/semgrep-action@v1` incompatible avec le
  registre `p/default` actuel) sans jamais faire échouer le job — GitHub Actions rapportait
  l'étape "success" malgré le crash Python interne. **0 règle SAST réellement évaluée pendant au
  moins 2 semaines**, malgré la porte "bloquante" annoncée. Corrigé : `.github/workflows/ci.yml`
  remplace l'action par un appel direct au CLI (`semgrep scan --config=p/default --error`), dont
  le code de sortie est fiable. À vérifier au prochain run réel (pas encore re-testé en conditions
  CI, seulement corrigé et relu).

### 7.2 WAF Cloud Armor — bloque 4/5 patterns testés en conditions réelles

| Test | Résultat | Attendu | Conforme |
|---|---|---|---|
| SQLi (`id=1' OR '1'='1`) | 403 | 403 | ✅ |
| XSS (`<script>alert(1)</script>`) | 403 | 403 | ✅ |
| `.env` | 403 | 403 | ✅ |
| `.git/config` | 403 | 403 | ✅ |
| Path traversal (`--path-as-is`, payload brut) | **302** | 403 | ⚠️ H13 |

**H13** : avec un payload de traversal non normalisé côté client, la réponse est un 302 (pas un
blocage 403) — contrairement aux 4 autres patterns, tous bloqués de façon cohérente. Fuite de
contenu réel jugée improbable par l'agent testeur, mais c'est un écart de couverture WAF réel,
pas théorique. Mécanisme exact non confirmé (hypothèse : normalisation d'URL par le Load
Balancer avant évaluation de la règle Cloud Armor). **Non corrigé** — nécessite d'abord de
comprendre le mécanisme exact avant de modifier la règle Cloud Armor à l'aveugle.

### 7.3 RBAC / exposition API — conforme en conditions réelles

7 routes protégées (`/siem/*`, `/users/`) testées sans jeton puis avec un jeton invalide :
jamais de `200` ni de `500`, toujours un refus propre (`403`/`401`) sans fuite de données dans le
corps de réponse. `/health` répond `200` mais révèle `environment` et `version` (fingerprinting
mineur, sévérité faible). `/docs`/`/openapi.json` exposés publiquement en staging — défendable
pour une démo PFE, à fermer avant toute mise en production réelle. `/coverage` (dashboard)
redirige bien vers `/login` sans authentification. La route `/auth/mfa/verify` (ajoutée le 18/08)
est confirmée déployée et fonctionnelle en staging (422 cohérent sur payload invalide).

### 7.4 Apply GCP — toujours bloqué, cause identifiée

Tentative de `terraform init`/`plan` réelle (avec permission explicite de l'utilisateur) : les
identifiants s'authentifient correctement (pas d'erreur de permission), mais l'accès à l'état
Terraform échoue avec une erreur de **facturation** : *"UserProjectAccountProblem — the project
to be billed is associated with an absent billing account"*. Le compte de facturation du projet
`menal-zero-trust-staging` semble désactivé/absent — **problème indépendant des correctifs de
sécurité, à résoudre en priorité côté console GCP avant tout `apply`**. Les 3 services (API,
dashboard, Elson) continuent de répondre normalement au moment du test (19/08), donc pas de
dégradation immédiate constatée, mais la situation reste à surveiller.

### 7.5 Verdict de cette session

Le projet se comporte, en conditions réelles, majoritairement comme documenté : WAF (4/5
patterns), RBAC (7/7 routes), en-têtes de sécurité, CI (hors SAST) — tous confirmés fonctionnels
en live. Deux écarts réels trouvés uniquement grâce à ce test en conditions réelles (invisibles
à la seule lecture de code) : H12 (SAST silencieusement mort, corrigé) et H13 (gap WAF path
traversal, ouvert). C'est la preuve que la relecture de code seule, même rigoureuse sur 6
sessions, ne suffit pas — un test en conditions réelles reste nécessaire avant de clore un audit.

---

## 8. Clôture finale (19/08/2026) — apply confirmé, panel d'experts de sortie

### 8.1 L'apply GCP a eu lieu — confirmé par preuve directe

Contrairement à l'état documenté en §3/§7.4 (apply bloqué par une facturation absente), l'apply a
été réalisé avec succès (résolu côté utilisateur, hors de cette session). Confirmé par 3 preuves
indépendantes obtenues en direct le 19/08 en fin de journée :

1. **`terraform plan` = "No changes. Your infrastructure matches the configuration."** —
   l'intégralité du code corrigé sur 7 sessions est réellement déployée sur
   `menal-zero-trust-staging`.
2. **`terraform state show`** confirme individuellement : `sa-ml-embed` existe avec le seul rôle
   `logging.logWriter` (aucun rôle BigQuery) ; le binding projet `pipeline_bigquery_editor` est
   absent ; `ml-embed` tourne en `INGRESS_TRAFFIC_INTERNAL_ONLY` sous `sa-ml-embed` ; `auth_paths`
   Cloud Armor inclut `/auth/mfa/verify|enable|disable` ; `log_config` est actif sur
   `deny_all_ingress`.
3. **Test HTTP live** : 11 requêtes `POST` vers `/auth/mfa/verify` — les 10 premières `422`, la
   11ᵉ **`429`** : le rate-limit Cloud Armor n'est pas seulement configuré, il est **appliqué**.

**H1, H2, H3, H4, H5 passent donc de "code corrigé, apply en attente" à "déployé et vérifié en
direct"** (mis à jour dans le tableau §1). C'est le niveau de preuve le plus solide possible sans
accès à un outil de pentest dédié.

### 8.2 Panel d'experts de clôture — 3 verdicts indépendants

**Security Architect (IAM / Réseau / Données)** — IAM 7/10, Réseau 4/10, Données 6/10.
H1 corrigé et vérifié en direct = point fort réel. Mais **H6 (segmentation réseau multi-tenant)
reste entièrement ouvert** et est qualifié de "disqualifiant" pour une certification SOC2/client
entreprise tant qu'aucune isolation réseau tenant-par-tenant n'existe. H10 (pas de politique
d'org IAM, test T6 stub) reste un vrai trou de contrôle, pas seulement documentaire.

**AppSec Architect (MFA / RBAC / WAF)** — MFA 9/10, RBAC 9.5/10, WAF 7.5/10.
RBAC et MFA doublement prouvés (code + live). H13 analysé en détail : risque réel jugé **faible**
pour une démo PFE (un navigateur standard normalise déjà les séquences `../`, l'exploitation
réelle exige une requête HTTP forgée à la main), mais reste un gap de défense en profondeur non
résolu, correctement classé HIGH par prudence méthodologique plutôt que par impact démontré.

**CI/CD (vérification du correctif Semgrep, H12)** — ⚠️ **Le correctif n'est pas encore commité
ni poussé** : il existe uniquement dans l'arbre de travail local, jamais exécuté par un run CI
réel. Le bug original (crash silencieux, faux-vert) est prouvé par les logs jusqu'au 16/08
inclus, mais **rien ne garantit à ce jour que le correctif fonctionne réellement en CI** (ex.
l'installation `pip install semgrep` pourrait échouer sur le runner, le format de sortie pourrait
différer). H12 doit être requalifié : diagnostic confirmé, correctif écrit mais **non vérifié**.

### 8.3 Verdict de clôture global

**Certifiable pour un PFE, avec 3 réserves à nommer explicitement devant le jury, pas à taire :**
1. **H6** — pas de segmentation réseau réelle entre tenants MENAL/Elson (le seul point jugé
   disqualifiant pour une certification entreprise/SOC2 par le panel).
2. **H13** — gap WAF sur un pattern de path traversal brut, risque réel faible mais non résolu.
3. **H12** — correctif Semgrep écrit mais jamais validé par un run CI réel (à commiter/pousser
   pour obtenir la preuve manquante, ou à présenter honnêtement comme "corrigé en théorie, pas
   encore vérifié").

Sur tout le reste (IAM hors H10, MFA, RBAC, données, CI hors SAST, réseau hors segmentation
multi-tenant) : **corrigé, déployé, et vérifié en conditions réelles** — pas seulement audité sur
le papier. C'est la différence entre "j'ai relu le code" et "j'ai prouvé que ça marche", et c'est
cette dernière preuve qui a été apportée aujourd'hui.
