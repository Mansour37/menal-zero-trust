# LLD — Plateforme MENAL
## Conception détaillée (Low-Level Design) — v1.0 — Juillet 2026

Ce document détaille chaque couche du HLD. Chaque section suit le même gabarit :
**Composants → Configuration → Contrôles Zero Trust → Interfaces → Point de vigilance.**
Les identifiants de flux (F1–F6) renvoient au HLD §4.1.

---

## 0. Conventions

| Élément | Convention |
|---|---|
| Projets GCP | `menal-dev` · `menal-staging` · `menal-prod` (un projet par environnement) + `menal-ops` (amorçage : état Terraform, WIF, Artifact Registry partagé). **Le LLD décrit la cible prod** ; dev et staging appliquent les mêmes modules avec un dimensionnement réduit (méthodologie §2) |
| Région | `europe-west1` |
| Nommage services | `app-elson`, `api-platform`, `dash-secu`, `ml-embed`, `enrich-job` |
| Nommage comptes de service | `sa-<service>@menal-<env>.iam.gserviceaccount.com` |
| Datasets BigQuery | `siem` (SIEM), `ops` (exports divers) |
| Étiquetage | `env=demo`, `layer=l1..l7`, `owner=pfe` |
| Provisionnement | **Terraform exclusivement** (ADR-12 renforcé) — un module par couche, état distant GCS ; détail en §10. Aucune ressource créée « à la main » dans la console. |

Politiques d'organisation appliquées dès la fondation (toutes disponibles nativement) :
`sql.restrictPublicIp`, `iam.disableServiceAccountKeyCreation`, `storage.publicAccessPrevention` — trois lignes qui rendent **structurellement impossibles** trois classes d'erreurs.

---

## 1. L1 — EDGE

### Composants
Cloud DNS (zone publique), Global External Application Load Balancer, certificats TLS managés, Cloud Armor.

### Configuration
| Paramètre | Valeur | Raison |
|---|---|---|
| Frontend | HTTPS 443 uniquement ; redirection 80→443 | Aucun trafic clair |
| Backends | 2 NEG serverless : `app-elson`, `dash-secu`/`api-platform` (routage par hôte : `app.menal.example` / `secu.menal.example`) | Séparation des domaines applicatif et supervision |
| Cloud Armor — règles | Règles préconfigurées : `sqli-v33-stable`, `xss-v33-stable`, `lfi`, `rce` en mode **deny** après période d'observation en mode *preview* | Le mode preview d'abord évite de bloquer du trafic légitime — pratique standard |
| Cloud Armor — rate limiting | `rate_based_ban` : seuil ~100 req/min/IP sur `/api/*`, ban 5 min | Valeur de départ, à calibrer sur le trafic observé |
| En-têtes | HSTS ; les en-têtes de sécurité applicatifs restent gérés par les services (héritage du modèle Caddy d'ELSON) | Un seul propriétaire par en-tête |

### Contrôles Zero Trust
Point d'entrée **unique** : les URL `*.run.app` directes sont neutralisées par l'ingress Cloud Run (voir L3). Contourner L1 est donc impossible, pas seulement interdit.

### Interfaces
Entrée : Internet (F1). Sortie : NEG serverless vers L3. Journaux : requêtes ALB + verdicts Cloud Armor → L7 (F4).

### Point de vigilance
Le rate limiting edge est par IP : derrière un CGNAT (contexte mauritanien documenté dans l'audit ELSON §11.6), régler le seuil large et compléter par les limiteurs applicatifs existants d'ELSON. **Ne pas** ajouter de composant pour ça.

---

## 2. L2 — IDENTITÉ & SÉCURITÉ (plan transversal)

### 2.1 Comptes de service et matrice IAM

Un compte de service **par workload**, aucun usage du SA Compute par défaut, **aucune clé exportée** (politique d'org + WIF).

| Compte de service | Utilisé par | Rôles (moindre privilège) | Interdictions notables |
|---|---|---|---|
| `sa-app-elson` | Cloud Run `app-elson` | `cloudsql.client` ; `secretmanager.secretAccessor` (secrets ELSON uniquement) | Aucun accès BigQuery |
| `sa-api-platform` | Cloud Run `api-platform` | `bigquery.dataViewer` sur `siem` ; `cloudsql.client` ; `secretmanager.secretAccessor` (secrets plateforme) | **Lecture seule** sur le SIEM — le dashboard ne modifie jamais une preuve |
| `sa-ml-embed` | Cloud Run `ml-embed` | **Aucun rôle de données** | Aucun droit BigQuery, aucun secret — le service ne fait qu'encoder |
| `sa-enrich-job` | Cloud Run Job `enrich-job` | `bigquery.dataViewer` sur `detections` ; `bigquery.dataEditor` **uniquement sur `alert_enrichment` et `pending_embeddings`** ; `run.invoker` sur `ml-embed` | Écriture interdite sur `raw_logs` et `detections` (intégrité des preuves) |
| `sa-ci-deploy` | GitHub Actions via WIF | `artifactregistry.writer` ; `run.developer` ; `iam.serviceAccountUser` sur les SAs runtime | Aucun accès données ; portée limitée au dépôt GitHub fédéré |
| `sa-scheduler` | Cloud Scheduler | `run.invoker` sur `enrich-job` | Rien d'autre |

Cette matrice **est** la micro-segmentation : elle remplace des pare-feux internes par des identités à droits minimaux.

### 2.2 Secrets et chiffrement
| Élément | Mise en œuvre |
|---|---|
| Secret Manager | Un secret par valeur (leçon directe de l'audit ELSON §11.2 : **jamais de secret dérivé d'un autre**). Pour ELSON : `db-password`, `jwt-secret`, `api-key-secret`, `audio-url-secret`, `otp-pepper`, `smtp-pass`, etc. — montés via `--set-secrets`, jamais en variable d'environnement en clair dans l'image. |
| Cloud KMS | Un keyring `menal-kr` ; clés CMEK pour Cloud SQL et BigQuery (marqué « cible prod » — en démo, le chiffrement Google par défaut est acceptable et documenté comme tel). |
| Rotation | Versionnement natif de Secret Manager ; procédure de rotation décrite dans le runbook (doc 05). |

### 2.3 JWT-RBAC applicatif
Trois rôles portés par le JWT émis par `api-platform` : `admin` (gestion), `analyste` (lecture incidents, matrice ATT&CK, CVE priorisées), `utilisateur` (application hébergée). Vérification systématique côté API (`Depends(require_role(...))` — contrat du doc ATT&CK-BERT §10.2). Le dashboard **n'appelle jamais** `ml-embed` ni BigQuery directement : il passe par l'API.

### 2.4 Workload Identity Federation (CI)
Pool WIF hébergé dans `menal-ops`, lié au dépôt GitHub `menal/*`. **Un SA de déploiement par environnement** (`sa-ci-deploy-dev|staging|prod`, `sa-ci-infra-…`), avec condition d'attribut sur la référence Git (`main` → dev, promotion → staging, tag `vX.Y.Z` → prod) et des rôles limités **au seul projet cible** : le pipeline dev ne peut structurellement pas toucher prod (test T17). Jetons de 10 minutes. **Aucune clé JSON n'existe** — la classe de risque disparaît au lieu d'être gérée.

---

## 3. L3 — WORKLOADS SERVERLESS

### Tableau des services Cloud Run

| Service | Image | SA | Ingress | Auth | Réseau sortant | Scaling |
|---|---|---|---|---|---|---|
| `app-elson` | `europe-west1-docker.pkg.dev/menal-ops/apps/elson@sha256:…` (registre partagé — même digest promu dev→staging→prod) | `sa-app-elson` | `internal-and-cloud-load-balancing` | Publique (auth applicative ELSON) | Direct VPC egress ; NAT pour SMTP/API externes | min 0 / max 3 |
| `api-platform` | `…/apps/api-platform@sha256:…` | `sa-api-platform` | `internal-and-cloud-load-balancing` | JWT-RBAC applicatif | Direct VPC egress | min 0 / max 2 |
| `dash-secu` | `…/apps/dash-secu@sha256:…` | (statique, appelle l'API) | `internal-and-cloud-load-balancing` | JWT (session analyste/admin) | — | min 0 / max 2 |
| `ml-embed` | `…/apps/ml-embed@sha256:…` (poids embarqués) | `sa-ml-embed` | **`internal`** | **`--no-allow-unauthenticated`** (jeton d'identité `sa-enrich-job`) | **Egress : aucun** (`vpc-egress=all-traffic`, pas de route Internet) | min 0 / max 1, concurrence bornée |

### Contrôles Zero Trust
- Déploiement **par digest** (`@sha256:`) et jamais par tag : ce qui tourne est exactement ce qui a été scanné (F3).
- Conteneurs non-root (déjà le cas dans les Dockerfiles ELSON et ml-embed), `docs_url=None` sur les APIs internes.
- Toute invocation service-à-service est authentifiée IAM : être « à côté » ne donne rien.

### Point de vigilance (application hébergée ELSON)
L'audit ELSON (§13.1) identifie des adaptations à la charge de l'application (fichiers locaux → GCS ou disque persistant, état en mémoire). **Hors périmètre du socle** : le socle expose les prérequis (SQL privé, secrets, NAT allow-listé) ; l'adaptation applicative est listée comme prérequis d'onboarding dans le cas d'utilisation UC-06.

---

## 4. L4 — RÉSEAU

### Composants et configuration
| Élément | Configuration |
|---|---|
| VPC | `menal-vpc`, mode custom, un subnet privé `snet-priv-ew1` (`10.10.0.0/24`), Private Google Access activé |
| PSA | Plage réservée `10.20.0.0/16` en peering `servicenetworking` → Cloud SQL en IP privée uniquement |
| Cloud NAT | `nat-egress` sur le routeur `menal-router` ; journalisation NAT activée ; sorties légitimes documentées dans la matrice des flux (doc 05) |
| Pare-feu | `deny-all-ingress` (priorité 65534) + règles explicites minimales ; journaux de règles activés sur les deny |
| Cloud Run ↔ VPC | **Direct VPC egress** (plus simple qu'un connecteur Serverless VPC Access dédié — un composant de moins à dimensionner) |

### Contrôles Zero Trust
Le réseau **transporte**, il n'**autorise** pas : même à l'intérieur, chaque appel repasse par l'IAM (L2). Les deny journalisés alimentent le SIEM (tentatives de mouvement latéral = signal).

### Point de vigilance
Direct VPC egress consomme des IP du subnet : le /24 est largement suffisant pour ce périmètre — ne pas sur-dimensionner.

---## 5. L5 — DATA

### 5.1 Cloud SQL PostgreSQL
| Paramètre | Valeur démo | Cible prod (documentée, non déployée) |
|---|---|---|
| Édition / version | PostgreSQL 17 | idem |
| Réseau | **IP privée uniquement** (PSA), `require_ssl` | idem |
| Sauvegardes | automatiques + **PITR** | + **HA régionale** |
| Chiffrement | Google-managed | **CMEK** (KMS L2) |
| Accès | `sa-app-elson`, `sa-api-platform` via connecteur/auth IAM | idem + Query Insights |

### 5.2 BigQuery — le SIEM
Dataset `siem`, tables et chaîne de traitement :

```
raw_logs (partitionnée/jour, ingérée par le sink F4)
   │  requêtes planifiées = règles Sigma traduites en SQL (toutes les 5 min)
   ▼
detections (alertes brutes normalisées : ts, entity, source, message, rule_id?)
   │  enrich-job (F5) : nouvelles lignes → pending_embeddings → ml-embed → vecteurs
   ▼
alert_enrichment (technique_id, tactic, similarity, status mapped/unmapped,
                  model_version, input_hash) — schéma exact : doc ATT&CK-BERT §9.4
   │  vue v_killchain (≥2 tactiques / entité / heure → bonus +15) — §9.6
   ▼
incident_scores → lu par api-platform → dashboard
attack_embeddings (600 vecteurs + index vectoriel IVF/COSINE, chargé hors ligne, lecture seule)
```

| Contrôle | Mise en œuvre |
|---|---|
| Intégrité des preuves | `raw_logs` et `detections` : écriture réservée au sink et aux requêtes planifiées ; **aucun SA applicatif ou ML n'a de droit d'écriture** |
| Rétention / coût | Partitionnement journalier, expiration `raw_logs` 90 j, filtres d'exclusion au sink (le poste de coût dominant — doc ATT&CK-BERT §6.4) |
| Seuil de similarité | `DECLARE threshold DEFAULT 0.60` en tête de requête : auditable et modifiable sans redéploiement (§9.5) |
| Discipline `unmapped` | Sous le seuil, on assume l'absence de rattachement ; le taux `unmapped` est un KPI affiché |

---

## 6. L6 — ML / ENRICHISSEMENT SÉMANTIQUE

Cette couche applique **intégralement** le document d'intégration ATT&CK-BERT ; le LLD n'en reprend que les décisions structurantes, la référence fait foi pour le code.

| Aspect | Détail |
|---|---|
| Modèle | `basel/ATTACK-BERT` (MPNet, 110 M params, sortie 768 d), révision épinglée par commit, **safetensors uniquement** (refus du pickle), empreintes `MODEL.sha256` consignées |
| Optimisation | Export **ONNX quantisé int8** (≈110 Mo), validation obligatoire : similarité cosinus float32↔int8 > 0,99 sur échantillon, sinon repli float32 |
| Service `ml-embed` | FastAPI, CPU 1 vCPU / 1 GiB, `min-instances=0`, troncature 512 tokens, lot max 64, `HF_HUB_OFFLINE=1`, poids **embarqués dans l'image** (jamais téléchargés à l'exécution) |
| `enrich-job` | Cloud Run Job déclenché par Cloud Scheduler toutes les 5 min ; lit les `detections` non enrichies, appelle `ml-embed` (jeton d'identité), écrit `pending_embeddings`, exécute `VECTOR_SEARCH` (top_k=1, COSINE), insère dans `alert_enrichment` |
| Cache | Par `input_hash` (SHA-256 du texte) : un événement récurrent n'est encodé qu'une fois |
| Position | Entre L4 et L5, **jamais exposée** : ni à l'edge, ni au dashboard (qui passe par l'API) |
| Chaîne d'approvisionnement | L'image `ml-embed` traverse le même pipeline que les autres : Gitleaks, Semgrep, Trivy — les poids sont un artefact tiers non fiable |

**Principe d'architecture cardinal (repris tel quel) :** *un moteur de détection ne doit jamais pouvoir modifier les preuves qu'il analyse.* Il est implémenté par la matrice IAM (§2.1), pas par une promesse.

---

## 7. L7 — OBSERVABILITÉ (plan transversal)

| Élément | Configuration |
|---|---|
| Sources | Audit Logs GCP (Admin Activity partout ; Data Access sur SQL/BQ/Secret Manager), logs Cloud Run, verdicts Cloud Armor, journaux NAT et pare-feu (deny) |
| Sink F4 | Cloud Logging → BigQuery `siem.raw_logs`, **avec filtres d'exclusion** (health checks, 200 statiques) — première mesure d'économie |
| Monitoring | Uptime check `/api/health` (ELSON expose déjà l'endpoint) et `/healthz` (`ml-embed`, sonde interne) |
| Politiques d'alerte | 5xx > seuil ; latence p95 `ml-embed` ; échec du job d'enrichissement ; pic de deny Cloud Armor ; échec de connexion SQL |
| Runbooks | Un runbook par famille de technique ATT&CK, lié depuis le dashboard (`runbook_url`) — c'est ce lien qui « concrétise » le bloc runbooks du schéma initial |
| KPI dashboard | MTTD/MTTR, taux de consolidation, % détections sémantiques vs règles, taux `unmapped`, latence p95 ml-embed, version du modèle (doc ATT&CK-BERT §11.5) |

---

## 8. Pipeline DevSecOps (plan de livraison)

### Étapes et portes bloquantes

| # | Étape | Outil | Porte (le pipeline échoue si…) |
|---|---|---|---|
| 1 | Checkout + auth GCP | GitHub Actions + **WIF** | Identité fédérée refusée (dépôt/branche non autorisés) |
| 2 | Scan de secrets | **Gitleaks** | Tout secret détecté → échec immédiat |
| 3 | SAST | **Semgrep** (règles OWASP + règles python/TS) | Finding de sévérité `ERROR` |
| 4 | Build image | Docker (base épinglée par digest, via dépôt remote Artifact Registry) | Build non reproductible refusé (`npm ci` / lockfiles — leçon audit ELSON §9.6) |
| 5 | Scan image + dépendances | **Trivy** | CVE `CRITICAL` (ou `HIGH` non acquittée) |
| 6 | Push | **Artifact Registry** (registre unique, scan continu Artifact Analysis en second filet) | — |
| 7 | Déploiement | `gcloud run deploy … --image …@sha256:` | Déploiement par tag interdit |
| 8 | Boucle F6 | Export SARIF/JSON Trivy → table `siem.cve_findings` → encodage ATT&CK-BERT → jointure techniques observées 30 j | — (alimente la priorisation, ne bloque pas) |

### Pipeline infrastructure (F7) — le second pipeline

Même dépôt d'organisation, workflow distinct, même identité fédérée (WIF, SA dédié `sa-ci-infra` limité aux rôles de provisionnement) :

| # | Étape | Outil | Porte (échec si…) |
|---|---|---|---|
| 1 | `terraform fmt -check` + `terraform validate` | Terraform | Code non formaté / invalide |
| 2 | Scan de sécurité IaC | **Trivy** en mode `config` (réutilisation de l'outil existant — aucun outil ajouté) | Mauvaise configuration `CRITICAL`/`HIGH` (ex. : bucket public, SQL en IP publique, SA sur-privilégié) |
| 3 | `terraform plan` publié en commentaire de PR | Terraform | — (revue humaine du plan) |
| 4 | **Approbation manuelle** (environnement protégé GitHub) | GitHub Environments | Aucune approbation = aucun apply |
| 5 | `terraform apply` | Terraform | Écart entre plan approuvé et apply |

Deux principes : (a) **le plan est revu comme du code** — l'infrastructure ne change jamais sans diff lisible et approuvé ; (b) **l'apply est la seule voie d'écriture** vers GCP — un changement console est une dérive, détectée au plan suivant (test T15).

### Ce que le pipeline démontre
Trois refus visibles en démonstration : un secret commité (étape 2), une injection volontaire (étape 3), une image de base vulnérable (étape 5) — plus un quatrième côté infra : une ressource volontairement mal configurée (ex. bucket public) bloquée par le scan IaC. Un pipeline qui n'a jamais rien bloqué ne prouve rien — ces cas d'échec font partie du plan de tests (doc 04).

---

## 9. Durcissement transverse (récapitulatif)

| Domaine | Mesures |
|---|---|
| Images | Multi-stage, non-root, digest épinglé, un seul registre, poids ML vérifiés par empreinte au build |
| Identité | 1 SA/workload, 0 clé exportée, WIF, rôles minimaux, séparation détection/preuves |
| Réseau | 0 IP publique sur les données, ingress LB-only, egress allow-listé, deny journalisés |
| Données | Partitionnement + rétention, lecture seule pour le dashboard, seuils déclarés en SQL |
| Journalisation | Chaque inférence tracée (hash, score, version) ; audit logs sur les surfaces sensibles |

---

## 10. Infrastructure as Code — Terraform (standard de provisionnement)

### 10.1 Structure du dépôt

```
infra/
├── backend.tf            # état distant : bucket GCS dans menal-ops, un préfixe par environnement
├── providers.tf          # provider google épinglé (version exacte)
├── main.tf               # composition des modules
├── variables.tf
├── envs/
│   ├── dev.tfvars        # dimensionnement réduit · Armor en preview · pas de HA
│   ├── staging.tfvars    # iso-topologie prod, tailles réduites
│   └── prod.tfvars       # chaîne complète · rétention pleine · (HA/CMEK cible)
└── modules/
    ├── 00-foundation/    # APIs, politiques d'organisation, étiquettes
    ├── 01-edge/          # DNS, ALB, certificats, Cloud Armor (règles en code)
    ├── 02-identity/      # SAs, bindings IAM (matrice §2.1 traduite en code), Secret Manager, KMS, WIF
    ├── 03-workloads/     # services Cloud Run (module réutilisable `run-service`)
    ├── 04-network/       # VPC, subnets, PSA, NAT, pare-feu
    ├── 05-data/          # Cloud SQL, dataset/tables BigQuery, requêtes planifiées
    ├── 06-ml/            # ml-embed, enrich-job, Cloud Scheduler
    └── 07-observability/ # sink filtré, uptime checks, politiques d'alerte
```

Un module par couche : **le dépôt Terraform est le miroir exact du modèle L1–L7** — la documentation, le code et l'architecture racontent la même histoire, dans le même ordre.

### 10.2 État et sécurité de l'état
| Élément | Configuration | Raison |
|---|---|---|
| Backend | Bucket GCS dédié `tf-state-menal` **dans `menal-ops`**, un préfixe d'état par environnement (`env/dev`, `env/staging`, `env/prod`), versioning activé, `publicAccessPrevention`, UBLA | L'état contient la topologie complète : c'est une donnée sensible ; un état par environnement borne le rayon d'impact d'une erreur d'apply |
| Accès à l'état | Uniquement `sa-ci-infra` (pipeline F7) et l'administrateur | Moindre privilège appliqué à l'IaC elle-même |
| Verrouillage | Verrou natif du backend GCS | Évite les applies concurrents |
| Secrets | **Jamais de valeur de secret dans le code ni dans l'état** : Terraform crée les *conteneurs* Secret Manager ; les *valeurs* sont injectées hors IaC (versions ajoutées manuellement ou par script d'amorçage) | Un `terraform.tfstate` ne doit jamais devenir un coffre de secrets |

### 10.3 Frontière IaC / exploitation
| Va dans Terraform | Reste hors Terraform |
|---|---|
| Toute ressource GCP durable (réseau, IAM, SQL, BQ, Cloud Run, Armor, sinks, alertes) | Valeurs des secrets (versions Secret Manager) |
| Schémas des tables SIEM et requêtes planifiées | Données applicatives, contenu des tables |
| Politiques d'organisation, WIF | Actions de réponse à incident (`gcloud` ponctuel, tracé par l'audit log) |
| — | Déploiement des *images* applicatives (pipeline F3 : la révision Cloud Run est mise à jour par digest via `gcloud run deploy` ; Terraform ignore le champ image pour éviter la guerre d'états entre les deux pipelines — `lifecycle ignore_changes`) |

La dernière ligne est le point de couture classique entre les deux pipelines : **F7 possède le service, F3 possède l'image**. La documenter évite le conflit le plus fréquent des équipes qui découvrent Terraform + CI applicative.

### 10.4 Détection de dérive
`terraform plan` planifié (hebdomadaire ou avant chaque jalon) : un plan non vide sans commit correspondant = dérive → investigation (qui a modifié quoi : Cloud Audit Logs). C'est le test T15 du plan de tests.
