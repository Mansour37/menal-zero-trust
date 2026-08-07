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
`secretmanager.secretAccessor` sur ses propres secrets (binding par secret, jamais projet).
**Aucun accès BigQuery** : une application hébergée ne lit pas le SIEM. Depuis le 07/08,
tout cela est porté par **`terraform/modules/app-service`** (SA + secrets « un par usage » +
base/user dédiés + bucket + job de migration), instancié une fois par application — voir
`environments/staging/elson.tf` pour le modèle complet.

**3.2 Image et registre** — image construite par le pipeline CI, poussée dans Artifact
Registry, scannée par Trivy (une CVE CRITICAL corrigeable bloque la livraison). Pas de
registre externe : un seul registre de confiance.

**3.3 Service Cloud Run** — sur le modèle de `terraform/modules/cloud-run` :
ingress `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` (joignable **uniquement** par le Load
Balancer, jamais par son URL `run.app`), connecteur VPC pour atteindre la base en IP privée,
`cpu_idle = true` pour la facturation à la requête.

**3.4 Routage** — **aucune modification du module** : déclarer l'application dans
`extra_services` (terraform.tfvars) — domaine, service par défaut, et pour une app
same-origin les chemins `api_paths` routés vers un second service. Le module génère NEG,
backend, règle d'hôte et certificat managé. L'enregistrement DNS (A → IP du LB) doit exister
**avant** l'apply, sinon le certificat reste en PROVISIONING.

**3.5 Journalisation** — le sink Cloud Run ne capte **que** les services listés dans
`cloud_run_services` (terraform.tfvars) : oublier d'y ajouter le nouveau service = app
absente du SIEM, **sans aucune erreur visible**. En renseignant la liste, toujours réinclure
`menal-api-<env>` (elle écrase le fallback historique). Vérifier ensuite que les requêtes
apparaissent dans `access_logs` après normalisation : c'est la condition pour que les règles
de détection voient quoi que ce soit.

**3.6 Adapter les règles de détection** — R1 cible `status_code IN (401, 403)` sur
`access_logs`, indépendamment du service : elle fonctionne donc immédiatement pour tout
endpoint d'authentification. Pour R4 (user-agent scripté sur `/api/`), une application grand
public dont toute la surface est sous `/api` doit être exclue via `r4_excluded_services`
(terraform.tfvars) — sinon chaque client scripté légitime devient une détection. Ajouter
aussi l'application à `monitored_services` (alertes, uptime, SLO par service) et ses chemins
d'authentification à `auth_paths` (règle Cloud Armor 1450) — en réincluant les valeurs
menal-api existantes dans les deux cas.

## 4. Cas d'Elson — l'onboarding réel (en cours depuis le 07/08/2026)

Elson est le **premier cas réel** de cette procédure. Décision du 07/08 : Elson sera déployé
sur Cloud Run derrière le socle, sous `elson.menal-sarl.com` (abandon de Hetzner à la
bascule). Sur les six points bloquants de son audit (`elson-main/DOCUMENTATION_ELSON.md`
§14), cinq sont levés (admin par défaut, secrets séparés, PgBouncer, token d'export, schéma
reconstructible + runner de migration en CI) ; reste l'état fichier sur disque, en cours de
migration vers GCS (abstraction `STORAGE_DRIVER=local|gcs`).

État d'avancement : infra complète déclarée (`environments/staging/elson.tf`, activable par
`elson_enabled`), correctifs Cloud Run applicatifs faits (IP client GCLB anti-usurpation,
split health/ready, cluster désactivable, migrations via job dédié), CI build+push+deploy
prête (gate `ELSON_DEPLOY_ENABLED`). La procédure d'activation pas à pas est dans
`08_RUNBOOK.md` §8 ; la bascule des données réelles (base + corpus audio + VM WAHA) reste
un chantier distinct avec sa checklist GO/NO-GO.

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
| 1 | ~~Aucun SLO chiffré~~ — **fait** le 03/08 | Disponibilité 99 % et latence 95 % < 1 s instrumentées en Cloud Monitoring, plus un SLI de retard d'enrichissement. Reste à observer une période de référence complète avant de s'engager sur les chiffres |
| 2 | **Cloud SQL zonal** | Une panne de zone arrête le service. Décision coût/risque **à décider** avant tout engagement |
| 3 | ~~Aucune restauration testée~~ — **fait** le 03/08 | Restauration réellement exécutée : **RTO 32 min 45 s**, **RPO 0** au point demandé, coupure vérifiée ligne à ligne. Voir `08_RUNBOOK.md` §3 |
| 4 | ~~Aucun runbook~~ — **fait** le 03/08 | `08_RUNBOOK.md` : retour arrière, panne de base, restauration, réponse aux dix alertes, diagnostic ML et requêtes planifiées. **L'astreinte reste à désigner** |
| 5 | **Canal d'alerte unique**, adresse personnelle non vérifiée | L'alerting est lui-même un point unique de défaillance |
| 6 | **Pas d'environnement de production** | `terraform/environments/prod/` est vide ; la chaîne dev→staging→prod n'a jamais été déroulée |
| 7 | Isolation inter-environnements de la CI incomplète | La condition d'accès fédéré porte sur le dépôt, pas sur la branche ni le tag : toute branche obtient les mêmes droits |

### Recommandation

Les points 1, 3 et 4 sont traités depuis le 3 août : les SLO sont instrumentés, la
restauration a été **réellement exécutée** (RTO 32 min 45 s, RPO 0) et le runbook existe.

Ce qui reste avant un engagement contractuel, par ordre d'importance :

1. **Cloud SQL zonal** (point 2) — arbitrage coût/risque à assumer explicitement. Avec le
   RTO désormais connu, la question est chiffrée : accepte-t-on ~45 min à 1 h d'arrêt en cas
   de panne de zone, ou paie-t-on la haute disponibilité ?
2. **Canal d'alerte unique** (point 5), sur une adresse personnelle non vérifiée, et
   **aucune astreinte désignée** — le runbook dit quoi faire, pas qui le fera.
3. **Observer une période de référence** sur les SLO avant de s'engager sur leurs valeurs :
   une cible sans historique reste une intention.
4. Les points 6 et 7 (pas de production, isolation CI incomplète) restent ouverts.
