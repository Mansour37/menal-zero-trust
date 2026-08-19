# 03 — Journal des décisions d'architecture (ADR)

Ce document consolide l'intégralité des Architecture Decision Records (ADR) du projet MENAL
Zero Trust. Chaque ADR est reproduit **intégralement**, sans résumé, dans son ordre numérique.

## Table des matières

| N° | Titre | Statut | Domaine |
|---|---|---|---|
| [ADR-0001](#adr-0001--choix-du-framework-frontend--nextjs) | Choix du framework frontend — Next.js | Accepté | Frontend / Dashboard |
| [ADR-0002](#adr-0002--ml-embed-sans-compte-de-service-dédié--exécution-sous-sa-pipeline) | `ml-embed` sans compte de service dédié — exécution sous `sa-pipeline` | Accepté (écart temporaire assumé — pas une conception cible) | IAM |
| [ADR-0003](#adr-0003--ml-embed-exclu-du-pipeline-ci--déploiement-manuel-maintenu) | `ml-embed` exclu du pipeline CI — déploiement manuel maintenu | Accepté (écart temporaire assumé, réévaluation urgente recommandée) | CI/CD |
| [ADR-0004](#adr-0004--géo-blocage-cloud-armor--ue--maghreb--mauritanie) | Géo-blocage Cloud Armor — UE + Maghreb + Mauritanie | Accepté (décision réelle, formalisée rétroactivement) | Réseau / WAF |
| [ADR-0005](#adr-0005--rate-limiting-cloud-armor-à-deux-couches--anti-bruteforce-ciblé--anti-ddos-global) | Rate-limiting Cloud Armor à deux couches — anti-bruteforce ciblé + anti-DDoS global | Accepté (décision réelle, formalisée rétroactivement) | Réseau / WAF |
| [ADR-0006](#adr-0006--subnet-publique-provisionnée-mais-non-utilisée) | Subnet publique provisionnée mais non utilisée | Accepté (écart temporaire assumé — conservation/retrait non tranché) | Réseau |
| [ADR-0007](#adr-0007--logs-de-deny-pare-feu-et-logs-nat-non-activés) | Logs de deny pare-feu et logs NAT non activés | **Résolu le 2026-08-19** (accepté le 2026-08-11) | Réseau / Logging / SIEM |
| [ADR-0008](#adr-0008--cadence-de-enrich-job-à-15-minutes-au-lieu-de-5-minutes-planifiées) | Cadence de `enrich-job` à 15 minutes (au lieu de 5 minutes planifiées) | Accepté (rationale qualitative — validation chiffrée manquante) | SIEM / ML |
| [ADR-0009](#adr-0009--découpage-des-tables-bigquery-du-siem--une-table-par-frontière-de-confiance) | Découpage des tables BigQuery du SIEM — une table par frontière de confiance | Accepté (décision réelle, consolidée) | SIEM / IAM |
| [ADR-0010](#adr-0010--vector_search-bigquery-plutôt-quune-base-vectorielle-dédiée) | `VECTOR_SEARCH` BigQuery plutôt qu'une base vectorielle dédiée | Accepté (décision déjà validée — ADR-06 du HLD ; ajoute métriques manquantes) | SIEM / ML |
| [ADR-0011](#adr-0011--attckbert--enrichissement-informationnel-non-joint-au-scoring-dincident) | ATT&CK-BERT — enrichissement informationnel, non joint au scoring d'incident | Accepté (écart temporaire assumé — décision à trancher explicitement) | SIEM / ML |
| [ADR-0012](#adr-0012--généralisation-du-socle-à-n-applications-modulesapp-service-modulesdashboard) | Généralisation du socle à N applications (`modules/app-service`, `modules/dashboard`) | Accepté (décision réelle, formalisée rétroactivement) | Multi-app |
| [ADR-0013](#adr-0013--double-convention-de-nommage-tenant-dans-le-siem) | Double convention de nommage tenant dans le SIEM | Accepté (décision réelle, formalisée rétroactivement — limitation reconnue) | Multi-app / SIEM |
| [ADR-0014](#adr-0014--déploiement-elson-mono-instance-pas-de-migration-vers-un-cache-distribué) | Déploiement Elson mono-instance (pas de migration vers un cache distribué) | Accepté (décision réelle, formalisée rétroactivement — plafond de capacité assumé) | Multi-app |
| [ADR-0015](#adr-0015--deux-clés-cmek-distinctes-régionale-pour-sqlbqgcs-globale-pour-secret-manager) | Deux clés CMEK distinctes (régionale pour SQL/BQ/GCS, globale pour Secret Manager) | Accepté (décision réelle, formalisée rétroactivement) | CMEK / Sécurité |

Ce document consolide l'ensemble des fichiers du dossier docs/adr/ (état au 19/08/2026).

---

## ADR-0001 — Choix du framework frontend — Next.js

# ADR 0001 : Choix du framework frontend — Next.js

**Statut :** Accepté
**Date :** 2026-07-30
**Auteur :** Équipe MENAL Zero Trust

## Contexte

Le HLD (architecture cible) spécifie Next.js pour le dashboard de sécurité.
Pendant le développement initial, un dashboard Streamlit a été déployé par souci de rapidité
(prototypage Python avec BigQuery).

Ce hiatus entre le HLD et l'implémentation réelle crée une dette architecturale.

## Décision

Revenir à **Next.js** comme prévu dans le HLD, et décommissionner le dashboard Streamlit.

Justifications :

- **HLD alignment** — Le HLD et les schémas d'architecture montrent Next.js ; tout écart
  doit être intentionnel et documenté.
- **SSR & performance** — Next.js permet un rendu serveur, des layouts complexes,
  et une meilleure expérience utilisateur qu'une SPA multithread Streamlit.
- **Typage** — TypeScript/Next.js apporte des types forts, un écosystème de composants
  mature (MUI, Tremor, shadcn/ui) et une maintenabilité supérieure pour une app
  appelée à évoluer (tableaux de bord multi-vues, graphiques interactifs, exports).
- **Séparation API/UI** — Le dashboard Streamlit appelle BigQuery directement.
  Next.js + une BFF (Backend For Frontend) renforce le Zero Trust (pas d'accès BQ
  depuis le navigateur).
- **Équipe** — Le choix initial de Streamlit n'a pas été challengé. Cet ADR formalise
  le retour au plan.

## Conséquences

| Aspect | Impact |
|--------|--------|
| **Délai** | Réécriture du dashboard en Next.js (estimé 2-3 sprints). |
| **I18n / Auth** | NextAuth.js + OIDC possible ; l'authentification HMAC actuelle (Streamlit) n'est plus nécessaire. |
| **Backend** | Une couche API (App Router API routes ou API Gateway) sert les données BQ au frontend. |
| **Migration** | Période de transition : les deux dashboards coexisteront jusqu'à ce que Next.js atteigne la parité fonctionnelle. |
| **Streamlit** | Décommissionné après validation du nouveau dashboard. |

## Alternatives rejetées

- **Conserver Streamlit** — Plus rapide mais non aligné HLD, extension difficile,
  pas de SSR, couplage BQ direct.
- **Vue.js / Svelte** — Valides mais Next.js est déjà dans le HLD et mieux connu de l'équipe.

## Références

- HLD v1.2 — Section Dashboard
- Dossier `api/dashboard/` (Streamlit actuel, à décommissionner)

---

## ADR-0002 — `ml-embed` sans compte de service dédié — exécution sous `sa-pipeline`

# ADR 0002 : `ml-embed` sans compte de service dédié — exécution sous `sa-pipeline`

**Statut :** Accepté (écart temporaire assumé — pas une conception cible)
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Écart tracé :** `06_ECARTS_IMPLEMENTATION.md` E29 · `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §2 (C1)

## Contexte

Le LLD (`02_LLD_MENAL.md` §2.1) spécifie un compte de service `sa-ml-embed` dédié au service
Cloud Run `ml-embed`, **sans aucun rôle de données** — le principe cardinal du HLD §5 étant
qu'un composant qui encode du texte en vecteurs ne doit jamais pouvoir lire ni écrire dans le
SIEM.

Dans l'implémentation réelle, `sa-ml-embed` n'existe pas. `ml-embed` s'exécute sous
`sa-pipeline` (`terraform/modules/ml-pipeline/main.tf:44`, `var.pipeline_sa_email`) — le même
compte de service que celui utilisé pour les requêtes planifiées de détection Sigma et,
jusqu'au 02/08/2026, pour `enrich-job`. `sa-pipeline` détient `roles/bigquery.dataEditor`
**au niveau projet** (`terraform/modules/iam/main.tf:63-67`), un droit d'écriture sur
l'intégralité du dataset BigQuery actuel et futur — bien au-delà du besoin réel de `ml-embed`
(encoder du texte, ne jamais toucher aux données).

Ce n'est pas une situation nouvelle : le même schéma (`enrich-job` partageant `sa-pipeline` et
héritant de ce droit d'écriture excessif) a déjà été identifié et corrigé le 02/08/2026 par la
création de `sa-enrich-job` (`06_ECARTS_IMPLEMENTATION.md` E2). Ce correctif n'a cependant
jamais été répliqué pour `ml-embed`, qui reste dans le même état que celui qui a motivé la
correction d'`enrich-job`.

## Décision

**Accepté comme écart temporaire le 11/08/2026** — `ml-embed` continue de s'exécuter sous
`sa-pipeline` pour cette itération du projet.

Ce n'est **pas un choix d'architecture** au même titre que les écarts assumés E5/E6/E7/E12/E15
de `06_ECARTS_IMPLEMENTATION.md` §1, qui reposent chacun sur une contrainte technique réelle
(un critère d'acceptation qui échoue, une latence d'ingestion, un budget de démonstration). Ici,
il n'existe **aucune contrainte technique** qui empêche de créer `sa-ml-embed` — c'est un
report faute de temps disponible (contrainte stagiaire seul, cahier des charges §7.2), formalisé
pour ne pas rester silencieux plutôt que présenté comme un renoncement définitif.

**Action de remédiation identifiée, non planifiée cette itération :**
1. Créer `sa-ml-embed` dans `terraform/modules/iam/main.tf`, sans aucun rôle BigQuery.
2. Assigner ce nouveau compte à `ml-embed` dans `terraform/modules/ml-pipeline/main.tf:44`
   (remplacer `var.pipeline_sa_email` par une nouvelle variable dédiée).
3. Vérifier si `sa-pipeline` a encore besoin de `bigquery.dataEditor` au niveau projet une fois
   `ml-embed` détaché (les requêtes planifiées de détection Sigma pourraient n'avoir besoin que
   d'un rôle plus étroit — à investiguer avant de retirer le binding, pour ne pas casser la
   chaîne de détection en corrigeant ce problème).

**Condition de réévaluation :** avant toute promotion en environnement de production, avant
l'onboarding d'une troisième application cliente sur le socle, ou à la prochaine revue de la
matrice IAM — ce qui arrive en premier.

## Conséquences

| Aspect | Impact |
|---|---|
| **Sécurité** | `ml-embed` hérite d'un droit d'écriture sur tout le dataset BigQuery via l'identité partagée `sa-pipeline` — écart Zero Trust réel tant que non corrigé, même si aucune exploitation n'a été observée |
| **Documentation** | La table IAM du LLD §2.1 (qui affirme `sa-ml-embed` sans rôle de données) reste la **cible**, pas l'état réel — cet ADR et `06_ECARTS_IMPLEMENTATION.md` E29 font foi sur l'état réel, conformément à la convention du projet |
| **Effort de correction** | Faible — le même patron qu'`E2` (création de `sa-enrich-job`) est directement réutilisable |
| **Soutenance** | L'écart est documenté et assumé explicitement plutôt que découvert en question de jury — c'est le point que cet ADR sécurise |

## Alternatives rejetées

- **Retirer `bigquery.dataEditor` de `sa-pipeline` sans créer `sa-ml-embed`** — rejeté sans
  investigation préalable : les requêtes planifiées de détection Sigma tournent peut-être encore
  sous ce même compte et pourraient se casser silencieusement (même classe d'incident que celui
  du 10/08 sur `enrich-job`, commit `3e024fa`).
- **Marquer l'écart comme assumé sans échéance ni condition de réévaluation** — rejeté : ce
  serait masquer un vrai écart Zero Trust derrière le vocabulaire d'un ADR, sans la
  justification technique que portent les autres écarts assumés du projet.

## Références

- `02_LLD_MENAL.md` §2.1 (table IAM cible)
- `terraform/modules/iam/main.tf:63-67` (binding `bigquery.dataEditor` projet sur `sa-pipeline`)
- `terraform/modules/ml-pipeline/main.tf:44` (`ml-embed` assigné à `sa-pipeline`)
- `06_ECARTS_IMPLEMENTATION.md` E29 (cet écart) et E2 (précédent équivalent, corrigé, sur `enrich-job`)
- `STATUT_DEV.md` §8.4
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §2 (C1)

---

## ADR-0003 — `ml-embed` exclu du pipeline CI — déploiement manuel maintenu

# ADR 0003 : `ml-embed` exclu du pipeline CI — déploiement manuel maintenu

**Statut :** Accepté (écart temporaire assumé, réévaluation urgente recommandée)
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Écart tracé :** `06_ECARTS_IMPLEMENTATION.md` (section "Écarts comblés", ligne dashboard/CI) · `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E5)

## Contexte

Le commit `3e024fa` (10/08/2026, *« fix(ci): déployer enrich-job en CI (image restait figée
depuis 5 jours) »*) a ajouté à `.github/workflows/ci.yml` un job de build/scan/déploiement pour
`enrich-job`, qui n'existait pas jusque-là. Avant ce correctif, l'image Cloud Run Job
d'`enrich-job` datait du 03/08 et n'avait jamais été redéployée automatiquement : après une
migration de schéma sur `detections.id` le 10/08, la jointure entre `detections` et
`alert_enrichment` s'est cassée **silencieusement** — le job continuait de s'exécuter sans
erreur visible, mais produisait un enrichissement non joint pendant environ une semaine. C'est
exactement le mode de défaillance que `06_ECARTS_IMPLEMENTATION.md` cite en introduction comme
raison d'être du document (*« un composant échoue soixante fois d'affilée sans que personne le
remarque »*).

Le pipeline CI construit et déploie aujourd'hui `dashboard` (ajouté avant le 07/08) et
`enrich-job` (ajouté le 10/08). **`ml-embed` reste hors CI** : aucun job de `ci.yml` ne
référence `api/ml-embed` pour le build, le scan ou le déploiement — seul un
`api/ml-embed/cloudbuild.yaml` manuel existe, déclenché à la main.

`ml-embed` est exactement dans la même situation qu'`enrich-job` avant le 10/08 : son image
peut dériver silencieusement de ce que le reste du système attend d'elle (contrat d'API, format
d'entrée/sortie, version du modèle), sans qu'aucun mécanisme automatique ne le détecte ni ne le
corrige.

## Décision

**Accepté comme écart temporaire le 11/08/2026** — `ml-embed` reste déployé manuellement pour
cette itération. Aucun calendrier de correction n'est fixé à ce jour.

Le risque est accepté **en connaissance de cause du précédent `enrich-job`**, faute de temps
disponible pour répliquer immédiatement le même correctif (contrainte stagiaire seul, cahier
des charges §7.2) — pas parce que le risque est jugé négligeable. C'est la distinction que cet
ADR formalise : un écart accepté sciemment, avec son précédent documenté, n'est pas la même
chose qu'un oubli.

**Action de remédiation identifiée, effort estimé faible :** répliquer dans `ci.yml` le même
patron que le job `enrich-job` ajouté le 10/08 (build → scan Trivy bloquant sur CRITICAL →
`gcloud run deploy`/`services update` pour `ml-embed`), avec la même logique de déclenchement
(pas de trigger manuel nécessaire si le service est simplement redéployé à chaque changement
pertinent).

**Condition de réévaluation :** dès que du temps est disponible dans le calendrier du projet — à
traiter comme la prochaine action CI/CD prioritaire, avant toute autre évolution de la couche
ML, et impérativement avant toute promotion en environnement de production.

## Conséquences

| Aspect | Impact |
|---|---|
| **Fiabilité** | Risque réel de dérive silencieuse entre `ml-embed` et les composants qui en dépendent (`enrich-job`, contrat d'API) — même classe de risque que l'incident du 10/08, non hypothétique |
| **Documentation** | La ligne de `06_ECARTS_IMPLEMENTATION.md` §3 (*« `ml-embed` et `enrich-job` restent promus manuellement »*) est **partiellement obsolète** depuis le 10/08 — `enrich-job` est désormais en CI, seul `ml-embed` reste manuel. À corriger dans la prochaine relecture du document |
| **Effort de correction** | Faible — patron directement réutilisable depuis le job `enrich-job` du 10/08 |
| **Soutenance** | Le risque est documenté et son précédent concret cité, plutôt que découvert en question de jury |

## Alternatives rejetées

- **Ne rien documenter (statu quo silencieux)** — rejeté explicitement : c'est le type d'angle
  mort qui vient de coûter une semaine de jointure cassée sur `enrich-job`. Le laisser sans trace
  écrite reproduirait la même erreur méthodologique.
- **Corriger immédiatement, avant tout autre travail** — envisagé mais non retenu pour cette
  itération : arbitrage de temps explicite en faveur des ADR IAM et du cahier des charges,
  documenté ici pour que ce ne soit pas un simple oubli mais un choix de priorisation traçable.

## Références

- Commit `3e024fa` (« fix(ci): déployer enrich-job en CI »)
- `.github/workflows/ci.yml` (job `enrich-job`, modèle à répliquer pour `ml-embed`)
- `api/ml-embed/cloudbuild.yaml` (déploiement manuel actuel)
- `08_RUNBOOK.md` §5 (diagnostic « le pipeline ML n'enrichit plus » — ne couvre pas encore le cas image `ml-embed` figée)
- `06_ECARTS_IMPLEMENTATION.md` (ligne dashboard/CI, à mettre à jour)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E5)

---

## ADR-0004 — Géo-blocage Cloud Armor — UE + Maghreb + Mauritanie

# ADR 0004 : Géo-blocage Cloud Armor — UE + Maghreb + Mauritanie

**Statut :** Accepté (décision réelle, formalisée rétroactivement le 11/08/2026)
**Date de la décision technique :** antérieure au 11/08/2026 (implémentée en code, jamais montée en ADR)
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E1 réseau)

## Contexte

Une règle Cloud Armor de priorité 410 (`terraform/modules/load-balancer/main.tf:56-65`) bloque
en `deny(403)` tout le trafic qui n'est **ni** originaire de l'Union européenne, **ni** du
Maghreb (Tunisie, Algérie, Maroc), **ni** de Mauritanie — pays d'implantation de MENAL SARL —
avec des exemptions ciblées pour le trafic VPC interne, les IP d'administration, et trois routes
précises (`/health`, `GET /`, `GET /login`) nécessaires aux sondes de disponibilité et aux tests
de fumée CI (dont les runners GitHub Actions n'ont pas de région fixe).

Ce contrôle est **actif en production** — il bloque l'essentiel du trafic mondial — mais
n'apparaît nulle part dans `01_HLD_MENAL.md` ni `02_LLD_MENAL.md` (la table de configuration L1
du LLD ne liste que les 4 règles WAF préconfigurées et un rate-limit générique). Il n'existait,
avant cet ADR, que sous forme de commentaire dans le code Terraform — lequel documente déjà une
partie importante du raisonnement, y compris la correction d'un bug réel : la Mauritanie avait
été **omise par erreur** dans une version antérieure de la règle, ce qui bloquait le pays même
de l'entreprise et de ses utilisateurs réels.

## Décision

**Formaliser la géo-restriction comme décision d'architecture délibérée**, avec la portée
suivante :

- **Pays autorisés :** États membres de l'UE (liste ISO explicite dans le code) + Tunisie,
  Algérie, Maroc (bassin d'utilisateurs régional du secteur) + Mauritanie (siège de MENAL SARL).
- **Exemptions structurelles, pas géographiques :** trafic VPC interne (`10.0.0.0/8`) et IP
  d'administration explicitement listées (`var.admin_ip_ranges`) — ces exemptions sautent
  **uniquement** le géo-blocage, elles restent soumises aux règles WAF OWASP (priorités
  1000-1400) et au rate-limiting (priorité 1450/1500). Ce point est un choix de sécurité
  explicite : une règle `allow` de priorité plus haute aurait court-circuité tout Cloud Armor
  (évaluation *first-match-wins*), ce qui aurait laissé les IP admin sans aucune protection
  applicative — rejeté pour cette raison précise (cf. commentaire code).
- **Exemptions de route, pas d'origine :** `/health`, `GET /` et `GET /login` restent accessibles
  hors de la zone géographique autorisée, car aucune n'expose de donnée sensible et leur blocage
  rendrait les sondes de disponibilité aveugles à une vraie panne. `POST /api/login` (la
  soumission réelle d'identifiants), lui, **reste** géo-bloqué et rate-limité.

## Conséquences

| Aspect | Impact |
|---|---|
| **Sécurité** | Réduit fortement la surface d'attaque exposée (la majorité du trafic mondial n'atteint jamais le WAF applicatif) |
| **Disponibilité pour utilisateurs légitimes hors zone** | Un utilisateur ou un contributeur MENAL/Elson voyageant hors de la zone autorisée serait bloqué — risque non quantifié à ce jour |
| **Documentation** | HLD/LLD ne reflètent toujours pas ce contrôle — à corriger lors de la prochaine mise à jour de `02_LLD_MENAL.md` §1 (table de configuration L1) |
| **Processus de révision** | **Aucun processus de révision périodique de la liste des pays n'est défini** — c'est la lacune principale que cet ADR ne comble pas encore (voir Alternatives) |

## Alternatives rejetées

- **Règle `allow` séparée et prioritaire pour les IP admin, au-dessus du géo-blocage** — rejetée
  explicitement (voir commentaire code) : une règle allow terminale de priorité supérieure
  court-circuiterait l'évaluation de toutes les règles suivantes de Cloud Armor, exposant les IP
  admin sans protection WAF ni rate-limit.
- **Bloquer sans exemption de route pour les sondes de disponibilité** — rejeté : un moniteur
  d'uptime ou un test de fumée CI, exécuté depuis une région non listée, recevrait
  systématiquement un 403 non distinguable d'une vraie panne du service — inacceptable pour un
  signal d'exploitation.
- **Ne pas geo-bloquer du tout** — non retenu : le trafic illégitime hors de la zone d'activité
  réelle de l'entreprise ne présente aucune valeur métier à laisser passer jusqu'au WAF applicatif.

## Point de vigilance non résolu

Cet ADR documente une décision déjà en place, il ne tranche pas une question restée ouverte :
**qui revoit la liste des pays, à quelle fréquence, et sur quel signal** (nouveau marché,
utilisateur légitime bloqué signalé, expansion de MENAL) ? À trancher lors d'une prochaine
itération — ce n'est pas un blocage pour la suite du projet, mais un point à ne pas oublier
avant une exploitation en production réelle au-delà du cadre du PFE.

## Références

- `terraform/modules/load-balancer/main.tf:36-65` (règle et commentaire de contexte)
- `02_LLD_MENAL.md` §1 (table L1, à mettre à jour — ce contrôle n'y figure pas)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E1 réseau / E3 dans le rapport détaillé de l'audit réseau)

---

## ADR-0005 — Rate-limiting Cloud Armor à deux couches — anti-bruteforce ciblé + anti-DDoS global

# ADR 0005 : Rate-limiting Cloud Armor à deux couches — anti-bruteforce ciblé + anti-DDoS global

**Statut :** Accepté (décision réelle, formalisée rétroactivement le 11/08/2026)
**Date de la décision technique :** antérieure au 11/08/2026 (implémentée en code, jamais montée en ADR)
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (A4 réseau)

## Contexte

`02_LLD_MENAL.md:44` documente **une seule** règle de rate-limiting : `rate_based_ban`, seuil
« ~100 req/min/IP sur `/api/*` », ban 5 minutes, valeur de départ à calibrer.

L'implémentation réelle (`terraform/modules/load-balancer/main.tf:127-178`) comporte **deux**
règles distinctes, à des seuils très différents de ce chiffre unique :

1. **Priorité 1450 — anti-bruteforce ciblé** : `rate_based_ban`, appliquée uniquement aux
   chemins d'authentification (`auth_paths`, par défaut `/auth/token` et `/api/login`), seuil
   **10 requêtes/minute par IP réelle**, ban de 5 minutes.
2. **Priorité 1500 — anti-DDoS générique** : `throttle`, appliquée à tout le trafic, seuil
   **1000 requêtes/minute par IP**, sans ban (retour à la normale dès que le débit repasse sous
   le seuil).

Le code documente déjà la raison de cette séparation en commentaire (lignes 127-133) : le
limiteur applicatif (`slowapi`, côté FastAPI) est **aveugle** sur le trajet
dashboard → API, qui traverse le Load Balancer deux fois — le dashboard, lui-même derrière le
même LB, ne voit que son IP de sortie **partagée** lorsqu'il relaie une requête vers l'API.
Un attaquant pouvait donc épuiser un compteur applicatif **commun à tous les analystes** et
verrouiller l'accès de toute l'équipe en 12 requêtes non authentifiées. Le rate-limit posé **au
bord**, là où Cloud Armor voit la vraie IP du client, corrige ce défaut : seul l'attaquant réel
est banni.

## Décision

**Formaliser le design à deux couches comme la cible réelle**, en remplacement du chiffre unique
« ~100 req/min sur `/api/*` » du LLD :

- Une couche **stricte et ciblée** sur les points d'entrée sensibles à l'énumération
  d'identifiants (authentification), avec ban temporaire.
- Une couche **large et générique** sur l'ensemble du trafic, en pure protection anti-saturation,
  sans pénaliser un usage normal mais en absorbant un pic volumétrique.

Ce n'est pas un simple ajustement de seuil : c'est un choix architectural — **le rate-limiting
pertinent contre le credential stuffing ne peut pas être posé au niveau applicatif** dans une
topologie où le trafic inter-services traverse le même Load Balancer que le trafic utilisateur.

## Conséquences

| Aspect | Impact |
|---|---|
| **Sécurité** | Corrige une vraie vulnérabilité de verrouillage collectif (déni de service applicatif via un compteur partagé) — pas seulement une amélioration de seuil |
| **Documentation** | `02_LLD_MENAL.md:44` reste à corriger pour refléter les deux couches réelles (déjà noté dans `06_ECARTS_IMPLEMENTATION.md` sous l'angle configuration réseau — cet ADR en documente le *pourquoi*, pas seulement le *quoi*) |
| **Calibration** | Les seuils (10 req/min sur l'auth, 1000 req/min global) sont des valeurs de départ ; aucune courbe de faux positifs/négatifs n'a été mesurée sur trafic réel à ce jour |
| **Ordre des règles** | L'ordre de priorité est significatif et documenté en commentaire : la règle 1500 (`throttle`, `conform_action=allow`) doit rester **après** les règles WAF OWASP (1000-1400), sinon elle court-circuiterait leur évaluation (bug déjà rencontré et corrigé, cf. commentaire code ligne 156-158) |

## Alternatives rejetées

- **Rate-limiting applicatif seul (`slowapi`)** — rejeté : c'est la vulnérabilité identifiée
  elle-même (compteur partagé côté dashboard → verrouillage collectif possible en 12 requêtes).
  Conservé comme défense en profondeur secondaire, pas comme contrôle principal.
- **Un seul seuil global, sans distinction auth vs trafic général** — rejeté : ne protège pas
  spécifiquement le point d'entrée le plus sensible (énumération d'identifiants) sans pénaliser
  un usage API légitime à volume plus élevé.
- **Seuil unique « ~100 req/min/IP sur `/api/*` » du LLD initial** — abandonné en pratique sans
  jamais être formellement révisé dans le document de conception ; cet ADR corrige cet oubli.

## Références

- `terraform/modules/load-balancer/main.tf:127-178` (règles et commentaires de contexte)
- `02_LLD_MENAL.md:44` (valeur à corriger)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (A4)

---

## ADR-0006 — Subnet publique provisionnée mais non utilisée

# ADR 0006 : Subnet publique provisionnée mais non utilisée

**Statut :** Accepté (écart temporaire assumé — décision de conservation/retrait non tranchée)
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (B1)

## Contexte

`terraform/modules/vpc/main.tf:7-19` provisionne, dans chaque environnement, une
`subnet-public-${var.environment}` — CIDR dédié (`var.vpc_cidr_public`), journalisation de flux
activée (`log_config`, échantillonnage 0,5) — en plus de la subnet privée
(`subnet-private-${var.environment}`, la seule avec `private_ip_google_access = true`) et de la
subnet dédiée au connecteur Serverless VPC Access.

Vérification faite le 11/08/2026 (`grep` sur l'ensemble du dépôt) : **aucune ressource
Terraform n'utilise cette subnet publique.** Aucun `google_compute_instance`, aucune ressource
placée dedans. Les environnements (`terraform/environments/{dev,staging}/main.tf`,
`elson.tf`) ne consomment que `module.vpc.vpc_id` et `module.vpc.vpc_connector_id` — jamais
l'identifiant de la subnet publique, alors même que le module l'expose en sortie
(`terraform/modules/vpc/outputs.tf:7`). Le Load Balancer en façade utilise des NEG serverless
(pas cette subnet), et Cloud SQL passe par PSA sur la subnet privée. `02_LLD_MENAL.md:116`
ne mentionne d'ailleurs qu'**un seul** subnet privé — la subnet publique n'est documentée nulle
part, ni comme cible ni comme écart.

Ceci contredit directement le principe de simplicité affirmé en `01_HLD_MENAL.md` §1.3.3 :
*« tout composant doit justifier son existence ; tout composant non justifié est retiré »*.

## Décision

**Accepté comme écart temporaire le 11/08/2026** — la subnet publique est conservée en l'état,
**sans décision tranchée** entre les deux issues possibles listées ci-dessous. Documenter cette
indécision explicitement vaut mieux que de laisser une ressource inexpliquée dans le code, mais
ce n'est pas une clôture du sujet.

**Deux issues possibles, non départagées à ce jour :**
1. **Retirer** la subnet publique et son CIDR dédié — cohérent avec le principe HLD §1.3.3, si
   aucun usage réel n'est prévu.
2. **Conserver et documenter** une utilisation future réelle si elle existe (par exemple : un
   futur bastion d'administration, une ressource qui nécessiterait une IP publique directe hors
   du chemin Cloud Run/LB actuel) — dans ce cas, cet ADR doit être mis à jour pour cesser d'être
   un écart assumé et devenir une décision positive.

## Conséquences

| Aspect | Impact |
|---|---|
| **Sécurité** | Surface d'attaque nulle en pratique aujourd'hui (rien n'écoute sur cette subnet) |
| **Cohérence documentaire** | Contredit le principe de simplicité du HLD tant que non retirée ou justifiée |
| **Coût** | Quasi nul — la subnet elle-même ne coûte rien, mais la journalisation de flux qui lui est associée consomme un peu de volume BigQuery pour une subnet vide |
| **Documentation** | `02_LLD_MENAL.md:116` continue de décrire une topologie à un seul subnet privé, sans même mentionner cet écart — à corriger a minima par un renvoi vers cet ADR |

## Alternatives rejetées

Aucune — c'est précisément la nature de cet écart : la décision elle-même n'a pas encore été
prise. Cet ADR existe pour que l'absence de décision soit visible et traçable, plutôt que
silencieuse.

## Références

- `terraform/modules/vpc/main.tf:7-19` (ressource) et `outputs.tf:7` (sortie non consommée)
- `02_LLD_MENAL.md:116` (topologie documentée, ne mentionne pas cette subnet)
- `01_HLD_MENAL.md` §1.3.3 (principe de simplicité contredit tant que non tranché)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (B1)

---

## ADR-0007 — Logs de deny pare-feu et logs NAT non activés

# ADR 0007 : Logs de deny pare-feu et logs NAT non activés

**Statut :** Résolu le 2026-08-19 (voir « Résolution » ci-dessous) — écart initialement accepté le 2026-08-11
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Écart tracé :** `06_ECARTS_IMPLEMENTATION.md` E31 · `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §2 (C3)

## Contexte

`02_LLD_MENAL.md:118-119` et `01_HLD_MENAL.md` §4-5 affirment que les journaux de deny du
pare-feu et les journaux Cloud NAT sont actifs et alimentent le SIEM (*« Les deny journalisés
alimentent le SIEM (tentatives de mouvement latéral = signal) »*).

Vérification faite le 11/08/2026 sur `terraform/modules/vpc/main.tf` : aucune des quatre règles
de pare-feu (`deny_all_ingress`, `allow_https`, `allow_internal`, `allow_health_checks`) ne
déclare de bloc `log_config` — la journalisation par règle de pare-feu est donc **désactivée**.
La ressource `google_compute_router_nat` (NAT) n'en déclare pas non plus. Côté SIEM,
`terraform/modules/logging/main.tf:30-47` définit pourtant déjà un sink `vpc_to_bq` qui filtre
spécifiquement `jsonPayload.disposition="DENIED"` sur le nom de log
`compute.googleapis.com/firewall` — la chaîne de traitement est prête, mais reçoit
structurellement zéro ligne tant que la journalisation n'est pas activée à la source. Aucun sink
n'existe par ailleurs pour les logs NAT eux-mêmes.

**Nuance à noter :** les deux subnets (publique et privée) ont bien la journalisation de flux
VPC activée (`log_config` avec `flow_sampling = 0.5` sur `terraform/modules/vpc/main.tf:14-18`
et `:29-33`). Ce n'est cependant **pas équivalent** à la journalisation par règle de pare-feu que
le sink `vpc_to_bq` attend : les VPC Flow Logs tracent les connexions au niveau de la subnet,
pas l'attribution précise à une règle de pare-feu (`disposition=DENIED` par règle) sur laquelle
repose le filtre du sink actuel. Une télémétrie réseau partielle existe donc déjà, mais elle
n'est pas branchée sur le sink prévu pour la détection de mouvement latéral.

## Décision

**Accepté comme écart temporaire le 11/08/2026** (`06_ECARTS_IMPLEMENTATION.md` E31). La
détection de mouvement latéral revendiquée en HLD §5 n'est aujourd'hui **pas démontrable** : le
mécanisme de collecte est prêt côté BigQuery mais vide en amont — ce n'est pas un choix de
conception, c'est un composant non terminé.

**Action de remédiation identifiée, non planifiée cette itération :**
1. Ajouter `log_config { metadata = "INCLUDE_ALL_METADATA" }` aux quatre règles de pare-feu.
2. Ajouter la configuration de journalisation équivalente sur `google_compute_router_nat`.
3. **Chiffrer le coût BigQuery avant activation** — c'est la raison explicite du report : activer
   la journalisation de deny sur `deny-all-ingress` (la règle la plus large, priorité 65534)
   sans estimation préalable du volume risquerait de reproduire le problème de coût d'ingestion
   déjà identifié comme poste dominant ailleurs dans le projet (`01_HLD_MENAL.md` §8,
   ATTACK-BERT doc §6.4).

**Condition de réévaluation :** avant toute démonstration ou revue qui s'appuierait sur la
détection de mouvement latéral comme preuve vivante — actuellement, ce n'est pas une preuve
disponible.

## Conséquences

| Aspect | Impact |
|---|---|
| **Sécurité — détection** | Aucune visibilité sur les tentatives de connexion refusées par le pare-feu ou sur les flux NAT sortants — un mouvement latéral réel ne produirait aujourd'hui aucun signal SIEM par cette voie |
| **Documentation** | HLD §5 et LLD §4 continuent d'affirmer ce contrôle comme actif — à corriger ou à faire pointer vers cet ADR et E31 lors de la prochaine mise à jour |
| **Coût** | Report justifié par un chiffrage manquant, pas par un refus de principe |
| **Télémétrie partielle existante** | Les VPC Flow Logs (subnets) offrent déjà une visibilité générale sur le trafic, non branchée sur le sink SIEM actuel — piste à évaluer comme alternative moins coûteuse à la journalisation par règle |

## Résolution (2026-08-19)

Le correctif identifié ci-dessus a été appliqué dans `terraform/modules/vpc/main.tf` :

1. `google_compute_firewall.deny_all_ingress` (seule règle DENY du module, priorité 65534) porte
   désormais `log_config { metadata = "INCLUDE_ALL_METADATA" }`. Les trois autres règles
   (`allow_https`, `allow_internal`, `allow_health_checks`) restent volontairement sans
   `log_config` — ce sont des règles ALLOW à fort volume, non pertinentes pour la détection de
   mouvement latéral et coûteuses à journaliser sans valeur ajoutée.
2. `google_compute_router_nat.nat` porte désormais `log_config { enable = true, filter =
   "ERRORS_ONLY" }`.

**Choix de filtre motivé par le chiffrage de coût demandé au point 3 de la décision initiale :**
plutôt que de chiffrer précisément le volume avant activation, le correctif retient directement
les filtres les plus restrictifs disponibles pour chaque source :
- Pare-feu : seul le DENY le plus large est journalisé (aucune règle ALLOW), ce qui borne le
  volume aux paquets effectivement refusés — le signal recherché par le sink `vpc_to_bq`, sans
  bruit des flux autorisés.
- NAT : `ERRORS_ONLY` plutôt que `ALL` — ne journalise que les échecs NAT (ex. épuisement de
  ports), pas chaque traduction de connexion sortante réussie, ce qui limite fortement le volume
  par rapport à une journalisation complète.

Ce choix évite de reproduire le risque de dérive de coût BigQuery identifié comme raison du
report initial, sans bloquer indéfiniment l'activation sur un chiffrage préalable.

**Risque résiduel assumé :** le filtre NAT `ERRORS_ONLY` ne capte pas les connexions sortantes
réussies (ex. une exfiltration ou un C2 discret qui ne produit aucune erreur réseau ne serait pas
visible dans les logs NAT — seul le deny pare-feu en ingress capterait un mouvement latéral qui
tente une connexion entrante refusée). Cette limite est jugée acceptable au regard du gain de
visibilité obtenu par rapport à l'absence totale de journalisation qui prévalait avant ce
correctif.

## Alternatives rejetées

- **Activer immédiatement sans chiffrage de coût** — rejeté : risque de reproduire un incident de
  dérive de coût BigQuery déjà identifié comme risque projet
  (`04_METHODOLOGIE_IMPLEMENTATION.md` §6).
- **Laisser la documentation affirmer le contrôle sans le corriger ni le signaler** — rejeté :
  c'est l'écart que cet ADR et `06_ECARTS_IMPLEMENTATION.md` E31 existent précisément pour
  éviter.

## Références

- `terraform/modules/vpc/main.tf` (règles de pare-feu et NAT, sans `log_config`)
- `terraform/modules/vpc/main.tf:14-18,29-33` (VPC Flow Logs actifs sur les subnets — télémétrie partielle existante)
- `terraform/modules/logging/main.tf:30-47` (sink `vpc_to_bq`, prêt mais vide en amont)
- `02_LLD_MENAL.md:118-119`, `01_HLD_MENAL.md` §4-5 (affirmations à corriger)
- `06_ECARTS_IMPLEMENTATION.md` E31
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §2 (C3)

---

## ADR-0008 — Cadence de `enrich-job` à 15 minutes (au lieu de 5 minutes planifiées)

# ADR 0008 : Cadence de `enrich-job` à 15 minutes (au lieu de 5 minutes planifiées)

**Statut :** Accepté (décision réelle, rationale qualitative existante — validation chiffrée manquante)
**Date :** 2026-08-11 (formalisation) — décision technique antérieure, déjà tracée E6
**Auteur :** Équipe MENAL Zero Trust
**Écart tracé :** `06_ECARTS_IMPLEMENTATION.md` E6 · `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E9 SIEM/ML)

## Contexte

`ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §4 et `02_LLD_MENAL.md` §5.2/§6 documentent un
déclenchement de `enrich-job` par Cloud Scheduler **toutes les 5 minutes**. L'implémentation
réelle (`terraform/modules/ml-pipeline/main.tf:224`) utilise `schedule = "*/15 * * * *"` — un
cycle de **15 minutes**.

`06_ECARTS_IMPLEMENTATION.md` E6 documente déjà cet écart comme assumé : *« Cadence suffisante au
regard de la latence d'ingestion (sink → normalisation → règle Sigma). Un cycle plus court
multiplierait les réveils du modèle sans gagner en fraîcheur utile. »* Ce raisonnement est
qualitativement solide, mais **aucune métrique ne le corrobore** dans le dépôt : le job expose
pourtant déjà les signaux nécessaires — `menal_backlog` (nombre d'événements en attente
d'enrichissement) et `menal_oldest_pending_age_s` (âge du plus ancien événement non enrichi),
tous deux calculés dans `api/enrich-job/main.py:104-105` — sans qu'aucune valeur observée n'ait
jamais été consignée dans un document du projet.

## Décision

**Formaliser la cadence de 15 minutes comme cible réelle**, en remplacement des « 5 minutes »
documentées ailleurs, avec le raisonnement qualitatif d'E6 comme justification de premier
niveau.

**Action de remédiation identifiée pour fermer complètement cet ADR, non réalisée à ce jour :**
extraire un échantillon des valeurs `menal_backlog` / `menal_oldest_pending_age_s` sur une
période représentative (Cloud Monitoring, ces métriques sont déjà émises) et les consigner ici,
pour transformer une justification qualitative en preuve chiffrée — exactement la démarche déjà
appliquée avec succès à la décision fp32/int8 (`06_ECARTS_IMPLEMENTATION.md` E7,
`ATTACK-BERT_Integration_SIEM_ZeroTrust.md`, en-tête), qui sert de modèle de rigueur pour cette
famille de décisions.

## Conséquences

| Aspect | Impact |
|---|---|
| **Fraîcheur de détection** | Un événement peut attendre jusqu'à 15 minutes avant enrichissement sémantique — acceptable pour un usage d'investigation, à documenter explicitement si un usage temps réel était envisagé |
| **Coût / charge** | Moins de réveils du service `ml-embed` (scale-to-zero) qu'à 5 minutes — direction cohérente avec l'objectif de coût du projet, mais non quantifiée |
| **Documentation** | `ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §4 continue d'afficher « /5 min » dans son schéma — à corriger pour refléter la cadence réelle |
| **Rigueur de la preuve** | Écart entre les autres décisions bien chiffrées du projet (ex. E7) et celle-ci, qui reste qualitative — à ne pas présenter comme un choix aussi solidement validé que E7 tant que les métriques ne sont pas consignées |

## Alternatives rejetées

- **Revenir à 5 minutes** — non retenu : multiplierait les réveils du service sans gain de
  fraîcheur démontré, selon le raisonnement qualitatif existant (non contredit par une donnée
  contraire, seulement non confirmé positivement).
- **Laisser l'écart uniquement dans `06_ECARTS_IMPLEMENTATION.md` sans ADR dédié** — rejeté :
  cet ADR permet d'exposer explicitement l'action de remédiation restante (chiffrer le backlog),
  que la table d'écarts, plus terse, ne portait pas.

## Références

- `terraform/modules/ml-pipeline/main.tf:216-224` (ressource `enrich_trigger`)
- `api/enrich-job/main.py:104-105` (métriques `menal_backlog`, `menal_oldest_pending_age_s`)
- `ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §4 (schéma à corriger)
- `06_ECARTS_IMPLEMENTATION.md` E6 et E7 (modèle de rigueur pour la remédiation)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3

---

## ADR-0009 — Découpage des tables BigQuery du SIEM — une table par frontière de confiance

# ADR 0009 : Découpage des tables BigQuery du SIEM — une table par frontière de confiance

**Statut :** Accepté (décision réelle, consolidée le 11/08/2026 — le rationale existait déjà, dispersé en commentaires Terraform)
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E10 SIEM/ML)

## Contexte

Le dataset `menal_security_<env>` (`terraform/modules/bigquery/main.tf`) est découpé en neuf
tables — `access_logs`, `security_events`, `raw_logs`, `detections`, `alert_enrichment`,
`pending_embeddings`, `cve_findings`, `api_metrics`, `analyst_verdicts` — plutôt qu'un schéma
plus consolidé. Ce découpage n'est nulle part expliqué comme un choix unique et cohérent : sa
justification existe, mais **dispersée** sur une douzaine de commentaires Terraform distincts,
chacun local à une table ou à un binding IAM. Aucun document (HLD, LLD, ou ADR) ne la
consolide.

## Décision

**Formaliser le principe directeur, en le nommant explicitement** : chaque table matérialise une
**frontière de confiance** — pas seulement un regroupement thématique de colonnes. Le
découpage sert un objectif précis, vérifié par construction IAM (bindings au niveau **table**,
pas seulement dataset) plutôt que par convention :

| Table | Rôle | Frontière de confiance qu'elle matérialise |
|---|---|---|
| `raw_logs` | Sink F4 — logs bruts non retraités, source unique de vérité | Écriture réservée au sink Cloud Logging ; aucun moteur applicatif ou ML n'y écrit — intégrité de la preuve à la source |
| `detections` | Sortie des règles Sigma (SQL planifié) | Écriture réservée aux requêtes planifiées de détection ; `sa-enrich-job` et `sa-api` n'ont que la lecture — *« un moteur de détection ne doit jamais pouvoir modifier les preuves qu'il analyse »* (HLD §5) |
| `alert_enrichment` | Sortie ML F5 (ATT&CK-BERT) | `sa-enrich-job` y a un droit d'écriture accordé **à la granularité de la table**, pas du dataset (`terraform/modules/bigquery/main.tf:383-389`) — il peut écrire son propre résultat, jamais réécrire une détection ou un log brut |
| `cve_findings` | Boucle F6 — CVE issues du pipeline CI | `sa-cicd` y a un droit d'écriture limité à cette seule table (corrigé le 07/08/2026 : le binding accordait auparavant `dataEditor` sur tout le dataset — *« un pipeline CI compromis aurait pu falsifier des preuves, pas seulement charger ses CVE »*, commentaire `terraform/modules/bigquery/main.tf:68-78`) |
| `analyst_verdicts` | Jugement humain sur un incident, append-only | Seule table où `sa-api` a un droit d'écriture — *« un verdict humain n'est pas une preuve technique, c'est une annotation posée par-dessus »* ; append-only (jamais d'`UPDATE`) pour un historique auditable sans effacement |
| `pending_embeddings` | File d'attente du pipeline ML | Table de travail transitoire, pas une preuve |
| `security_events`, `access_logs`, `api_metrics` | Vues de restitution / métriques agrégées | Alimentées par le sink ou par agrégation planifiée, jamais par un moteur de détection ou d'enrichissement directement |

**Le principe unique qui explique tout le découpage :** une table = un niveau de confiance = un
binding IAM distinct. Fusionner des tables aux niveaux de confiance différents (par exemple
`detections` et `alert_enrichment`) obligerait à accorder le même droit d'écriture au moteur de
règles et au moteur ML, brisant la séparation détection/preuve qui est le principe cardinal du
HLD §5.

## Conséquences

| Aspect | Impact |
|---|---|
| **Sécurité** | La granularité fine permet des tests négatifs vérifiables (test E2E T4 : tentative d'`INSERT` dans `detections` avec `sa-enrich-job` → `PERMISSION_DENIED`) |
| **Coût** | Plus de tables partitionnées séparément que dans un schéma consolidé — coût de stockage marginal, pas mesuré comme significatif à ce jour |
| **Lacune connue, non résolue par ce découpage** | Le découpage protège l'intégrité **verticale** (qui peut écrire quoi) mais pas l'isolation **horizontale** par tenant : `security_events`, `api_metrics` et `alert_enrichment` n'ont aucune colonne `service`/tenant (`06_ECARTS_IMPLEMENTATION.md` E22/E32) — ce découpage résout un problème différent de celui du multi-tenant, à ne pas confondre |
| **Documentation** | Ce tableau devient la référence à citer plutôt que de re-disperser le raisonnement dans de futurs commentaires Terraform |

## Alternatives rejetées

- **Un schéma consolidé (ex. fusionner `detections` et `alert_enrichment` en une seule table
  « événements enrichis »)** — rejeté : casserait la séparation IAM qui matérialise le principe
  cardinal du HLD §5 (un moteur de détection ne modifie jamais les preuves qu'il analyse).
- **Bindings IAM au niveau dataset plutôt que table** — rejeté et corrigé a posteriori à deux
  reprises (`sa-cicd` sur `cve_findings`, le 07/08 ; le même principe appliqué dès la conception
  pour `sa-enrich-job` sur `alert_enrichment`) : un binding dataset-level donne accès à toutes
  les tables présentes **et futures**, ce qu'aucun des cas d'usage réels ne requiert.

## Références

- `terraform/modules/bigquery/main.tf` (schémas des tables et commentaires de justification, notamment lignes 27-91, 370-398)
- `01_HLD_MENAL.md` §5 (principe cardinal : séparation détection/preuve)
- `06_ECARTS_IMPLEMENTATION.md` E22, E32 (lacune tenant, distincte de ce découpage)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E10)

---

## ADR-0010 — `VECTOR_SEARCH` BigQuery plutôt qu'une base vectorielle dédiée

# ADR 0010 : `VECTOR_SEARCH` BigQuery plutôt qu'une base vectorielle dédiée

**Statut :** Accepté (décision déjà validée — `01_HLD_MENAL.md` §6, ADR-06) ; cet ADR ajoute les métriques manquantes, non un nouveau choix
**Date :** 2026-08-11 (consolidation) — décision technique originale antérieure
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E11 SIEM/ML)

## Contexte

Ce choix est **déjà** un ADR validé — `01_HLD_MENAL.md` §6, ligne ADR-06 : *« Inférence
vectorielle déportée dans BigQuery ✅ Validé — Supprime un composant entier (pgvector/Qdrant/
Matching Engine). Cohérent avec l'objectif de simplicité. »* Ce n'est donc pas une décision à
reprendre, mais l'audit du 11/08/2026 a relevé qu'elle manque d'un élément que les autres
décisions du même registre possèdent : **aucune donnée chiffrée** (latence de
`VECTOR_SEARCH`, coût par recherche) n'accompagne la justification qualitative, alors que
`api/enrich-job/main.py` mesure déjà le temps d'exécution de chaque appel et pourrait fournir
ces chiffres à coût nul.

Cet ADR ne rouvre donc pas la décision — il **documente le manque** et fixe l'action pour le
combler, suivant le même principe méthodologique que `06_ECARTS_IMPLEMENTATION.md`
(*« un document qui ne bouge jamais est le signe qu'on a cessé de comparer »*), appliqué ici à
une décision déjà actée plutôt qu'à un écart.

## Décision

**Maintenir ADR-06 tel quel** (HLD §6) comme décision de référence. Ajouter, comme action de
suivi, la mesure et la consignation de :
- Latence de `VECTOR_SEARCH` sur `attack_embeddings` (~872 vecteurs à 768 dimensions à ce jour,
  cf. `STATUT_DEV.md`), à `top_k=3`.
- Coût par recherche (BigQuery facture au volume de données scannées, pas au nombre de
  vecteurs — à chiffrer sur le volume réel du dataset).

Ces chiffres, une fois mesurés, renforceraient l'argument qualitatif déjà solide (suppression
d'un composant entier) sans le remettre en cause — le choix reste justifié même sans eux,
l'absence de mesure est un manque de rigueur documentaire, pas un doute sur la décision.

## Conséquences

| Aspect | Impact |
|---|---|
| **Architecture** | Aucun changement — décision déjà en production, fonctionnelle |
| **Rigueur de la preuve** | Écart avec le standard de chiffrage déjà atteint sur d'autres décisions du projet (ex. E7 : gate 0/5 top-1 mesuré) — à combler pour la cohérence du dossier, pas par doute sur le fond |
| **Effort de correction** | Très faible — instrumentation déjà en place dans `enrich-job`, il ne manque que la consignation des valeurs observées |

## Alternatives rejetées

Aucune nouvelle — les alternatives (pgvector, Qdrant, Vertex AI Matching Engine) ont déjà été
tranchées dans `01_HLD_MENAL.md` §6 (ADR-06). Cet ADR ne les rouvre pas.

## Références

- `01_HLD_MENAL.md` §6, ADR-06 (décision originale)
- `api/enrich-job/main.py` (instrumentation de latence existante, non consignée)
- `STATUT_DEV.md` (nombre de vecteurs chargés, dernière valeur connue)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E11)

---

## ADR-0011 — ATT&CK-BERT — enrichissement informationnel, non joint au scoring d'incident

# ADR 0011 : ATT&CK-BERT — enrichissement informationnel, non joint au scoring d'incident

**Statut :** Accepté (écart temporaire assumé — décision à trancher explicitement)
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Écart tracé :** `06_ECARTS_IMPLEMENTATION.md` E10 (endpoints/vue absents) et E30 (ce constat précis) · `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §2 (C2)

## Contexte

`ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §5.3 affirme : *« Sans le modèle, [le champ tactic]
n'existe que pour les événements couverts par une règle Sigma... **Avec le modèle, il existe
pour tous les événements.** Le modèle est donc **la condition d'existence** de la détection de
progression d'attaque. »* C'est l'argument de valeur central du document le plus long du projet
(919 lignes).

Vérification faite le 11/08/2026 sur `api/app/routers/siem.py` : le scoring kill-chain
(`_score_incident`, lignes 374-467) calcule le bonus de progression d'attaque **exclusivement**
à partir de `detections.mitre_tactic` — un champ peuplé **uniquement** par les 7 règles Sigma
(`terraform/modules/detection/main.tf`). La table `alert_enrichment` (sortie du modèle
ATT&CK-BERT, schéma confirmé dans `terraform/modules/bigquery/main.tf:204-241`) est structurée
autour de `detection_id`, pas d'une clé `entity` — elle **ne peut pas** être jointe au scoring
par entité dans son état actuel, même si on le souhaitait sans changement de schéma. Le modèle
n'est aujourd'hui exposé que sous forme de KPI agrégé (`/siem/enrichment-quality`), jamais par
incident individuel.

**Ce que le modèle fait réellement aujourd'hui** : il enrichit chaque détection avec une
technique MITRE ATT&CK probable (rang 1) et deux candidats alternatifs (rangs 2-3, champ
`alternates`, jamais exposés par détection pour ne pas donner à un attaquant de quoi calibrer
une évasion — commentaire `terraform/modules/bigquery/main.tf:226-231`). C'est une capacité
réelle et fonctionnelle — mais elle reste **en aval** du pipeline de scoring, pas **dans** le
pipeline de scoring.

## Décision

**Accepté comme écart temporaire le 11/08/2026** (`06_ECARTS_IMPLEMENTATION.md` E30) :
l'enrichissement ATT&CK-BERT reste **informationnel** pour cette itération — il produit une
donnée exploitable manuellement ou via l'endpoint de qualité agrégée, mais ne participe pas
automatiquement à la détection de progression d'attaque (kill-chain) ni à la matrice de
couverture ATT&CK observée.

Cette décision **contredit directement** l'argument central du document technique
`ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §5.3. Deux issues sont possibles, et cet ADR ne
tranche pas laquelle est retenue à terme — il documente que le choix doit être fait
explicitement, plutôt que de laisser la contradiction non résolue dans le dossier de projet :

1. **Combler l'écart technique** : ajouter une colonne `entity` à `alert_enrichment` (dérivable
   depuis `detections.entity` via une jointure sur `detection_id` au moment de l'écriture par
   `enrich-job`), puis joindre cette donnée dans `_score_incident`. Redonnerait à §5.3 sa
   validité factuelle.
2. **Corriger le document narratif** : reformuler §5.3 (et §9.4, §9.6 qui décrivent une vue
   `v_killchain` elle aussi absente, déjà couverte par E10) pour présenter l'enrichissement
   comme une capacité d'investigation informationnelle et un KPI de couverture — un gain réel,
   mais un gain différent de celui actuellement revendiqué.

## Conséquences

| Aspect | Impact |
|---|---|
| **Valeur démontrée du modèle ML** | Aujourd'hui limitée à l'enrichissement individuel et au KPI agrégé — pas à l'amélioration automatique de la détection de progression d'attaque, contrairement à ce qu'affirme le document de référence |
| **Risque en soutenance** | Argument central du document ATT&CK-BERT vulnérable à une question de jury qui testerait un incident multi-tactiques réel — l'écart doit être assumé et expliqué avant d'être découvert en direct |
| **Documentation** | `ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §5.3/§9.4/§9.6 restent à corriger ou l'écart technique à combler — l'un ou l'autre, pas aucun des deux |
| **Effort de correction (option 1)** | Modéré : modification du schéma `alert_enrichment`, de `enrich-job` (écriture de `entity`), et de `_score_incident` (jointure) |
| **Effort de correction (option 2)** | Faible : réécriture de sections narratives, sans changement de code |

## Alternatives rejetées

- **Ne pas trancher et laisser cohabiter l'affirmation du document et le comportement réel du
  code** — rejeté explicitement : c'est l'état constaté par l'audit du 11/08/2026, précisément ce
  que cet ADR existe pour ne plus laisser silencieux.
- **Corriger silencieusement le document sans consigner pourquoi** — rejeté : effacerait la
  trace du fait que l'architecture cible incluait bien cette capacité, utile pour justifier une
  roadmap post-PFE.

## Références

- `ATTACK-BERT_Integration_SIEM_ZeroTrust.md` §5.3, §9.4, §9.6
- `api/app/routers/siem.py:12-19` (limitation documentée en commentaire de code), `:374-467` (`_score_incident`)
- `terraform/modules/bigquery/main.tf:204-241` (schéma réel de `alert_enrichment`)
- `06_ECARTS_IMPLEMENTATION.md` E10, E30
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §2 (C2)

---

## ADR-0012 — Généralisation du socle à N applications (`modules/app-service`, `modules/dashboard`)

# ADR 0012 : Généralisation du socle à N applications (`modules/app-service`, `modules/dashboard`)

**Statut :** Accepté (décision réelle, formalisée rétroactivement le 11/08/2026)
**Date de la décision technique :** antérieure au 11/08/2026 (commits `a39049c`, `1fbe731` — généralisation du socle, début août 2026)
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E13 multi-tenant)

## Contexte

Le HLD/LLD initiaux (`01_HLD_MENAL.md`, `02_LLD_MENAL.md`) décrivent un socle hébergeant **une**
application exemple (ELSON), avec un compte de service et une configuration réseau/LB
spécifiques à ce seul cas. Depuis les commits `a39049c` et `1fbe731` (début août 2026), le socle
a été **généralisé** pour accueillir plusieurs applications clientes sans dupliquer
l'infrastructure de base :

- `terraform/modules/app-service/main.tf` — module réutilisable instancié une fois par
  application hébergée : compte de service dédié (`sa-<app>-<env>`, sans rôle BigQuery — *« une
  application hébergée ne lit pas le SIEM »*, ligne 11), base et utilisateur Cloud SQL dédiés,
  secrets applicatifs à accès ciblé, bucket média optionnel, job de migration de schéma
  découplé du démarrage du service (`MIGRATE_MODE=off` — évite l'anti-pattern *N instances Cloud
  Run = N runners de migration concurrents sans verrou DDL*, commentaire lignes 156-159).
- `terraform/modules/dashboard/main.tf` — module dédié pour le dashboard de supervision,
  suivant le même patron (SA dédié, `actAs` accordé à `sa-cicd` uniquement sur ce SA).
- `terraform/modules/load-balancer/main.tf` — routage additionnel par hôte pour chaque
  `var.extra_services` (NEG, backend, certificat SSL propre), derrière le même WAF Cloud Armor
  que l'API et le dashboard.

Cette généralisation est **une expansion architecturale réelle et significative** (nouveau
module, nouveau patron IAM, nouvelle logique de routage LB), jamais actée dans un ADR ni
répercutée dans le LLD, qui décrit encore une topologie à application unique.

## Décision

**Formaliser le patron `modules/app-service` comme le mécanisme standard d'onboarding d'une
application cliente sur le socle**, avec les invariants suivants, déjà appliqués et vérifiés
pour Elson (premier cas réel, `03_CAS_UTILISATION.md` UC7) :

1. Un compte de service par application, **jamais** de rôle BigQuery — l'application hébergée
   ne fait pas partie du SIEM, elle en est une source surveillée.
2. Une base et un utilisateur Cloud SQL dédiés sur l'instance partagée (isolation applicative,
   pas d'instance dédiée — écart déjà tracé `06_ECARTS_IMPLEMENTATION.md` E23).
3. Des secrets à portée strictement individuelle par application.
4. Un routage LB par hôte, derrière le même WAF partagé — pas de WAF dupliqué par application.
5. Le déploiement de l'application reste sous le contrôle de `sa-cicd`, limité par `actAs` au
   seul SA de cette application (jamais un accès générique à tous les SA d'application).

## Conséquences

| Aspect | Impact |
|---|---|
| **Réutilisabilité** | Onboarding d'une nouvelle application réduit à l'instanciation du module + un fichier `.tf` sur le modèle d'`elson.tf` (`07_ONBOARDING_APPLICATION.md`) |
| **Documentation** | `02_LLD_MENAL.md` §2.1/§3 continue de décrire une topologie à application unique — à mettre à jour pour refléter ce patron généralisé |
| **Limites connues, non résolues par ce module** | `modules/cloud-sql` reste non réinstanciable par application (peering VPC unique, `06_ECARTS_IMPLEMENTATION.md` E23) ; aucune colonne tenant fiable dans plusieurs tables SIEM (E22/E32) — la généralisation couvre l'identité et le déploiement, pas encore l'isolation complète des données de supervision |
| **CI** | Chaque application généralisée nécessite son propre workflow (`elson-ci.yml` en exemple, ~280 lignes, non factorisé avec `ci.yml` — `06_ECARTS_IMPLEMENTATION.md`, gap connu) |

## Alternatives rejetées

- **Dupliquer le socle par application (un projet ou un ensemble de modules par client)** —
  rejeté : contredit l'objectif même du projet (un socle commun, pas un modèle à copier-coller
  par client), et multiplierait le coût de maintenance et de revue de sécurité.
- **Un seul compte de service partagé pour toutes les applications hébergées** — rejeté : brise
  le principe de moindre privilège par workload (HLD §5) et rendrait impossible d'attribuer un
  incident à une application précise par l'identité appelante.

## Références

- `terraform/modules/app-service/main.tf`, `terraform/modules/dashboard/main.tf`
- `terraform/modules/load-balancer/main.tf` (routage `extra_services`)
- Commits `a39049c`, `1fbe731` (généralisation du socle)
- `03_CAS_UTILISATION.md` UC7 (Elson, premier cas réel)
- `07_ONBOARDING_APPLICATION.md`
- `06_ECARTS_IMPLEMENTATION.md` E22, E23, E27, E32
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E13)

---

## ADR-0013 — Double convention de nommage tenant dans le SIEM

# ADR 0013 : Double convention de nommage tenant dans le SIEM

**Statut :** Accepté (décision réelle, formalisée rétroactivement — limitation reconnue, pas une conception cible)
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E14 multi-tenant)

## Contexte

Le filtrage par tenant du dashboard (`?tenant=menal|elson`) repose sur la fonction
`tenant_services()` (`api/app/bigquery.py:63-88`), qui doit réconcilier **deux schémas de
nommage qui ne partagent aucun préfixe commun** :

- **Source Cloud Run** (`access_logs.service`, dérivée de `resource.labels.service_name`) :
  chaque service porte son propre nom applicatif — `elson-api-<env>`, `elson-web-<env>`,
  `menal-api-<env>`.
- **Source LB/Cloud Armor** (`raw_logs.resource_name`, dérivée de `backend_service_name` —
  `terraform/modules/load-balancer/main.tf`) : **tous** les backends sont nommés
  `menal-<clé>-backend-<env>`, y compris ceux d'Elson (`menal-elson-backend-<env>`,
  `menal-elson-api-backend-<env>`). Un filtre par simple préfixe `"menal-"` capturerait donc
  aussi le trafic WAF d'Elson — d'où l'obligation d'une liste explicite plutôt qu'un préfixe
  déduit (commentaire code, `api/app/bigquery.py:63-72`).

Cette double convention n'est pas un oubli isolé : elle découle de deux couches d'infrastructure
conçues indépendamment (nommage Cloud Run applicatif vs nommage des ressources LB, où tout
backend est préfixé `menal-` par convention du module, quel que soit le tenant réel qu'il sert).
Elle oblige à maintenir une **table de correspondance codée en dur** dans `tenant_services()`,
qui doit être mise à jour manuellement à chaque nouvelle application onboardée.

## Décision

**Accepté comme limitation reconnue le 11/08/2026** — la table de correspondance codée en dur
reste la solution retenue pour cette itération. Ce n'est pas présenté comme une architecture
cible idéale, mais comme la solution la plus simple compatible avec les deux conventions de
nommage existantes, sans réécrire ni le module LB ni le nommage des services Cloud Run.

**Alternative de fond, non retenue pour cette itération** : introduire une étiquette `tenant`
explicite et cohérente au moment de la création de chaque ressource (Cloud Run, backend LB), et
la propager dans les logs/tables BigQuery dès l'ingestion — supprimerait le besoin d'une table
de correspondance applicative, mais impliquerait de modifier le module `load-balancer` (renommer
les backends, ou ajouter un label distinct du nom) et la normalisation F4 (`terraform/modules/
logging/main.tf`), pour un socle qui compte aujourd'hui deux tenants réels.

## Conséquences

| Aspect | Impact |
|---|---|
| **Maintenabilité** | Chaque nouvelle application onboardée nécessite une mise à jour manuelle de `tenant_services()` — risque d'oubli, pas de garde-fou automatique (aucun test ne vérifie que la table est à jour vis-à-vis des ressources Terraform réelles) |
| **Sécurité** | Le filtre reste un raffinement de lecture, pas une frontière de sécurité — une entrée manquante ou incorrecte élargit ou réduit silencieusement la vue affichée, sans exposer de donnée d'un tenant à l'autre au niveau du stockage (rappel : `06_ECARTS_IMPLEMENTATION.md` E22/E32 couvrent la fiabilité de la donnée elle-même, distincte de ce mapping) |
| **Documentation** | Ce comportement n'était documenté que dans un commentaire de code avant cet ADR — désormais traçable pour la prochaine personne qui onboardera une application |

## Alternatives rejetées

- **Filtrer par préfixe `"menal-"` sur les ressources LB** — rejeté explicitement (voir
  commentaire code) : capturerait aussi le trafic WAF d'Elson, puisque tous les backends
  partagent ce préfixe par convention du module `load-balancer`.
- **Réécrire immédiatement le nommage des ressources LB pour un préfixe par tenant** — non
  retenu pour cette itération : changement structurel du module `load-balancer` (renommage de
  ressources existantes = recréation), coût disproportionné pour deux tenants actuellement
  onboardés, à réévaluer si le nombre de tenants augmente significativement.

## Références

- `api/app/bigquery.py:63-88` (`tenant_services()`, commentaire de contexte)
- `terraform/modules/load-balancer/main.tf` (convention de nommage des backends)
- `06_ECARTS_IMPLEMENTATION.md` E22, E32
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E14)

---

## ADR-0014 — Déploiement Elson mono-instance (pas de migration vers un cache distribué)

# ADR 0014 : Déploiement Elson mono-instance (pas de migration vers un cache distribué)

**Statut :** Accepté (décision réelle, formalisée rétroactivement — plafond de capacité assumé)
**Date :** 2026-08-11
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E15 multi-tenant) · `elson-main/DOCUMENTATION_ELSON.md` (audit préalable, point bloquant §11.6/Phase 3)

## Contexte

L'audit de sécurité préalable d'Elson a identifié que son backend Express maintient un **état en
mémoire locale au processus** — rate-limiting et invalidation de cache reposent sur des workers
`setInterval` internes au process Node.js, sans coordination inter-process. L'audit recommandait
en Phase 3 une migration de cet état vers un cache distribué (Memorystore/Redis) avant toute
mise à l'échelle horizontale.

Le socle MENAL, lors de l'onboarding d'Elson (`terraform/environments/staging/elson.tf:71-72`,
commentaire : *« Backend Express — workers in-process (setInterval) : 1 instance chaude, CPU
toujours allouée, cluster coupé (WEB_CONCURRENCY=1 + CLUSTER=off) »*), a contourné ce problème
plutôt que de le résoudre : le service Cloud Run d'Elson est configuré en
`min_instances = 1, max_instances = 1` (ligne 228-229), avec `WEB_CONCURRENCY = "1"` et
`CLUSTER = "off"` (lignes 238-239) — **aucune mise à l'échelle possible, ni horizontale
(instances), ni verticale (cluster de process)**. Tant qu'il n'existe qu'une seule instance
et un seul process, l'état local reste cohérent par construction : le problème structurel
identifié par l'audit ne se manifeste jamais, parce que la condition qui le déclencherait
(plusieurs runners concurrents) n'est jamais atteinte.

Ce choix n'était documenté nulle part comme une décision — seul le commentaire de code
l'explique techniquement, sans jamais formuler le compromis qu'il implique : **la disponibilité
et la capacité d'Elson sont plafonnées à ce qu'une seule instance Cloud Run peut absorber**, y
compris en cas de pic de charge ou de panne de cette instance unique.

## Décision

**Accepté comme compromis délibéré le 11/08/2026** — la configuration mono-instance reste en
place pour cette itération, en substitut temporaire à la migration recommandée par l'audit
Elson vers un cache distribué.

**Ce que cette décision accepte explicitement :**
- Un pic de trafic au-delà de la capacité d'une seule instance dégrade le service, sans
  possibilité d'absorption automatique par scale-out.
- Une panne ou un redémarrage de l'unique instance provoque une interruption de service
  (pas de bascule vers une autre instance déjà chaude).
- Cette configuration n'est **pas** compatible avec un objectif de disponibilité en production à
  l'échelle — cohérent avec le cadrage du projet (`01_HLD_MENAL.md` §1.3.2 : *« la scalabilité
  n'est pas un objectif »*), mais jamais explicitement relié à ce choix précis avant cet ADR.

**Condition de réévaluation :** avant toute montée en charge réelle d'Elson au-delà d'un usage
de démonstration/staging, ou avant l'onboarding d'une application dont l'audit préalable
identifierait la même dépendance à un état en mémoire locale — la Phase 3 de l'audit Elson
(migration vers Memorystore/Redis) resterait alors la correction de fond à appliquer, pas ce
contournement.

## Conséquences

| Aspect | Impact |
|---|---|
| **Capacité** | Plafond dur : une instance Cloud Run, un seul worker — pas de dégradation progressive, blocage net au-delà de la capacité d'une instance |
| **Disponibilité** | Aucune redondance sur ce service précis — contraste avec le choix explicite fait ailleurs sur le projet de passer Cloud SQL en HA régionale (`06_ECARTS_IMPLEMENTATION.md` E21 partiel, décision utilisateur du 08/08, coût doublé assumé) ; ici, le choix inverse (accepter le SPOF plutôt que payer la redondance) n'avait jamais été formulé comme un choix symétrique |
| **Coût** | `min_instances = 1` maintient une instance **toujours allouée** (pas de scale-to-zero) — coût permanent, mais aucune alternative moins coûteuse tant que l'état en mémoire n'est pas externalisé |
| **Dette technique héritée** | Le problème identifié par l'audit Elson (Phase 3) n'est pas résolu, seulement rendu invisible par construction — à ne pas présenter comme une correction |

## Alternatives rejetées

- **Migrer immédiatement vers Memorystore/Redis (recommandation Phase 3 de l'audit Elson)** —
  non retenue pour cette itération : changement applicatif dans le code d'Elson (hors périmètre
  direct du socle, cf. `01_HLD_MENAL.md` §1.2 — le code interne des applications hébergées est
  hors périmètre du PFE), et `Memorystore` est explicitement écarté du socle pour absence
  d'objectif de scalabilité (`01_HLD_MENAL.md` §7, ligne « Memorystore (Redis) »).
- **Autoriser plusieurs instances sans corriger l'état en mémoire** — rejeté sans discussion
  possible : reproduirait exactement la vulnérabilité de cohérence identifiée par l'audit Elson.

## Références

- `terraform/environments/staging/elson.tf:71-72,228-239` (configuration et commentaire)
- `elson-main/DOCUMENTATION_ELSON.md` (audit préalable, recommandation Phase 3)
- `01_HLD_MENAL.md` §1.3.2, §7 (Memorystore explicitement écarté du socle)
- `06_ECARTS_IMPLEMENTATION.md` E21 (choix inverse fait sur Cloud SQL, pour comparaison)
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E15)

---

## ADR-0015 — Deux clés CMEK distinctes (régionale pour SQL/BQ/GCS, globale pour Secret Manager)

# ADR 0015 : Deux clés CMEK distinctes (régionale pour SQL/BQ/GCS, globale pour Secret Manager)

**Statut :** Accepté (décision réelle, formalisée rétroactivement le 11/08/2026 — le rationale technique existait déjà, en commentaire)
**Date de la décision technique :** 2026-08-07/08 (câblage CMEK, Tier 2 de `09_AUDIT_E2E_STAGING_2026-08-07.md`)
**Auteur :** Équipe MENAL Zero Trust
**Référence :** `06_ECARTS_IMPLEMENTATION.md` E21 (partiel) · `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E16 multi-tenant)

## Contexte

`terraform/modules/kms/main.tf` provisionne **deux** trousseaux de clés CMEK distincts, plutôt
qu'un seul :

1. `google_kms_key_ring.menal` (`europe-west1`, même région que le reste de l'infrastructure) —
   clé `menal-api-key-<env>`, utilisée par BigQuery et GCS (bucket média).
2. `google_kms_key_ring.menal_global` (`global`) — clé `menal-secrets-key-<env>`, utilisée
   **exclusivement** par Secret Manager.

Ce n'était pas le plan initial : le câblage CMEK visait une seule clé régionale pour tous les
services (SQL, BigQuery, GCS, Secret Manager). La séparation a été découverte **en `apply`**, le
07/08/2026 : la politique de réplication `auto` de Secret Manager **n'accepte que des clés KMS en
location `global`** (erreur GCP : *« Automatic replication policy can only be configured with
Cloud KMS keys in location [global] »*). La clé principale, en `europe-west1`, était donc
structurellement inutilisable pour les secrets sans basculer leur réplication en
`user_managed` — un changement plus lourd, non testé, et risqué sur des secrets **déjà en
usage** en staging. La solution retenue (`terraform/modules/kms/main.tf:55-68`, commentaire de
contexte) a été de créer une seconde clé, en location `global`, dédiée aux seuls secrets — même
politique de rotation (90 jours), même niveau de protection, sans toucher à la réplication des
secrets existants.

À noter également : Cloud SQL reste **hors** de ce câblage CMEK (`encryption_key_name` est
immuable à la création d'une instance — l'ajouter à l'instance existante forcerait son
remplacement complet, donc une perte de données sans migration dédiée, vérifié par `terraform
plan` le 08/08/2026, cf. `06_ECARTS_IMPLEMENTATION.md` E21).

## Décision

**Formaliser la séparation à deux clés comme la configuration cible**, pas comme un pis-aller
temporaire : c'est la solution la plus simple et la plus sûre compte tenu d'une contrainte API
GCP non contournable (réplication automatique de Secret Manager limitée aux clés globales),
découverte par la pratique (`terraform plan`/`apply` réel) plutôt qu'anticipée en conception.

## Conséquences

| Aspect | Impact |
|---|---|
| **Sécurité** | Chiffrement CMEK réellement câblé sur BigQuery (dataset SIEM), GCS (bucket média) et Secret Manager (7 secrets applicatifs MENAL + Elson) — gain réel, pas décoratif |
| **Surface de gestion** | Deux trousseaux à administrer et faire tourner au lieu d'un seul — complexité légèrement accrue, contrepartie directe de la contrainte GCP |
| **Limite non résolue** | Cloud SQL reste chiffré par la clé Google-managed par défaut, pas par une CMEK — nécessiterait un projet de migration dédié (nouvelle instance + bascule applicative), hors portée d'une simple activation (`06_ECARTS_IMPLEMENTATION.md` E21) |
| **Méthode** | Illustre une leçon générale du projet, déjà consignée en `02_LLD_MENAL.md` §10.4 : *« le plan seul ne suffit pas toujours à prédire l'effet réel d'un apply »* — cette contrainte de réplication n'était visible qu'à l'exécution, pas au plan |

## Alternatives rejetées

- **Basculer la réplication de tous les secrets en `user_managed` pour n'utiliser qu'une seule
  clé régionale** — rejeté : changement structurel plus lourd, non testé, risqué sur des secrets
  déjà en usage en staging, pour un gain (une seule clé au lieu de deux) purement cosmétique.
- **Renoncer au CMEK sur Secret Manager plutôt que créer une seconde clé** — rejeté : aurait
  laissé un chiffrement Google-managed par défaut sur les secrets les plus sensibles du projet
  (JWT, mots de passe base de données), contraire à l'objectif de durcissement Tier 2 de
  `09_AUDIT_E2E_STAGING_2026-08-07.md`.

## Références

- `terraform/modules/kms/main.tf:6-91` (les deux trousseaux et leur commentaire de contexte)
- `terraform/modules/cloud-sql/variables.tf` (avertissement sur `kms_key_id`, non appliqué à l'instance)
- `02_LLD_MENAL.md` §10.4 (détection de dérive, leçon retenue le 08/08)
- `09_AUDIT_E2E_STAGING_2026-08-07.md` (Tier 2 — câblage CMEK)
- `06_ECARTS_IMPLEMENTATION.md` E21
- `10_AUDIT_ECARTS_DOCUMENTATION_2026-08-11.md` §3 (E16)
