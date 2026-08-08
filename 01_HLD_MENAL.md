# HLD — Plateforme MENAL
## Infrastructure GCP sécurisée · Zero Trust · DevSecOps
**Document : High-Level Design (conception de haut niveau) — v1.0 — Juillet 2026**
**Projet : PFE — Hébergement et sécurisation des applications MENAL (application exemple : ELSON)**

> **Ce document décrit la cible.** Les écarts vérifiés entre cette conception et le système
> réellement déployé sont recensés dans [`06_ECARTS_IMPLEMENTATION.md`](06_ECARTS_IMPLEMENTATION.md),
> et l'état courant de l'environnement de référence (`staging`) dans
> [`STATUT_DEV.md`](STATUT_DEV.md) §8. En cas de divergence, ces deux documents font foi sur
> ce qui existe ; celui-ci fait foi sur ce qui est visé.

---

## 1. Objet, périmètre et hypothèses

### 1.1 Objet
Concevoir un **socle d'hébergement GCP unique, pragmatique et sécurisé**, fondé sur les principes **Zero Trust** (NIST SP 800-207) et une chaîne de livraison **DevSecOps**, capable d'héberger les applications de MENAL. L'application **ELSON** (plateforme éducative de crowdsourcing) sert d'application exemple ; son code interne est **hors périmètre** — le PFE porte sur le socle qui l'héberge et la supervise.

### 1.2 Périmètre
| Dans le périmètre | Hors périmètre |
|---|---|
| Socle GCP : edge, identité, workloads, réseau, données, ML, observabilité | Code interne des applications hébergées (ELSON) |
| Pipeline DevSecOps de bout en bout | Multi-région, reprise d'activité inter-région |
| SIEM léger sur BigQuery + enrichissement ATT&CK-BERT (couche L6) | Mise à l'échelle massive (Redis distribué, GKE, service mesh) |
| Dashboard de supervision sécurité (Next.js + API FastAPI) | Conformité juridique complète (traitée en recommandation) |

### 1.3 Hypothèses et limites assumées (à énoncer telles quelles en soutenance)
1. **Trois environnements = trois projets GCP** (`menal-dev`, `menal-staging`, `menal-prod`), une seule région (ex. `europe-west1`), plus un mini-projet d'amorçage `menal-ops` (état Terraform, WIF, registre partagé — aucun workload). Mêmes modules Terraform partout, seules les variables de dimensionnement changent : **la sécurité n'est jamais un paramètre d'environnement**. Stratégie détaillée : méthodologie §2.
2. **La scalabilité n'est pas un objectif** : `min-instances` bas, pas de cache distribué, pas d'autoscaling agressif. Les limites sont documentées, pas contournées.
3. **La simplicité est un critère d'architecture** : tout composant doit justifier son existence ; tout composant non justifié est retiré (cf. §7).

---

## 2. Retouches apportées au schéma initial — avec justification

Le schéma d'origine est **structurellement bon** : le choix des composants est correct et aucun n'est remplacé. Les retouches portent sur la **cohérence du modèle en couches**, la **précision des flux**, et **deux corrections de chaîne d'approvisionnement**. C'est exactement le type de revue qu'un comité d'architecture ferait passer : on ne change pas la substance, on corrige l'urbanisation.

| # | Point du schéma initial | Retouche | Justification d'architecte |
|---|---|---|---|
| R1 | Numérotation incohérente : L1, L3, L2, L4, puis **deux couches L5** (Data et Observabilité) | Renumérotation : **L1 Edge · L2 Identité · L3 Workloads · L4 Réseau · L5 Data · L6 ML (nouvelle) · L7 Observabilité** | Un modèle en couches n'a de valeur que si la numérotation est unique et ordonnée. La numérotation retenue est **alignée sur le document ATT&CK-BERT** (qui définit déjà L6 et L7) : cohérence documentaire totale. |
| R2 | L2 (Identité) dessinée comme un bloc latéral pointant vers L3 | L2 devient un **plan transversal** qui contrôle toutes les couches, pas seulement L3 | Principe Zero Trust fondamental : l'identité est le **plan de contrôle**, vérifiée à chaque saut (edge→workload, workload→données, CI→registre). La dessiner en couche latérale sous-entend qu'elle ne protège que les workloads. |
| R3 | L7 Observabilité dessinée comme couche terminale isolée | L7 devient un **plan transversal** qui collecte depuis toutes les couches, et **alimente L5** (sink Cloud Logging → BigQuery) | Sans ce lien, le bloc « BigQuery security analytics » de votre schéma n'a **aucune source de données**. Le sink est le flux qui donne son sens au SIEM. |
| R4 | Flèche « L3 → Accès privé fourni → L4 → L5 » sans mécanisme nommé | Le mécanisme est explicité : Cloud Run → **Direct VPC egress** → subnet privé → **PSA (Private Service Access)** → Cloud SQL en IP privée | « Accès privé » est une intention ; Direct VPC egress + PSA est le mécanisme GCP qui la réalise. Un HLD nomme les mécanismes, pas seulement les intentions. |
| R5 | Pipeline : « Artifact Registry **+ Docker Hub** » | **Docker Hub retiré** de la chaîne de livraison. Option conservée : dépôt *remote* Artifact Registry comme proxy en lecture des images de base | Deux registres = deux surfaces de chaîne d'approvisionnement et une ambiguïté sur la source de vérité. Zero Trust supply chain : **un seul registre de confiance**, celui que le déploiement est autorisé à tirer. Docker Hub n'apportait rien que le proxy ne fournisse. |
| R6 | Pipeline : authentification GitHub Actions → GCP non précisée | Ajout de **Workload Identity Federation (WIF)** — aucune clé de compte de service exportée | Une clé JSON de SA dans un secret GitHub est le vecteur de compromission n°1 des pipelines. WIF = identité fédérée, jetons courts, zéro secret longue durée. C'est le point DevSecOps le plus différenciant du projet. |
| R7 | Pipeline : Semgrep + Trivy seulement | Ajout d'un scan de secrets (**Gitleaks**) en première étape | Coût quasi nul, gain élevé : l'audit ELSON montre précisément le risque des secrets mal gérés (mono-secret JWT, §11.2 de l'audit). Le pipeline doit bloquer un secret commité **avant** SAST. |
| R8 | « Application éducative (hors périmètre) » — libellé ambigu | Reformulé : « **Application hébergée — ELSON** (code applicatif hors périmètre PFE) » | « Hors périmètre » sans précision laisse croire que l'application est hors du périmètre *de sécurité*, ce qui serait un contresens Zero Trust : elle est bien **dans** le périmètre de contrôle du socle, seul son code interne est hors sujet. |
| R9 | Absence de couche ML | Insertion de **L6 — ML / Enrichissement sémantique** (ATT&CK-BERT), entre L4 et L5, joignable uniquement depuis l'intérieur | Conforme au document d'intégration fourni : `ml-embed` (Cloud Run, ONNX int8, CPU, egress nul) + `enrich-job` (Cloud Run Job planifié) + `VECTOR_SEARCH` dans BigQuery. Aucune base vectorielle ajoutée. |
| R10 | Rate limiting mentionné à l'edge uniquement | Conservé tel quel, **sans ajout** | Validation explicite : pour ce périmètre, le rate limiting Cloud Armor à l'edge suffit. Ajouter un second niveau (Redis) contredirait l'objectif de simplicité. |
| R11 | Mode de provisionnement non précisé sur le schéma | **Tout le socle est provisionné en Terraform** (état distant dans GCS, un module par couche), avec son propre pipeline `fmt → validate → plan → scan IaC → approbation → apply` | L'infrastructure devient elle-même un artefact revu, scanné et versionné — le principe DevSecOps appliqué à l'infra, pas seulement au code applicatif. C'est aussi la réponse directe à la dette « environnement non reproductible » de l'audit ELSON. Détail : LLD §10. |

> **Résumé de la revue : aucun composant remplacé.** 2 retraits (Docker Hub comme registre de déploiement ; rien d'autre), 4 ajouts légers (L6 ML — demandé, WIF, Gitleaks, sink Logging→BigQuery), le reste est de la clarification.

---

## 3. HLD — Version 1 (schéma corrigé, fidèle à l'original)

Cette version conserve la lecture verticale de votre schéma. Seules les retouches R1–R10 sont appliquées.

```
                    ┌────────────────────────────────┐
                    │   Utilisateurs / Administrateurs│
                    └───────────────┬────────────────┘
                                    │ HTTPS uniquement
┌───────────────────────────────────▼───────────────────────────────────┐
│  L1 — EDGE                                                            │
│  Cloud DNS · Global External Application Load Balancer (TLS managé)   │
│  Cloud Armor : WAF (règles OWASP) + rate limiting                     │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ trafic filtré, authentifié à l'étape suivante
┌───────────────────────────────────▼───────────────────────────────────┐   ┌──────────────────────────────┐
│  L3 — WORKLOADS SERVERLESS (Cloud Run)                                │   │  L2 — IDENTITÉ & SÉCURITÉ    │
│  ┌──────────────────────────┐  ┌───────────────────────────────────┐  │◄──┤  (plan transversal)          │
│  │ Application hébergée     │  │ API FastAPI (plateforme)          │  │   │  Cloud IAM · comptes de      │
│  │ ELSON                    │  │ + Dashboard supervision Next.js   │  │   │  service dédiés · Secret     │
│  │ (code applicatif         │  │ JWT-RBAC : admin / analyste /     │  │   │  Manager · Cloud KMS (CMEK)  │
│  │  hors périmètre PFE)     │  │ utilisateur                       │  │   │  JWT-RBAC applicatif · WIF   │
│  └──────────────────────────┘  └───────────────────────────────────┘  │   │  ── contrôle TOUTES les      │
└───────────────────────────────────┬───────────────────────────────────┘   │     couches, y c. le pipeline│
                                    │ Direct VPC egress                     └──────────────────────────────┘
┌───────────────────────────────────▼───────────────────────────────────┐
│  L4 — RÉSEAU                                                          │
│  VPC · subnets privés · pare-feu deny-by-default                      │
│  PSA (accès privé Cloud SQL) · Cloud NAT (egress contrôlé)            │
└───────────────────────────────────┬───────────────────────────────────┘
┌═══════════════════════════════════▼═══════════════════════════════════┐
│  L6 — ML / ENRICHISSEMENT SÉMANTIQUE                        ★ NOUVEAU │
│  ml-embed (Cloud Run · ATT&CK-BERT ONNX int8 · CPU · egress : AUCUN)  │
│  enrich-job (Cloud Run Job) · Cloud Scheduler (toutes les 5 min)      │
│  Joignable uniquement depuis l'intérieur du VPC                       │
└═══════════════════════════════════┬═══════════════════════════════════┘
┌───────────────────────────────────▼───────────────────────────────────┐
│  L5 — DATA                                                            │
│  Cloud SQL PostgreSQL — IP privée · HA · PITR · CMEK (cible prod)     │
│  BigQuery (SIEM) : raw_logs → detections → alert_enrichment →         │
│                    incident_scores · attack_embeddings + index vect.  │
└───────────────────────────────────▲───────────────────────────────────┘
                                    │ sink de journaux (R3)
┌───────────────────────────────────┴───────────────────────────────────┐
│  L7 — OBSERVABILITÉ (plan transversal)                                │
│  Cloud Logging · Cloud Monitoring · alerting · runbooks               │
│  Collecte depuis L1→L6 · exporte vers BigQuery (L5)                   │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  PIPELINE DEVSECOPS (plan de livraison)                               │
│  GitHub → GitHub Actions (auth WIF, sans clé) → Gitleaks (secrets)    │
│  → Semgrep (SAST) → build → Trivy (image + dépendances)               │
│  → Artifact Registry (registre unique de confiance)                   │
│  → déploiement Cloud Run (L3, L6)                                     │
│  Pipeline infra : Terraform fmt/validate/plan → scan IaC              │
│  → approbation → apply (état distant GCS) — tout le socle est en IaC  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. HLD — Version 2 (détaillée)

### 4.1 Vue d'ensemble des flux

Six flux nommés structurent toute la documentation (le LLD, les cas d'utilisation et les tests y font référence par leur identifiant).

| Flux | Chemin | Nature |
|---|---|---|
| **F1** | Utilisateur → DNS → ALB → Cloud Armor → Cloud Run (app hébergée / dashboard) | Requête applicative |
| **F2** | Cloud Run (API) → Direct VPC egress → PSA → Cloud SQL (IP privée) | Accès données applicatif |
| **F3** | GitHub Actions → (WIF) → Artifact Registry → Cloud Run | Livraison logicielle |
| **F4** | Toutes couches → Cloud Logging → sink → BigQuery `raw_logs` | Télémétrie sécurité |
| **F5** | Scheduler → enrich-job → ml-embed → BigQuery `VECTOR_SEARCH` → `alert_enrichment` → scoring → dashboard | Détection & enrichissement |
| **F6** | Trivy (CVE du pipeline) → encodage ATT&CK-BERT → jointure avec techniques observées → priorisation | Boucle DevSecOps ↔ SIEM |
| **F7** | GitHub Actions → (WIF) → `terraform plan` → scan IaC → approbation → `terraform apply` → APIs GCP | Provisionnement de l'infrastructure |

Le flux **F6** est le point d'originalité de l'architecture : il relie deux blocs habituellement disjoints (livraison et détection). C'est l'argument central du document ATT&CK-BERT (§5.4), repris ici sans modification.

### 4.2 Schéma détaillé

```
                             UTILISATEURS                    ANALYSTE / ADMIN
                                  │                                │
                                  │  F1                            │  F1
   ╔══════════════════════════════▼════════════════════════════════▼═══════════════════╗
   ║ L1 EDGE      Cloud DNS ── ALB HTTPS (certificats managés) ── Cloud Armor          ║
   ║              · règles WAF préconfigurées OWASP  · rate limiting par IP            ║
   ╚═════════════════╤══════════════════════════════════════╤══════════════════════════╝
                     │ NEG serverless                       │ NEG serverless
   ╔═════════════════▼══════════════════╗   ╔═══════════════▼══════════════════════════╗
   ║ L3  app-elson (Cloud Run)          ║   ║ L3  api-platform (FastAPI, Cloud Run)    ║
   ║  ingress: LB uniquement            ║   ║     dash-secu (Next.js, Cloud Run)       ║
   ║  SA: sa-app-elson                  ║   ║  ingress: LB uniquement · JWT-RBAC (L2)  ║
   ╚═════════╤══════════════════════════╝   ╚═══════╤══════════════════════════════════╝
             │ F2 (Direct VPC egress)               │ F2 (lecture BigQuery + Cloud SQL)
   ╔═════════▼══════════════════════════════════════▼══════════════════════════════════╗
   ║ L4 RÉSEAU   VPC menal-vpc · subnet privé · firewall deny-by-default               ║
   ║             PSA → Cloud SQL privé · Cloud NAT → egress allow-listé (SMTP, APIs)   ║
   ╚═════════╤═══════════════════════════════════════════════════╤══════════════════════╝
             │                                                   │ interne uniquement
   ╔═════════▼═════════════════════════╗      ╔═══════════════════▼═══════════════════╗
   ║ L5 Cloud SQL PostgreSQL           ║      ║ L6 ML  ml-embed (Cloud Run)           ║
   ║    IP privée · HA · PITR · CMEK   ║      ║   ONNX int8 · CPU · min-inst=0        ║
   ╠═══════════════════════════════════╣      ║   --no-allow-unauthenticated          ║
   ║ L5 BigQuery (SIEM)                ║◄─────║   egress: AUCUN                       ║
   ║  raw_logs → detections (Sigma/SQL)║  F5  ║ enrich-job (Cloud Run Job)            ║
   ║  attack_embeddings + index vect.  ║      ║   Cloud Scheduler /5 min              ║
   ║  alert_enrichment → incident_scores║     ╚═══════════════════════════════════════╝
   ╚═════════════════▲═════════════════╝
                     │ F4 sink (filtré)
   ╔═════════════════╧═════════════════════════════════════════════════════════════════╗
   ║ L7 OBSERVABILITÉ   Cloud Logging (audit logs + logs applicatifs)                  ║
   ║                    Cloud Monitoring · uptime /health · politiques d'alerte        ║
   ║                    runbooks (liés aux techniques ATT&CK, cf. dashboard)           ║
   ╚═══════════════════════════════════════════════════════════════════════════════════╝

   ╔═══════════════════════════════════════════════════════════════════════════════════╗
   ║ L2 IDENTITÉ & SÉCURITÉ (transversal)                                              ║
   ║  IAM moindre privilège · 1 compte de service PAR workload (sa-app-elson,          ║
   ║  sa-api-platform, sa-ml-embed, sa-enrich-job, sa-ci-deploy)                       ║
   ║  Secret Manager (secrets applicatifs) · Cloud KMS (CMEK sur SQL/BQ)               ║
   ║  JWT-RBAC applicatif (admin/analyste/utilisateur) · WIF pour la CI                ║
   ╚═══════════════════════════════════════════════════════════════════════════════════╝

   PIPELINE DEVSECOPS (F3, F6)
   GitHub ─► GitHub Actions ─(WIF, sans clé)─► [Gitleaks] ─► [Semgrep SAST] ─► build
        ─► [Trivy: image + dépendances] ──► Artifact Registry ──► deploy Cloud Run
                     │                                                (L3 et L6)
                     └── F6 : CVE Trivy ─► ATT&CK-BERT ─► priorisation par menace observée

   PIPELINE INFRA (F7) — tout le socle en Terraform
   GitHub ─► Actions ─(WIF)─► terraform fmt · validate · plan ─► scan IaC (Trivy config)
        ─► approbation manuelle ─► terraform apply ─► état distant GCS (versionné, privé)
```

Un rendu graphique de ce schéma est fourni séparément (`architecture_HLD.mermaid`).

---

## 5. Application des principes Zero Trust (NIST SP 800-207)

Chaque couche doit pouvoir répondre à la question : *« quel principe Zero Trust cette couche matérialise-t-elle, et que se passe-t-il si elle est contournée ? »*

| Principe (NIST 800-207) | Matérialisation dans MENAL |
|---|---|
| **Ne jamais faire confiance au réseau** | Cloud SQL sans IP publique ; Cloud Run en `ingress: internal-and-cloud-load-balancing` ; `ml-embed` joignable uniquement en interne ; firewall deny-by-default. Être « dans le VPC » ne donne aucun droit : l'IAM est vérifié à chaque appel. |
| **Vérifier explicitement, à chaque requête** | L1 filtre (WAF), L2 authentifie (JWT + IAM), chaque appel service-à-service porte un jeton d'identité du compte de service appelant (`--no-allow-unauthenticated`). |
| **Moindre privilège** | Un compte de service par workload, rôles minimaux. Exemple clef (issu du doc ATT&CK-BERT §9.2) : `sa-enrich-job` peut écrire **uniquement** dans `alert_enrichment` — jamais dans `raw_logs` ni `detections`. *Un moteur de détection ne doit jamais pouvoir modifier les preuves qu'il analyse.* |
| **Supposer la compromission (assume breach)** | Tout est journalisé (F4) ; le SIEM détecte les comportements y compris internes (audit logs IAM) ; les poids du modèle ML sont traités comme un artefact non fiable (safetensors, empreintes, image scannée). |
| **Micro-segmentation** | Séparation par identité et non par périmètre : app hébergée / plateforme / ML / données ont des SAs, des droits et des chemins réseau distincts. |
| **Surveillance et amélioration continues** | L7 + SIEM + matrice de couverture ATT&CK affichant aussi ce que le système **ne détecte pas** ; boucle F6 réinjectant l'observation de menace dans la priorisation des correctifs. |

---

## 6. Revue d'architecte — registre des décisions (ADR)

Chaque décision est **validée** (conservée telle quelle), **retouchée** (ajustée), ou **écartée** (proposée puis refusée), avec justification. C'est ce registre qui prouve que l'architecture est *délibérée* et non accumulée.

| ADR | Décision | Statut | Justification |
|---|---|---|---|
| ADR-01 | Cloud Run comme unique plateforme d'exécution | ✅ Validé | Serverless managé : pas d'OS à durcir, TLS interne, scale-to-zero, identité native par révision. GKE apporterait de la flexibilité dont ce périmètre n'a pas besoin, au prix d'un cluster à opérer. |
| ADR-02 | ALB global + Cloud Armor à l'edge | ✅ Validé | Point d'entrée unique = point de contrôle unique. WAF managé + rate limiting couvrent OWASP en L7 sans composant à maintenir. |
| ADR-03 | Cloud SQL PostgreSQL, IP privée, HA/PITR | ✅ Validé | Correspond exactement au besoin d'ELSON (audit §13.4). HA/PITR marqués « cible prod » : en démonstration, PITR seul suffit — HA doublerait le coût sans valeur pédagogique. |
| ADR-04 | BigQuery comme SIEM (au lieu de Chronicle/Splunk/ELK) | ✅ Validé | Le SIEM est *construit*, pas acheté : c'est la valeur du PFE. BigQuery apporte le stockage, le SQL de détection (règles Sigma traduites), et — décisif — `VECTOR_SEARCH` pour L6 sans base vectorielle dédiée. |
| ADR-05 | ATT&CK-BERT (embedding non génératif) en L6 | ✅ Validé | Repris intégralement du document fourni : sortie déterministe = preuve auditable ; pas de surface d'injection de prompt ; CPU seul ; coût net d'infrastructure assumé et documenté. |
| ADR-06 | Inférence vectorielle déportée dans BigQuery | ✅ Validé | Supprime un composant entier (pgvector/Qdrant/Matching Engine). Cohérent avec l'objectif de simplicité. |
| ADR-07 | Retrait de Docker Hub de la chaîne de livraison | 🔧 Retouche (R5) | Un seul registre de confiance. Les images de base passent par un dépôt *remote* Artifact Registry (proxy en lecture), ce qui conserve l'accès à Docker Hub sans en faire une cible de déploiement. |
| ADR-08 | Workload Identity Federation pour la CI | ➕ Ajout (R6) | Supprime la classe de risque « clé de SA longue durée dans GitHub ». Aligné avec la politique d'organisation `disableServiceAccountKeyCreation`. Coût d'implémentation : une matinée. |
| ADR-09 | Gitleaks en tête de pipeline | ➕ Ajout (R7) | L'audit ELSON démontre le coût d'un secret mal géré. Détection au commit = correction la moins chère du cycle. |
| ADR-10 | JWT-RBAC applicatif conservé (admin/analyste/utilisateur) | ✅ Validé | L'autorisation applicative reste dans l'application ; l'IAM GCP protège l'infrastructure. Les deux plans ne se substituent pas l'un à l'autre. Rôle `analyste` ajouté pour le dashboard SIEM (lecture des incidents, pas d'administration). |
| ADR-11 | Cloud NAT avec egress allow-listé | ✅ Validé | Les applications hébergées ont des sorties légitimes (ELSON : SMTP, API externes). Zero Trust ne signifie pas « aucune sortie » mais « sorties connues, nommées, journalisées ». `ml-embed` fait exception : **egress nul**. |
| ADR-12 | **Terraform comme standard unique de provisionnement** — l'intégralité du socle (L1→L7 + pipeline) est décrite en Terraform | ✅ Validé (renforcé) | Rien n'existe dans GCP qui n'existe d'abord dans le dépôt Terraform. Trois gains : reproductibilité totale (la dette n°1 relevée par l'audit ELSON §4.4.1), revue de sécurité de l'infrastructure **avant** sa création (scan IaC dans le pipeline), détection de dérive (`terraform plan` propre = état conforme). Les commandes `gcloud` sont réservées aux opérations ponctuelles d'exploitation (rotation, réponse à incident), jamais au provisionnement. |

---

## 7. Ce qui est volontairement écarté (et pourquoi c'est une décision, pas un oubli)

À la demande explicite du cadrage (« recommander si des modifications ne sont pas nécessaires »), les éléments suivants ont été **évalués puis écartés**. Les documenter vaut autant que documenter ce qui est retenu.

| Élément écarté | Raison de l'écart | Condition de réévaluation |
|---|---|---|
| **VPC Service Controls** | Périmètre d'exfiltration puissant mais lourd (dry-run, exceptions, dépannage complexe). Disproportionné pour un projet mono-projet de démonstration. | Passage en production réelle multi-équipes avec données réglementées. |
| **GKE / service mesh (mTLS Istio)** | Cloud Run fournit déjà TLS interne + identité par service. Un mesh ajouterait un plan de contrôle entier sans menace résiduelle à couvrir. | Besoin de workloads longs, stateful, ou de politiques L7 est-ouest fines. |
| **Memorystore (Redis)** | Nécessaire uniquement pour des rate-limits distribués et du cache multi-instances — exigence de scalabilité explicitement hors objectif. | Montée en charge réelle multi-instances. |
| **Multi-région / DR inter-région** | Coût ×2, complexité ×3, valeur pédagogique quasi nulle pour la démonstration Zero Trust. PITR + sauvegardes couvrent le risque de perte de données. | Exigence de disponibilité contractuelle. |
| **Binary Authorization** | Excellent contrôle (n'admettre que des images signées), mais son apport marginal après Trivy + registre unique + WIF est faible pour une démonstration. **Mentionné comme évolution naturelle du pipeline.** | Industrialisation ; c'est la première extension recommandée post-PFE. |
| **IAP (Identity-Aware Proxy) devant le dashboard** | Le JWT-RBAC applicatif couvre le besoin du périmètre. IAP ajouterait une fédération Google devant — pertinent en entreprise, redondant ici. **Documenté comme option P2.** | Ouverture du dashboard à des identités d'entreprise (Google Workspace). |
| **LLM génératif pour l'analyse d'incidents** | Écarté par conception (doc ATT&CK-BERT §5.5) : sortie non déterministe, injectable par le contenu des logs — inacceptable dans une chaîne de preuve. | Aucun — le choix non génératif est un contrôle de sécurité, pas une contrainte. |

---

## 8. Exigences non fonctionnelles — cibles assumées

| Exigence | Cible PFE | Commentaire |
|---|---|---|
| Disponibilité | SLO réels instrumentés (99% dispo / 30j, latence p95 < 1s) sur `menal-api` et `elson-api` ; Cloud SQL passé en **régional** (HA) le 08/08/2026 (décision explicite, coût doublé) | Mesuré en continu (Cloud Monitoring), au-delà du "best effort" initialement visé — voir `09_AUDIT_E2E_STAGING_2026-08-07.md` §2 |
| Scalabilité | **Volontairement limitée** (cadrage projet) | Limites connues et documentées : rate-limits par instance, `min-instances` 0–1 sur l'API (relâche le SLO latence de 800ms à 1s, assumé). |
| Performance L6 | Cold start `ml-embed` mesuré : ~27s en moyenne, pic réel ~94s (Cloud Monitoring, 7j) — cause des 503 du 05/08, corrigée le 07/08 (budget de sonde élargi à 150s) | Chiffres initiaux du doc ATT&CK-BERT §6.1 (30-50ms, 2-4s) non recoupés par la mesure réelle ; la mesure fait foi (`09_AUDIT_E2E_STAGING_2026-08-07.md` §3) |
| Sécurité | Zero Trust NIST 800-207 ; DevSecOps avec 3 portes bloquantes (secrets, SAST, CVE) | Cœur du projet. |
| Coût | Paliers gratuits / quelques dizaines d'€/mois ; poste dominant = ingestion de logs (filtres au sink) | Cohérent avec le doc ATT&CK-BERT §6.4. |
| Auditabilité | Chaque inférence ML journalisée (hachage d'entrée, score, version du modèle) ; audit logs GCP activés | Prérequis de la valeur « SIEM ». |

---

## 9. Suite documentaire

| Document | Contenu |
|---|---|
| `02_LLD_MENAL.md` | Conception détaillée couche par couche (L1→L7 + pipeline) |
| `03_CAS_UTILISATION.md` | Cas d'utilisation avec flux nominaux, alternatifs et contrôles exercés |
| `04_METHODOLOGIE_IMPLEMENTATION.md` | Phases, livrables, critères de sortie, plan de tests de démonstration |
| `05_DOCUMENTS_COMPLEMENTAIRES.md` | Matrices (flux, IAM), checklist de mise en service, runbook exemple, modèle de menaces léger |
| `06_ECARTS_IMPLEMENTATION.md` | Écarts vérifiés entre cette conception et l'implémentation réelle — document vivant |
| `08_RUNBOOK.md` | Procédures d'incident (restauration Cloud SQL, rollback Cloud Run) |
| `09_AUDIT_E2E_STAGING_2026-08-07.md` | Audit E2E staging (sécurité, dispo, perf, scalabilité, résilience, reproductibilité) + remédiation appliquée |
| `architecture_HLD.mermaid` | Schéma détaillé rendu graphiquement |
