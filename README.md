# Plan de Travail — PFE

---

| | |
|---|---|
| **Étudiant** | Mansour HABIBOULLAH |
| **Établissement** | ESPRIT — Honoris United Universities |
| **Entreprise d'accueil** | MENAL-SARL, Nouakchott, Mauritanie |
| **Encadrant entreprise** | Houssein Ezzedine |
| **Date** | 12 mai 2026 |

---

## Titre du Projet

> **Conception d'une architecture cloud sécurisée Zero Trust avec approche DevSecOps**

---

## Résumé Exécutif

Ce projet consiste à concevoir et déployer une architecture cloud complète et sécurisée sur **Google Cloud Platform (GCP)** pour le compte de MENAL-SARL, entreprise IT émergente spécialisée dans le cloud et la cybersécurité.

La solution s'articule autour du modèle **Zero Trust** (aucune confiance par défaut, vérification systématique de chaque accès), enrichie d'une approche **DevSecOps** qui intègre la sécurité dès les premières étapes du développement. Elle comprend :

- Une **API REST sécurisée** (FastAPI v0.3.1) déployée sur Cloud Run, exposée via Load Balancer HTTPS (`api.menal-sarl.com`) protégé par Cloud Armor WAF
- Un **pipeline de traitement de données** automatisé (Cloud Workflow) alimentant BigQuery en logs de sécurité
- Un **tableau de bord de supervision** en temps réel (Next.js) déployé sur Cloud Run
- Un **pipeline CI/CD complet** (GitHub Actions) avec analyse SAST (Semgrep), scan Docker (Trivy), push vers Artifact Registry et Docker Hub

---

## Contexte & Problématique

### Contexte

MENAL-SARL est une entreprise IT en pleine croissance opérant dans un environnement où les cybermenaces sont en constante augmentation. L'entreprise a besoin de migrer vers une infrastructure cloud moderne, sécurisée et observable, capable de répondre aux exigences métier tout en garantissant la protection des données et la conformité aux standards de sécurité.

### Problématique

> **Comment une entreprise IT émergente comme MENAL-SARL peut-elle concevoir une architecture cloud sécurisée permettant de protéger ses données, contrôler les accès et superviser ses systèmes, tout en respectant les principes Zero Trust et DevSecOps ?**

---

## Objectifs du Projet

### Objectifs généraux

- Concevoir une architecture cloud scalable, sécurisée et observable sur GCP
- Implémenter le modèle Zero Trust pour éliminer toute confiance implicite
- Automatiser et sécuriser le cycle de développement via DevSecOps

### Objectifs spécifiques

- [x] Mettre en place un réseau cloud segmenté avec VPC, subnets et règles firewall (Terraform)
- [x] Implémenter une gestion des identités et accès robuste via GCP IAM (Service Accounts par environnement, Least Privilege)
- [x] Développer une API REST sécurisée avec FastAPI (v0.3.1, JWT RBAC, audit logging, 5 security headers)
- [x] Configurer une base de données Cloud SQL (PostgreSQL 15) sécurisée dans le subnet privé (Auth Proxy)
- [x] Construire un pipeline de traitement de données vers BigQuery (`menal-security-pipeline-dev`, dataset `menal_security_dev`)
- [x] Créer un dashboard de supervision en temps réel avec Next.js (déployé sur Cloud Run)
- [x] Containeriser tous les services avec Docker (multi-stage builds, push Artifact Registry + Docker Hub)
- [x] Configurer l'environnement de développement isolé (`menal-dev`) — environnements staging/prod en attente
- [x] Mettre en place une stratégie de tests complète (17 pytest, 3 fichiers Jest, 4 fichiers Playwright E2E)
- [x] Automatiser les déploiements avec CI/CD (GitHub Actions — `ci.yml` + `deploy.yml` + `deploy-dashboard.yml`)
- [x] Intégrer des scans de sécurité automatiques avec Semgrep SAST et Trivy (0 CVE critique)

---

## Architecture Globale

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE CLOUD PLATFORM                           │
│                         Projet : menal-dev                              │
│                         Région : europe-west1                           │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                          VPC : menal-vpc-dev                       │ │
│  │                                                                    │ │
│  │   ┌─────────────────────┐     ┌──────────────────────────────┐    │ │
│  │   │   SUBNET PUBLIC     │     │       SUBNET PRIVÉ           │    │ │
│  │   │                     │     │                              │    │ │
│  │   │  ┌───────────────┐  │     │  ┌────────────────────────┐ │    │ │
│  │   │  │ Cloud Run     │  │◄────┼─►│   API FastAPI v0.3.1   │ │    │ │
│  │   │  │ (Dashboard)   │  │     │  │   (Cloud Run)          │ │    │ │
│  │   │  │  Next.js 14   │  │     │  └────────┬──────┬────────┘ │    │ │
│  │   │  └───────────────┘  │     │           │      │          │    │ │
│  │   │                     │     │  ┌────────▼──┐ ┌─▼───────┐  │    │ │
│  │   │  ┌───────────────┐  │     │  │ Cloud SQL │ │BigQuery │  │    │ │
│  │   │  │ Load Balancer │  │     │  │ PostgreSQL│ │menal_   │  │    │ │
│  │   │  │ IP:8.232.239  │  │     │  │    15    │ │security │  │    │ │
│  │   │  │ .114 (HTTPS)  │  │     │  └──────────┘ │  _dev   │  │    │ │
│  │   │  └───────┬───────┘  │     │               └─────────┘  │    │ │
│  │   │          │          │     │                              │    │ │
│  │   │  ┌───────▼───────┐  │     │  ┌────────────────────────┐ │    │ │
│  │   │  │ Cloud Armor   │  │     │  │  Secret Manager        │ │    │ │
│  │   │  │ WAF (7 règles)│  │     │  │  (JWT, DB credentials) │ │    │ │
│  │   │  └───────────────┘  │     │  └────────────────────────┘ │    │ │
│  │   └─────────────────────┘     └──────────────────────────────┘    │ │
│  │                                                                    │ │
│  │   ┌──────────────────────────────────────────────────────────┐    │ │
│  │   │               COUCHE SÉCURITÉ ZERO TRUST                 │    │ │
│  │   │  GCP IAM │ KMS (menal-keyring-dev) │ Cloud Armor │ JWT   │    │ │
│  │   └──────────────────────────────────────────────────────────┘    │ │
│  │                                                                    │ │
│  │   ┌──────────────────────────────────────────────────────────┐    │ │
│  │   │               OBSERVABILITÉ & MONITORING                 │    │ │
│  │   │   GCP Logging (3 sinks) │ Cloud Monitoring (4 alertes)   │    │ │
│  │   │   Cloud Workflow (pipeline horaire) │ Dashboard Next.js  │    │ │
│  │   └──────────────────────────────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                   PIPELINE DevSecOps                             │  │
│   │  GitHub → GitHub Actions → Semgrep SAST → Trivy →              │  │
│   │  Artifact Registry + Docker Hub → Cloud Run (Deploy)            │  │
│   └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Description des couches

| Couche | Rôle | Composants GCP |
|--------|------|----------------|
| **Réseau** | Isolation et segmentation du trafic | VPC `menal-vpc-dev`, Subnets, Firewall Rules, Cloud NAT |
| **Sécurité périmétrique** | Protection contre les attaques externes | Cloud Armor WAF (6 règles anti-DDoS, OWASP Top 10) |
| **Sécurité identité** | Contrôle des accès et chiffrement | IAM, KMS `menal-keyring-dev`, JWT RBAC, Secret Manager |
| **Calcul** | Exécution des services applicatifs | Cloud Run (API + Dashboard), Cloud Workflow |
| **Base de données** | Stockage des données métier | Cloud SQL PostgreSQL 15 (subnet privé, Auth Proxy) |
| **Données analytiques** | Stockage et traitement des logs/événements | BigQuery dataset `menal_security_dev` |
| **Observabilité** | Supervision et alertes | GCP Logging (3 sinks), Cloud Monitoring (4 alertes) |
| **CI/CD** | Automatisation et déploiement sécurisé | GitHub Actions, Artifact Registry, Docker Hub |

---

## Fonctionnalités Détaillées

---

### Module 1 — Infrastructure Cloud Sécurisée

**Objectif :** Concevoir une infrastructure réseau cloud isolée, segmentée et protégée.

#### Composants techniques

| Composant | Description | État |
|-----------|-------------|------|
| **VPC `menal-vpc-dev`** | Réseau privé dédié isolant tous les services du projet | ✅ Déployé |
| **Subnet Public** | Héberge Load Balancer et trafic entrant | ✅ Déployé |
| **Subnet Privé `subnet-private-dev`** | Héberge API, Cloud SQL, pipelines | ✅ Déployé |
| **Règles Firewall** | Contrôle strict du trafic entrant/sortant | ✅ Déployé |
| **Cloud NAT** | Accès Internet sortant sans exposition directe | ✅ Déployé |
| **Cloud Armor WAF** | 7 règles (rate-limit + 5 blocs OWASP + allow), protection OWASP Top 10 | ✅ Déployé |

#### Flux de données réel

```
Internet
    │
    ▼
Cloud Armor WAF (IP 8.232.239.114) — filtre attaques DDoS + OWASP
    │
    ▼
Load Balancer HTTPS → api.menal-sarl.com (TLS terminé ici)
    │
    ▼
API FastAPI (Cloud Run, subnet privé, --ingress=internal-and-cloud-load-balancing)
    ├── Cloud SQL PostgreSQL 15 (données métier : users, roles, api_keys, audit_logs)
    └── BigQuery menal_security_dev (logs analytiques via Cloud Workflow)
```

#### Haute disponibilité & Scalabilité

| Composant | Stratégie HA/Scalabilité | Configuration réelle |
|-----------|--------------------------|---------------------|
| **Cloud Run (API)** | Auto-scaling horizontal | `--min-instances=1 --max-instances=5` |
| **Cloud Run (Dashboard)** | Auto-scaling horizontal | `--min-instances=0 --max-instances=3` |
| **Cloud SQL** | Instance managée GCP | PostgreSQL 15, backups 7 jours |
| **BigQuery** | Natif multi-zone | Dataset `menal_security_dev` en EU |
| **Cloud Load Balancer** | Health checks actifs | IP statique `8.232.239.114` |

---

### Module 2 — Modèle Zero Trust

**Objectif :** Appliquer le principe "ne jamais faire confiance, toujours vérifier" à chaque accès au système.

#### Principes Zero Trust appliqués

| Principe | Implémentation réelle |
|----------|----------------------|
| **Identité vérifiée** | Token JWT signé (PyJWT 2.9.0) validé à chaque requête |
| **Accès minimal** | RBAC — 3 rôles : Admin, Viewer, Service (Least Privilege) |
| **Vérification continue** | Middleware FastAPI valide JWT + rôle sur chaque endpoint |
| **Segmentation micro** | API dans subnet privé — pas d'accès direct (ingress LB uniquement) |
| **Chiffrement bout-en-bout** | TLS 1.3 (LB → client), KMS `menal-keyring-dev` (données au repos) |
| **Protection périmétrique** | Cloud Armor WAF bloque DDoS, SQLi, XSS, path traversal |
| **Audit systématique** | Chaque requête API → enregistrée dans `audit_logs` (Cloud SQL) |

#### Flux d'authentification Zero Trust réel

```
Utilisateur (browser / API client)
    │
    ▼
Cloud Armor WAF — vérification IP, rate limiting, OWASP rules
    │
    ▼
Load Balancer HTTPS (api.menal-sarl.com) — TLS 1.3 terminé ici
    │
    ▼
API FastAPI (Cloud Run, subnet privé)
    │
    ├── POST /auth/token → vérification email+password (bcrypt) → JWT émis (1h)
    │
    └── Toute autre requête :
            │
            ├── Middleware audit_and_security : extrait JWT du header Authorization
            ├── decode_token() : valide signature + expiration (PyJWT 2.9.0)
            ├── get_current_user() : charge utilisateur depuis Cloud SQL
            ├── RBAC : vérifie rôle requis (Admin/Viewer/Service)
            ├── Traitement de la requête
            └── Audit log → Cloud SQL audit_logs (user_id, action, path, status_code, ip)
```

#### Scénarios Zero Trust testés et validés

| Test | Résultat attendu | Résultat obtenu |
|------|-----------------|-----------------|
| Requête sans token JWT | `401 Unauthorized` | ✅ |
| Token JWT expiré | `401 Unauthorized` | ✅ |
| Rôle insuffisant (Viewer → Admin route) | `403 Forbidden` | ✅ |
| Rate limit dépassé (> 200 req/min) | `429 Too Many Requests` | ✅ |
| IP non autorisée (Cloud Armor) | Bloqué en amont | ✅ |
| Scan .env / .git (attaque réelle détectée) | `404` loggé en audit | ✅ |

---

### Module 3 — Pipeline de Données

**Objectif :** Automatiser la collecte, le traitement et le stockage sécurisé des logs et événements système.

#### Architecture du pipeline réelle

```
Sources de logs
    │
    ├── API FastAPI → middleware → Cloud SQL audit_logs (temps réel)
    ├── Cloud Run → GCP Logging → Log Sink → BigQuery run_googleapis_com_requests
    ├── Cloud SQL → GCP Logging → Log Sink → BigQuery cloudaudit_googleapis_com_activity
    └── VPC → GCP Logging → Log Sink → BigQuery (flow logs)
    │
    ▼
Cloud Workflow : menal-security-pipeline-dev (exécution horaire via Cloud Scheduler)
    │
    ├── Étape 1 : Collecte depuis run_googleapis_com_requests → INSERT INTO access_logs
    ├── Étape 2 : Agrégation métriques horaires → INSERT INTO api_metrics
    └── Étape 3 : Détection anomalies (status >= 400) → INSERT INTO security_events
    │
    ▼
BigQuery dataset menal_security_dev
    ├── access_logs          — logs d'accès normalisés
    ├── security_events      — anomalies et alertes
    ├── api_metrics          — métriques agrégées par heure
    └── run_googleapis_com_requests — logs bruts Cloud Run (3 438+ entrées)
    │
    ▼
Dashboard Next.js + Cloud Monitoring (4 alertes configurées)
```

#### Tables BigQuery

| Table | Description | Données |
|-------|-------------|---------|
| `access_logs` | Logs d'accès API normalisés | timestamp, method, path, status_code, ip_address, latency_ms |
| `security_events` | Anomalies détectées (auth failures, rate limit) | timestamp, event_type, severity, source_ip, description |
| `api_metrics` | Métriques agrégées par heure | hour, total_requests, success_count, error_count, auth_failures |
| `run_googleapis_com_requests` | Logs bruts Cloud Run (sink GCP Logging) | 3 438+ entrées (données réelles) |

#### Alertes Cloud Monitoring

| Alerte | Condition | Sévérité |
|--------|-----------|---------|
| `menal-alert-error-rate` | Taux d'erreur 5xx > seuil | CRITICAL |
| `menal-alert-latency` | Latence P99 > 2s | WARNING |
| `menal-alert-auth-failures` | Échecs auth > seuil | WARNING |
| `menal-alert-sql-cpu` | CPU Cloud SQL > 80% | WARNING |

---

### Module 4 — API Sécurisée

**Objectif :** Exposer les services métier via une API REST robuste, sécurisée et résiliente.

**Technologie :** Python 3.12 / FastAPI — version `0.3.1` — déployée sur Cloud Run (`menal-api-dev`)
**URL de production :** `https://api.menal-sarl.com` (via Load Balancer + Cloud Armor)

#### Endpoints réels

| Endpoint | Méthode | Description | Accès requis |
|----------|---------|-------------|--------------|
| `/auth/token` | POST | Génération de token JWT (1h) | Public |
| `/health` | GET | Statut API + version | Public |
| `/` | GET | Message racine | Public |
| `/logs` | GET | Récupération audit logs (Cloud SQL) | Admin |
| `/logs/{id}` | GET | Détail d'un événement | Admin |
| `/alerts` | GET | Liste des alertes actives | Admin, Viewer |
| `/users` | GET | Liste des utilisateurs | Admin |
| `/users/{id}` | GET/PUT/DELETE | Gestion d'un utilisateur | Admin |

#### Mécanismes de sécurité

| Mécanisme | Description | Implémentation |
|-----------|-------------|----------------|
| **JWT (PyJWT 2.9.0)** | Token signé HS256, expiration 1h | `app/auth/jwt.py` |
| **RBAC** | Rôles Admin, Viewer, Service | `app/auth/dependencies.py` |
| **Rate Limiting** | 200 requêtes/minute par IP | `slowapi` dans `main.py` |
| **Validation Pydantic** | Filtrage strict de toutes les entrées | Modèles dans `app/schemas/` |
| **Audit Logging** | Chaque requête → `audit_logs` (Cloud SQL) | Middleware dans `main.py` |
| **bcrypt** | Hachage des mots de passe (direct, sans passlib) | `bcrypt.checkpw/hashpw/gensalt` |
| **5 Security Headers** | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `HSTS`, `Referrer-Policy` | Middleware dans `main.py` |
| **Cloud SQL Auth Proxy** | Connexion sécurisée sans IP publique | `--add-cloudsql-instances` Cloud Run |
| **Secret Manager** | Secrets (JWT_SECRET, DB_PASSWORD) injectés à runtime | `--set-secrets` Cloud Run |

---

### Module 5 — Base de Données (Cloud SQL — PostgreSQL)

**Objectif :** Stocker et gérer les données métier de l'application de manière sécurisée et performante.

**Technologie :** Cloud SQL PostgreSQL 15 — instance managée dans le subnet privé `subnet-private-dev`

#### Schéma des tables réelles

```
┌─────────────────────┐       ┌──────────────────────┐
│       users         │       │        roles         │
├─────────────────────┤       ├──────────────────────┤
│ id          UUID PK │◄──┐   │ id         UUID PK   │
│ email       TEXT    │   │   │ name       TEXT       │
│ password    TEXT    │   │   │ permissions JSONB     │
│ role_id     FK      │───┘   │ created_at TIMESTAMP  │
│ is_active   BOOL    │       └──────────────────────┘
│ created_at  TS      │
│ last_login  TS      │       ┌──────────────────────────┐
└─────────────────────┘       │       audit_logs         │
                              ├──────────────────────────┤
┌─────────────────────┐       │ id          UUID PK      │
│    api_keys         │       │ user_id     FK (nullable) │
├─────────────────────┤       │ action      TEXT (method) │
│ id          UUID PK │       │ resource    TEXT (path)   │
│ user_id     FK      │       │ ip_address  TEXT          │
│ key_hash    TEXT    │       │ user_agent  TEXT          │
│ expires_at  TS      │       │ status_code INTEGER       │
│ is_active   BOOL    │       │ timestamp   TIMESTAMP     │
└─────────────────────┘       └──────────────────────────┘
```

#### Sécurité de la base de données

| Mesure | Détail |
|--------|--------|
| **Accès réseau** | Pas d'IP publique — accessible uniquement depuis le subnet privé |
| **Authentification** | Cloud SQL Auth Proxy + Service Account `sa-api@menal-dev.iam.gserviceaccount.com` |
| **Chiffrement au repos** | KMS `menal-keyring-dev` (keyring dédié, rotation automatique 90 jours) |
| **Chiffrement en transit** | TLS obligatoire pour toutes les connexions |
| **Backups automatiques** | Sauvegardes quotidiennes avec rétention 7 jours |
| **Secrets** | `DB_PASSWORD` stocké dans Secret Manager, injecté à runtime sur Cloud Run |

#### Connexion API → Base de données

```
API FastAPI (Cloud Run, subnet privé)
    │
    ├── Cloud SQL Auth Proxy (sidecar intégré Cloud Run)
    │       └── Authentification via Service Account IAM (sans mot de passe réseau)
    │
    ▼
Cloud SQL PostgreSQL 15 (subnet privé, pas d'IP publique)
    └── Connexion : unix socket via /cloudsql/menal-dev:europe-west1:menal-sql-dev
```

#### ORM & Migrations

| Outil | Usage |
|-------|-------|
| **SQLAlchemy** | ORM Python — modèles dans `app/models/` |
| **Alembic** | Migrations versionnées dans Git (`alembic/versions/`) |
| **Pydantic** | Validation et sérialisation des données |

---

### Module 6 — Interface de Supervision

**Objectif :** Offrir un tableau de bord web temps réel pour visualiser l'état de sécurité du système.

**Technologie :** Next.js 14 (App Router, TypeScript, Tailwind CSS, recharts)
**URL de production :** `https://menal-dashboard-dev-5j4ih577pq-ew.a.run.app`

#### Fonctionnalités implémentées

| Fonctionnalité | Description | État |
|----------------|-------------|------|
| **Page Login** | Authentification via `/api/login` → token JWT stocké en cookie httpOnly | ✅ |
| **Vue d'ensemble** | Statistiques globales : total requêtes, erreurs 4xx, événements sécurité | ✅ |
| **Logs** | Tableau paginé des `audit_logs` avec méthode HTTP, path, status, IP | ✅ |
| **Alertes** | Liste des alertes de sécurité par sévérité (HIGH/MEDIUM/LOW) | ✅ |
| **Graphiques** | Visualisation recharts (distribution statuts, tendances) | ✅ |
| **Middleware auth** | Protection de toutes les routes (sauf `/api/` et assets) | ✅ |

#### Architecture frontend sécurisée

```
Browser (utilisateur)
    │
    ├── POST /api/login (Next.js Route Handler)
    │       └── Appel à https://api.menal-sarl.com/auth/token
    │           → Token JWT reçu → stocké en cookie httpOnly secure
    │
    └── Requêtes pages (SSR/Client)
            ├── Middleware Next.js vérifie cookie token (exclut /api/)
            └── Fetch https://api.menal-sarl.com/* avec Authorization: Bearer {token}
```

#### Bug critique résolu (middleware.ts)

Problème identifié et corrigé : le matcher Next.js interceptait `POST /api/login` et le redirigait en 307 vers `/login` (boucle infinie silencieuse).

**Correction :** Ajout de `api/` dans l'exclusion du matcher :
```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
```

---

### Module 7 — Pipeline DevSecOps

**Objectif :** Automatiser et sécuriser l'ensemble du cycle de développement logiciel.

#### Flux CI/CD complet réel

```
Développeur
    │
    ├── git push → GitHub (branche develop ou main)
    │
    ▼
GitHub Actions déclenché automatiquement
    │
    ├── ci.yml (CI — sur toute PR)
    │   ├── Étape 1 : Tests unitaires pytest (17 tests, coverage > 80%)
    │   ├── Étape 2 : Tests unitaires Jest (3 fichiers composants)
    │   ├── Étape 3 : Analyse SAST Semgrep (patterns sécurité Python + JS)
    │   ├── Étape 4 : Build image Docker (multi-stage)
    │   └── Étape 5 : Scan Trivy v0.36.0 (0 CVE critique — PyJWT 2.9.0)
    │
    └── deploy.yml / deploy-dashboard.yml (CD — sur push develop/main)
        ├── Authentification GCP (Service Account via secret GCP_SA_KEY)
        ├── Build image Docker + tag SHA court (ex: sha-a1b2c3d)
        ├── Push → Artifact Registry (europe-west1-docker.pkg.dev/menal-dev/menal-docker-dev)
        ├── Push → Docker Hub (mo35ehab/menal-api:latest, mo35ehab/menal-dashboard:latest)
        ├── Déploiement Cloud Run (--set-secrets, --add-cloudsql-instances, --vpc-egress)
        └── Vérification santé via https://api.menal-sarl.com/health (12 tentatives × 10s)
```

#### Containerisation (Docker)

Tous les services sont packagés en images Docker **multi-stage** pour minimiser la surface d'attaque.

**Structure Dockerfile (API FastAPI) :**
```dockerfile
# Stage 1 — Build
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2 — Production (image minimale)
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY . .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

| Bonne pratique | Justification |
|----------------|---------------|
| Multi-stage build | Image finale légère (pas d'outils de build dans l'image prod) |
| `python:3.12-slim` | Image de base minimale, moins de surface d'attaque |
| Scan Trivy v0.36.0 | 0 CVE critique validé à chaque build |
| Tag SHA court | Traçabilité — chaque déploiement est lié à un commit Git précis |

**Registre des images :**
- Google Artifact Registry : `europe-west1-docker.pkg.dev/menal-dev/menal-docker-dev/api`
- Docker Hub : `mo35ehab/menal-api:latest` et `mo35ehab/menal-dashboard:latest`

#### Script de déploiement d'urgence

`scripts/hotfix.sh` — permet un déploiement direct en ~2 minutes sans passer par GitHub Actions :

```bash
bash scripts/hotfix.sh api        # reconstruit et redéploie l'API
bash scripts/hotfix.sh dashboard  # reconstruit et redéploie le dashboard
```

Fonctionnement : build local → push Docker Hub + Artifact Registry → `gcloud run deploy`.

#### Gestion des environnements

```
GitHub Branch Strategy
│
├── feature/*  → Développement local (pas de déploiement auto)
├── develop    → Environnement Dev (menal-dev) — déploiement automatique
└── main       → Environnement Prod (menal-prod) — à configurer
```

| Environnement | Projet GCP | État |
|---------------|-----------|------|
| **Dev** | `menal-dev` | ✅ Actif et fonctionnel |
| **Staging** | `menal-staging` | ⏳ Projet créé, déploiement à configurer |
| **Production** | `menal-prod` | ⏳ Projet créé, déploiement à configurer |

#### Gestion des secrets

| Secret | Stockage | Accès |
|--------|----------|-------|
| `jwt-secret-dev` | GCP Secret Manager | Cloud Run uniquement (`--set-secrets`) |
| `db-password-dev` | GCP Secret Manager | Cloud Run uniquement (`--set-secrets`) |
| `GCP_SA_KEY` | GitHub Secrets | GitHub Actions uniquement |
| `DOCKERHUB_USERNAME` | GitHub Secrets | GitHub Actions uniquement |
| `DOCKERHUB_TOKEN` | GitHub Secrets | GitHub Actions uniquement |
| Clés de chiffrement | GCP KMS `menal-keyring-dev` | Contrôlé par IAM, rotation 90 jours |

---

### Module 8 — Stratégie de Tests

**Objectif :** Garantir la qualité, la sécurité et la fiabilité du code à chaque étape du pipeline.

#### Pyramide de tests

```
        ┌─────────────────┐
        │   Tests E2E     │  ← Playwright (4 fichiers : auth, overview, logs, alerts)
        │   (5%)          │     Scénarios utilisateur complets sur le dashboard
        ├─────────────────┤
        │  Tests Unitaires│  ← pytest (FastAPI) / Jest (Next.js)
        │  Frontend (15%) │     3 fichiers Jest : StatsCard, middleware, alertsSeverity
        ├─────────────────┤
        │  Tests Unitaires│  ← pytest — 17 tests, coverage > 80%
        │   API (80%)     │     Endpoints, JWT, RBAC, health check
        └─────────────────┘
```

#### Tests par couche

| Type | Outil | Ce qui est testé | Résultat |
|------|-------|------------------|---------|
| **Unitaires API** | pytest | Endpoints, JWT, RBAC, health, version | ✅ 17 tests, coverage > 80% |
| **Unitaires Frontend** | Jest + Testing Library | StatsCard, middleware auth, alertsSeverity | ✅ 3 fichiers |
| **Sécurité SAST** | Semgrep | Analyse statique Python + JavaScript | ✅ 0 vulnérabilité critique |
| **Sécurité image** | Trivy v0.36.0 | CVE dans dépendances + OS de l'image | ✅ 0 CVE critique |
| **E2E** | Playwright | Authentification, overview, logs, alertes | ✅ 4 fichiers |

#### Tests de sécurité spécifiques Zero Trust

| Test | Scénario vérifié | Résultat |
|------|-----------------|---------|
| Accès sans token | L'API renvoie `401 Unauthorized` | ✅ |
| Token expiré | L'API renvoie `401` et refuse la requête | ✅ |
| Rôle insuffisant | L'API renvoie `403 Forbidden` | ✅ |
| Injection SQL | Requêtes malformées bloquées par validation Pydantic | ✅ |
| Rate limit dépassé | L'API renvoie `429 Too Many Requests` (> 200 req/min) | ✅ |

#### Intégration dans le pipeline CI/CD

```
git push
    │
    ├── Tests unitaires pytest (17 tests)   → bloque si coverage < 80%
    ├── Tests unitaires Jest (3 fichiers)   → bloque si échec
    ├── Analyse Semgrep SAST                → bloque si vulnérabilité critique
    ├── Build Docker (multi-stage)
    ├── Scan Trivy v0.36.0                  → bloque si CVE critique
    └── Déploiement Cloud Run
            └── Tests E2E Playwright        → alerte si échec
```

---

## Stack Technologique

### Par couche

| Couche | Technologie | Usage | État |
|--------|-------------|-------|------|
| **Infrastructure** | Terraform | Infrastructure as Code — provisionnement GCP | ✅ |
| **Cloud** | Google Cloud Platform | Plateforme d'hébergement principale | ✅ |
| **Réseau** | GCP VPC, Firewall, Cloud NAT | Segmentation et sécurité réseau | ✅ |
| **Protection périmétrique** | Cloud Armor WAF | 7 règles (rate-limit + 5 blocs OWASP + allow) | ✅ |
| **Identité** | GCP IAM, JWT RBAC | Gestion des accès Zero Trust | ✅ |
| **Chiffrement** | GCP KMS `menal-keyring-dev`, TLS 1.3 | Chiffrement données et communications | ✅ |
| **Secrets** | GCP Secret Manager | Stockage sécurisé des credentials | ✅ |
| **Conteneurisation** | Docker (multi-stage) | Packaging des services pour Cloud Run | ✅ |
| **Registre images** | Artifact Registry + Docker Hub | Stockage images versionnées | ✅ |
| **Calcul** | Cloud Run (auto-scaling) | API (min 1 / max 5) + Dashboard (min 0 / max 3) | ✅ |
| **Orchestration pipeline** | Cloud Workflow | Pipeline de traitement des logs (horaire) | ✅ |
| **Backend API** | Python 3.12 / FastAPI v0.3.1 | API REST sécurisée | ✅ |
| **Authentification** | PyJWT 2.9.0, bcrypt | JWT + hachage mots de passe | ✅ |
| **Base de données métier** | Cloud SQL PostgreSQL 15 | Utilisateurs, rôles, api_keys, audit_logs | ✅ |
| **Base analytique** | BigQuery `menal_security_dev` | Logs access, security events, métriques | ✅ |
| **ORM / Migrations** | SQLAlchemy + Alembic | Modèles Python et migrations versionnées | ✅ |
| **Frontend** | Next.js 14 (App Router, TypeScript, Tailwind) | Interface de supervision | ✅ |
| **Graphiques** | recharts | Visualisations temps réel | ✅ |
| **Observabilité** | GCP Logging (3 sinks), Cloud Monitoring (4 alertes) | Logs et métriques | ✅ |
| **CI/CD** | GitHub Actions | Pipeline DevSecOps complet | ✅ |
| **SAST** | Semgrep | Analyse statique sécurité (Python + JS) | ✅ |
| **Tests API** | pytest (17 tests, > 80% coverage) | Tests unitaires backend | ✅ |
| **Tests Frontend** | Jest (3 fichiers) | Tests unitaires composants | ✅ |
| **Tests E2E** | Playwright (4 fichiers) | Scénarios complets dashboard | ✅ |
| **Sécurité image** | Trivy v0.36.0 | Scan CVE images Docker | ✅ |
| **Versioning** | Git, GitHub | Gestion du code source | ✅ |

---

## Livrables Attendus

| # | Livrable | Description | État |
|---|----------|-------------|------|
| 1 | **Infrastructure Terraform** | VPC, subnets, Cloud SQL, Artifact Registry, IAM, Cloud NAT, Load Balancer | ✅ Livré |
| 2 | **API FastAPI v0.3.1** | JWT RBAC, audit logging, rate limiting, 5 security headers, Swagger | ✅ Livré |
| 3 | **Base de données Cloud SQL** | PostgreSQL 15, schéma versionné Alembic, backups 7j, Auth Proxy | ✅ Livré |
| 4 | **Pipeline BigQuery** | Cloud Workflow `menal-security-pipeline-dev`, 4 tables, 3 log sinks | ✅ Livré |
| 5 | **Dashboard Next.js** | Auth JWT, pages logs/alertes/overview, recharts, middleware sécurisé | ✅ Livré |
| 6 | **Pipeline CI/CD** | GitHub Actions — ci.yml + deploy.yml + deploy-dashboard.yml | ✅ Livré |
| 7 | **Suite de tests** | 17 pytest + 3 Jest + 4 Playwright E2E + Semgrep SAST + Trivy | ✅ Livré |
| 8 | **Documentation technique** | `documentation-technique.md` — architecture, déploiement, troubleshooting | ✅ Livré |
| 9 | **Rapport de sécurité** | `rapport-securite.md` — Trivy 0 CVE, Semgrep 0 vulnérabilité, audit Zero Trust complet | ✅ Livré |

---

## État de Production (13 juin 2026)

| Composant | URL / Identifiant | Statut |
|-----------|------------------|--------|
| **API FastAPI** | `https://api.menal-sarl.com/health` | ✅ Opérationnel |
| **Load Balancer** | IP `8.232.239.114`, domaine `api.menal-sarl.com` | ✅ Opérationnel |
| **Cloud Armor WAF** | 7 règles actives | ✅ Opérationnel |
| **Dashboard** | `https://menal-dashboard-dev-5j4ih577pq-ew.a.run.app` | ✅ Opérationnel |
| **Cloud SQL** | `menal-dev:europe-west1:menal-sql-dev` | ✅ Opérationnel |
| **BigQuery** | Dataset `menal-dev.menal_security_dev` | ✅ 3 438+ entrées |
| **Audit Logs** | Table `audit_logs` Cloud SQL | ✅ 100+ entrées (dont attaque réelle détectée) |
| **Docker Hub API** | `mo35ehab/menal-api:latest` | ✅ Publié |
| **Docker Hub Dashboard** | `mo35ehab/menal-dashboard:latest` | ✅ Publié |
| **KMS** | Keyring `menal-keyring-dev`, rotation 90j | ✅ Opérationnel |
| **Secret Manager** | `jwt-secret-dev`, `db-password-dev` | ✅ Opérationnel |
| **Cloud Workflow** | `menal-security-pipeline-dev` | ✅ Opérationnel (révision 000002-4cd, 7.9s) |

---

## Entreprise & Encadrement

### Entreprise d'accueil

| | |
|---|---|
| **Nom** | MENAL-SARL |
| **Adresse** | Avenue Cheikh Bouddah Ould El Bousseiry 741, Nouakchott, Mauritanie |
| **Secteur** | Technologies de l'Information |
| **E-Mail** | ahmed.kherchi@menal-sarl.com |
| **Téléphone** | +222 38 13 84 29 |

### Encadrant entreprise

| | |
|---|---|
| **Nom** | Houssein Ezzedine |
| **E-Mail** | ezzedine.houssein@menal-sarl.com |
| **Téléphone** | +222 37 22 06 22 |

---
