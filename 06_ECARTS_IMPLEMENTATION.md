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
| E13 | Déploiement par **digest** `@sha256:` (LLD §8, « déploiement par tag interdit ») | Déploiement par **tag SHA de commit** (`menal-api:<sha>`), puis re-tag `latest` | Le tag SHA est immuable en pratique, mais l'invariant documenté n'est pas tenu au sens strict. T10 reste non démontrable |
| E16 | Condition WIF sur la **référence Git** (`main`→dev, tag `vX.Y.Z`→prod) | Condition sur le **dépôt seulement** | T17 (isolation inter-environnements) non démontrable : n'importe quelle branche du dépôt peut obtenir les mêmes droits |
| E17 | Dossier `pipeline/` | **Vide** ; `workflows/security-pipeline.yaml` est orphelin et référence un projet `menal-dev` inexistant | Code mort trompeur pour un lecteur |
| E19 | Un dashboard | **Deux** : `dashboard/` (Next.js, déployé, cible ADR 0001) et `api/dashboard/` (Streamlit, code mort) | Ambiguïté sur ce qui est le produit |

## 3. Écarts comblés depuis (traçabilité)

| Réf. | Écart | Résolution |
|---|---|---|
| E2 | 3 comptes de service au lieu des 6 du LLD §2.1 ; `enrich-job` partageait `sa-pipeline` et héritait du droit d'écrire dans `detections` | **`sa-enrich-job` créé** le 02/08 : lecture du dataset, écriture sur la seule table `alert_enrichment`. Le principe cardinal du HLD §5 est tenu et vérifiable (T4). Voir `STATUT_DEV.md` §8.4 |
| E11 | Aucun pipeline infra F7, aucun scan IaC | **`terraform.yml`** ajouté : `fmt` bloquant, `validate` sur dev + staging, scan IaC Trivy bloquant sur CRITICAL. `plan`/`apply` automatisés restent à faire (décision IAM) |
| E14 | Règles Sigma en fenêtre de 5 min, plus courte que la latence d'ingestion | Fenêtres portées à 15 min avec déduplication `NOT EXISTS`. R2, R3 et R6 voient désormais aussi les tentatives bloquées au bord par le WAF |
| E18 | Secret JWT par défaut présent dans le code | Toujours présent comme valeur de repli en dev, mais **fail-closed hors dev** : l'API refuse de démarrer si le secret n'a pas été injecté |
| — | Le CI ne construisait pas l'image du dashboard | Job `dashboard` ajouté au pipeline (build, scan Trivy, déploiement, smoke test). `ml-embed` et `enrich-job` restent promus manuellement |

---

## Comment maintenir ce document

Il n'a de valeur que s'il est confronté au réel. À relire à chaque évolution d'architecture, et
au minimum avant toute revue ou démonstration : un écart qui disparaît doit passer en §3, un
écart nouveau doit apparaître en §1 ou §2. Un document d'écarts qui ne bouge jamais est le
signe qu'on a cessé de comparer.
