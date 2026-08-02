# Intégrer une application derrière la plateforme MENAL

**Date :** 2 août 2026 · **Environnement de référence :** `menal-zero-trust-staging`

Procédure pour placer une application (Elson ou toute autre application MENAL) derrière le
socle : Load Balancer, Cloud Armor, journalisation, détection et tableau de bord SOC.

Elle décrit ce que la plateforme sait faire **aujourd'hui**, et à quelles conditions. Ce
n'est pas un plan de migration d'Elson : l'état d'Elson est traité au §4.

---

## 1. Prérequis côté application

Une application ne peut pas être intégrée telle quelle. Ces cinq points ne sont pas
négociables — non par formalisme, mais parce que chacun casse le socle s'il est ignoré.

| # | Prérequis | Pourquoi |
|---|---|---|
| 1 | **Sans état sur le disque local** | Cloud Run détruit et recrée les instances sans préavis. Tout ce qui doit survivre va en base ou dans un bucket |
| 2 | **Configuration par variables d'environnement**, secrets via Secret Manager | Un secret dans une image se retrouve dans le registre, puis dans chaque copie de l'image |
| 3 | **Un secret par usage**, jamais un secret partagé entre plusieurs mécanismes | Une rotation devient sinon un choix entre tout casser et ne rien tourner |
| 4 | **Écoute sur `$PORT`**, healthcheck HTTP répondant sans dépendance externe | La sonde doit dire « ce conteneur est vivant », pas « toute la chaîne va bien » — sinon une panne de base fait redémarrer en boucle des conteneurs sains |
| 5 | **Schéma de base reconstructible depuis le dépôt** (migrations versionnées) | Sans cela, aucun environnement n'est reproductible, et la reprise après incident est une opération manuelle non testée |

À vérifier également : pas d'identifiants par défaut, pas de compte d'administration créé
automatiquement avec un mot de passe connu.

## 2. Ce que la plateforme apporte, et ce qu'elle n'apporte pas

**Apporté automatiquement**, sans modification de l'application :

- TLS managé, redirection HTTP→HTTPS, IP anycast globale ;
- Cloud Armor : géo-blocage (UE + Maghreb + Mauritanie), règles OWASP (XSS, SQLi, LFI, RCE,
  RFI), limitation de débit anti-DDoS et anti-force-brute au bord sur les chemins
  d'authentification ;
- journalisation centralisée vers BigQuery (flux F4) et normalisation ;
- règles de détection R1–R7 sur le trafic, avec étiquetage MITRE ATT&CK ;
- enrichissement sémantique ATT&CK-BERT des détections ;
- restitution dans le tableau de bord SOC (détections, incidents, couverture ATT&CK,
  vulnérabilités) ;
- surveillance et alertes (erreurs, latence, échecs d'authentification, ingestion à l'arrêt).

**Non apporté** — reste à la charge de l'application :

- l'authentification et l'autorisation applicatives (le MFA de la plateforme protège les
  comptes MENAL du tableau de bord, pas les utilisateurs de l'application hébergée) ;
- la validation des entrées : Cloud Armor filtre les charges connues, il ne remplace pas
  un contrôle applicatif ;
- la sécurité de la logique métier ;
- les sauvegardes applicatives au-delà de celles de Cloud SQL.

## 3. Étapes d'intégration

**3.1 Compte de service dédié** — un par application, jamais partagé. Les droits accordés
sont ceux dont elle a besoin et rien de plus : `cloudsql.client` si elle utilise la base,
`secretmanager.secretAccessor` sur ses propres secrets. **Aucun accès BigQuery** : une
application hébergée ne lit pas le SIEM. Voir `terraform/modules/iam`.

**3.2 Image et registre** — image construite par le pipeline CI, poussée dans Artifact
Registry, scannée par Trivy (une CVE CRITICAL corrigeable bloque la livraison). Pas de
registre externe : un seul registre de confiance.

**3.3 Service Cloud Run** — sur le modèle de `terraform/modules/cloud-run` :
ingress `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` (joignable **uniquement** par le Load
Balancer, jamais par son URL `run.app`), connecteur VPC pour atteindre la base en IP privée,
`cpu_idle = true` pour la facturation à la requête.

**3.4 Routage** — ajouter un backend, un NEG et une règle d'hôte dans
`terraform/modules/load-balancer` (le module en gère déjà deux : API et tableau de bord ;
le troisième suit le même schéma). Prévoir le certificat managé et l'enregistrement DNS.

**3.5 Journalisation** — le sink Cloud Run capte automatiquement les journaux du nouveau
service. Vérifier que les requêtes apparaissent dans `access_logs` après normalisation :
c'est la condition pour que les règles de détection voient quoi que ce soit.

**3.6 Adapter les règles de détection** — R1 cible `status_code IN (401, 403)` sur
`access_logs`, indépendamment du service : elle fonctionne donc immédiatement pour tout
endpoint d'authentification. Vérifier en revanche les règles qui filtrent sur des chemins
(`/api/`) et adapter au préfixe de l'application.

## 4. Cas d'Elson

Elson tourne aujourd'hui sur son propre socle (Hetzner, Docker Compose, Caddy, Cloudflare) —
**ni sur GCP, ni derrière MENAL**. Son audit (`elson-main/DOCUMENTATION_ELSON.md` §14)
identifie six points bloquants, qui recoupent presque exactement les prérequis du §1 :
identifiants d'administration par défaut en clair, `JWT_SECRET` unique partagé par sept
mécanismes, PgBouncer sans authentification, état en mémoire et sur disque incompatible avec
Cloud Run, schéma de base non reconstructible depuis le dépôt.

Le chemin estimé dans ce même document est de **11 à 21 semaines en 4 phases**. Rien de cela
n'a été entamé : la plateforme est prête à accueillir une application, Elson n'est pas prête
à être accueillie.

En attendant, `GUIDE_DEMO_ELSON.md` décrit ce qui est démontrable dès aujourd'hui : le même
mécanisme de détection qui protégerait Elson, rejoué pour de vrai contre l'API MENAL sur un
endpoint d'authentification équivalent.

## 5. Critères de passage en phase de commercialisation

Ce que je considère acquis, et ce qui manque encore. Les éléments marqués « à décider »
demandent un arbitrage, pas du travail technique.

### Acquis et vérifiés

| Critère | Preuve |
|---|---|
| Pipeline CI-SEC-CD vert de bout en bout sur l'environnement de référence | Exécutions GitHub Actions ; `STATUT_DEV.md` §8.1 |
| Les portes de sécurité bloquent réellement | Trois défauts réels interceptés le 02/08, dont une CVE CRITICAL ; §8.2 |
| Infrastructure entièrement décrite en Terraform, `plan` vide | Convergence vérifiée sur staging |
| Chaîne SIEM alimentée et exacte de bout en bout | Audit maillon par maillon ; §8.3 |
| Principe cardinal Zero Trust tenu et vérifiable | `sa-enrich-job` ; §8.4 |
| Détection réelle sur trafic réel, enrichie par un vrai modèle | T13 et T14 sur staging |
| Sauvegardes et récupération à un instant donné | Cloud SQL : 7 sauvegardes, PITR 7 jours |

### Manquant — bloquant pour un engagement contractuel

| # | Manque | Nature |
|---|---|---|
| 1 | **Aucun SLO chiffré et mesuré** | On ne peut pas s'engager sur une disponibilité qu'on ne mesure pas. Des cibles réalistes ont été proposées (disponibilité 99 %, latence p95, fraîcheur des détections) ; il reste à les instrumenter et à observer une période de référence |
| 2 | **Cloud SQL zonal** | Une panne de zone arrête le service. Décision coût/risque **à décider** avant tout engagement |
| 3 | **Aucune restauration testée** | Les sauvegardes existent ; leur restauration n'a jamais été exécutée. Une sauvegarde non testée est une hypothèse, pas une garantie |
| 4 | **Aucun runbook d'incident** | Ni procédure de restauration, ni retour arrière documenté, ni astreinte |
| 5 | **Canal d'alerte unique**, adresse personnelle non vérifiée | L'alerting est lui-même un point unique de défaillance |
| 6 | **Pas d'environnement de production** | `terraform/environments/prod/` est vide ; la chaîne dev→staging→prod n'a jamais été déroulée |
| 7 | Isolation inter-environnements de la CI incomplète | La condition d'accès fédéré porte sur le dépôt, pas sur la branche ni le tag : toute branche obtient les mêmes droits |

### Recommandation

L'infrastructure est **techniquement saine et démontrable**. Les points 1, 3 et 4 sont les
moins coûteux et les plus structurants : ils transforment « ça marche » en « on sait ce qui
se passe quand ça ne marche plus », qui est exactement la question qu'un premier client
posera. Le point 2 est un arbitrage à assumer explicitement, pas à laisser par défaut.
