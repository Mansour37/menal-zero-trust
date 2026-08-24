# Architecture MENAL — Socle d'hébergement GCP Zero Trust

**Projet : PFE — Hébergement et sécurisation Zero Trust des applications MENAL (application pilote : ELSON, deuxième tenant : Elson)**
**État au 19/08/2026**

> Ce document consolide et remplace `00_CAHIER_DES_CHARGES_MENAL.md`, `03_CAS_UTILISATION.md`,
> `01_HLD_MENAL.md`, `02_LLD_MENAL.md`, `ATTACK-BERT_Integration_SIEM_ZeroTrust.md` (état au
> 19/08/2026). Il décrit l'architecture **réellement déployée**, vérifiée contre le Terraform et
> le code applicatif au moment de la rédaction — pas une cible. Les cinq documents sources
> restent dans le dépôt pour traçabilité historique mais ne doivent plus être considérés comme
> référence à jour. Les écarts entre la conception initiale (juillet 2026) et l'état réel,
> identifiés par deux audits croisés (`10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` et
> `11_AUDIT_EXPERTS_SIGMA_RESEAU_IAM_MFA_2026-08-18.md`), sont intégrés directement dans le texte
> ci-dessous plutôt que renvoyés en annexe : chaque affirmation technique reflète le code lu au
> 19/08/2026, avec la mention explicite « correctif en cours de déploiement le 19/08 » lorsque
> c'est le cas.

---

## 1. Contexte et objectifs

### 1.1 Pourquoi ce projet

MENAL héberge et opère des applications pour des clients tiers. La première application
hébergée, **ELSON** (plateforme éducative de crowdsourcing vocal), a fait l'objet d'un audit de
sécurité préalable qui a mis en évidence une dette technique caractéristique d'un environnement
construit sans socle commun : secrets mal gérés, environnement non reproductible, pas de
séparation d'identité par service, pas de détection. Plutôt que de corriger ELSON application par
application, le projet construit un **socle d'hébergement générique**, sur lequel ELSON est
branchée comme premier cas réel, avant l'onboarding d'applications supplémentaires — **Elson**
(organisation distincte, à ne pas confondre avec l'application ELSON) est la deuxième
organisation onboardée sur le socle, en environnement `staging`, depuis le 07/08/2026.

Le projet est mené dans le cadre d'un **Projet de Fin d'Études** : un stagiaire, un calendrier de
quelques semaines, une soutenance devant jury académique et un commanditaire (MENAL). Cette double
contrainte (rigueur professionnelle + soutenabilité par une seule personne dans un temps court)
structure toutes les décisions de périmètre ci-dessous.

### 1.2 Objectif principal

Concevoir, implémenter et démontrer un **socle d'hébergement GCP Zero Trust** (NIST SP 800-207)
avec une chaîne de livraison **DevSecOps** de bout en bout, capable d'héberger plusieurs
applications clientes de façon isolée et supervisée par un SIEM léger.

### 1.3 Objectifs dérivés et mesure de succès

| # | Objectif | Mesure de succès | État réel au 19/08 |
|---|---|---|---|
| O1 | Zero Trust matérialisé, pas déclaré | Chaque principe NIST 800-207 rattaché à un contrôle vérifiable | Tenu pour l'edge/l'identité ; segmentation réseau est-ouest encore insuffisante (§4.3) |
| O2 | Chaîne de livraison sécurisée | Pipeline CI/CD bloquant sur secret commité, faille SAST, CVE critique | Tenu, CI verte confirmée sur menal et Elson |
| O3 | Détection utile, pas décorative | SIEM opérationnel (règles + enrichissement ML), rattachement MITRE ATT&CK | Règles opérationnelles ; le rattachement ML reste **informationnel**, non joint au scoring (§5.4) |
| O4 | Socle réutilisable multi-application | Une deuxième application onboardée sans dupliquer l'infrastructure de base | Tenu comme preuve vivante (Elson, staging) ; isolation **applicative** seulement, pas réseau (§4.3) |
| O5 | Reproductibilité totale | 100 % de l'infrastructure en Terraform, environnement reconstructible | Tenu sur le fond ; garantie de version de provider incomplète (`.terraform.lock.hcl` gitignoré) |
| O6 | Valeur pédagogique | Soutenance capable de dérouler 6 preuves techniques en 15 minutes | Visé |

### 1.4 Ce que ce projet n'essaie pas de prouver

Le projet **n'a pas** pour objectif la haute disponibilité multi-région, la scalabilité massive,
ni la conformité réglementaire complète (RGPD, hébergement de données de santé). Ces axes sont
traités en recommandation, pas en livrable. Sont également écartés par choix de conception
délibéré et documenté : VPC Service Controls, service mesh mTLS, cache distribué Memorystore,
Binary Authorization, Identity-Aware Proxy, réponse à incident pilotée par un LLM génératif
(non-déterminisme incompatible avec une chaîne de preuve).

### 1.5 Parties prenantes

| Partie prenante | Rôle | Attente principale |
|---|---|---|
| **MENAL** | Commanditaire du stage, opérateur final du socle | Un socle exploitable, onboardable pour de nouveaux clients après le PFE |
| **Stagiaire** | Conception, implémentation, exploitation, documentation | Un projet démontrable de bout en bout |
| **Encadrant académique / jury** | Évaluation | Une démarche d'ingénierie rigoureuse : besoin → conception → implémentation → écarts assumés → preuve |
| **ELSON** | Première application hébergée (code hors périmètre PFE) | Un hébergement plus sûr, sans réécriture de son code |
| **Organisation Elson (2ᵉ tenant)** | Deuxième organisation onboardée en `staging` | Isolation de ses données vis-à-vis de MENAL dans le SIEM et le dashboard partagés |

### 1.6 Périmètre

**Dans le périmètre :** socle GCP (edge, identité, workloads, réseau, données, ML,
observabilité) ; pipeline DevSecOps applicatif et infrastructure ; SIEM léger sur BigQuery
(ingestion, normalisation, règles de détection, enrichissement sémantique) ; dashboard de
supervision ; mécanisme d'onboarding d'une application cliente supplémentaire.

**Hors périmètre :** code interne des applications hébergées ; multi-région et reprise
d'activité inter-région ; mise à l'échelle massive (cache distribué, service mesh, Kubernetes) ;
conformité juridique complète ; détection/réponse pilotée par IA générative.

**Hypothèses structurantes :** trois environnements visés (dev/staging/prod) — **seuls dev et
staging existent réellement** à ce jour, prod est une cible non provisionnée ; une seule région
GCP (`europe-west1`) ; la sécurité n'est jamais un paramètre d'environnement.

### 1.7 Contraintes

- Fournisseur cloud imposé : GCP exclusivement. Plateforme d'exécution : Cloud Run serverless
  (pas de cluster Kubernetes à opérer).
- Provisionnement : Terraform exclusivement, aucune ressource créée manuellement en console.
- Projet porté par un seul stagiaire, calendrier PFE ~5-6 semaines de construction, suivi d'une
  phase d'exploitation, d'audit et de remédiation continue jusqu'à la soutenance.
- Budget de démonstration : instances minimales, scale-to-zero, environnements jetables.

### 1.8 Besoins fonctionnels de référence

| Réf. | Besoin |
|---|---|
| BF-01 | Authentifier et autoriser les utilisateurs du dashboard et de l'API par rôle (JWT-RBAC + MFA TOTP) |
| BF-02 | Héberger une application cliente tierce de façon isolée (identité, secrets, base de données dédiés) |
| BF-03 | Filtrer le trafic entrant en périphérie (WAF, anti-bruteforce, restriction géographique) |
| BF-04 | Collecter et normaliser les journaux de sécurité dans un entrepôt central |
| BF-05 | Détecter des comportements suspects par règles déclaratives |
| BF-06 | Enrichir sémantiquement les événements et les rattacher au référentiel MITRE ATT&CK — **état réel : l'enrichissement est produit mais non joint au scoring d'incident** (§5.4) |
| BF-07 | Présenter aux analystes une vue de supervision (incidents, détections, couverture ATT&CK, vulnérabilités, santé des règles) |
| BF-08 | Prioriser les vulnérabilités (CVE) en fonction des techniques d'attaque observées |
| BF-09 | Construire, scanner et déployer automatiquement les images, avec blocage sur secret/faille/CVE critique |
| BF-10 | Provisionner et faire évoluer l'infrastructure exclusivement par du code versionné |
| BF-11 | Gérer les secrets applicatifs de façon centralisée |
| BF-12 | Sauvegarder les données et permettre une restauration à un point dans le temps |
| BF-13 | Permettre le retour arrière d'un déploiement applicatif défectueux |
| BF-14 | Séparer les données et vues de supervision entre organisations hébergées — **état réel : isolation partielle** (§4.3, §5.5) |

### 1.9 Critères d'acceptation

Un critère n'est acquis que s'il est **démontrable**, pas seulement écrit : (1) les tests de
contournement volontaire (T1–T18) passent et sont documentés ; (2) les mesures avant/après de
l'apport ML sont renseignées avec des valeurs réelles ; (3) chaque écart entre conception et réel
est classé assumé (justifié) ou à combler, aucun écart silencieux ; (4) un environnement est
reconstructible depuis un projet GCP vierge par `terraform apply` ; (5) la chaîne de promotion a
été déroulée au moins une fois de bout en bout ; (6) la soutenance peut dérouler en 15 minutes :
un schéma d'architecture, une attaque bloquée, un incident enrichi, une priorisation de
vulnérabilité, un refus de pipeline, une promotion en environnement supérieur.

---

## 2. Cas d'utilisation

Chaque cas décrit un flux nominal, ses contrôles Zero Trust et son statut de vérification réel
(vérifié en direct sur `staging` le 07-08/08/2026, complété par les audits du 11/08 et 18/08).

### UC1 — Un analyste SOC consulte le dashboard

Flux : utilisateur → DNS → ALB → Cloud Armor → Cloud Run (dashboard), puis dashboard → API →
BigQuery en lecture seule. Session absente → redirection `307` vers `/login` ; authentification
mot de passe (bcrypt) puis, si MFA activé, JWT temporaire `typ:"mfa_pending"` (5 min, sans rôle)
en attente du code TOTP. `sa-api` est en lecture seule sur le dataset SIEM. Le navigateur ne parle
jamais directement à BigQuery ni à `ml-embed`.

**Statut :** fonctionnel et vérifié en direct. Point d'attention : le mur anti-bruteforce Cloud
Armor (10 req/min/IP, ban 5 min) ne couvre que `/auth/token` et `/api/login` par défaut —
`/auth/mfa/verify`, la cible naturelle d'un brute-force du code à 6 chiffres, **n'y figure pas**
(confirmé dans `terraform/modules/load-balancer/variables.tf:47-51`, non corrigé au 19/08). Seul
filet restant : un `slowapi` applicatif à 60/min, dont la clé peut se replier sur l'IP de sortie
mutualisée du dashboard.

### UC2 — Une attaque réseau est bloquée en périphérie (WAF)

Une requête malveillante (XSS, SQLi, LFI, RCE, RFI) atteint l'ALB et est bloquée par Cloud Armor
avant Cloud Run (5 règles OWASP préconfigurées, `deny(403)` direct, pas de mode preview).
L'événement de blocage est journalisé. Défense en profondeur : en cas de faux négatif, les
contrôles applicatifs prennent le relais.

**Statut :** règle anti-bruteforce et règles WAF confirmées actives en direct. Gap connu : aucune
colonne de tenant sur les logs de blocage — un blocage n'est pas attribuable à une application
précise si plusieurs applications partagent le LB.

### UC3 — Détection sémantique sans règle explicite (ATT&CK-BERT)

Cloud Scheduler déclenche `enrich-job` toutes les 15 minutes ; le job lit les détections non
enrichies des 2 dernières heures, appelle `ml-embed` (jeton d'identité, ingress interne), écrit le
résultat dans `alert_enrichment`. Visible sur le dashboard (technique, score) via l'agrégat
`/siem/enrichment-quality` — **mais pas par incident individuel** (§5.4).

**Statut :** fonctionnel en staging. La latence de démarrage à froid de `ml-embed` mesurée
réellement (~27 s en moyenne, p99 jusqu'à ~94 s) est très supérieure à l'estimation initiale
(2-4 s) ; elle avait causé des erreurs 503 début août, corrigées côté budget de sonde (élargi à
150 s), sans réduire la latence elle-même.

### UC4 — Livraison logicielle via CI/CD

Push sur `main` (filtré par chemin) → Workload Identity Federation → Gitleaks → Semgrep → build →
Trivy (bloquant sur CVE `CRITICAL`) → push Artifact Registry (tag = SHA du commit) → déploiement
Cloud Run par ce tag → rapport Trivy chargé dans `cve_findings` (BigQuery). La condition WIF est
scopée statiquement à `refs/heads/main`.

**Statut :** CI verte confirmée sur menal et Elson. Nuance : le déploiement CI se fait par tag
SHA (traçable au commit) et non par digest cryptographique `@sha256:` explicite — l'invariant
« déploiement par digest » du LLD initial n'est donc pas strictement tenu côté CI applicative
(il l'est côté reconstruction Terraform, qui résout un digest via Artifact Registry).

### UC5 — Évolution de l'infrastructure via Terraform

`terraform fmt/validate` puis scan IaC Trivy (config), `plan` publié en revue, puis `apply`. État
distant sur GCS, versionné et verrouillé.

**Statut :** `plan`/`apply` restent un geste **manuel**, non automatisés en pipeline complet — F7
partiel. `.terraform.lock.hcl` est gitignoré : la CI de validation (`init -backend=false`) ne
garantit pas la même version de provider que les `apply` réels.

### UC6 — Incident Cloud SQL : panne de zone / restauration

L'instance Cloud SQL est passée de zonale à régionale (HA) le 08/08/2026. Bascule automatique
attendue vers un réplica synchrone en cas de panne de zone — **configurée mais jamais déclenchée
en conditions réelles**, seule la conversion zonal→régional a été testée. Restauration PITR :
32 min 45 s mesurés le 03/08 (sur l'ancienne configuration zonale, à revalider sur la config
actuelle), RPO = 0. Une restauration PITR restaure les deux bases (`menal_db` + `elson_db`)
ensemble et peut faire perdre le durcissement `REVOKE cloudsqlsuperuser` appliqué séparément —
risque désormais détecté automatiquement sous 24h par un job dédié plutôt que de rester silencieux.

### UC7 — Onboarding d'une application cliente sur le socle (cas réel : Elson)

Instanciation du module `app-service` + routage LB (`extra_services`) + monitoring dédié : SA
dédié (`sa-elson-staging`), DNS + certificat managé, base/utilisateur Cloud SQL dédiés
(`elson_db`/`elson_user`), 6 alertes + 1 uptime check, secrets et bucket média en CMEK depuis le
08/08. Isolation SQL croisée vérifiée automatiquement chaque jour (job + alerte sur échec).

**Statut :** premier onboarding réel du socle multi-app, prouvé vivant depuis le 07/08. Gaps
structurels pour une 3ᵉ application : le module `cloud-sql` n'est pas réinstanciable (peering VPC
codé dans le module), aucune colonne de tenant fiable sur `api_metrics`/`alert_enrichment`/
`cve_findings`, et surtout **aucune isolation réseau réelle entre tenants** (§4.3) — VPC, connecteur
serverless et instance Cloud SQL sont partagés, l'isolement actuel est purement applicatif (SA et
base dédiés), pas réseau.

### UC8 — Rollback d'un déploiement défectueux

`gcloud run revisions list` puis bascule de trafic vers une révision précédente.

**Statut :** testé réellement (bascule vers révision précédente en 11,6 s, retour en 16,5 s avec
cold start observé). Pas de canary ni de rollout progressif automatique en CI.

---

## 3. Architecture haut niveau

### 3.1 Vue en couches

Le socle est organisé en 7 couches numérotées, deux d'entre elles (identité, observabilité) étant
transversales plutôt qu'empilées :

```
                    Utilisateurs / Administrateurs
                                 │ HTTPS uniquement
┌────────────────────────────────────────────────────────────────────┐
│  L1 — EDGE : Cloud DNS · ALB HTTPS (TLS managé) · Cloud Armor       │
│  (géo-blocage + WAF OWASP + rate limiting à deux couches)          │
└───────────────────────────────┬──────────────────────────────────┬─┘
                                 │ NEG serverless                    │
┌────────────────────────────────▼──────────────────┐   ┌────────────▼──────────────┐
│  L3 — WORKLOADS (Cloud Run)                        │   │  L2 — IDENTITÉ (transverse)│
│  app hébergée (ELSON/Elson) · api-platform ·        │◄──┤  IAM · SA dédiés · Secret  │
│  dashboard (JWT-RBAC + MFA TOTP)                    │   │  Manager · KMS · WIF       │
└───────────────────────────────┬──────────────────────┘   └───────────────────────────┘
                                 │ Serverless VPC Access Connector
┌────────────────────────────────▼──────────────────────────────────┐
│  L4 — RÉSEAU : VPC · 2 subnets + connecteur · pare-feu deny-by-def.│
│  PSA (Cloud SQL privé) · Cloud NAT (egress contrôlé)                │
└──────┬──────────────────────────────────────────────────────┬──────┘
       │                                                        │ interne uniquement
┌───────▼────────────────────────┐         ┌────────────────────▼──────────────────┐
│  L5 — DATA                     │         │  L6 — ML / ENRICHISSEMENT SÉMANTIQUE   │
│  Cloud SQL PostgreSQL (HA)     │◄────────│  ml-embed (Cloud Run, fp32, CPU)       │
│  BigQuery (SIEM) : raw_logs →  │  F5     │  enrich-job (Cloud Run Job, /15 min)   │
│  detections → alert_enrichment │         │  jamais exposée hors VPC               │
└───────────────▲─────────────────┘         └─────────────────────────────────────┘
                 │ sink filtré
┌─────────────────┴──────────────────────────────────────────────────┐
│  L7 — OBSERVABILITÉ (transverse) : Cloud Logging · Monitoring ·     │
│  alerting · runbooks                                                │
└──────────────────────────────────────────────────────────────────────┘

PIPELINE DEVSECOPS (F3, F6) : GitHub → Actions (WIF) → Gitleaks → Semgrep → build
   → Trivy → Artifact Registry → deploy Cloud Run (tag SHA)
   → F6 : CVE Trivy → cve_findings (BigQuery) → priorisation

PIPELINE INFRA (F7, geste manuel de plan/apply) : Terraform fmt/validate/plan
   → scan IaC Trivy → approbation manuelle → apply (état distant GCS)
```

### 3.2 Flux nommés

| Flux | Chemin | Nature |
|---|---|---|
| F1 | Utilisateur → DNS → ALB → Cloud Armor → Cloud Run | Requête applicative |
| F2 | Cloud Run → connecteur VPC → PSA → Cloud SQL (IP privée) | Accès données applicatif |
| F3 | GitHub Actions → WIF → Artifact Registry → Cloud Run | Livraison logicielle |
| F4 | Toutes couches → Cloud Logging → sink → BigQuery `raw_logs` | Télémétrie sécurité |
| F5 | Scheduler → enrich-job → ml-embed → `VECTOR_SEARCH` → `alert_enrichment` → dashboard | Détection & enrichissement |
| F6 | Trivy (CVE) → encodage ATT&CK-BERT → jointure techniques observées → priorisation | Boucle DevSecOps ↔ SIEM |
| F7 | GitHub Actions → WIF → `terraform plan` → scan IaC → approbation → `apply` | Provisionnement infra |

### 3.3 Application des principes Zero Trust (NIST SP 800-207)

| Principe | Matérialisation | Limite connue |
|---|---|---|
| Ne jamais faire confiance au réseau | Cloud SQL sans IP publique ; Cloud Run en ingress LB-only ; `ml-embed` joignable uniquement en interne ; pare-feu deny-by-default | `allow_internal` autorise tout TCP/UDP/ICMP entre les deux subnets sans granularité par tag/service (§4.3) |
| Vérifier explicitement à chaque requête | L1 filtre (WAF), L2 authentifie (JWT + IAM), chaque appel service-à-service porte un jeton d'identité | `/auth/mfa/verify` sans protection Cloud Armor dédiée (§2, UC1) |
| Moindre privilège | Un compte de service par workload, rôles resserrés au niveau table pour les workloads sensibles | Discipline resource-level solide (§4.2) |
| Supposer la compromission | Tout est journalisé (F4) ; poids ML traités comme artefact non fiable (safetensors, empreintes, image scannée) | Logs de deny pare-feu et NAT : **corrigé le 19/08** (§4.3) |
| Micro-segmentation | Séparation par identité : app hébergée / plateforme / ML / données ont des SA, droits et chemins réseau distincts | Micro-segmentation par identité oui, par réseau non (VPC/Cloud SQL partagés entre tenants) |
| Surveillance et amélioration continues | L7 + SIEM + matrice de couverture ATT&CK affichant aussi ce qui n'est pas détecté | Angles morts structurels : pas de détection d'exfiltration ni d'abus IAM/élévation de privilèges |

### 3.4 Décisions d'architecture structurantes (registre résumé)

| Décision | Statut | Justification |
|---|---|---|
| Cloud Run comme unique plateforme d'exécution | Validé | Serverless managé, scale-to-zero, pas de cluster à opérer |
| ALB global + Cloud Armor à l'edge | Validé | Point d'entrée unique = point de contrôle unique |
| Cloud SQL PostgreSQL, IP privée, HA (régionale depuis le 08/08) | Validé | HA activée en décision explicite, coût doublé assumé |
| BigQuery comme SIEM (plutôt que Chronicle/Splunk/ELK) | Validé | SIEM construit, pas acheté ; `VECTOR_SEARCH` supprime le besoin d'une base vectorielle dédiée |
| ATT&CK-BERT (embedding non génératif) en L6 | Validé | Sortie déterministe = preuve auditable, pas de surface d'injection de prompt |
| Workload Identity Federation pour la CI | Validé | Supprime la classe de risque « clé de SA longue durée » |
| Retrait de Docker Hub de la chaîne de livraison | Validé | Un seul registre de confiance (Artifact Registry) |
| Terraform comme standard unique de provisionnement | Validé (renforcé) | Reproductibilité totale, revue de sécurité avant création, détection de dérive |
| VPC Service Controls, service mesh, Memorystore, multi-région, Binary Authorization, IAP, LLM génératif pour l'analyse | Écartés (documentés, pas oubliés) | Disproportionnés pour ce périmètre ; conditions de réévaluation explicites (industrialisation, montée en charge, ouverture d'identités d'entreprise) |

Le registre complet des décisions individuelles (15 ADR au 18/08/2026 : WIF, géo-blocage,
rate-limiting, subnet public, journalisation réseau, cadence SIEM, statut ATT&CK-BERT,
généralisation multi-app, séparation CMEK…) reste dans `docs/adr/`.

---

## 4. Architecture détaillée par composant

### 4.1 L1 — Edge

| Paramètre | Valeur réelle | Raison |
|---|---|---|
| Frontend | HTTPS 443 uniquement, ALB global externe, certificats managés | Aucun trafic clair |
| Géo-blocage (Cloud Armor, priorité 410) | Autorise UE + Maghreb (TN/DZ/MA) + Mauritanie (MR, siège MENAL SARL) ; bloque le reste. Exemptions : VPC interne, IP admin, `/health`, `GET /`, `GET /login` | Réduit la surface exposée au WAF ; `POST /api/login` reste géo-bloqué et rate-limité |
| Règles WAF (deny direct, pas de mode preview) | 5 règles préconfigurées : `xss-v33-stable`, `sqli-v33-stable`, `lfi-v33-stable`, `rce-v33-stable`, `rfi-v33-stable` | OWASP Top 10 couvert sans composant à maintenir |
| Rate limiting — 2 couches | (1) `rate_based_ban`, priorité 1450, 10 req/min/IP sur `auth_paths` (défaut : `/auth/token`, `/api/login`), ban 5 min ; (2) `throttle`, priorité 1500, 1000 req/min/IP, anti-DDoS | Design motivé par une vulnérabilité de verrouillage collectif observée (IP de sortie partagée dashboard→API) |
| En-têtes | HSTS ; en-têtes de sécurité applicatifs gérés par les services | Un seul propriétaire par en-tête |

**Point ouvert :** `/auth/mfa/verify` n'est pas dans `auth_paths` par défaut
(`terraform/modules/load-balancer/variables.tf:47-51`) — le point d'entrée le plus sensible pour
un brute-force TOTP n'a pas la protection edge dédiée que `/auth/token` a. Coût de correction
quasi nul (ajout d'une valeur de variable), non appliqué au 19/08/2026.

### 4.2 L2 — Identité et IAM

Un compte de service par workload, aucun `roles/editor`/`roles/owner`, aucune clé JSON exportée.
Comptes réellement provisionnés (`terraform/modules/iam/main.tf`, `terraform/modules/bigquery/main.tf`) :

| Compte de service | Rôles (moindre privilège) | Notes |
|---|---|---|
| `sa-api` | `cloudsql.client`, `logging.logWriter`, lecture BigQuery scopée au dataset SIEM, écriture limitée à `analyst_verdicts` | Aucun `secretAccessor` au niveau projet — bindings ciblés sur `db-password`/`jwt-secret` uniquement |
| `sa-pipeline` | `bigquery.dataEditor` au niveau **dataset** (`menal_security_<env>`), `logging.logWriter` | **Le binding `dataEditor` au niveau projet, hérité par ml-embed, a été retiré le 19/08/2026** (ADR-0002, remédiation) — correctif en cours de déploiement le 19/08, à valider par un `terraform plan`/`apply` réel avant de le considérer clos en production |
| `sa-ml-embed` | Aucun rôle BigQuery (ni dataset, ni table) ; `logging.logWriter` uniquement | **Compte dédié créé le 19/08/2026** (`terraform/modules/iam/main.tf:182-196`) — avant cette date, `ml-embed` tournait sous `sa-pipeline` et héritait donc du droit d'écriture BigQuery projet-wide, écart Zero Trust documenté C1 des deux audits |
| `sa-enrich-job` | `bigquery.dataViewer` sur `detections`, `bigquery.dataEditor` **uniquement** sur `alert_enrichment`, `run.invoker` sur `ml-embed` | Ne peut pas écrire dans `raw_logs`/`detections` : le moteur d'enrichissement ne peut pas modifier les preuves qu'il analyse |
| `sa-cicd` | `run.developer`, `artifactregistry.writer`, `actAs` (`serviceAccountUser`) sur `sa-api` et chaque `sa-<app>-<env>` déployé, `bigquery.dataEditor` scopé à la table `cve_findings` | Portée élargie au fil de la généralisation multi-app par rapport au plan initial (« les SA runtime uniquement ») |
| `sa-<app>-<env>` (ex. `sa-elson-staging`) | `cloudsql.client`, `secretmanager.secretAccessor` (secrets de cette application uniquement) | Aucun accès BigQuery — une application hébergée ne lit pas le SIEM |
| `sa-dashboard-<env>` | `iam.serviceAccountUser` accordé par `sa-cicd` sur ce seul compte | — |

La convention de nommage est hétérogène par construction assumée : les comptes fondateurs
(`sa-api`, `sa-pipeline`, `sa-cicd`, `sa-enrich-job`) n'ont pas de suffixe d'environnement — ils
sont disambigués par projet GCP — tandis que les comptes ajoutés lors de la généralisation
multi-app en portent un. Renommer rétroactivement recréerait les bindings, jugé plus risqué que
l'incohérence documentée.

**Workload Identity Federation :** un pool WIF par projet d'environnement (pas de projet
`menal-ops` partagé), un seul compte de déploiement `sa-cicd` par environnement — pas de palier
`sa-ci-infra` séparé, contrairement au montage à trois paliers initialement envisagé. Condition
d'attribut **statique** sur la branche (`assertion.repository == '...' && assertion.ref ==
'refs/heads/main'`). Jetons de 10 minutes, aucune clé JSON.

**Points ouverts (IAM) :**
- La garantie « pas de clés de compte de service statiques », présentée comme acquise dans les
  documents sources, n'est **pas appliquée par une politique d'organisation réelle** : le projet
  est personnel, sans organisation GCP, donc `iam.disableServiceAccountKeyCreation` n'est pas en
  vigueur. Le test censé le vérifier (`test_t6_sa_key_creation_blocked_check`) est un `pass` vide
  qui ne détecterait pas une régression.
- Binding dataset-level parfois redondant avec un binding table-level plus étroit — masque le
  périmètre réellement nécessaire sans l'élargir.

**Secrets et chiffrement :** un secret par valeur dans Secret Manager (jamais de secret dérivé
d'un autre), montés via `--set-secrets`, jamais en variable d'environnement en clair dans l'image.
Un keyring `menal-kr` ; clés CMEK sur Cloud SQL/BigQuery marquées cible prod (Google-managed en
démo) ; secrets et bucket média Elson en CMEK depuis le 08/08/2026 — deux régimes de clés
distincts (clé globale pour les secrets, clé régionale pour les données), séparation actée mais
sans rationale écrite formalisée avant les ADR 0015.

**JWT-RBAC applicatif et MFA :** trois rôles (`admin`, `analyste`/`viewer`, `service`) portés par
le JWT émis par l'API. MFA TOTP (RFC 6238, `pyotp`, fenêtre `valid_window=1`, conforme NIST
800-63B) — pas de SMS, pas de codes de secours, pas de WebAuthn. Flux solide : mot de passe
(bcrypt) → si MFA actif, JWT `typ:"mfa_pending"` (5 min, sans rôle) → vérification TOTP ;
`get_current_user` rejette tout token dont `typ != "access"`. Aucun chemin de contournement
identifié dans le code. Écart ouvert, non corrigé au 19/08 : `/auth/mfa/verify` non
couvert par le rate-limit Cloud Armor dédié (§4.1). Second écart, **correctif en cours de
déploiement le 19/08** : `mfa_secret` était stocké en clair en base
(`api/app/models/user.py`, `String(32)`) — une fuite de la base exposait directement tous
les secrets MFA. Le code lu au 19/08 montre un chiffrement symétrique Fernet applicatif
(`api/app/auth/crypto.py`, colonne élargie à `String(255)`, migration Alembic
`003_widen_mfa_secret_column.py`), avec tolérance explicite d'une valeur legacy non chiffrée
en base pour ne pas casser les comptes existants — à confirmer par une migration de données
réellement exécutée sur `staging` avant de considérer l'écart clos.

### 4.3 L4 — Réseau

Topologie réellement provisionnée (`terraform/modules/vpc/main.tf`), qui diverge du plan initial
(un seul subnet `10.10.0.0/24`) sur plusieurs points chiffrés :

| Élément | Configuration réelle |
|---|---|
| VPC | `menal-vpc-<env>`, mode custom, deux subnets : `subnet-public-<env>` (`10.0.1.0/24`, **non utilisée par aucune ressource à ce jour**) et `subnet-private-<env>` (`10.0.2.0/24`, Private Google Access activé), plus une plage dédiée au connecteur Serverless VPC Access (`10.0.3.0/28`) |
| PSA | Plage réservée en peering `servicenetworking` → Cloud SQL IP privée ; allocation automatique GCP |
| Cloud Run ↔ VPC | Serverless VPC Access Connector (2× `e2-micro` minimum, jamais réduits), pas de Direct VPC egress comme envisagé initialement — coût fixe permanent |
| Cloud NAT | `menal-nat-<env>` ; journalisation activée en filtre `ERRORS_ONLY` |
| Pare-feu | `deny-all-ingress` (priorité 65534) + règles explicites minimales ; journalisation activée sur la règle deny |

**Journalisation réseau — corrigé le 19/08/2026 :** au 11/08 puis encore au 18/08, aucune des 4
règles de pare-feu ni le Cloud NAT n'avait de `log_config` — le sink BigQuery `vpc_to_bq`
(filtre `disposition="DENIED"`) était câblé mais ne recevait jamais rien, rendant la détection de
mouvement latéral invérifiable. Le Terraform lu au 19/08 (`terraform/modules/vpc/main.tf:14-18,
29-33, 59-62, 83-85`) montre `log_config` désormais actif sur les deux subnets (flow logs,
échantillonnage 0,5), sur le NAT (mode `ERRORS_ONLY`, pour limiter le coût d'ingestion tout en
gardant la visibilité sur les échecs) et sur la seule règle `deny_all_ingress` (volontairement
absent des règles `allow` à fort volume). **Correctif en cours de déploiement le 19/08** : à
confirmer par un `terraform apply` réel sur `staging` avant de le considérer prouvé en production,
la lecture du code seule ne garantit pas l'état appliqué.

**Segmentation est-ouest — écart HIGH toujours ouvert :** `allow_internal` (priorité 900)
autorise **tout TCP/UDP/ICMP** entre les deux subnets sans restriction par tag ou service — une
logique de confiance de zone, pas de moindre privilège port-à-port. Combiné au partage d'un seul
VPC, d'un seul connecteur serverless et d'une seule instance Cloud SQL entre MENAL et Elson, cela
signifie que l'isolation entre tenants est aujourd'hui **purement applicative** (SA et base
dédiés), sans aucune isolation réseau réelle, et sans VPC Service Controls. Un socle multi-app
présenté comme Zero Trust devrait segmenter par tag/SA avant l'onboarding d'un 3ᵉ client.

Autres écarts mineurs connus, non bloquants : les règles `allow-https-ingress`/`allow-health-checks`
ciblent un tag réseau `https-server` que rien n'attache jamais (règles mortes) ; le subnet public
reste sans usage et sans décision tranchée sur son utilité.

### 4.4 L5 — Données

**Cloud SQL PostgreSQL 17** : IP privée uniquement (PSA), `require_ssl` ; sauvegardes automatiques
+ PITR ; **HA régionale depuis le 08/08/2026** (décision explicite, coût doublé, bascule zone en
cas de panne jamais déclenchée en conditions réelles) ; chiffrement Google-managé en démo (CMEK
documentée comme cible prod).

**BigQuery — le SIEM.** Dataset réel : `menal_security_<env>` (pas `siem` comme documenté dans le
plan initial). Chaîne de traitement :

```
raw_logs (partitionnée/jour, ingérée par le sink F4)
   │  requêtes planifiées = règles de détection traduites en SQL (fenêtre 15 min)
   ▼
detections (alertes normalisées : id, timestamp, entity, source, message, service,
            mitre_tactic, mitre_technique)
   │  enrich-job (cadence réelle 15 min, pas 5 comme dans le plan initial) :
   │  détections non enrichies → ml-embed → VECTOR_SEARCH (top_k=3, COSINE)
   ▼
alert_enrichment (schéma réel : timestamp, detection_id, technique, tactic,
                   similarity, alternates (rangs 2-3), model_version, input_hash ;
                   PAS de colonne entity — écart structurant, voir §5.4)
   ▼
scoring recalculé en Python dans l'API (_score_incident, api/app/routers/siem.py)
   à partir des SEULES détections Sigma — pas de jointure sur alert_enrichment
attack_embeddings (vecteurs du référentiel MITRE + index vectoriel, chargé hors ligne)
```

| Contrôle | Mise en œuvre |
|---|---|
| Intégrité des preuves | `raw_logs` et `detections` : écriture réservée au sink et aux requêtes planifiées ; aucun SA applicatif ou ML n'a de droit d'écriture |
| Rétention / coût | Partitionnement journalier, expiration `raw_logs` 90 j, filtres d'exclusion au sink (poste de coût dominant) |
| Seuil de similarité | `DECLARE threshold DEFAULT 0.60` en tête de requête, auditable sans redéploiement |

**Isolation multi-tenant réelle (clé `service`) :** la colonne `detections.service` existe et est
utilisée par l'API, mais n'est peuplée de façon fiable que pour une partie des règles de
détection — plusieurs règles restent majoritairement NULL sur ce champ. Trois autres tables
(`api_metrics`, `alert_enrichment`, `cve_findings`) n'ont aucune colonne tenant. Conséquence
concrète : certaines pages du dashboard restent globalement fusionnées MENAL+Elson quel que soit
le sélecteur de tenant affiché à l'écran. L'isolation multi-tenant du SIEM doit donc être présentée
comme **partielle**, pas comme une capacité binaire acquise.

### 4.5 L3 — Workloads Cloud Run

Chaque service tourne avec `ingress: internal-and-cloud-load-balancing` (sauf `ml-embed`,
`internal` strict) et `--no-allow-unauthenticated` pour les appels service-à-service, authentifiés
par jeton d'identité du compte appelant. Conteneurs non-root ; `docs_url=None` sur les API
internes. Le déploiement se fait par tag `github.sha` (traçable au commit) plutôt que par digest
`@sha256:` explicite côté pipeline applicatif — nuance par rapport à l'invariant « déploiement par
digest » du LLD initial, qui n'est strictement tenu que côté reconstruction Terraform.

---

## 5. Pipeline SIEM et enrichissement ATT&CK-BERT

### 5.1 Positionnement et ce que le modèle apporte réellement

Le modèle retenu, **ATT&CK-BERT** (`basel/ATTACK-BERT`, MPNet, 110 M paramètres, sortie 768
dimensions), est un modèle d'embedding de phrases — pas un LLM, il ne génère aucun texte et ne
« décide » de rien : il retourne une distance numérique. Ce choix non génératif est un contrôle de
sécurité délibéré : sortie déterministe et reproductible (admissible comme preuve dans un SIEM),
aucune surface d'injection de prompt via le contenu des logs, aucune hallucination possible.

Formulation honnête à retenir : l'ajout d'ATT&CK-BERT n'améliore pas les performances de
l'infrastructure — il en consomme (+1 service, +latence, +surface à durcir). Il améliore la
**performance de détection potentielle** : le système peut identifier des comportements qu'aucune
règle ne décrit et les rattacher au référentiel MITRE ATT&CK. Ce gain reste aujourd'hui **partiel**
au sens où il n'alimente pas encore le scoring d'incident (§5.4).

Éléments d'originalité réels : inférence vectorielle déportée dans BigQuery (`VECTOR_SEARCH`)
plutôt que dans une base vectorielle dédiée ; précalcul asymétrique (référentiel encodé hors
ligne, seule l'alerte entrante passe par le modèle en ligne) ; poids traités comme un artefact de
chaîne d'approvisionnement non fiable (safetensors imposé, refus du pickle, empreintes SHA-256
consignées, révision épinglée).

### 5.2 Le modèle exact, pas la version quantisée

Le plan initial prévoyait un export ONNX quantisé int8 (~110 Mo, latence divisée par 4). En
pratique, la quantisation a été testée et **rejetée** : les vecteurs int8 ne reproduisaient plus
les rapprochements MITRE du modèle fp32 de référence (0/5 top-1 identiques sur un échantillon de
requêtes SOC de test). Le modèle exact fp32 est donc livré en production (~440 Mo, service à
2 GiB) — un écart assumé et documenté par un gate d'acceptation explicite (critère : similarité
cosinus float32↔int8 > 0,99, non atteint), plutôt qu'une quantisation non validée déployée quand
même.

Service `ml-embed` : FastAPI, CPU 1 vCPU / jusqu'à 2 GiB, `min-instances=0`, troncature 512
tokens, lot max 64, `HF_HUB_OFFLINE=1`, poids embarqués dans l'image (jamais téléchargés à
l'exécution), ingress interne strict, egress nul (`vpc-egress=all-traffic`, pas de route
Internet), compte de service dédié `sa-ml-embed` sans aucun droit BigQuery (§4.2).

### 5.3 Cadence et pipeline d'enrichissement

`enrich-job` (Cloud Run Job) est déclenché par Cloud Scheduler toutes les **15 minutes**
(`terraform/modules/ml-pipeline/main.tf:228`, `schedule = "*/15 * * * *"`) — pas 5 minutes comme
l'affirmait le plan initial. Le job lit les détections des 2 dernières heures sans enrichissement,
appelle `ml-embed` (jeton d'identité), exécute `VECTOR_SEARCH` avec **top_k=3** (pas top_k=1 comme
dans la requête d'exemple du document initial) et conserve les rangs 2-3 dans un champ
`alternates`, jamais exposés sur un endpoint accessible au rôle `viewer` (évite de donner à un
attaquant de quoi calibrer une évasion).

Un `input_hash` (SHA-256 du texte) est calculé et stocké dans `alert_enrichment` à des fins de
traçabilité, mais **n'est jamais utilisé pour éviter un ré-encodage** : chaque batch réencode
l'intégralité des événements en attente, y compris les textes déjà vus. Le bénéfice de cache
décrit dans le plan initial reste une intention non réalisée.

### 5.4 Le scoring d'incident n'utilise pas la sortie du modèle

C'est l'écart le plus significatif entre la documentation initiale et le code réel. Le document
source affirmait que le champ `tactic` produit par le modèle « existe pour tous les événements »
et devient « la condition d'existence de la détection de progression d'attaque » (bonus
kill-chain : +15 au score si ≥ 2 tactiques distinctes, même entité, fenêtre d'une heure).

En réalité, `_score_incident` (`api/app/routers/siem.py:374-467`) calcule ce bonus **exclusivement**
à partir de `detections.mitre_tactic`, un champ peuplé uniquement par les 7 règles de détection
SQL — `alert_enrichment` n'est **jamais jointe** au scoring, et ne pourrait d'ailleurs pas l'être
simplement : son schéma réel n'a pas de colonne `entity` (clé sur `detection_id` uniquement, voir
§4.4), qui serait nécessaire à la corrélation par entité décrite dans le plan initial. Le modèle
ML est exposé uniquement en KPI agrégé (`/siem/enrichment-quality`), jamais par incident.

Conséquence pour la présentation du projet : ATT&CK-BERT doit être décrit comme **informationnel**
aujourd'hui — il enrichit chaque détection individuellement (technique + deux candidats
alternatifs) sans participer à la détection de progression d'attaque (kill-chain) ni à la
priorisation d'incident. Deux issues restent ouvertes et non tranchées au 19/08 : ajouter une
colonne `entity` à `alert_enrichment` et joindre au scoring, ou assumer et documenter formellement
ce positionnement informationnel comme décision définitive.

### 5.5 Règles de détection ("Sigma") — positionnement réel

`terraform/modules/detection/main.tf` définit 7 règles (`r1_bruteforce` … `r7_sensitive_files`)
écrites **directement en SQL BigQuery**, déployées en `google_bigquery_data_transfer_config` avec
un `display_name` du type `"Sigma R1-brute-force: ..."`. Aucun fichier YAML Sigma natif
(format `logsource`/`detection`/`condition` SigmaHQ) n'existe dans le dépôt, aucune dépendance
`pysigma`/`sigma-cli`. `api/app/bigquery.py` recopie à la main un dictionnaire Python décrivant
ces règles, explicitement non synchronisé automatiquement avec le Terraform.

Le nom « Sigma » **n'est donc pas justifié au sens du standard** (pas de portabilité YAML, pas de
compatibilité avec les règles communautaires SigmaHQ, pas de moteur de traduction) mais n'est pas
non plus mensonger : c'est un choix de conception assumé, documenté sans complaisance dans le
rapport de PFE. Le risque est que la présentation produit (Terraform `display_name`, libellé du
dashboard « R1–R7 · Sigma ») ne porte pas la même nuance que la documentation technique interne.

Points forts réels : déduplication rigoureuse (`NOT EXISTS`) + fenêtre 15 min correctement
dimensionnée pour la latence d'ingestion ; mapping MITRE tactic/technique par règle ; R3/R6
couvrent à la fois le trafic bloqué par le WAF et celui qui atteint l'application (évite l'angle
mort « le WAF cache l'attaque ») ; séparation des privilèges au niveau table pour l'écriture dans
`detections`.

Angles morts structurels assumés : aucune détection d'exfiltration de données, aucune détection
d'abus IAM/élévation de privilèges, aucune UEBA — uniquement du pattern-matching HTTP/WAF. Aucun
test unitaire par règle (jeu de logs synthétiques → assertion déclenchement/non-déclenchement).
Seuils de faux positifs en dur, non documentés (`> 5`, `> 10`, `5000ms`).

### 5.6 Boucle DevSecOps ↔ SIEM (priorisation CVE, flux F6)

Le rapport Trivy du pipeline CI est chargé dans la table `cve_findings` (BigQuery), croisée avec
les techniques ATT&CK observées dans les logs des 30 derniers jours — la priorisation ne se fait
plus par score CVSS décroissant seul, mais par risque réellement observé. `sa-cicd` est scopé à
cette seule table depuis le 08/08/2026 (resserrement d'un accès auparavant plus large). C'est
l'argument central qui relie les deux blocs habituellement disjoints d'une architecture
(livraison logicielle et détection) — il reste valide indépendamment de l'écart noté en §5.4, qui
concerne le scoring d'incident, pas cette boucle de priorisation CVE.

### 5.7 Limites à documenter explicitement

1. **Dépendance linguistique** : le modèle est entraîné sur de l'anglais ; les logs GCP le sont
   également, donc le cas d'usage est couvert, mais tout log applicatif francophone nécessiterait
   une traduction préalable.
2. **Calibration du seuil** : la similarité cosinus (`threshold = 0.60`) n'est pas une probabilité
   et doit être calibrée par une courbe précision/rappel sur les données réelles — non exécuté à
   ce jour, aucun artefact de calibration dans le dépôt.
3. **Faux rattachements** : le modèle rattachera toujours quelque chose ; la discipline `unmapped`
   sous le seuil est indispensable.
4. **Pas de détection d'anomalie temporelle** : le modèle est sémantique, pas statistique.
5. **Modèle figé** : aucun réentraînement prévu ; une évolution du référentiel ATT&CK nécessite de
   régénérer les vecteurs de référence, pas d'adapter le modèle.
6. **Le modèle n'est pas une source de vérité** : sortie = hypothèse assortie d'un score, toute
   réponse à incident reste soumise à validation humaine.

### 5.8 Impact sur les performances — chiffres mesurés

| Élément | Estimation initiale | Mesure réelle |
|---|---|---|
| Latence d'enrichissement en régime établi | +30-50 ms par alerte | Jamais instrumentée en régime établi |
| Démarrage à froid `ml-embed` | ≈ 2-4 s (hypothèse ONNX int8) | ≈ 27 s en moyenne, p99 jusqu'à ≈ 94 s (modèle fp32 réellement livré) — cause des 503 début août, corrigée côté budget de sonde (150 s), pas côté latence |
| Taille de l'image | +110 Mo (int8) | +440 Mo (fp32) à scanner dans le pipeline |
| Cadence `enrich-job` | 5 min | 15 min réelles |
| Coût financier | Paliers gratuits / quelques dizaines d'€/mois, poste dominant = ingestion de logs | Confirmé : aucun GPU, aucune base vectorielle facturée séparément |

---

## Mise à jour — Session N+1 (19/08/2026, Infra & Data)

Complète l'audit initial sur des couches non couvertes le 18/08 (détail complet dans
`02_SECURITE_AUDITS_ECARTS.md` §4) :

- **Cloud Run** : `timeout` et `execution_environment` étaient implicites (Cloud Run choisissait
  gen1/gen2 lui-même, comportement non déterministe) — désormais explicites
  (`terraform/modules/cloud-run/main.tf`, `EXECUTION_ENVIRONMENT_GEN2`, timeout 300s).
- **CMEK** : cohérent avec l'ADR-0015 pour BigQuery, bucket GCS Elson, Secret Manager. **Cloud
  SQL reste en chiffrement Google-managé par défaut** — `encryption_key_name` immuable à la
  création, migration = projet à part entière, pas un correctif ponctuel.
- **Rétention BigQuery** : `access_logs` et `raw_logs` (IP sources en clair) passent à une
  expiration de 90 jours (RGPD art. 5.1.e) ; les tables de preuves (`detections`,
  `analyst_verdicts`, `cve_findings`...) restent sans expiration, à dessein.
- **DR Cloud SQL** : configuration Terraform (PITR, rétention 7 j, régional) confirmée
  **exactement conforme** aux mesures réelles du 03/08 (RTO 32 min 45 s, RPO 0).
- **Edge/CDN** : en-têtes de sécurité HTTP déjà en place (session antérieure), pas de Cloud CDN
  activé donc pas de risque de cache de réponses sensibles — aucun correctif nécessaire ici.

---

## Mise à jour — Validation en conditions réelles (19/08/2026)

Après 4 sessions de revue de code (18-19/08), une dernière passe a testé le comportement RÉEL de
l'environnement staging (`api-staging.menal-sarl.com`, `dash-staging.menal-sarl.com`,
`elson.menal-sarl.com`) plutôt que de relire le code à froid — détail complet dans
`02_SECURITE_AUDITS_ECARTS.md` §7 :

- **WAF Cloud Armor** : bloque bien SQLi, XSS, accès `.env`/`.git` en conditions réelles (403
  confirmé). Un gap trouvé sur un pattern de path traversal envoyé sous forme brute (302 au lieu
  de 403) — à investiguer, tracé en H13.
- **RBAC API** : les 7 routes protégées testées sans authentification refusent systématiquement
  l'accès (401/403), sans fuite de données ni erreur 500 — le contrôle d'accès audité en code le
  19/08 est confirmé appliqué en production.
- **CI/CD** : le pipeline fonctionne réellement (Gitleaks, Trivy, build/déploiement, Terraform
  checks) à l'exception de la gate SAST Semgrep, découverte silencieusement cassée depuis au
  moins le 02/08 (crashait sans jamais faire échouer le job) — corrigée le 19/08 (H12).
- **Apply GCP** : toujours bloqué, mais par un problème de **facturation** du projet
  (`menal-zero-trust-staging`), indépendant des correctifs de sécurité — à résoudre côté console
  GCP avant tout déploiement réel des correctifs H1-H5.

---

*Document consolidé le 19/08/2026 à partir de `00_CAHIER_DES_CHARGES_MENAL.md`,
`03_CAS_UTILISATION.md`, `01_HLD_MENAL.md`, `02_LLD_MENAL.md`,
`ATTACK-BERT_Integration_SIEM_ZeroTrust.md`, vérifié contre `terraform/modules/{vpc,iam,
load-balancer,detection,bigquery,ml-pipeline}` et `api/app/routers/siem.py`,
`api/app/models/user.py`. Les cinq documents sources ont été supprimés du dépôt le 19/08/2026
après consolidation (contenu intégralement repris ici et dans `02_SECURITE_AUDITS_ECARTS.md`,
`03_JOURNAL_DECISIONS_ADR.md`, `04_EXPLOITATION_DEMO.md`) ; ce document fait foi sur
l'architecture réelle à cette date, mis à jour au fil des sessions suivantes de la feuille de
route (`05_METHODOLOGIE_PFE.md` Partie C).*
