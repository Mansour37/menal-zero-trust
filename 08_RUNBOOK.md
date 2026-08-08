# Runbook d'incident — Plateforme MENAL

**Environnement de référence :** `menal-zero-trust-staging` · **Région :** `europe-west1`
**Dernière validation :** 3 août 2026 (restauration réellement exécutée, §3)

Ce document est fait pour être suivi **pendant** un incident, pas lu avant. Chaque procédure
donne la commande exacte, ce qu'on attend en retour, et la durée observée — pas estimée.

Les chiffres de restauration du §3 proviennent d'un test réel exécuté le 3 août, pas d'une
documentation fournisseur.

---

## 0. Réflexes de premier niveau

| Question | Commande |
|---|---|
| L'API répond-elle ? | `curl -s -o /dev/null -w "%{http_code}\n" https://api-staging.menal-sarl.com/health` |
| Le tableau de bord ? | `curl -s -o /dev/null -w "%{http_code}\n" https://dash-staging.menal-sarl.com/login` |
| Quelles alertes sont ouvertes ? | `gcloud alpha monitoring policies list --project=menal-zero-trust-staging --format="value(displayName,enabled)"` |
| Quelle révision est en service ? | `gcloud run services describe menal-api-staging --project=menal-zero-trust-staging --region=europe-west1 --format="value(status.traffic)"` |
| La base est-elle debout ? | `gcloud sql instances describe menal-db-staging --project=menal-zero-trust-staging --format="value(state)"` |

**Attention — `/health` ne teste pas la base de données.** Il renvoie `200` même si Cloud SQL
est injoignable (`api/main.py`, réponse statique). Un `/health` vert **n'est donc pas** une
preuve que la plateforme fonctionne : c'est une preuve que le conteneur est vivant. Pour
savoir si la base répond, interroger un point d'accès qui la lit (`/users/` renvoie `403`
sans jeton mais touche la base) ou regarder le taux de `5xx`.

---

## 1. Retour arrière d'un déploiement

**Quand :** une livraison vient de passer et les erreurs augmentent, ou une régression
fonctionnelle est constatée.

```bash
PROJET=menal-zero-trust-staging; REGION=europe-west1; SERVICE=menal-api-staging

# 1. Lister les révisions, la plus récente en tête
gcloud run revisions list --service=$SERVICE --project=$PROJET --region=$REGION --limit=5 \
  --format="table(metadata.name, metadata.creationTimestamp, status.conditions[0].status)"

# 2. Basculer 100 % du trafic sur la révision précédente
gcloud run services update-traffic $SERVICE --project=$PROJET --region=$REGION \
  --to-revisions=<REVISION_PRECEDENTE>=100

# 3. Vérifier
curl -s -o /dev/null -w "%{http_code}\n" https://api-staging.menal-sarl.com/health
```

Durée : quelques secondes. Le retour arrière ne redéploie rien — il redirige le trafic vers
une révision déjà construite et déjà démarrée.

**Le même geste s'applique au tableau de bord** avec `SERVICE=menal-dashboard-staging`.

**Ne pas** faire de retour arrière par `terraform apply` : les modules `cloud-run`,
`dashboard` et `ml-pipeline` portent un `ignore_changes` sur l'image précisément pour que
Terraform ne se batte pas avec le pipeline de livraison. Un `apply` ne ramènerait pas la
révision précédente, il ramènerait le tag `:latest`, qui n'est pas la même chose.

---

## 2. Panne de base de données

**Symptômes :** `5xx` en hausse, alerte « Pics 5xx » ou « Taux d'erreur API », **mais
`/health` toujours vert** (voir §0).

```bash
# Etat, zone, opérations en cours
gcloud sql instances describe menal-db-staging --project=menal-zero-trust-staging \
  --format="yaml(state,gceZone,settings.availabilityType)"
gcloud sql operations list --instance=menal-db-staging --project=menal-zero-trust-staging --limit=5
```

**L'instance est zonale** (`europe-west1-b`, sans réplica) : une panne de zone Google arrête
le service et **aucune bascule automatique n'existe**. C'est un risque accepté, documenté en
`STATUT_DEV.md` §8.6. Dans ce cas, la seule option est la restauration (§3), avec le délai
mesuré ci-dessous.

Si l'instance est `RUNNABLE` mais que l'API échoue quand même, chercher du côté du connecteur
VPC et des connexions :

```bash
gcloud compute networks vpc-access connectors describe menal-vpc-connector-stg \
  --project=menal-zero-trust-staging --region=europe-west1 --format="value(state)"
```

---

## 3. Restauration de la base — procédure validée le 3 août 2026

### Chiffres mesurés, pas estimés

| Grandeur | Valeur mesurée | Comment |
|---|---|---|
| **RTO** (durée de restauration) | **32 min 45 s** | Opération `CLONE` de 11:16:40 à 11:49:26 UTC, instance `db-f1-micro`, 10 Go |
| **RPO** (perte de données) | **0** au point demandé | 314 lignes attendues, 314 restaurées, 0 manquante, 0 en trop ; les 3 écritures postérieures au point de restauration correctement absentes |
| Fenêtre de restauration disponible | **7 jours** | `transactionLogRetentionDays: 7`, journaux en Cloud Storage |
| Sauvegardes complètes conservées | **7**, quotidiennes à 02:00 UTC | `retainedBackups: 7` |

**Le RTO réel à annoncer est supérieur à 32 min** : il faut y ajouter le temps de détection,
de décision, et la bascule de l'application vers l'instance restaurée. Compter **45 min à 1 h**
de bout en bout tant que ces étapes ne sont pas elles-mêmes chronométrées.

### Procédure

> **⚠️ Instance partagée multi-app (depuis l'onboarding Elson).** Le clone PITR restaure
> **l'instance entière** : ramener `menal_db` à T-2h ramène AUSSI `elson_db` à T-2h. Avant
> toute bascule vers l'instance restaurée, décider quoi faire de l'autre base : soit la
> fenêtre d'incident est commune (bascule totale assumée), soit il faut extraire la seule
> base sinistrée du clone (`pg_dump` de la base depuis le clone → restore ciblé sur
> l'instance d'origine) et NE PAS basculer l'instance. Ce second chemin n'a jamais été
> chronométré — le tester avant de s'engager sur un RTO multi-app.

**Restaurer toujours vers une instance NEUVE**, jamais par-dessus l'originale : tant que la
cause n'est pas comprise, l'instance d'origine est une pièce à conviction. C'est aussi ce qui
permet de comparer avant de basculer.

```bash
PROJET=menal-zero-trust-staging

# 1. Choisir le point de restauration. IMPÉRATIF : dans le PASSÉ.
#    Une date même de quelques secondes dans le futur est rejetée par l'API
#    ("PITR Timestamp should be before current time") — piège rencontré au test.
PIT="2026-08-03T11:13:00Z"

# 2. Cloner (≈ 33 min). La commande gcloud rend la main au bout de ~10 min
#    avec un message d'attente : ce n'est PAS un échec, l'opération continue.
gcloud sql instances clone menal-db-staging menal-db-restore \
  --project=$PROJET --point-in-time="$PIT"

# 3. Si la commande a rendu la main avant la fin, suivre l'opération :
gcloud sql operations list --instance=menal-db-restore --project=$PROJET --limit=1
gcloud beta sql operations wait --project=$PROJET <OPERATION_ID> --timeout=1800

# 4. Vérifier que l'instance est debout et que la base existe
gcloud sql instances describe menal-db-restore --project=$PROJET --format="value(state)"
gcloud sql databases list --instance=menal-db-restore --project=$PROJET
```

### Vérifier le contenu sans exposer l'instance

L'instance restaurée est en IP privée : on ne peut pas s'y connecter depuis un poste. **Ne
pas lui ajouter d'IP publique pour vérifier** — cela exposerait une copie complète des données
à Internet, au pire moment. Passer par un export, qui utilise l'API d'administration et ne
demande aucune connectivité réseau :

```bash
BUCKET=menal-restore-verify-$(date -u +%s)
gcloud storage buckets create gs://$BUCKET --project=$PROJET \
  --location=europe-west1 --uniform-bucket-level-access

SA=$(gcloud sql instances describe menal-db-restore --project=$PROJET \
       --format="value(serviceAccountEmailAddress)")
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"

gcloud sql export sql menal-db-restore gs://$BUCKET/verif.sql \
  --database=menal_db --table=audit_logs --project=$PROJET

gcloud storage cp gs://$BUCKET/verif.sql .
```

Comparer ensuite avec un export de l'instance d'origine : toutes les lignes antérieures au
point de restauration doivent être présentes, et **aucune postérieure**. C'est ce contrôle,
et non la seule présence du schéma, qui prouve que la restauration a coupé au bon endroit.

### Basculer l'application

```bash
# Le nom de connexion est une variable d'environnement du service Cloud Run
gcloud run services update menal-api-staging --project=$PROJET --region=europe-west1 \
  --set-env-vars CLOUD_SQL_CONNECTION_NAME=$PROJET:europe-west1:menal-db-restore
```

Puis **reporter le changement dans Terraform** (`modules/cloud-sql`, `modules/cloud-run`),
sinon le prochain `apply` ramènera l'ancienne instance.

### Nettoyage

```bash
gcloud sql instances delete menal-db-restore --project=$PROJET --quiet
gcloud storage rm -r gs://$BUCKET --quiet
```

Une instance de restauration oubliée est facturée en continu. Le nettoyage fait partie de la
procédure, pas d'un rangement ultérieur.

---

## 4. Réponse aux alertes

Dix politiques sont actives. Ce que chacune veut dire, et par où commencer.

| Alerte | Ce qu'elle signifie | Premier geste |
|---|---|---|
| **Taux d'erreur API > 10 %** | Régression applicative ou dépendance en panne | Journaux Cloud Run de la révision en service ; retour arrière (§1) si la livraison est récente |
| **Pics 5xx > 30 / 5 min** | Idem, en plus brutal | Idem, et vérifier la base (§2) |
| **Latence P99 > 2 s** | Saturation, ou démarrages à froid en rafale | Vérifier le nombre d'instances ; l'API est à `min_instance_count = 0` |
| **Échecs auth > 20 / 5 min** | Attaque par force brute en cours | Vérifier que R1 s'est déclenchée (`detections`) et que Cloud Armor bannit (règle 1450). Si l'attaque passe, c'est le bord qui a un problème, pas l'application |
| **Cloud SQL CPU > 80 %** | Requête coûteuse, ou instance sous-dimensionnée (`db-f1-micro`) | `gcloud sql operations list` ; regarder les requêtes lentes |
| **API Health Check échoue** | Le conteneur ne répond plus du tout | Retour arrière (§1). **Ne pas conclure que la base va bien** parce que cette alerte est muette (§0) |
| **Job d'enrichissement ML en échec** | ml-embed injoignable, BigQuery en erreur, ou insertion refusée | §5 |
| **Requête planifiée BigQuery en échec** | Une règle de détection ou une normalisation ne tourne plus | §6 |
| **Ingestion des journaux à l'arrêt** | Plus aucune requête observée depuis 30 min | Soit l'API est morte, soit la chaîne de journalisation est rompue. Vérifier d'abord que l'API répond |
| **Enrichissement en retard (> 30 min)** | Le résultat n'arrive plus, quelle qu'en soit la cause | §5. C'est l'alerte à privilégier : elle mesure le résultat, pas un composant |

---

## 5. Le pipeline ML n'enrichit plus

```bash
PROJET=menal-zero-trust-staging; REGION=europe-west1

# Le job s'exécute-t-il, et réussit-il ?
gcloud run jobs executions list --job=menal-enrich-job-staging \
  --project=$PROJET --region=$REGION --limit=5 \
  --format="table(name,status.completionTime,status.succeededCount,status.failedCount)"

# Que dit le dernier run ? (la mesure de retard y figure en JSON)
gcloud logging read 'resource.type="cloud_run_job"
  AND resource.labels.job_name="menal-enrich-job-staging"' \
  --project=$PROJET --limit=20 --format="value(textPayload,jsonPayload.message)" --freshness=1h

# Le déclencheur tourne-t-il toujours ?
gcloud scheduler jobs describe menal-enrich-trigger-staging \
  --project=$PROJET --location=$REGION --format="value(state,schedule)"

# Combien de détections attendent ? (source de vérité)
bq query --project_id=$PROJET --use_legacy_sql=false \
 'SELECT COUNT(*) AS en_attente FROM `menal_security_staging.detections` d
  WHERE d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
    AND NOT EXISTS (SELECT 1 FROM `menal_security_staging.alert_enrichment` e
                    WHERE e.detection_id = CONCAT("{\"rule_id\": \"", d.rule_id,
                      "\", \"timestamp\": \"",
                      FORMAT_TIMESTAMP("%Y-%m-%d %H:%M:%E6S+00:00", d.timestamp), "\"}"))'
```

**Le job échoue désormais franchement quand il échoue** — ce n'était pas le cas avant le
2 août, où il sortait en succès même ml-embed injoignable. Un `failedCount` non nul est donc
une information fiable, et `max_retries = 2` reprend automatiquement.

**Une exécution en succès avec un retard qui monte** signifie que le job tourne mais ne
traite rien : regarder `ml-embed` (démarrage à froid du modèle ONNX, ~26 s mesurés) et les
droits BigQuery de `sa-enrich-job`.

**Ne pas relancer le job en boucle pour « débloquer »** : il déduplique. Relancer ne
retraitera pas ce qui est déjà enrichi et ne changera rien au symptôme.

---

## 6. Une règle de détection ou une normalisation ne tourne plus

```bash
# Lister les 12 transferts (7 règles R1-R7 + 5 normalisations F4)
bq ls --transfer_config --transfer_location=europe-west1 \
  --project_id=menal-zero-trust-staging

# Historique d'exécution d'un transfert
bq ls --transfer_run --run_attempt=LATEST \
  --filter='states:FAILED' <RESOURCE_NAME>
```

**Vérifier la fraîcheur des tables plutôt que l'état des transferts** — c'est plus rapide et
c'est ce qui compte :

```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false \
 'SELECT "access_logs" t, MAX(timestamp) dernier FROM `menal_security_staging.access_logs`
  UNION ALL SELECT "detections", MAX(timestamp) FROM `menal_security_staging.detections`
  UNION ALL SELECT "alert_enrichment", MAX(timestamp) FROM `menal_security_staging.alert_enrichment`
  UNION ALL SELECT "api_metrics", MAX(hour) FROM `menal_security_staging.api_metrics`'
```

`access_logs` doit être frais à quelques minutes. `detections` peut légitimement être ancien :
les règles n'insèrent que s'il y a quelque chose à détecter.

**Piège déjà rencontré :** un `terraform apply -target` a un jour déclenché un remplacement
destructeur en attente sur `cve_findings` et vidé la table (111 lignes perdues). Avant tout
`apply`, **lire le plan en entier**, pas seulement sa fin.

---

## 7. Escalade et points de contact

| Rôle | Qui | Quand |
|---|---|---|
| Astreinte technique | **à désigner** | — |
| Propriétaire GCP | `mansour.cheikh2010@gmail.com` | Décisions IAM, facturation |
| Canal d'alerte | e-mail, canal unique **non vérifié** | — |

> **Deux manques assumés, à traiter avant tout engagement client.** Il n'existe qu'un seul
> canal d'alerte, sur une adresse personnelle dont la vérification n'a jamais été confirmée :
> l'alerting est donc lui-même un point unique de défaillance. Et aucune astreinte n'est
> désignée — ce runbook décrit quoi faire, pas qui le fera à 3 h du matin.

---

## 8. Onboarding Elson — opérations (07/08/2026)

L'infra Elson est déclarée dans `terraform/environments/staging/elson.tf`, désactivée par
`elson_enabled=false`. L'activation se fait **en deux temps**, dans cet ordre strict :

**Temps 1 — refactos socle (déjà commités)** : `terraform plan` doit montrer uniquement les
`moved` du monitoring (aucun destroy). Appliquer. Toute destruction d'une ressource MENAL
dans le plan = arrêt immédiat (moved block ou tfvars raté) — lire le plan EN ENTIER.

**Temps 2 — activation Elson**, préconditions TOUTES remplies :
1. Enregistrement A `elson.menal-sarl.com` → IP du LB staging (`8.232.24.132`) chez le
   registrar — AVANT l'apply, sinon le certificat managé reste en PROVISIONING.
2. Variables GitHub créées : `ELSON_API_SERVICE_NAME`, `ELSON_WEB_SERVICE_NAME`,
   `ELSON_MIGRATE_JOB_NAME`, `ELSON_DOMAIN` (cf. en-tête de `elson-ci.yml`).
3. Premier passage de `elson-ci.yml` sur main : images `elson-backend`/`elson-frontend`
   poussées dans Artifact Registry (le module cloud-run référence `:latest`).
4. Dans `terraform.tfvars` : `elson_enabled=true` + décommenter TOUT le bloc Elson d'un
   coup (`cloud_run_services`, `auth_paths`, `extra_services`, `monitored_services`,
   `r4_excluded_services`) — en réincluant les valeurs menal-api (piège des fallbacks).
5. `terraform apply -target=module.elson_app` (SA/secrets/base/bucket/job), puis apply
   complet.
6. **Isolation SQL (une fois)** — les users Postgres Cloud SQL sont membres de
   `cloudsqlsuperuser`, sans ces REVOKE chaque app lit la base de l'autre :
   ```sql
   REVOKE CONNECT ON DATABASE menal_db FROM PUBLIC;
   REVOKE CONNECT ON DATABASE menal_db FROM elson_user;
   GRANT  CONNECT ON DATABASE menal_db TO api_user;
   REVOKE CONNECT ON DATABASE elson_db FROM PUBLIC;
   REVOKE CONNECT ON DATABASE elson_db FROM api_user;
   GRANT  CONNECT ON DATABASE elson_db TO elson_user;
   ```
   Exécution : **via le job `elson-migrate-staging`** (`src/scripts/sql-isolation.ts`,
   retag `:latest` + `--command "npx,tsx,src/scripts/sql-isolation.ts"`), pas via
   cloud-sql-proxy : l'instance n'a pas d'IP publique, le proxy local ne la joint pas.
   **Durcissement complémentaire** (`src/scripts/sql-isolation-harden.ts`, après un test
   probe qui montrait la persistance de l'accès croisé par héritage) :
   ```sql
   GRANT  ALL ON SCHEMA public TO elson_user;  -- sur elson_db (migrations futures)
   GRANT  ALL ON SCHEMA public TO api_user;    -- sur menal_db
   REVOKE cloudsqlsuperuser FROM api_user;
   REVOKE cloudsqlsuperuser FROM elson_user;
   ```
   Vérification (job, puis logs) : `has_database_privilege` → `CONNECT=true` sur
   `api_user→menal_db` et `elson_user→elson_db` uniquement, probe croisé vers la base
   de l'autre app **REJETÉ**, accès propre toujours OK.
7. Basculer `ELSON_DEPLOY_ENABLED=true` (variable GitHub) → le job deploy de `elson-ci.yml`
   migre (job `elson-migrate-staging`) puis déploie les deux services, smoke test compris.
8. Premier accès admin Elson : ajouter temporairement `ADMIN_BOOTSTRAP=true` sur
   `elson-api-staging` (`gcloud run services update --update-env-vars`), créer l'admin et
   whitelister son IP via l'UI, puis RETIRER la variable (procédure DEPLOY_CHECKLIST §4b).

Post-activation : vérifier logs Elson dans `access_logs` BigQuery, alertes `[staging][elson]`
dans Cloud Monitoring, règle Armor 1450 active sur `/api/auth`, et smoke MENAL toujours vert.

---

## 9. Ce que ce runbook ne couvre pas encore

| Sujet | État |
|---|---|
| Bascule de zone Cloud SQL | Impossible : instance zonale, pas de réplica (§2) |
| Restauration de BigQuery | Aucune procédure. Le SIEM n'a pas de sauvegarde ; les partitions n'ont pas d'expiration configurée |
| Reprise après perte de l'état Terraform | Le versioning du bucket est actif depuis le 2 août, mais la reprise n'a jamais été testée |
| Compromission (fuite de secret, jeton volé) | Aucune procédure de rotation d'urgence documentée |
| Environnement de production | N'existe pas (`terraform/environments/prod/` est vide) |

Ces manques sont réels et connus. Les inscrire ici plutôt que de les taire est le seul moyen
qu'ils soient traités : un runbook qui prétend tout couvrir se fait démentir au premier
incident qu'il n'avait pas prévu.
