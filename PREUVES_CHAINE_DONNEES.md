# Preuves — chaîne de données : de la requête à la table

**Où va une donnée, qui la voit, et pourquoi les deux bases ne se parlent pas.**
Ce fichier répond à quatre questions : *par où passe une donnée entre le navigateur et la table ?*,
*en quoi `menal_db` et `elson_db` sont-elles réellement isolées ?*, *où vit la donnée utilisateur
et comment la récupérer proprement ?*, et *que contiennent vraiment les tables BigQuery ?*

| | |
|---|---|
| Projet | `menal-zero-trust-staging` (europe-west1) |
| Instance SQL | `menal-db-staging` — PostgreSQL 15, `REGIONAL`, IP **privée** `10.247.0.3`, `ipv4Enabled = False`, `sslMode = ENCRYPTED_ONLY` |
| Dataset | `menal_security_staging` — 23 tables |
| Date des relevés | **08/09/2026** (données live, l'ingestion tournait pendant la mesure) |
| Nature | Chaque chiffre vient d'une requête `bq` ou d'un appel `gcloud` rejouable — commandes au §7. |

---

## 1. Les deux trajets d'une donnée

Une plateforme comme MENAL ne mélange pas ces deux flux, et c'est le point à faire passer :

| | **Trajet métier** (la donnée de l'utilisateur) | **Trajet observation** (la trace de son passage) |
|---|---|---|
| Point de départ | le navigateur | le même appel, vu par l'infrastructure |
| Chemin | HTTPS → Cloud Armor → Cloud Run → **Cloud SQL** | Cloud Logging → Log Router → **Pub/Sub** → pipeline → **BigQuery** |
| Contenu | comptes, contenus, verdicts — la donnée elle-même | horodatage, chemin, code HTTP, IP, verdict WAF |
| Stockage | PostgreSQL, **IP privée**, jamais exposé | BigQuery, partitionné par jour |
| Qui écrit | `sa-api` / `sa-elson` | `sa-pipeline` (et le service Google de journalisation) |
| Durée de vie | tant que le compte existe | 90 jours (`raw_logs`, `access_logs`) |

**La règle de bonne pratique qui découle de cette séparation** : le SIEM ne doit pas devenir un
second entrepôt de données personnelles. Il observe *qu'un* appel a eu lieu, pas *ce que* l'appel
contenait. C'est pour cela que la donnée métier reste en base privée, et que BigQuery ne reçoit
que de la télémétrie.

### Le trajet observation, maillon par maillon

```
requête HTTP
   │
   ├─ Cloud Armor          verdict WAF (allow / deny 403)
   │
   ├─ Cloud Run            le service traite, journalise
   │
   ├─ Cloud Logging        journal structuré
   │
   ├─ Log Router (sink)    4 sinks : LB, Cloud Run, Cloud SQL, VPC
   │      └─ écrit via le compte Google `service-...@gcp-sa-logging` (WRITER sur le dataset)
   │
   ├─ raw_logs             228 654 lignes — la trace brute, telle quelle
   │
   ├─ normalisation F4     5 requêtes planifiées, identité `sa-pipeline`
   │      └─ access_logs (79 210) · security_events (62 680)
   │
   ├─ règles R1-R7         7 requêtes planifiées, identité `sa-pipeline`
   │      └─ detections (117)
   │
   ├─ job d'enrichissement identité `sa-enrich-job` → encodeur ATT&CK-BERT (ingress interne)
   │      └─ alert_enrichment (117)
   │
   └─ verdict analyste     identité `sa-api`, rôle admin exigé côté application
          └─ analyst_verdicts (23)
```

Chaque flèche change d'identité, et chaque identité perd des droits en avançant — c'est le
détail prouvé dans [`PREUVES_CHAINE_IAM.md`](PREUVES_CHAINE_IAM.md) §4.

---

## 2. L'isolation des bases : deux applications, une instance, zéro passerelle

`menal_db` et `elson_db` cohabitent sur la même instance `menal-db-staging`. Le cloisonnement ne
repose donc pas sur le réseau, mais sur trois couches empilées.

### 2.0 Une seule instance, une seule adresse — et pourquoi ça change tout

Point à avoir parfaitement clair avant d'être interrogé dessus : **`menal_db` et `elson_db` ne sont
pas deux serveurs.** Ce sont deux bases *à l'intérieur* du même serveur PostgreSQL, qui porte donc
une seule adresse.

```
menal-db-staging   POSTGRES_15   10.247.0.3   PRIVATE
  ├── postgres     (base de service)
  ├── menal_db
  └── elson_db
```

Les deux applications se connectent donc **au même `10.247.0.3:5432`**. Il faut assumer la
conséquence, parce qu'elle est structurante :

> **Le réseau n'apporte aucun cloisonnement ici.** Même IP, même port, même processus. Un filtrage
> réseau entre les deux applications serait techniquement sans effet. L'isolation tient
> **entièrement** à la couche des rôles PostgreSQL (§2.1) — et c'est précisément pour cela qu'elle
> est revérifiée toutes les 24 h (§2.2) : c'est le seul mur qui existe.

**Ne pas confondre une plage et une adresse d'hôte.** Les quatre adressages du projet :

| Élément | Adresse | Nature |
|---|---|---|
| `subnet-private-staging` | `10.0.2.0/24` | **plage** — sous-réseau du VPC `menal-vpc-staging` |
| `menal-vpc-connector-stg` | `10.0.3.0/28` | **plage** — connecteur VPC des services Cloud Run |
| `google-services-staging` | `10.247.0.0/16` | **plage** réservée au *Private Service Access* (VPC peering) |
| `menal-db-staging` | **`10.247.0.3`** | **une adresse d'hôte** — l'instance, allouée dans le `/16` ci-dessus |

> **À corriger sur le diagramme d'architecture avant de le projeter.** Il annonce l'instance en
> `10.20.0.0/24`. Deux erreurs en une : `10.247.0.3` est une **adresse d'hôte**, pas une plage ; et
> `10.20.0.0/24` ne correspond à **aucune** plage réelle du projet — ni au sous-réseau
> (`10.0.2.0/24`), ni au connecteur (`10.0.3.0/28`), ni à la plage PSA (`10.247.0.0/16`).
> Vérification : §8.2.

### 2.1 Les trois couches

| Couche | Ce qu'elle empêche | Où c'est défini |
|---|---|---|
| **Secret** | `sa-elson` ne peut pas lire le mot de passe de `api_user`, et réciproquement | bindings Secret Manager, 1 lecteur par secret |
| **Rôle PostgreSQL** | `elson_user` n'a pas `CONNECT` sur `menal_db` ; `api_user` n'a pas `CONNECT` sur `elson_db` | `REVOKE` appliqué par `sql-isolation-harden.ts` |
| **Privilège** | ni l'un ni l'autre n'est membre de `cloudsqlsuperuser` — donc aucun ne peut se redonner le droit | idem |

La troisième couche est celle qu'on oublie : sans elle, un compte privé de `CONNECT` pourrait
simplement se le réattribuer.

### 2.2 La preuve, rejouée toutes les 24 h

L'isolation est appliquée **au runtime**, hors Terraform. Un `terraform plan` propre ne prouve donc
rien à son sujet — une restauration PITR postérieure au durcissement la ferait disparaître sans
aucune alerte. D'où un contrôle automatique dédié :

- Job Cloud Run `elson-sql-isolation-check-staging`
- Déclenché par Cloud Scheduler, **tous les jours à 04:00 UTC**
- Strictement en **lecture seule** — aucun `GRANT`/`REVOKE`
- Sort en `exit 1` si l'isolation a dérivé, ce qui déclenche l'alerte « exécution échouée »

Sortie réelle de l'exécution du **08/09/2026 à 04:00 UTC** (`isolated=True`, 6 contrôles verts) :

```
message = SQL_ISOLATION_CHECK        isolated = True

api_user_not_cloudsqlsuperuser              ok   pg_has_role(api_user, cloudsqlsuperuser)   = false
elson_user_not_cloudsqlsuperuser            ok   pg_has_role(elson_user, cloudsqlsuperuser) = false
cross_connect_rejected_elson_user_menal_db  ok   has_database_privilege(elson_user, menal_db, CONNECT) = false
cross_connect_rejected_api_user_elson_db    ok   has_database_privilege(api_user, elson_db, CONNECT) = false
self_connect_preserved                      ok   has_database_privilege(elson_user, elson_db, CONNECT) = true
cross_connect_probe_rejected                ok   tentative de connexion reelle elson_user -> menal_db rejetee
```

Deux qualités de ce contrôle méritent d'être soulignées en soutenance :

1. **Le 6ᵉ contrôle est comportemental, pas déclaratif.** Les cinq premiers interrogent le
   catalogue PostgreSQL. Le sixième **ouvre réellement une connexion** `elson_user → menal_db` et
   vérifie qu'elle est refusée. Une politique peut mentir ; une connexion refusée, non.
2. **Le 5ᵉ contrôle est un contre-test.** Sans lui, on pourrait « réussir » l'isolation en cassant
   la base : `self_connect_preserved` vérifie que l'application, elle, se connecte toujours.

`exit(0)` et `succeeded_count = 1` sur les exécutions du 07/09 et du 08/09 : la preuve n'est pas
un instantané, c'est une série.

---

### 2.3 Ce que chaque base héberge réellement

Relevé du 08/09/2026 par [`scripts/preuve-contenu-bases.sh`](scripts/preuve-contenu-bases.sh) —
pièces brutes dans [`preuves/bases-2026-09-08/`](preuves/bases-2026-09-08/).

| | `elson_db` | `menal_db` |
|---|---|---|
| Tables | **62** | **5** |
| Métier hébergé | contributions linguistiques, audio, profils | comptes du dashboard, journal d'audit |
| Table la plus fournie | `schema_migrations` — **76** | `audit_logs` — **9 248** (2 160 ko) |
| Autres volumes | `profiles` 1 · `users` 1 | `roles` 3 · `users` 2 · `api_keys` 0 |
| Stockage objet associé | `…-elson-media` — **0 objet** | — |

**Le contraste des colonnes est la preuve la plus directe** que ces deux bases n'hébergent pas la
même chose, et qu'elles n'ont donc aucune raison de communiquer :

```
elson_db.users   (17 colonnes)  id, email, password_hash, username, first_name, last_name,
                                phone, birthdate, role, is_active, created_at, updated_at,
                                nni, whatsapp, identity_verified, email_verified,
                                whatsapp_verified

menal_db.users   ( 9 colonnes)  id, email, hashed_password, is_active, role_id,
                                created_at, updated_at, mfa_secret, mfa_enabled
```

`elson_db` porte de l'**identité civile** — NNI, WhatsApp, date de naissance, vérification
d'identité : c'est une plateforme de contribution qui doit savoir qui contribue. `menal_db` n'en
porte aucune : ses comptes sont des **comptes d'exploitation**, avec un secret TOTP et un rôle.
Deux natures de données, deux bases, deux comptes de service, aucun chemin entre les deux.

Et la chaîne d'attaque est hébergée côté MENAL, dans `audit_logs` :

```
menal_db.audit_logs (8 colonnes)  id, user_id, action, resource, ip_address,
                                  user_agent, status_code, created_at
```

C'est cette table qui a enregistré les 9 248 actions du §4.1, dont les consultations d'incidents
sur des adresses d'attaquants précises.

### 2.4 La matrice d'isolation, en quatre lignes

Constatée depuis `elson_db`, sans jamais joindre la base d'en face — `has_database_privilege()`
est à l'échelle du cluster, une seule connexion suffit donc à établir les quatre verdicts :

```
elson_user  -> elson_db   peut se connecter   conforme
elson_user  -> menal_db   REFUSE              conforme
api_user    -> menal_db   peut se connecter   conforme
api_user    -> elson_db   REFUSE              conforme

api_user    membre de cloudsqlsuperuser   non
elson_user  membre de cloudsqlsuperuser   non
```

Les deux dernières lignes sont celles qu'on oublie : sans elles, un rôle privé de `CONNECT`
pourrait simplement se le réattribuer. **4 verdicts sur 4 conformes**, et aucun des deux rôles ne
peut se réarmer.

---

## 3. Où vit la donnée utilisateur — et où elle ne vit pas

C'est le point où la plupart des présentations se trompent. Réponse mesurée :

| Donnée | Emplacement réel | Accessible depuis BigQuery ? |
|---|---|---|
| Comptes MENAL (`users`, `roles`, secret TOTP) | `menal_db`, IP privée | **non** |
| Journal d'activité MENAL (`audit_logs` : `user_id`, `action`, `resource`, `ip`, `user_agent`) | `menal_db`, IP privée | **non** |
| Clés d'API (`api_keys`) | `menal_db`, IP privée | **non** |
| Comptes et contenus ELSON | `elson_db`, IP privée | **non** |
| Verdicts d'analyste (pseudonyme JWT `sub`) | `analyst_verdicts` | **oui** |
| Télémétrie de passage (chemin, code, IP, latence) | `access_logs`, `raw_logs` | oui |

### Le constat à connaître avant d'être interrogé dessus

La table `access_logs` **déclare** des colonnes `user_id` et `user_role`. Elles ne sont
**jamais renseignées** :

```
service                 lignes   dont user_id renseigne
menal-api-staging       57 604            0
cloud-run               12 958            0
elson-api-staging        7 978            0
elson-web-staging          684            0
                    ──────────   ──────────
                        79 210            0   (0,00 %)
```

Il faut le présenter pour ce que c'est, sans le maquiller : **on ne peut pas répondre « quel
utilisateur a fait quoi » depuis BigQuery.** Cette question se répond dans `menal_db.audit_logs`.

Deux lectures possibles, et il vaut mieux assumer la première :

- **Défaut de mise en œuvre** — le schéma prévoit la corrélation, la normalisation F4 ne la
  remplit pas. Elle exigerait de propager l'identité du JWT dans le journal applicatif.
- **Choix défendable de minimisation** — le SIEM n'a pas besoin de l'identité nominative pour
  détecter un balayage ; il travaille sur l'entité `source_ip`. Le seul identifiant d'utilisateur
  présent dans le dataset est le `sub` JWT des verdicts, qui est un **pseudonyme**, pas un e-mail.

Le seul identifiant utilisateur du dataset, en clair — un UUID opaque, aucune donnée nominative :

```
ts                 entity           verdict          analyste     commentaire
2026-09-07 16:33   41.188.115.52    CONFIRMED        c9fab758...  vrai attaque
2026-09-07 15:05   41.188.115.52    CONFIRMED        c9fab758...  xfvg
2026-09-07 15:05   41.188.115.52    FALSE_POSITIVE   c9fab758...
```

---

## 4. Récupérer la donnée utilisateur — la bonne pratique

Les deux bases sont en **IP privée** : aucun poste de travail ne peut s'y connecter. C'est
volontaire, et c'est la contrainte à ne pas contourner.

> **Le réflexe à ne jamais avoir : ajouter une IP publique à l'instance « juste pour vérifier ».**
> Cela expose une copie complète des données personnelles à Internet, en général au pire moment.

La procédure validée (runbook §3) passe par l'**API d'administration**, qui ne demande aucune
connectivité réseau vers la base :

```bash
PROJET=menal-zero-trust-staging
BUCKET=menal-export-$(date -u +%s)

gcloud storage buckets create gs://$BUCKET --project=$PROJET \
  --location=europe-west1 --uniform-bucket-level-access

SA=$(gcloud sql instances describe menal-db-staging --project=$PROJET \
       --format="value(serviceAccountEmailAddress)")
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"

# Exporter UNE table, pas la base entière — principe de minimisation
gcloud sql export sql menal-db-staging gs://$BUCKET/audit_logs.sql \
  --database=menal_db --table=audit_logs --project=$PROJET

gcloud storage cp gs://$BUCKET/audit_logs.sql .
```

Ce qui rend cette procédure défendable, et qu'il faut dire en la montrant :

1. **L'instance n'est jamais exposée** — l'export est piloté par le plan de contrôle Google.
2. **Une table, pas la base** — `--table=audit_logs` plutôt qu'un export complet.
3. **Le bucket est jetable et daté**, et n'est lisible que par le compte de service de l'instance.
4. **L'export laisse une trace** dans les journaux d'audit `cloudaudit_googleapis_com_activity` :
   l'opération de récupération est elle-même auditée. Il faut le montrer — c'est ce qui distingue
   une extraction maîtrisée d'une exfiltration.
5. **Nettoyer après** : `gcloud storage rm -r gs://$BUCKET`.

> À faire une fois l'export récupéré : ne pas laisser le `.sql` dans le dépôt. Il contient des
> données personnelles réelles et n'a rien à faire sous suivi de version.

---

### 4.1 Ce que l'extraction a réellement donné — 08/09/2026

La procédure ci-dessus **a été exécutée**, avec des requêtes d'agrégat plutôt qu'un dump : aucun
e-mail, aucun nom, aucun hash n'est sorti de la base. Le bucket temporaire a été supprimé après
lecture — le projet est revenu à ses 3 buckets d'origine.

Les sorties brutes sont conservées comme pièces justificatives dans
[`preuves/exports-sql-2026-09-08/`](preuves/exports-sql-2026-09-08/) : chaque chiffre ci-dessous
s'y recoupe ligne à ligne.

**MENAL Sentinel — la plateforme est utilisée, et c'est mesurable :**

| Indicateur | Valeur |
|---|---|
| Comptes | **2** (2 actifs) |
| Comptes avec MFA activée | **1** sur 2 |
| Rôles définis | 3 |
| Clés d'API | 0 |
| Entrées du journal d'audit | **9 248** |
| Première entrée | 31/07/2026 03:13 UTC |
| Dernière entrée | **08/09/2026 20:02 UTC** (le jour même du relevé) |

Le détail des actions montre un usage **humain et investigatif**, pas du sondage automatique :

| Action | Ressource | Appels | Comptes | Jours distincts |
|---|---|---|---|---|
| `GET` | `/siem/incidents` | 1 046 | 1 | 13 |
| `GET` | `/siem/detections` | 955 | 1 | 14 |
| `GET` | `/siem/overview` | 689 | 1 | 17 |
| `GET` | `/logs/` | 672 | 1 | 17 |
| `GET` | `/alerts/` | 652 | 1 | 17 |
| `POST` | `/auth/token` | 132 | — | 8 |
| `GET` | **`/siem/incidents/41.188.116.214`** | 92 | 1 | 1 |
| `GET` | **`/siem/incidents/41.188.115.52`** | 42 | 1 | 1 |
| `GET` | **`/siem/incidents/41.188.115.124`** | 32 | 1 | 1 |
| `GET` | `/users/` | 31 | 1 | 6 |

**Les trois lignes en gras sont la preuve la plus solide du dossier.** Ce sont des consultations
d'incidents sur **une adresse IP précise** — personne n'automatise cela. Un analyste a ouvert la
fiche d'un attaquant, l'a examinée, et `41.188.115.52` est exactement l'entité qui porte le verdict
`CONFIRMED` du §6.1. La boucle complète est donc tracée : le WAF bloque → la règle détecte → le
modèle propose → **l'humain enquête** → l'humain tranche. Chaque étape a laissé une trace
indépendante, dans un système différent.

> À noter au passage : `GET /fetch` (188 appels) et `GET /proxy` (70 appels), tous deux sans compte
> authentifié et concentrés sur 3 jours, ne sont pas des fonctionnalités de MENAL — ce sont des
> tentatives de SSRF sur des chemins que les scanners essaient systématiquement. Le journal d'audit
> les a enregistrées.

**ELSON — un cycle de vie utilisateur réel, sans contributions :**

Le premier relevé concluait « base vide ». C'était faux, et l'erreur mérite d'être connue :
l'inventaire s'appuyait sur `reltuples`, qui vaut **`-1` tant qu'une table n'a jamais été
analysée** — ce qui ne veut pas dire vide. Un `COUNT(*)` exhaustif (§8.2) donne le vrai compte :
**9 tables peuplées sur 62**, pas 3.

| Table | Lignes | Ce que ça raconte |
|---|---|---|
| `schema_migrations` | **76** | 76 migrations appliquées — schéma versionné, pas bricolé |
| `competition_config` | 29 | le module concours est configuré |
| `tags` | 14 | taxonomie chargée : 5 `context`, 5 `region`, 4 `register` |
| `audit_log` | 6 | **le parcours utilisateur, tracé** (ci-dessous) |
| `email_verifications` | 2 | deux codes de vérification émis |
| `user_events` | 2 | deux connexions |
| `users` · `profiles` · `otp_codes` | 1 chacune | un compte, son profil, son OTP d'inscription |

**Le journal d'ELSON raconte un parcours complet, daté :**

```
22/08/2026   register                   1    inscription
22/08/2026   otp_codes (purpose=register) 1  OTP emis pour cette inscription
23/08/2026   email_verifications        2    codes de verification e-mail
23/08/2026   login                      2    connexions
23/08/2026   register_collision         2    doublons d inscription detectes
08/09/2026   register_rejected_fraud    1    inscription automatisee REJETEE
```

Trois choses à en tirer, dans cet ordre :

1. **Le cycle de vie est complet** — inscription, OTP, vérification d'e-mail, connexions. La chaîne
   d'authentification a été exercée de bout en bout par un vrai utilisateur, et chaque étape a
   laissé une trace horodatée.
2. **`register_collision` × 2** : deux tentatives d'inscription en doublon ont été détectées et
   refusées. L'unicité (e-mail, NNI, WhatsApp) n'est pas qu'une contrainte déclarée, elle a
   effectivement bloqué quelque chose.
3. **`register_rejected_fraud` du 08/09/2026** est la trace d'une **campagne d'inscription
   automatisée bloquée** — voir §4.2.

Ce qui manque, et qu'il faut dire tel quel : **0 phrase, 0 contribution, 0 validation, et le
bucket audio à 0 objet.** La collecte linguistique n'a pas démarré.

> **Le cadrage à tenir.** Ne pas dire « ELSON est utilisé par des contributeurs » — c'est faux et
> vérifiable en une requête. Dire : « la plateforme est fonctionnelle et sa chaîne
> d'authentification est éprouvée — inscription, OTP, vérification, connexion, tout est tracé. La
> collecte de contenu n'a pas encore commencé. » Et sur le plan du sujet traité, ELSON prouve
> surtout un **accueil** : une application tierce intégrée au socle avec son identité `sa-elson`,
> ses 5 secrets cloisonnés et sa base isolée revérifiée chaque jour. La multi-tenance se démontre
> sans aucun volume de contenu.

**Et surtout, ne pas s'appuyer sur la télémétrie pour parler d'usage.** `elson-api-staging`
enregistre **exactement 288 requêtes par jour** plusieurs jours d'affilée : 24 × 60 ÷ 5, soit une
sonde de disponibilité toutes les 5 minutes. Le site lui-même reçoit 0 à 43 visites quotidiennes.
Citer « 7 978 requêtes ELSON » comme preuve d'usage se retourne immédiatement contre celui qui le
dit — la régularité parfaite saute aux yeux.

---

### 4.2 Une inscription automatisée, bloquée par trois couches — 08/09/2026

Une campagne d'inscription automatisée a été lancée contre `POST /api/auth/register` avec 25
personas synthétiques. **Aucun compte n'a été créé.** Trois contrôles indépendants l'ont arrêtée,
successivement :

| # | Couche | Verdict | Ce qui l'a déclenchée |
|---|---|---|---|
| 1 | Garde anti-CSRF (`server.ts:originEnforced`) | **403** `MISSING_REQUESTED_BY` | toute méthode non-GET exige un `Origin` allow-listé **et** `X-Requested-By: elson-web` |
| 2 | Validation métier | **400** | « Le NNI doit contenir exactement 10 chiffres » |
| 3 | Moteur anti-fraude (`utils/fraud.ts`) | **400**, rejet | score **0,80** ≥ seuil `0.8` |

Le détail du score, qui rend la décision explicable — c'est ce qu'on attend d'un contrôle
anti-abus :

| Signal | Poids |
|---|---|
| `ua_bot` — l'en-tête `User-Agent` contient `curl` | +0,50 |
| `ua_short` — moins de 30 caractères | +0,15 |
| `fingerprint_missing` — pas d'empreinte d'appareil | +0,15 |
| **Total** | **0,80** → `shouldReject` |

**La preuve est double, dans deux systèmes indépendants.** Côté base, `elson_db.audit_log` porte la
ligne `register_rejected_fraud` du 08/09/2026 (§4.1). Côté SIEM, les cinq tentatives sont dans
BigQuery, **remontées en moins d'une minute** :

```
21:31:46   POST /api/auth/register   403      garde anti-CSRF
21:31:56   POST /api/auth/register   403
21:32:14   POST /api/auth/register   403
21:33:06   POST /api/auth/register   400      validation NNI
21:33:41   POST /api/auth/register   400      anti-fraude, score 0,80
```

C'est un scénario d'attaque complet et honnête : l'attaque a réellement eu lieu, elle a réellement
échoué, et les deux chaînes — applicative et observation — l'ont enregistrée chacune de son côté.

> Ce que ce scénario dit aussi, et qu'il faut assumer : le moteur rejette sur des signaux de
> **client** (`User-Agent`, empreinte), pas sur l'identité du demandeur. Un client qui imite un
> navigateur passerait sous le seuil. C'est une défense en profondeur contre l'automatisation de
> masse, pas une preuve d'identité — et elle se combine avec la limitation de débit Cloud Armor
> (10 tentatives d'authentification par minute, bannissement 5 min).

Rejouer le scénario : [`scripts/injecter-jeu-test-elson.sh`](scripts/injecter-jeu-test-elson.sh)
en `DRY_RUN=0`, jeu produit par
[`scripts/generer-jeu-test-elson.py`](scripts/generer-jeu-test-elson.py) (tirage déterministe,
`--seed 42`).

---

## 5. Les tables BigQuery : inventaire et rôles

23 tables, en trois familles. Volumes relevés le 08/09/2026.

### 5.1 Les tables de la chaîne de détection

| Table | Lignes | Écrite par | Rôle |
|---|---|---|---|
| `raw_logs` | **228 654** | Log Router | trace brute, non transformée — partition 90 j |
| `access_logs` | **79 210** | `sa-pipeline` (F4) | requêtes normalisées — partition 90 j |
| `security_events` | **62 680** | `sa-pipeline` (F4) | verdicts WAF normalisés |
| `detections` | **117** | `sa-pipeline` (R1-R7) | alertes qualifiées, rattachées à ATT&CK |
| `alert_enrichment` | **117** | `sa-enrich-job` | top-3 ATT&CK par similarité vectorielle |
| `analyst_verdicts` | **23** | `sa-api` | annotation humaine (`CONFIRMED` / `FALSE_POSITIVE`) |
| `attack_embeddings` | **872** | opérateur (hors CI) | catalogue ATT&CK vectorisé, cible de `VECTOR_SEARCH` |
| `cve_findings` | **181** | `sa-cicd` (boucle F6) | rapports Trivy de la chaîne de livraison |
| `pending_embeddings` | — | `sa-pipeline` | file d'attente d'enrichissement |
| `api_metrics` | — | `sa-pipeline` | métriques agrégées par heure |

**Le rapport 228 654 → 117 est le chiffre à mettre en avant** : la chaîne réduit d'un facteur
**≈ 1 950** le volume que l'analyste doit regarder. C'est la valeur ajoutée d'un SIEM, mesurée.

### 5.2 Les tables de journal d'audit (alimentées par Google, non par MENAL)

`cloudaudit_googleapis_com_activity`, `..._data_access`, `..._system_event`,
`cloudsql_googleapis_com_postgres_log`, `run_googleapis_com_requests`, `..._stdout`, `..._stderr`,
`..._varlog_system`, `monitoring_googleapis_com_ViolationOpenEventv1`, `...AutoResolveEventv1`,
`requests`.

Ce sont elles qui rendent l'§4 vérifiable : toute action d'administration y est tracée, y compris
celles de l'administrateur.

### 5.3 Les tables d'archive — à expliquer si on les voit

| Table | Origine |
|---|---|
| `detections_archive_pre_20260824` | 646 lignes récupérées par *time travel* après un `DELETE` administrateur du 24/08/2026 |
| `detections_backup_tournage` | sauvegarde prise avant une séance de démonstration |

Ne pas les masquer : la première est la preuve que le *time travel* BigQuery a permis une
récupération réelle après une suppression accidentelle de preuves.

---

## 6. Un parcours complet, avec de vraies valeurs

### 6.1 Une alerte, de la requête au verdict

| Étape | Valeur réelle |
|---|---|
| Entité observée | `41.188.115.52` |
| Règle déclenchée | `R2` — *Pic WAF* |
| Sévérité | `MEDIUM` |
| ATT&CK par la règle | `T1498` (tactique `TA0040`) |
| ATT&CK proposé par le modèle | `T1204.003` — similarité **0,437** |
| Modèle | `attack-bert-onnx-fp32@v1.0` |
| Verdict humain | `CONFIRMED` par l'analyste `c9fab758...` |
| Horodatage | 07/09/2026 23:31 |

**La divergence entre `T1498` et `T1204.003` n'est pas un défaut à cacher** — c'est le sujet. La
règle raisonne sur un volume, le modèle sur la sémantique du texte, et la similarité de **0,437**
dit elle-même que la proposition est faible. C'est précisément pourquoi l'enrichissement ML est
écrit dans une table **séparée** (`alert_enrichment`) et ne réécrit jamais `detections` : le modèle
propose, il ne tranche pas. L'humain a tranché `CONFIRMED`, et son verdict est allé dans une
troisième table encore.

Trois tables, trois identités, trois niveaux de confiance — c'est la chaîne de données du Zero
Trust appliquée à la preuve elle-même.

> Détail de restitution : la jointure `detections × analyst_verdicts` se fait sur `entity`, pas sur
> l'identifiant de détection. Un verdict posé sur une IP s'applique donc à **toutes** ses
> détections, et une requête naïve duplique les lignes. À savoir avant de projeter un tableau.

### 6.2 Ce que les 3 règles ont réellement produit

| Règle | Nom | Sévérité | ATT&CK | Détections | Dernière |
|---|---|---|---|---|---|
| `R3` | Path traversal | HIGH | `T1190` | **50** | 08/09 11:06 |
| `R6` | Pattern injection détecté | CRITICAL | `T1190` | **47** | 08/09 03:26 |
| `R2` | Pic WAF | MEDIUM | `T1498` | **20** | 08/09 15:11 |

Sur les 7 règles déployées, **3 ont produit des détections**. Le dire franchement vaut mieux que
de laisser croire que les 7 tournent à plein : les 4 autres couvrent des scénarios qui ne se sont
pas produits sur cet environnement.

---

## 7. Ce que les chiffres disent vraiment — à lire avant de les citer

`security_events` contient **62 695** lignes (au moment du relevé — la table grossit en continu),
toutes `event_type = waf_block`, toutes `mitigated = true`.
**Ne pas annoncer « 62 695 attaques bloquées ».** Répartition mesurée :

| Origine | Cible | Lignes |
|---|---|---|
| Plages Google (`35.x`, `34.x`, …) | `/health`, `/api/health` | **37 448** |
| Plages Google | autres chemins | 9 274 |
| Autres IP | autres chemins | 14 473 |
| Autres IP | `/health` | 1 485 |

**≈ 74 % de ces événements sont les propres sondes de disponibilité de Google**, refusées par la
règle de géo-blocage (priorité 410) parce qu'elles arrivent des États-Unis. La règle exempte bien
`/health`, mais ELSON expose `/api/health` — chemin non couvert par l'exemption. Deux
conséquences : le compteur est gonflé, **et la surveillance de disponibilité d'ELSON est
elle-même bloquée**. C'est un vrai défaut d'exploitation, à corriger ou à assumer.

### Le chiffre défendable

Classement par **comportement** — un balayage se reconnaît au nombre de chemins distincts
visités — **et** par origine, car les deux corrections sont nécessaires :

| Profil | Sources | Événements |
|---|---|---|
| **Balayage externe (Internet)** — ≥ 50 chemins distincts | **24 IP** | **7 154** |
| Balayage depuis nos propres plages GCP (auto-tests) | 11 IP | 11 192 |
| Sonde répétitive (1 seul chemin) | 712 IP | 39 798 |
| Intermédiaire (2 à 49 chemins) | 411 IP | 4 551 |
| | | **62 695** |

> **Le piège dans lequel il ne faut pas tomber.** Un premier classement, par comportement seul,
> donnait « 18 346 balayages depuis 35 sources ». En regardant les IP une par une, trois d'entre
> elles présentaient la signature **exactement identique** — 1 848 requêtes, 1 203 chemins
> distincts — à trois dates différentes (`34.81.62.116`, `34.53.30.61`, `136.117.214.122`). Or
> `34.x` et `136.112.0.0/12` sont des plages **Google Cloud** : ce sont nos propres campagnes de
> test, rejouées depuis GCP, pas des attaquants. Les compter comme tels aurait gonflé le chiffre
> de 60 %.

**« Le WAF a bloqué 7 154 requêtes de balayage provenant de 24 sources externes »** — voilà la
phrase qui tient devant un jury. Les cas individuels, tous hors plages Google :

| Source | Requêtes | Chemins distincts | Fenêtre |
|---|---|---|---|
| `195.128.248.33` | 1 761 | 825 | du 01/08 au 26/08 — lent et persistant |
| `185.8.106.147` | 1 000 | 936 | 31/08, en 42 minutes |
| `94.154.46.246` | 719 | 433 | 01/09, en **une minute** |
| `103.168.67.253` | 534 | 426 | 28/08, en 3 minutes |
| `45.148.10.13` | 501 | 117 | 03/09, en 4 minutes |

433 chemins distincts en une minute, ce n'est pas un utilisateur : c'est un scanner
d'énumération, et il a été bloqué. Ces cinq-là viennent réellement d'Internet et n'ont pas été
fabriqués pour la démonstration — c'est vérifiable, leurs plages n'appartiennent pas au projet.

> Les 11 192 requêtes issues de nos propres tests ne sont pas à cacher : elles prouvent que la
> plateforme a été **testée offensivement**. Mais elles se citent séparément, comme campagne de
> test, jamais additionnées aux attaques subies.

---

## 8. Rejouer chaque preuve — les commandes

**8.1 — Isolation des bases (le contrôle et sa dernière sortie)**
```bash
gcloud run jobs executions list --project=menal-zero-trust-staging --region=europe-west1 \
  --job=elson-sql-isolation-check-staging --limit=5 \
  --format="table(metadata.name,status.conditions[0].type,status.succeededCount,metadata.creationTimestamp)"

gcloud logging read 'resource.labels.job_name="elson-sql-isolation-check-staging"' \
  --project=menal-zero-trust-staging --limit=6 --freshness=2d \
  --format="value(textPayload,jsonPayload)"
```

**8.2 — Une seule instance, une seule IP privée, et les plages du VPC**
```bash
# Une instance, trois bases : menal_db et elson_db partagent la meme adresse
gcloud sql instances list --project=menal-zero-trust-staging \
  --format="table(name,databaseVersion,ipAddresses[0].ipAddress:label=IP,ipAddresses[0].type:label=TYPE)"
gcloud sql databases list --instance=menal-db-staging --project=menal-zero-trust-staging \
  --format="table(name,charset)"

# Pas d'IPv4 publique, TCP en clair rejete
gcloud sql instances describe menal-db-staging --project=menal-zero-trust-staging \
  --format="value(settings.ipConfiguration.ipv4Enabled,settings.ipConfiguration.sslMode)"

# Les PLAGES, a distinguer de l'adresse d'hote de l'instance
gcloud compute networks subnets describe subnet-private-staging \
  --project=menal-zero-trust-staging --region=europe-west1 --format="value(name,ipCidrRange)"
gcloud compute networks vpc-access connectors list --project=menal-zero-trust-staging \
  --region=europe-west1 --format="table(name,ipCidrRange,state)"
gcloud compute addresses list --global --project=menal-zero-trust-staging \
  --format="table(name,address,prefixLength,purpose,status)"
```

**8.3 — Inventaire et volumes des tables**
```bash
bq ls --project_id=menal-zero-trust-staging --format=json menal_security_staging   # PAS --format=pretty (bug CLI)

bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=csv \
'SELECT "raw_logs" t, COUNT(*) n FROM `menal_security_staging.raw_logs`
 UNION ALL SELECT "access_logs", COUNT(*) FROM `menal_security_staging.access_logs`
 UNION ALL SELECT "security_events", COUNT(*) FROM `menal_security_staging.security_events`
 UNION ALL SELECT "detections", COUNT(*) FROM `menal_security_staging.detections`
 UNION ALL SELECT "alert_enrichment", COUNT(*) FROM `menal_security_staging.alert_enrichment`
 UNION ALL SELECT "analyst_verdicts", COUNT(*) FROM `menal_security_staging.analyst_verdicts`
 ORDER BY n DESC'
```

**8.4 — Le parcours complet d'une alerte**
```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=prettyjson \
'SELECT d.timestamp, d.rule_id, d.rule_name, d.severity, d.entity,
        d.mitre_tactic, d.mitre_technique,
        e.technique_id AS ml_technique, ROUND(e.similarity,3) AS ml_similarity, e.model_version,
        v.verdict, v.analyst_sub
 FROM `menal_security_staging.detections` d
 LEFT JOIN `menal_security_staging.alert_enrichment` e ON d.id = e.detection_id
 LEFT JOIN `menal_security_staging.analyst_verdicts`  v ON d.entity = v.entity
 WHERE v.verdict IS NOT NULL
 ORDER BY d.timestamp DESC LIMIT 1'
```

**8.5 — La composition réelle des événements WAF (le §7)**
```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=csv \
'WITH par_ip AS (
   SELECT source_ip, COUNT(*) n, COUNT(DISTINCT target_path) chemins,
          REGEXP_CONTAINS(source_ip,
            r"^(34|35|104\.19[6-9]|130\.211|108\.170|136\.11[2-9]|136\.12[0-7])\.") AS google
   FROM `menal_security_staging.security_events` GROUP BY 1)
 SELECT CASE WHEN chemins >= 50 AND NOT google THEN "1. balayage EXTERNE (Internet)"
             WHEN chemins >= 50 AND google     THEN "2. balayage depuis nos plages GCP (auto-tests)"
             WHEN chemins  = 1                 THEN "3. sonde repetitive (1 seul chemin)"
             ELSE "4. intermediaire (2-49 chemins)" END profil,
        COUNT(*) sources, SUM(n) evenements
 FROM par_ip GROUP BY 1 ORDER BY profil'
```

**8.7 — Les balayages réellement externes (le chiffre à citer)**
```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=csv \
'SELECT source_ip, COUNT(*) requetes, COUNT(DISTINCT target_path) chemins,
        FORMAT_TIMESTAMP("%m-%d %H:%M", MIN(timestamp)) premier,
        FORMAT_TIMESTAMP("%m-%d %H:%M", MAX(timestamp)) dernier
 FROM `menal_security_staging.security_events`
 WHERE NOT REGEXP_CONTAINS(source_ip,
         r"^(34|35|104\.19[6-9]|130\.211|108\.170|136\.11[2-9]|136\.12[0-7])\.")
 GROUP BY 1 HAVING chemins >= 50 ORDER BY requetes DESC LIMIT 8'
```

**8.6 — Vérifier que `user_id` est vide (le constat du §3)**
```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=csv \
'SELECT service, COUNT(*) n, COUNTIF(user_id IS NOT NULL) avec_user
 FROM `menal_security_staging.access_logs` GROUP BY service ORDER BY n DESC'
```
