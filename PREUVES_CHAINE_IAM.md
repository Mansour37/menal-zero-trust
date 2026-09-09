# Preuves — chaîne IAM

**Qui est qui, qui peut quoi, et surtout : qui ne peut pas.**
Ce fichier répond à trois questions : *avec quelle identité chaque maillon s'exécute-t-il ?*,
*d'où vient cette identité et combien de temps vit-elle ?*, et *qu'est-ce que la chaîne IAM
refuse, concrètement ?*

| | |
|---|---|
| Projet | `menal-zero-trust-staging` (europe-west1) |
| Source de vérité | [`terraform/modules/iam/`](terraform/modules/iam/), [`terraform/modules/bigquery/`](terraform/modules/bigquery/), [`terraform/modules/app-service/`](terraform/modules/app-service/) |
| Date des relevés | **08/09/2026** |
| Nature | Aucune valeur recopiée du code. Chaque ligne vient d'un appel `gcloud`/`bq` sur le projet réel, rejouable — la commande est donnée au §7. |

---

## 1. Les 7 identités et ce qu'elles portent

Aucun service ne tourne sous une identité par défaut : chaque maillon du diagramme a son propre
compte de service, créé par Terraform.

| Compte de service | Porte | Rôles au niveau **projet** |
|---|---|---|
| `sa-api` | API SIEM (FastAPI) | `cloudsql.client`, `logging.logWriter`, `bigquery.jobUser` |
| `sa-dashboard-staging` | MENAL Sentinel (Next.js) | `bigquery.jobUser` |
| `sa-elson` | ELSON (site + API Node) | `cloudsql.client`, `bigquery.jobUser` |
| `sa-pipeline` | Normalisation + 7 règles | `bigquery.dataEditor`, `logging.logWriter`, `bigquery.jobUser` |
| `sa-enrich-job` | Job d'enrichissement ATT&CK | `logging.logWriter`, `bigquery.jobUser` |
| `sa-ml-embed` | Encodeur ATT&CK-BERT ONNX | *(aucun rôle projet)* |
| `sa-cicd` | Chaîne GitHub Actions | `run.developer`, `artifactregistry.writer`, `bigquery.jobUser` |

> `bigquery.jobUser` ne donne **aucun accès aux données** : il autorise seulement à *lancer* un
> job. Ce que le compte peut lire ou écrire est décidé séparément, au niveau du dataset ou de la
> table (§4).

**Le relevé important est celui-ci** — au niveau projet, la recherche des rôles sensibles
(`secretmanager.*`, `iam.serviceAccountUser`, `iam.serviceAccountTokenCreator`, `owner`, `editor`)
ne renvoie **aucun compte de service MENAL** :

```
110809493492-compute@developer.gserviceaccount.com   roles/editor
110809493492@cloudservices.gserviceaccount.com       roles/editor
user:mansour.cheikh2010@gmail.com                    roles/owner
```

Les deux `roles/editor` sont les comptes **par défaut de Google Cloud** (Compute Engine et
Cloud Services), présents à la création du projet et non utilisés par MENAL — aucun service Cloud
Run ne tourne sous eux (§1, colonne « Porte »). Le seul `owner` est un humain nommé.

---

## 2. La porte d'entrée : GitHub → GCP, sans aucune clé

### 2.1 Le filtre qui fait autorité

La chaîne de livraison s'authentifie par jeton OIDC (WIF), jamais par un fichier de clé. La
condition qui décide d'accepter ou non ce jeton est portée par GCP :

```
assertion.repository == 'Mansour37/menal-zero-trust' && assertion.ref == 'refs/heads/main'
```

Deux verrous, pas un : le **dépôt** *et* la **branche**. Une branche de fonctionnalité, même
poussée dans le bon dépôt, n'obtient pas l'identité `sa-cicd`. C'est ce qui rend la Phase 1 de la
chaîne (demande de fusion) structurellement incapable de déployer, indépendamment du garde-fou
`if: github.ref` écrit côté GitHub — lequel, seul, serait contournable.

### 2.2 Aucune clé de compte de service n'existe

Le risque classique d'une chaîne CI/CD est le fichier JSON de clé, qui ne périme jamais et fuit
dans un secret de dépôt. Comptage des clés gérées par l'utilisateur, compte par compte :

| Compte de service | Clés utilisateur |
|---|---|
| `sa-api` | **0** |
| `sa-cicd` | **0** |
| `sa-pipeline` | **0** |
| `sa-enrich-job` | **0** |
| `sa-elson` | **0** |
| `sa-dashboard-staging` | **0** |

Il n'y a donc **rien à voler** : les seules identités en circulation sont des jetons OIDC de courte
durée, émis à l'exécution.

### 2.3 Le graphe d'impersonation, en entier

C'est le relevé le plus parlant de la chaîne IAM : *qui a le droit de devenir qui*.

| Compte cible | Qui peut l'endosser | Rôle |
|---|---|---|
| `sa-cicd` | le dépôt `Mansour37/menal-zero-trust` **sur `main`** (principalSet WIF) | `iam.workloadIdentityUser` |
| `sa-api` | `sa-cicd` | `iam.serviceAccountUser` |
| `sa-elson` | `sa-cicd` | `iam.serviceAccountUser` |
| `sa-dashboard-staging` | `sa-cicd` | `iam.serviceAccountUser` |
| `sa-pipeline` | agents Google BigQuery Data Transfer et Cloud Scheduler | `iam.serviceAccountTokenCreator` |
| `sa-enrich-job` | **personne** | — |
| `sa-ml-embed` | **personne** | — |

Trois choses se lisent directement dans ce tableau :

1. La chaîne complète tient en **un seul saut** : `main` → `sa-cicd` → les trois identités
   applicatives. Il n'y a pas de rebond possible vers `sa-pipeline`, `sa-enrich-job` ou
   `sa-ml-embed`.
2. `iam.serviceAccountUser` sur `sa-api` est un droit de **déploiement** (« lancer une révision
   *sous* cette identité »), pas un droit d'exécution : `sa-cicd` ne récupère jamais les jetons de
   `sa-api`, donc n'accède pas aux secrets de `sa-api` (§3).
3. Ce droit est accordé **compte par compte**. Le rôle équivalent au niveau projet aurait laissé la
   chaîne CI endosser *n'importe quel* compte du projet — c'est écarté explicitement dans
   [`terraform/modules/iam/main.tf`](terraform/modules/iam/main.tf).

---

## 3. Cloisonnement des secrets : 9 secrets, un seul lecteur chacun

Aucun compte n'a `secretmanager.secretAccessor` au niveau projet (§1). L'accès est accordé
**secret par secret** :

| Secret | Seul lecteur autorisé |
|---|---|
| `db-password-staging` | `sa-api` |
| `jwt-secret-staging` | `sa-api` |
| `mfa-encryption-key-staging` | `sa-api` |
| `elson-db-password-staging` | `sa-elson` |
| `elson-jwt-secret-staging` | `sa-elson` |
| `elson-otp-pepper-staging` | `sa-elson` |
| `elson-api-key-secret-staging` | `sa-elson` |
| `elson-audio-url-secret-staging` | `sa-elson` |
| `dashboard-password-staging` | `sa-dashboard-staging` |

Ce tableau est une preuve de cloisonnement **multi-applications** : `sa-elson` ne peut lire aucun
secret MENAL, et `sa-api` ne peut lire aucun secret ELSON. La frontière entre les deux applications
existe déjà à la couche secret, avant même la couche base de données.

Et la ligne qui manque est la plus importante : **`sa-cicd` n'apparaît nulle part.** La chaîne de
livraison déploie des services qui consomment ces secrets, sans jamais pouvoir en lire un seul.
`sa-pipeline`, `sa-enrich-job` et `sa-ml-embed` non plus.

---

## 4. Le principe cardinal : un moteur ne modifie pas les preuves qu'il analyse

HLD §5 / LLD §2.1. Il ne se tient pas par une convention de code, mais par des droits accordés
**au niveau de la table**, pas du dataset.

| Compte | Sur le dataset `menal_security_staging` | Écriture accordée en plus |
|---|---|---|
| `sa-pipeline` | `dataEditor` (WRITER) | — *(c'est lui qui écrit les preuves)* |
| `sa-api` | `dataViewer` (READER) | table `analyst_verdicts` uniquement |
| `sa-enrich-job` | `dataViewer` (READER) | table `alert_enrichment` uniquement |
| `sa-dashboard-staging` | `dataViewer` (READER) | — |
| `sa-cicd` | *(devrait être : aucun — voir §6)* | table `cve_findings` uniquement |

Les deux droits table-level, relevés en direct :

```
cve_findings      -> sa-cicd        roles/bigquery.dataEditor
alert_enrichment  -> sa-enrich-job  roles/bigquery.dataEditor
```

Concrètement : le job d'enrichissement ML **lit** `detections` et **écrit** son verdict dans
`alert_enrichment` — une table à part. Il ne peut pas réécrire la détection qu'il vient de juger.
De même, l'API restitue les incidents et peut poser une annotation humaine dans
`analyst_verdicts`, mais ne peut pas toucher `detections`, `raw_logs`, `access_logs` ni
`security_events`.

> Nuance à assumer devant un jury : la restriction « seul un rôle *admin* peut émettre un verdict »
> vit dans le code de l'API (`require_role` dans [`api/app/routers/siem.py`](api/app/routers/siem.py)),
> pas dans l'IAM GCP — au niveau IAM, le JWT de l'utilisateur n'existe pas encore. Les deux couches
> sont complémentaires, elles ne se remplacent pas.

---

## 5. Ce que la chaîne IAM refuse — les preuves négatives

Une autorisation qui marche prouve peu ; un refus prouve beaucoup.

| Tentative | Résultat attendu | Ce qui l'empêche |
|---|---|---|
| Déployer depuis une branche autre que `main` | **refusé** | condition WIF sur `assertion.ref` (§2.1) |
| Déployer depuis un fork du dépôt | **refusé** | condition WIF sur `assertion.repository` |
| `sa-cicd` lit `jwt-secret-staging` | **refusé** | aucun binding secret pour `sa-cicd` (§3) |
| `sa-cicd` endosse `sa-pipeline` | **refusé** | pas de binding sur `sa-pipeline` (§2.3) |
| `sa-enrich-job` écrit dans `detections` | **refusé** | READER dataset + éditeur sur la seule `alert_enrichment` (§4) |
| `sa-api` écrit dans `raw_logs` | **refusé** | READER dataset + éditeur sur la seule `analyst_verdicts` (§4) |
| Appeler l'encodeur ML depuis Internet | **refusé** | `menal-ml-embed-staging` est en `ingress=internal`, invocable par le seul `sa-enrich-job` |
| Joindre l'API en contournant le WAF via l'URL `run.app` | **refusé** | `ingress=internal-and-cloud-load-balancing` sur les 4 services exposés |

### Le point qui surprend souvent : `allUsers` sur les services publics

Le relevé des invocateurs montre `allUsers` avec `roles/run.invoker` sur `menal-api-staging`,
`menal-dashboard-staging`, `elson-api-staging` et `elson-web-staging`. Ce n'est **pas** une faille,
et il faut savoir l'expliquer :

| Service | Invocateur | Entrée (`ingress`) |
|---|---|---|
| `menal-api-staging` | `allUsers` | `internal-and-cloud-load-balancing` |
| `menal-dashboard-staging` | `allUsers` | `internal-and-cloud-load-balancing` |
| `elson-api-staging` | `allUsers` | `internal-and-cloud-load-balancing` |
| `elson-web-staging` | `allUsers` | `internal-and-cloud-load-balancing` |
| `menal-ml-embed-staging` | `sa-enrich-job` **seul** | `internal` |

`allUsers` lève l'authentification *IAM* — c'est nécessaire, puisqu'un visiteur anonyme n'a pas de
compte Google. Mais `ingress` décide **par où** la requête peut arriver : avec
`internal-and-cloud-load-balancing`, l'URL `*.run.app` du service est injoignable depuis Internet.
Le seul chemin d'entrée est le répartiteur de charge, donc Cloud Armor, donc le WAF. **Le contrôle
d'accès n'est pas supprimé, il est déplacé** vers le WAF puis vers le JWT/RBAC de l'application.

---

## 6. Écart constaté le 08/09/2026 — à corriger avant toute capture

> **`sa-cicd` détient `WRITER` sur l'ensemble du dataset `menal_security_staging`, en plus de son
> droit table sur `cve_findings`.**

Relevé live de l'ACL du dataset :

```
WRITER   sa-cicd            <-- ne devrait pas exister
WRITER   sa-pipeline
WRITER   service-...@gcp-sa-logging
READER   sa-api / sa-dashboard-staging / sa-enrich-job
OWNER    mansour.cheikh2010@gmail.com
```

**Ce n'est ni dans le code, ni dans l'état Terraform.** L'inventaire de
`gs://menal-tf-state-staging/env/staging/default.tfstate` ne contient, pour `sa-cicd`, qu'une seule
ressource : `google_bigquery_table_iam_member.cicd_editor` sur `cve_findings`.

**Cause.** La correction Tier 1 du 07/08/2026 a transformé un
`google_bigquery_dataset_iam_member` en `google_bigquery_table_iam_member`. Ces ressources sont
**non autoritatives** (additives) : Terraform ne supprime que les bindings qu'il a lui-même en
état. L'ancien binding, sorti de l'état en même temps que du code, est resté vivant côté GCP —
orphelin.

**Conséquences, à connaître avant de présenter :**

1. La correction documentée comme appliquée **ne l'est pas** : une chaîne CI compromise peut
   toujours écrire dans `detections`, `raw_logs`, `access_logs` et `security_events` — donc
   falsifier des preuves, exactement le scénario que la correction visait.
2. **`terraform plan` affiche « 0 drift » et continuera de l'afficher.** L'absence de dérive
   Terraform ne prouve pas l'absence de binding IAM excédentaire. C'est la leçon transposable :
   un audit IAM doit interroger le **cloud**, pas seulement l'état Terraform.

**Correctif** (retire l'entrée d'ACL orpheline — à décider, non appliqué) :

```bash
bq show --format=prettyjson menal-zero-trust-staging:menal_security_staging > acl.json
# retirer l'objet {"role":"WRITER","userByEmail":"sa-cicd@..."} du tableau "access"
bq update --source acl.json menal-zero-trust-staging:menal_security_staging
```

À rejouer ensuite : le §7.4 doit alors montrer `sa-cicd` uniquement sur `cve_findings`.

---

## 7. Rejouer chaque preuve — les commandes

Toutes en lecture seule, aucune ne modifie le projet.

**7.1 — Les identités et leurs rôles projet**
```bash
gcloud iam service-accounts list --project=menal-zero-trust-staging --format="value(email)"

gcloud projects get-iam-policy menal-zero-trust-staging \
  --flatten="bindings[].members" --format="value(bindings.members,bindings.role)" \
  | grep -Ei "secret|serviceAccountUser|tokenCreator|owner|editor"
```

**7.2 — Le filtre WIF (dépôt + branche)**
```bash
gcloud iam workload-identity-pools providers describe menal-github-provider \
  --project=menal-zero-trust-staging --location=global \
  --workload-identity-pool=menal-github-pool --format="value(attributeCondition)"
```

**7.3 — Aucune clé de compte de service**
```bash
for sa in sa-api sa-cicd sa-pipeline sa-enrich-job sa-elson sa-dashboard-staging; do
  echo -n "$sa: "
  gcloud iam service-accounts keys list --managed-by=user --project=menal-zero-trust-staging \
    --iam-account=$sa@menal-zero-trust-staging.iam.gserviceaccount.com \
    --format="value(name)" | wc -l
done
```

**7.4 — Le graphe d'impersonation et les droits BigQuery**
```bash
for sa in sa-api sa-cicd sa-pipeline sa-enrich-job sa-elson sa-ml-embed sa-dashboard-staging; do
  echo "--- $sa"
  gcloud iam service-accounts get-iam-policy $sa@menal-zero-trust-staging.iam.gserviceaccount.com \
    --project=menal-zero-trust-staging --flatten="bindings[].members" \
    --format="value(bindings.members,bindings.role)"
done

bq show --format=prettyjson menal-zero-trust-staging:menal_security_staging
bq get-iam-policy menal-zero-trust-staging:menal_security_staging.cve_findings
bq get-iam-policy menal-zero-trust-staging:menal_security_staging.alert_enrichment
```

**7.5 — Le cloisonnement des secrets**
```bash
for s in $(gcloud secrets list --project=menal-zero-trust-staging --format="value(name)" | tr -d '\r'); do
  printf "%-32s :: " "$s"
  gcloud secrets get-iam-policy "$s" --project=menal-zero-trust-staging --format=json \
    | grep -o 'serviceAccount:sa-[a-z-]*' | sort -u | tr '\n' ' '
  echo
done
```

**7.6 — Entrée et invocateurs Cloud Run**
```bash
for s in menal-api-staging menal-dashboard-staging elson-api-staging elson-web-staging menal-ml-embed-staging; do
  printf "%-26s ingress=" "$s"
  gcloud run services describe "$s" --project=menal-zero-trust-staging --region=europe-west1 \
    --format="value(metadata.annotations['run.googleapis.com/ingress'])" | tr -d '\r'
  echo
done
```

> **Deux pièges de l'environnement Windows**, rencontrés en produisant ce fichier :
> `gcloud ... --format="value(...)"` termine ses lignes par un retour chariot — une boucle `for`
> sans `tr -d '\r'` échoue silencieusement sur **tous** les éléments sauf le dernier, et renvoie un
> résultat vide qu'on peut prendre pour « aucun droit ». Par ailleurs `bq ls --format=pretty`
> plante (bug du CLI 2.1.34) : utiliser `--format=json` ou `--format=prettyjson`.
