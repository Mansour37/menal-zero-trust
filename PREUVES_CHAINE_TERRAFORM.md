# Preuves — Infrastructure as Code (Terraform)

**L'infrastructure est-elle vraiment décrite en code, et cette description est-elle fidèle à ce qui
tourne ?**
Ce fichier répond à trois questions : *que gère réellement Terraform ?*, *où vit l'état et comment
est-il protégé ?*, et — la plus inconfortable — *peut-on reconstruire cette infrastructure depuis
le dépôt ?*

| | |
|---|---|
| Racine | [`terraform/environments/staging/`](terraform/environments/staging/) |
| Projet | `menal-zero-trust-staging` (europe-west1) |
| Date des relevés | **09/09/2026** |
| Script de capture | [`scripts/preuve-terraform.sh`](scripts/preuve-terraform.sh) — lecture seule, aucun `apply` |
| Pièces | [`preuves/terraform-2026-09-09/`](preuves/terraform-2026-09-09/) |

---

## 1. Ce que Terraform gère réellement

| | |
|---|---|
| Fichiers `.tf` | **53** |
| Modules réutilisables | **16** |
| Lignes de code | **5 717** |
| Ressources gérées | **173** (222 instances) |
| Types de ressources distincts | **56** |
| Modules instanciés dans l'état | **19** |
| Sources de données | 7 |
| Version de Terraform | `1.14.9` · format d'état `v4` · **serial 89** |

Le *serial* 89 se lit comme un compteur d'écritures : l'état a été modifié 89 fois. Ce n'est pas
une infrastructure décrite une fois puis abandonnée.

**Répartition par module** — elle dit où est la complexité réelle :

| Module | Ressources | | Module | Ressources |
|---|---|---|---|---|
| `load_balancer` | 20 | | `elson_app[0]` | 17 |
| `bigquery` | 19 | | `dashboard` | 10 |
| `monitoring` | 19 | | `vpc` | 10 |
| `iam` | 18 | | `logging` | 9 |
| `cloud_sql` | 17 | | `kms` | 8 |

Les cinq premiers modules portent la moitié des ressources : le répartiteur de charge (avec son
WAF), l'entrepôt de sécurité, la supervision, les identités et la base. C'est cohérent avec un
socle Zero Trust — ce n'est pas une application avec un peu d'infrastructure autour.

**Types les plus fréquents** :

```
google_project_iam_member                15     google_service_account                   7
google_monitoring_alert_policy           11     google_secret_manager_secret             6
google_bigquery_table                    10     google_secret_manager_secret_iam_member  6
google_bigquery_dataset_iam_member        8     google_service_account_iam_member        6
```

**Le chiffre à retenir : 79 des 173 ressources — soit 46 % — portent sur l'IAM, les secrets ou le
chiffrement.**

| Catégorie | Ressources | Part | Types distincts |
|---|---|---|---|
| IAM (identités, bindings, impersonation) | **63** | 36 % | 13 |
| Secrets et chiffrement (Secret Manager, KMS) | **16** | 9 % | 4 |
| Tout le reste (réseau, calcul, données, supervision) | 94 | 54 % | 39 |

Près d'une ressource sur deux existe pour décider *qui a le droit de faire quoi*. Le contrôle
d'accès n'est pas cliqué dans une console puis oublié : il est déclaré, versionné, relisible et
diffable. C'est ce qui rend l'audit du §4 possible.

---

## 2. Où vit l'état, et comment il est protégé

L'état Terraform est le fichier le plus sensible d'un dépôt d'infrastructure : il contient les
mots de passe générés en clair. Sa protection se vérifie :

| Propriété | Valeur | Ce que ça garantit |
|---|---|---|
| Emplacement | `EUROPE-WEST1` | la donnée ne quitte pas l'UE |
| Accès uniforme (UBLA) | **activé** | plus d'ACL par objet — un seul modèle IAM, auditable |
| Blocage d'accès public | **`enforced`** | aucune exposition publique possible, même par erreur |
| Versioning | **activé** | un état écrasé reste récupérable |
| Suppression différée | **7 jours** | une suppression accidentelle est rattrapable |
| Chiffrement | clés gérées par Google | chiffré au repos, sans CMEK |

Le bucket est `gs://menal-tf-state-staging`, préfixe `env/staging`.

> **Écart mineur assumé** : le dataset BigQuery et les secrets sont chiffrés par CMEK
> (`modules/kms`), mais le bucket d'état ne l'est pas. Or c'est lui qui contient les mots de passe
> générés. Ce n'est pas une faille — le chiffrement au repos par Google s'applique — mais c'est une
> incohérence de posture qu'un jury peut relever. Le dire avant qu'on le demande.

**Le script ne conserve jamais l'état comme pièce justificative.** Il le télécharge, en extrait les
compteurs agrégés, puis le supprime — précisément parce qu'il contient des secrets en clair. Seuls
`etat_resume.csv`, `etat_par_module.csv` et `etat_par_type.csv` sont conservés.

---

## 3. Peut-on reconstruire depuis le dépôt ? Non — trois obstacles réels

C'est la partie qu'il faut présenter honnêtement, parce qu'elle est vérifiable en une commande.

### 3.1 Le backend déclaré n'est pas le backend utilisé

```
declare dans le code       menal-tf-state
memorise en local          menal-tf-state-staging
reellement utilise         menal-tf-state-staging
```

[`terraform/environments/staging/main.tf`](terraform/environments/staging/main.tf) déclare
`bucket = "menal-tf-state"`. L'état réel vit dans `menal-tf-state-staging`. **Les deux buckets
existent**, ce qui rend l'erreur silencieuse :

| Bucket | Objet | Dernière écriture |
|---|---|---|
| `menal-tf-state` *(déclaré)* | `env/staging/default.tfstate` | **19/08/2026 13:15** |
| `menal-tf-state-staging` *(réel)* | `env/staging/default.tfstate` | **20/08/2026 03:43** |

Un `terraform init` depuis un dépôt fraîchement cloné viserait donc un état figé au 19/08. Ça ne
fonctionne aujourd'hui que grâce au répertoire `.terraform/` local, **qui n'est pas sous suivi de
version** : il mémorise la surcharge `-backend-config` passée à l'init lors de la migration.

Terraform le détecte lui-même et **refuse de planifier** :

```
Error: Backend initialization required: please run "terraform init"
Reason: Backend configuration block has changed
```

C'est la preuve qui se démontre toute seule : l'outil constate que le code ne correspond pas à la
réalité. **Correctif** — une ligne dans `main.tf` :

```hcl
backend "gcs" {
  bucket = "menal-tf-state-staging"   # au lieu de "menal-tf-state"
  prefix = "env/staging"
}
```

### 3.2 Terraform est en 32 bits, et le provider plante

Même en réinitialisant vers le bon bucket, le plan échoue :

```
Stack trace from the terraform-provider-google_v5.45.2_x5.exe plugin:
panic: Error reading level state: strconv.ParseInt: parsing "1786143883702": value out of range
```

`1786143883702` est un horodatage en millisecondes. Sur une build `windows_386`, l'entier signé
plafonne à `2 147 483 647` — la valeur déborde. Le binaire utilisé est bien
`Terraform v1.14.9 on windows_386`, **sur une machine 64 bits**.

**Correctif** : installer la build `windows_amd64`. Le script
[`scripts/preuve-terraform.sh`](scripts/preuve-terraform.sh) détecte désormais ce cas et
l'annonce avant de tenter quoi que ce soit.

### 3.3 L'identité de Terraform n'est pas celle de gcloud

Terraform s'authentifie par *Application Default Credentials*, qui portent ici
`gcp.infra@adst.io` — un compte sans accès au bucket d'état :

```
Failed to open state file at gs://menal-tf-state-staging/env/staging/default.tfstate:
403 AccessDenied — gcp.infra@adst.io does not have storage.objects.get access
```

Le compte qui a les droits est `mansour.cheikh2010@gmail.com`, actif dans `gcloud` mais pas dans
l'ADC. **Contournement** : passer un jeton du compte actif, sans jamais l'afficher —

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" terraform plan
```

> Ne jamais exécuter cette commande de jeton **à l'écran** pendant une captation : elle affiche un
> credential valide une heure. Ici il est consommé par une variable, jamais imprimé.

---

## 4. Le piège à ne pas tomber : « plan vide » ≠ « aucune dérive »

C'est le point le plus important de cette fiche, et il vaut au-delà de ce projet.

`terraform plan` ne compare que ce qu'il a **dans son état**. Les ressources IAM de type
`google_*_iam_member` sont **non autoritatives** : elles ajoutent un binding sans revendiquer la
liste complète. Terraform ne supprime donc jamais un binding qu'il ne connaît pas, et n'en signale
pas l'existence.

Conséquence démontrée sur ce projet — [`PREUVES_CHAINE_IAM.md`](PREUVES_CHAINE_IAM.md) §6 :
`sa-cicd` détient `WRITER` sur tout le dataset `menal_security_staging`, alors que ce binding
n'existe **ni dans le code, ni dans l'état**. Un plan affiche « aucun changement » et continuera de
l'afficher indéfiniment.

> **La règle à retenir, et à dire** : un audit IAM doit interroger le **cloud**, pas l'état
> Terraform. « `terraform plan` est propre » prouve que le code et l'état concordent — pas que
> l'infrastructure est conforme au code.

Le dernier écrit de l'état date du **20/08/2026** : aucun `apply` depuis trois semaines. Tout
changement d'infrastructure survenu depuis a donc été fait hors Terraform.

---

## 5. Rejouer chaque preuve

```bash
# Tout, en lecture seule (code, etat, backend, coherence)
bash scripts/preuve-terraform.sh

# En ajoutant une tentative de plan reel
AVEC_PLAN=1 bash scripts/preuve-terraform.sh
```

Vérifications unitaires :

```bash
# Volumetrie du code
find terraform -name "*.tf" | wc -l
ls -1 terraform/modules | wc -l

# Securite du bucket d'etat
gcloud storage buckets describe gs://menal-tf-state-staging --project=menal-zero-trust-staging \
  --format="value(location,versioning_enabled,uniform_bucket_level_access,public_access_prevention)"

# Les deux buckets d'etat, et leurs dates
gcloud storage ls -l -r gs://menal-tf-state/**
gcloud storage ls -l gs://menal-tf-state-staging/env/staging/

# Le backend declare dans le code
grep -A3 'backend "gcs"' terraform/environments/staging/main.tf

# Le backend memorise localement (non versionne)
python -c "import json;print(json.load(open('terraform/environments/staging/.terraform/terraform.tfstate'))['backend']['config']['bucket'])"

# L'architecture du binaire
/c/terraform/terraform version
```

---

## 6. Ce qu'il faut corriger — par ordre de gravité

| # | Écart | Correctif | Effort |
|---|---|---|---|
| 1 | Backend déclaré ≠ backend réel | une ligne dans `main.tf` | minutes |
| 2 | Binding IAM orphelin `sa-cicd` | retirer l'entrée d'ACL du dataset ([`PREUVES_CHAINE_IAM.md`](PREUVES_CHAINE_IAM.md) §6) | minutes |
| 3 | Terraform 32 bits | installer la build `windows_amd64` | minutes |
| 4 | ADC ≠ compte gcloud | `gcloud auth application-default login` avec le bon compte | minutes |
| 5 | Bucket d'état sans CMEK | cohérence avec le reste, ou l'assumer par écrit | à arbitrer |

Les quatre premiers se règlent en une demi-heure. Tant qu'ils tiennent, la phrase « notre
infrastructure est reproductible depuis le dépôt » n'est pas vraie — et c'est exactement le genre
d'affirmation qu'un jury vérifie en demandant de lancer un `plan`.
