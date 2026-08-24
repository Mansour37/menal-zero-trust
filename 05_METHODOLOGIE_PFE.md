# Méthodologie PFE — Plateforme MENAL
**v1.0 — Juillet 2026**

> **Avant-propos.** Ce document consolide et remplace 04_METHODOLOGIE_IMPLEMENTATION.md, 05_DOCUMENTS_COMPLEMENTAIRES.md (état au 19/08/2026).

---

## Partie A — Méthodologie d'implémentation

### A.1 Approche générale

Trois principes de conduite, cohérents avec les objectifs du projet (simplicité, organisation, clarté) :

1. **Security by design, pas security by review** : chaque phase livre ses contrôles de sécurité *avec* la fonctionnalité, jamais après. Une phase sans critère de sortie sécurité ne se ferme pas.
2. **Incrémental et démontrable** : chaque phase se termine par une démonstration reproductible (commande, capture, ou test rejoué). Le mémoire se construit au fil de l'eau — pas de « phase documentation » finale.
3. **Tout est Terraform** (ADR-12 renforcé) : l'intégralité du socle — L1 à L7 et le pipeline lui-même — est provisionnée exclusivement par Terraform (structure : LLD §10), via le pipeline infra F7 (`fmt → validate → plan → scan IaC → approbation → apply`). Aucune ressource créée à la main dans la console ; les commandes `gcloud` sont réservées à l'exploitation ponctuelle. Les requêtes SQL de détection et les workflows CI sont également versionnés. C'est la réponse directe à la leçon de l'audit ELSON (environnement non reproductible, §4.4.1) : **chaque phase ci-dessous livre son ou ses modules Terraform, et l'`apply` de la phase est son livrable.**

**Ordre des couches :** on construit de l'intérieur vers l'extérieur (identité et réseau d'abord, edge ensuite), puis la détection, puis l'enrichissement ML, puis la restitution. Ordre inverse d'une lecture « par le haut » du schéma, ordre normal d'un déploiement sécurisé : les fondations d'identité conditionnent tout le reste.

### A.2 Stratégie d'environnements (dev → staging → prod)

#### A.2.1 Modèle : un projet GCP par environnement
Trois environnements = **trois projets GCP** — c'est la frontière d'isolation native de GCP (IAM, quotas, facturation, rayon d'impact d'un incident). Un mini-projet d'amorçage complète le dispositif :

| Projet | Rôle | Contenu |
|---|---|---|
| `menal-ops` | Amorçage (seed) | État Terraform (bucket GCS), pool WIF, **Artifact Registry partagé**. Aucun workload, coût quasi nul. Seul élément créé manuellement, une seule fois. |
| `menal-dev` | Construction, itération rapide | Topologie réduite : pas de HA, Cloud Armor en mode *preview*, L6 déployée quand P6 démarre |
| `menal-staging` | Répétition générale | **Iso-topologie prod** (c'est sa seule raison d'être), dimensionnement réduit |
| `menal-prod` | Démonstration / exploitation | Chaîne complète L1→L7 : PITR (+ HA/CMEK documentés en cible), Armor en *deny*, rétention pleine |

#### A.2.2 Deux invariants non négociables
1. **La sécurité n'est jamais un paramètre d'environnement.** Politiques d'organisation, deny-by-default, matrice IAM, ingress LB-only, egress allow-listé : identiques sur les trois environnements. Seuls varient le dimensionnement, la rétention et les options de coût (HA, CMEK) — portés par `envs/{dev,staging,prod}.tfvars` sur les **mêmes modules**.
2. **Build once, promote by digest.** Une image est construite et scannée **une fois** (pipeline F3), poussée dans le registre unique de `menal-ops`, puis **promue** d'environnement en environnement par son digest. Ce qui tourne en prod est, à l'octet près, ce qui a été scanné puis validé en staging — rebuilder par environnement annulerait la valeur des scans.

#### A.2.3 Chaîne de promotion

| Déclencheur Git | Environnement | Portes |
|---|---|---|
| PR (branche feature) | aucun déploiement | Gitleaks + Semgrep + Trivy + `terraform plan` (contrôles seuls) |
| Merge sur `main` | **dev** (automatique) | Pipeline complet ; apply infra auto-approuvé en dev |
| Promotion manuelle (workflow) | **staging** | Même digest ; apply infra avec approbation (1 relecteur) |
| Tag `vX.Y.Z` | **prod** | Même digest ; approbation obligatoire (environnement protégé GitHub) |

WIF : un SA de déploiement **par environnement** (`sa-ci-deploy-{env}`), condition d'attribut sur la référence Git (`main`→dev, tag→prod), et rôles limités **au seul projet cible** : le pipeline dev ne peut structurellement pas toucher prod (test T17).

#### A.2.4 Environnements jetables — la parade au coût
Grâce à la DoD n°4 (tout rejouable par `terraform apply`), dev et staging sont **jetables** : staging n'est créé qu'aux jalons de recette puis détruit ; dev peut être détruit/recréé à la demande. Combiné au scale-to-zero serverless, le surcoût des trois environnements reste marginal — c'est le dividende concret du « tout Terraform ».

### A.3 Phases, livrables, critères de sortie

| Phase | Contenu | Durée indicative | Livrables | Critères de sortie (démontrables) |
|---|---|---|---|---|
| **P0 — Fondation** | **Amorçage `menal-ops`** (bucket d'état GCS versionné/privé — un préfixe d'état par environnement, pool WIF, Artifact Registry partagé, SAs `sa-ci-*`), création des 3 projets d'environnement, pipeline F7 opérationnel, module `00-foundation` (APIs, politiques d'org : `sql.restrictPublicIp`, `disableServiceAccountKeyCreation`, `publicAccessPrevention`) appliqué aux 3 projets, conventions, dépôt structuré | 2 j | Backend d'état + pipeline F7 vert + `00-foundation` appliqué ×3 | Premier `plan → approbation → apply` réussi via le pipeline ; tentative de création d'une clé de SA → **refusée par la politique** (capture) |
| **P1 — Identité & réseau (L2, L4)** | Modules `02-identity` (SAs, bindings de la matrice IAM, Secret Manager, WIF applicative) et `04-network` (VPC, subnet privé, PSA, NAT, pare-feu deny-by-default) | 2–3 j | Modules Terraform appliqués + matrice IAM remplie | `gcloud` avec un SA hors rôle → `PERMISSION_DENIED` ; scan du projet : **0 IP publique de données** |
| **P2 — Données (L5 partie 1)** | Cloud SQL privé (PITR), dataset `siem`, tables `raw_logs`/`detections` (partitionnées, rétention) | 1–2 j | Instances + schémas SQL versionnés | Connexion SQL depuis Internet → impossible ; depuis Cloud Run → OK |
| **P3 — Workloads & edge (L3, L1)** | Déploiement `app-elson` (image d'exemple), `api-platform`, `dash-secu` ; ALB + Cloud Armor (preview→deny) ; ingress LB-only | 2–3 j | Services en ligne via F1 | `curl` de l'URL `*.run.app` directe → refus ; injection test → 403 Cloud Armor |
| **P4 — Pipeline DevSecOps (F3)** | Workflow GitHub Actions : WIF, Gitleaks, Semgrep, build épinglé, Trivy, push Artifact Registry, deploy par digest | 2–3 j | Workflow versionné + 3 captures de refus | Les **3 refus** (secret, SAST, CVE) rejoués et documentés ; déploiement par tag → refusé |
| **P5 — Détection (L7 + L5 partie 2)** | Audit logs, sink filtré → `raw_logs`, 5–8 règles Sigma traduites en requêtes planifiées, politiques d'alerte, uptime checks | 2–3 j | Règles SQL versionnées + alertes | Un événement simulé (énumération IAM) produit une ligne dans `detections` < 10 min |
| **P6 — Enrichissement ML (L6)** | Plan en 8 jours du doc ATT&CK-BERT §13, appliqué tel quel : poids épinglés/safetensors/empreintes → ONNX int8 validé (>0,99) → `attack_embeddings` + index → `ml-embed` durci → `enrich-job` + Scheduler → vue kill-chain → endpoints API | 8 j | `MODEL.sha256`, image, tables, API | Alerte test rattachée avec `similarity` et `source` ; cas `unmapped` observé ; `sa-enrich-job` ne peut pas écrire dans `detections` (test négatif) |
| **P7 — Dashboard & boucle F6** | 4 composants Next.js (matrice ATT&CK, timeline kill-chain, panneau incident, CVE priorisées) + KPI | 2–3 j | Dashboard opérationnel | Le tableau « CVE 7,5 devant CVE 9,8 » s'affiche avec données réelles/simulées |
| **P8 — Recette & promotion** | Création de **staging** par `terraform apply` (mêmes modules, `staging.tfvars`) ; rejeu complet du plan de tests (§A.4) en staging ; évaluation du modèle (TRAM, baselines TF-IDF / MiniLM / SecureBERT, courbe précision-rappel → seuil justifié) et mesures avant/après (§A.5) en staging ; puis **promotion prod** : apply `prod.tfvars` + promotion des digests validés (tag `vX.Y.Z` + approbation) + tests de fumée (T1, T2, T11, T13) rejoués en prod | 4–5 j | Rapport de recette + tableaux de résultats + prod en service | Plan de tests intégralement passé en staging ; **digest prod = digest staging** (T18) ; `terraform plan` vide sur les trois environnements |

**Les phases P1→P7 se déroulent intégralement dans `menal-dev`** ; staging et prod n'apparaissent qu'en P8, par promotion — le coût des trois environnements ne court pas pendant la construction (cf. §A.2.4).

**Total indicatif : ~5 à 6 semaines** à temps plein — compatible avec un calendrier de PFE, avec P6 comme chemin critique.

**Jalons de revue :** fin P1 (revue identité/réseau), fin P4 (revue chaîne de livraison), fin P6 (revue L6), fin P8 (recette finale). À chaque jalon : relire le registre ADR (HLD §6) et confirmer qu'aucune décision n'a dérivé.

### A.4 Plan de tests de démonstration Zero Trust

C'est le cœur de la recette : chaque test est un **contrôle contourné volontairement**, dont l'échec (du contournement) prouve le contrôle. À rejouer en soutenance.

| # | Test (tentative) | Résultat attendu | Contrôle prouvé |
|---|---|---|---|
| T1 | `curl https://app-elson-xxxx.run.app` (contournement de l'edge) | Refus (403/404) | Ingress LB-only (L3) |
| T2 | Connexion PostgreSQL depuis Internet | Timeout/refus — pas d'IP publique | PSA + `restrictPublicIp` (L4/L5) |
| T3 | Appel `ml-embed` sans jeton d'identité (depuis le VPC) | 401/403 | `--no-allow-unauthenticated` (L6) |
| T4 | `INSERT` dans `siem.detections` avec `sa-enrich-job` | `PERMISSION_DENIED` | Intégrité des preuves (L2) |
| T5 | Lecture d'un secret ELSON avec `sa-api-platform` | `PERMISSION_DENIED` | Cloisonnement des secrets (L2) |
| T6 | Création d'une clé JSON de SA | Refus (politique d'org) | Suppression de la classe de risque |
| T7 | Commit contenant un faux secret | Pipeline rouge à l'étape Gitleaks | Porte 1 du pipeline |
| T8 | Injection volontaire (`eval` non filtré) dans une PR | Pipeline rouge à l'étape Semgrep | Porte 2 |
| T9 | Image de base volontairement obsolète | Pipeline rouge à l'étape Trivy | Porte 3 |
| T10 | `gcloud run deploy --image ...:latest` (tag) | Refusé par convention/contrôle du workflow | Déploiement par digest |
| T11 | Requête avec payload SQLi sur F1 | 403 Cloud Armor + trace dans `raw_logs` | WAF (L1) + télémétrie (L7) |
| T12 | Egress non déclaré depuis `app-elson` (domaine hors allow-list) | Bloqué ; deny journalisé, visible au SIEM | Egress contrôlé (L4) |
| T13 | Scénario d'attaque simulé : 3 actions couvrant 3 tactiques ATT&CK sur la même entité en < 1 h | Incident chaîné, bonus +15, preuves listées | Chaîne F4→F5 complète |
| T14 | Événement sans règle Sigma correspondante mais sémantiquement proche d'une technique | Rattachement `semantic` au-dessus du seuil (ou `unmapped` assumé) | Valeur ajoutée du modèle (L6) |
| T15 | Modification manuelle dans la console (ex. : ouvrir une règle de pare-feu) puis `terraform plan` | Le plan détecte et annonce la dérive ; l'apply la corrige | Détection de dérive — l'IaC est la source de vérité (F7) |
| T16 | PR Terraform contenant une ressource volontairement mal configurée (bucket public / SQL en IP publique) | Pipeline infra rouge à l'étape scan IaC (Trivy config) | Porte de sécurité de l'infrastructure |
| T17 | Depuis le pipeline dev (`sa-ci-deploy-dev`), tentative de déploiement vers `menal-prod` | Refus WIF (condition sur la référence Git) et/ou `PERMISSION_DENIED` (rôles limités au projet dev) | **Isolation inter-environnements** (§A.2.3) |
| T18 | Comparaison des digests d'image : prod vs staging vs digest scanné par Trivy | Identiques à l'octet près | **Build once, promote by digest** (§A.2.2) |

### A.5 Mesures avant/après (livrable d'évaluation)

Conformément au doc ATT&CK-BERT (§6.3), cinq métriques mesurées **avant** (règles seules) et **après** (règles + L6), sur le **même jeu de logs** rejoué :

| Métrique | Avant (règles seules) | Après (+ ATT&CK-BERT) |
|---|---|---|
| Rappel de détection (sur scénarios injectés) | à mesurer | à mesurer |
| Taux de consolidation (alertes ÷ incidents) | — | — |
| MTTD | — | — |
| MTTR (avec runbooks liés) | — | — |
| Couverture ATT&CK (techniques observables) | — | — |

Et le coût ajouté, mesuré honnêtement : latence p95 de `ml-embed`, durée de démarrage à froid, taille d'image, coût mensuel estimé. *Un tableau qui montre le prix du gain est plus crédible qu'un tableau qui ne montre que le gain.*

### A.6 Gestion des risques projet

| Risque | Impact | Parade |
|---|---|---|
| Coût/temps de 3 environnements | Budget démo dépassé | **Environnements jetables** (§A.2.4) : staging créé aux jalons puis détruit, dev recréable à la demande ; scale-to-zero serverless |
| Calibration du seuil instable sur les données réelles | L6 peu convaincant | Courbe précision/rappel systématique ; modèle de repli documenté (`MITRE-v16-tactic-bert`, doc ATT&CK-BERT §12.4) |
| Dérive de coût BigQuery (ingestion) | Budget démo dépassé | Filtres d'exclusion au sink **dès P5**, rétention 90 j, partitionnement |
| P6 dépasse les 8 jours | Calendrier | P6 découplée : P5 livre déjà un SIEM fonctionnel par règles — le projet reste soutenable sans L6, L6 devient l'incrément |
| Sur-ingénierie en cours de route | Perte de l'objectif simplicité | Toute addition passe par le registre ADR ; la liste des écarts (HLD §7) fait office de garde-fou |
| Données de démonstration insuffisantes | Dashboard vide | Générateur de scénarios d'attaque simulés (T13/T14) écrit en P5, réutilisé partout |

### A.7 Définition de « terminé » (Definition of Done) du projet

1. Les 18 tests du §A.4 passent et sont documentés (captures + commandes).
2. Le tableau avant/après du §A.5 est rempli avec des mesures réelles.
3. Le registre ADR est à jour et chaque écart (HLD §7) reste justifié.
4. Un déploiement complet depuis un projet GCP vierge est rejouable par **`terraform apply`** (mêmes modules `00`→`07`, `tfvars` par environnement, README d'amorçage) — le critère qui manquait à ELSON ; et `terraform plan` est **vide** sur les trois environnements (aucune dérive, aucune ressource hors IaC).
5. La chaîne de promotion **dev → staging → prod** a été déroulée au moins une fois de bout en bout sur le même digest (T18), avec ses approbations.
6. La soutenance peut dérouler : 1 schéma (HLD V2) → 1 attaque simulée → 1 incident enrichi → 1 tableau CVE priorisées → 1 refus de pipeline → 1 promotion en prod. Six preuves, quinze minutes.

---

## Partie B — Documents complémentaires opérationnels

Au-delà du HLD/LLD, quatre documents font réellement gagner du temps en implémentation — fournis ci-dessous **déjà remplis** pour ce périmètre et maintenus comme documents vivants : la matrice des flux réseau, la checklist de mise en service, les runbooks d'incident, et un modèle de menaces léger. Deux documents habituellement proposés ne sont **pas nécessaires** ici et ne sont pas repris : le registre ADR (déjà intégré au HLD §6) et la matrice IAM (déjà intégrée au LLD §2.1). De même, une spécification OpenAPI complète des 225 endpoints, un RACI multi-équipes ou un plan de capacité sont écartés — documents d'industrialisation multi-équipes, hors de portée d'un PFE mono-porteur ; FastAPI génère déjà l'OpenAPI de l'API plateforme automatiquement.

### B.1 Matrice des flux réseau

Règle de lecture : **tout flux absent de cette matrice est interdit** (deny-by-default). Chaque ligne cite le mécanisme qui l'autorise et celui qui l'authentifie — un flux Zero Trust a toujours les deux.

| # | Source | Destination | Proto/Port | Autorisé par | Authentifié par | Flux HLD |
|---|---|---|---|---|---|---|
| N1 | Internet | ALB | TCP/443 | Frontend LB | TLS + Cloud Armor (filtrage) | F1 |
| N2 | ALB | `app-elson`, `api-platform`, `dash-secu` | HTTPS (NEG serverless) | Ingress `internal-and-cloud-load-balancing` | — (auth applicative en aval) | F1 |
| N3 | `app-elson` / `api-platform` | Cloud SQL (IP privée) | TCP/5432 | Direct VPC egress + PSA | IAM `cloudsql.client` + SSL | F2 |
| N4 | `api-platform` | BigQuery `siem` | API Google (Private Google Access) | PGA | IAM **lecture seule** | F2 |
| N5 | `enrich-job` | `ml-embed` | HTTPS interne | Ingress `internal` | Jeton d'identité `sa-enrich-job` (`run.invoker`) | F5 |
| N6 | `enrich-job` | BigQuery | API Google | PGA | IAM (écriture limitée à `alert_enrichment`, `pending_embeddings`) | F5 |
| N7 | Cloud Scheduler | `enrich-job` | HTTPS | Cible Cloud Run Job | Jeton `sa-scheduler` (`run.invoker`) | F5 |
| N8 | `app-elson` | SMTP fournisseur / APIs externes déclarées | TCP/587, 443 | **Cloud NAT — allow-list** | Credentials applicatifs (Secret Manager) | — |
| N9 | GitHub Actions | Artifact Registry / Cloud Run API | HTTPS | Internet → APIs Google | **WIF** (jeton 10 min) | F3 |
| N10 | Cloud Logging (sink) | BigQuery `raw_logs` | interne Google | Sink configuré | SA du sink (writer sur `raw_logs` uniquement) | F4 |
| ∅ | `ml-embed` | **toute destination Internet** | — | **AUCUN — egress nul** | — | contrôle L6 |
| ∅ | `dash-secu` (navigateur) | `ml-embed` ou BigQuery | — | **INTERDIT — passe par l'API** | — | contrôle L3 |

### B.2 Checklist de mise en service (go-live)

**Infrastructure as Code (Terraform — source de vérité)**
- [ ] État distant dans le bucket GCS dédié : versioning actif, accès privé, réservé à `sa-ci-infra` + admin
- [ ] `terraform plan` **vide** sur l'environnement final (aucune dérive, aucune ressource créée hors IaC) — test T15 passé
- [ ] Pipeline infra F7 : refus du scan IaC démontré sur une ressource mal configurée (test T16), apply protégé par approbation
- [ ] Aucune valeur de secret dans le code Terraform ni dans l'état (seuls les conteneurs Secret Manager sont en IaC)
- [ ] Frontière F3/F7 en place : `lifecycle ignore_changes` sur l'image des services Cloud Run (pas de guerre d'états entre pipelines)
- [ ] Promotion validée : **digest prod = digest staging = digest scanné** (test T18) ; isolation inter-environnements prouvée (test T17)

**Fondation & identité**
- [ ] Politiques d'org actives : `restrictPublicIp`, `disableServiceAccountKeyCreation`, `publicAccessPrevention` (test T6 passé)
- [ ] 6 SAs créés, rôles conformes à la matrice IAM (LLD §2.1) ; SA Compute par défaut non utilisé
- [ ] 0 clé de SA existante dans le projet ; WIF restreint au dépôt et à la branche `main`
- [ ] Tous les secrets dans Secret Manager, **un par valeur** ; aucun secret en variable d'env d'image

**Réseau & données**
- [ ] Pare-feu : deny-by-default présent ; journaux activés sur les deny
- [ ] Cloud SQL : IP privée uniquement, `require_ssl`, PITR actif, sauvegarde testée par une restauration (leçon audit ELSON §11.11)
- [ ] BigQuery : partitionnement + expiration `raw_logs` ; filtres d'exclusion posés sur le sink
- [ ] Matrice des flux (§B.1) à jour = configuration réelle (revue croisée)

**Workloads & edge**
- [ ] Tous les services en ingress LB-only ou `internal` ; test T1 passé
- [ ] Déploiements par **digest** ; images multi-stage non-root
- [ ] Cloud Armor : règles en mode deny (fin de la période preview) ; test T11 passé
- [ ] `ml-embed` : `--no-allow-unauthenticated`, egress nul, `HF_HUB_OFFLINE=1`, empreinte `MODEL.sha256` vérifiée au build

**Pipeline & détection**
- [ ] Les 3 refus du pipeline (T7, T8, T9) documentés avec captures
- [ ] Règles de détection versionnées ; requêtes planifiées actives ; alerte de bout en bout testée (T13)
- [ ] Uptime checks verts ; politiques d'alerte notifiant un canal réel
- [ ] KPI du dashboard alimentés (dont taux `unmapped` et version du modèle)

**Documentation**
- [ ] Registre ADR à jour ; runbooks (§B.3) publiés et liés depuis le dashboard
- [ ] Rejeu complet depuis un projet vierge validé une fois (Definition of Done n°4, §A.7)

### B.3 Runbooks d'incident

#### B.3.1 Modèle (une page par famille de techniques)

```
RUNBOOK <ID-TECHNIQUE> — <Nom>
Déclencheur     : détection (règle Sigma <id> ou rattachement sémantique ≥ seuil)
Gravité type    : <basse|moyenne|élevée> — ajustée par le score d'incident
1. VÉRIFIER     : preuves à consulter (requête BigQuery fournie), faux positifs connus
2. CONTENIR     : actions immédiates réversibles
3. ÉRADIQUER    : actions correctives
4. RÉTABLIR     : retour au nominal + vérifications
5. CAPITALISER  : ce que la détection doit apprendre (nouvelle règle ? seuil ?)
Rôles           : analyste (1–2), admin (3–4)
```

#### B.3.2 Exemplaire rempli — T1078.004 « Valid Accounts: Cloud Accounts »

*(usage anormal d'un compte de service — le scénario de l'exemple d'incident du doc ATT&CK-BERT §10.2)*

1. **VÉRIFIER** — Dans le panneau d'incident : entité, fenêtre, techniques associées et leurs `similarity`. Requête sur `raw_logs` : dernières actions IAM/API du SA concerné, IP sources, comparaison à son comportement des 7 derniers jours. Faux positif connu : exécution du pipeline (activité de `sa-ci-deploy` pendant un déploiement).
2. **CONTENIR** — Désactiver le SA (`gcloud iam service-accounts disable`) **ou**, si le service est critique, restreindre d'abord par retrait du rôle le plus sensible. Noter l'heure exacte pour la timeline.
3. **ÉRADIQUER** — Identifier l'origine (secret exposé ? workload compromis ?). Faire tourner les secrets associés (Secret Manager, nouvelles versions), redéployer la révision Cloud Run.
4. **RÉTABLIR** — Réactiver avec rôles minimaux revalidés contre la matrice IAM ; vérifier T4/T5 sur ce SA.
5. **CAPITALISER** — Si la détection est venue du rattachement sémantique (source `semantic`), promouvoir le motif en règle Sigma explicite ; réévaluer le seuil si la `similarity` était limite.

### B.4 Modèle de menaces léger (une page)

Menaces retenues (vocabulaire ATT&CK, cohérent avec le SIEM), contrôle principal et test qui le prouve :

| Menace | Technique ATT&CK type | Contrôle principal | Test |
|---|---|---|---|
| Exploitation d'une application exposée | T1190 | Cloud Armor WAF + correctifs priorisés (F6) | T11, UC-05 |
| Vol / abus d'identifiants cloud | T1078.004 | 0 clé de SA, WIF, moindre privilège, détection IAM | T6, T4, runbook §B.3.2 |
| Compromission de la chaîne d'approvisionnement | T1195 | Registre unique, digest, Gitleaks/Semgrep/Trivy, poids ML safetensors + empreintes | T7–T10 |
| Mouvement latéral interne | T1021 / T1580 | Ingress internes, IAM par appel, deny journalisés | T1, T3, T12 |
| Exfiltration de données | T1567 | Egress allow-listé, `ml-embed` sans egress, dashboard en lecture seule | T12, T5 |
| Altération des preuves de détection | (anti-forensics) | Séparation stricte écriture/lecture sur le SIEM | T4 |
| Manipulation du composant IA | (injection de prompt) | **Écartée par conception** : modèle non génératif, entrée tronquée, sortie = 768 flottants | — (argument doc ATT&CK-BERT §5.5) |

Chaque ligne se lit de gauche à droite : *menace nommée → contrôle nommé → preuve rejouable*. C'est la version condensée de toute la démarche.

---

## Partie C — Feuille de route de l'audit "tous layers" (à partir du 19/08/2026)

**Contexte.** Le 18-19/08/2026, un premier audit a couvert 4 domaines (détection/SIEM, réseau/segmentation, IAM, MFA dashboard) via des agents IA en posture d'expert senior, suivi de correctifs validés en code (non encore déployés). Le détail est dans `02_SECURITE_AUDITS_ECARTS.md`. Pour couvrir l'ensemble des couches de l'architecture à niveau architecte, la suite est planifiée en sessions bornées — chacune sur 2-3 domaines liés, avec le même schéma (audit expert parallèle → correctifs → validation → mise à jour des 5 documents de référence existants, sans en créer de nouveaux). Chaque session vérifie d'abord si un mécanisme équivalent existe déjà ailleurs dans le projet avant de corriger, pour ne pas dupliquer un composant qui répond déjà au même objectif.

**Principe transverse à chaque session :** rester borné (2-4 agents experts en parallèle maximum, pas 10 domaines d'un coup) — projet PFE, pas plateforme d'entreprise.

| Session | Domaines couverts | Objectif |
|---|---|---|
| ✅ Session réalisée (19/08) | Détection/SIEM, réseau/segmentation, IAM, MFA dashboard | Fait — voir `02_SECURITE_AUDITS_ECARTS.md` |
| **N+1 — Infra & Data** | Architecture cloud (Cloud Run, autoscaling, CMEK/KMS), couche donnée (gouvernance BigQuery, DR Cloud SQL au-delà du RTO/RPO déjà mesuré), edge/CDN (approfondir Cloud Armor) | Comment la plateforme tourne et stocke la donnée |
| **N+2 — Credentials & Supply Chain** | Secrets/Secret Manager (rotation), **Docker Hub en compte personnel (déjà identifié URGENT le 05/08, jamais traité)**, CI/CD (droits du pipeline), scan d'images/dépendances | Ce qu'un attaquant pourrait voler ou empoisonner en amont |
| **N+3 — Applicatif & Elson/ML** | RBAC dashboard au-delà du MFA, sécurité de la stack Elson en tant qu'application (pas seulement son intégration IAM/réseau), pipeline ML (`enrich-job`/`ml-embed`) | Les composants applicatifs eux-mêmes |
| **N+4 — Synthèse finale & déploiement réel** | Revue croisée de toutes les sessions précédentes, `terraform apply` réel en staging (les correctifs IAM/réseau/MFA du 19/08 ne sont encore que du code non déployé), mise à jour finale des 5 documents, verdict final défendabilité/commercialisation/Zero Trust | Clôture — sans déploiement réel, le reste n'est que du code validé hors ligne |

**Total estimé : 4 sessions supplémentaires** après celle du 19/08 pour une couverture "tous layers" défendable en soutenance.
