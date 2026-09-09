# Guide de capture de preuves — les 6 chaînes

**Quoi capturer, dans quel ordre, et quelle phrase dire dessus.**
Ce guide ne réexplique pas l'architecture : il organise la **prise de preuve**. Chaque plan tient
en une commande, produit une sortie lisible à l'écran, et prouve exactement une chose.

| | |
|---|---|
| Script compagnon | [`scripts/preuves-chaines.sh`](scripts/preuves-chaines.sh) — joue les plans P1 à P12 avec une pause avant chacun · Terraform : `scripts/preuve-terraform.sh` |
| Déjà couvert ailleurs | l'attaque live : [`scripts/demo-tournage.sh`](scripts/demo-tournage.sh) (plans 7 et 8) |
| Durée | ≈ 30 min de captures pour les 6 segments |
| Date de validation | 08/09/2026 — toutes les commandes de ce guide ont été exécutées, sorties vérifiées |

---

## 0. Le découpage en 6 segments

Chaque segment est autonome : on peut le capturer, le monter et le présenter seul.

| # | Segment | Ce qu'il prouve | Fiche de preuves | État |
|---|---|---|---|---|
| **S1** | Chaîne de livraison | le code ne va en production qu'en passant 4 portes | [`PREUVES_CHAINE_APP_DELIVERY.md`](PREUVES_CHAINE_APP_DELIVERY.md) | **fait** |
| **S2** | Chaîne IAM | aucune clé, un seul saut d'identité, secrets cloisonnés | [`PREUVES_CHAINE_IAM.md`](PREUVES_CHAINE_IAM.md) | à capturer |
| **S3** | Isolation des bases | `menal_db` et `elson_db` ne se parlent pas, et c'est revérifié chaque jour | [`PREUVES_CHAINE_DONNEES.md`](PREUVES_CHAINE_DONNEES.md) §2 | à capturer |
| **S4** | Données et BigQuery | 228 654 lignes brutes → 117 alertes → 23 verdicts, et 9 248 actions auditées | [`PREUVES_CHAINE_DONNEES.md`](PREUVES_CHAINE_DONNEES.md) §4.1, §5-§7 | à capturer |
| **S5** | Attaque live | le WAF bloque en vrai, la détection remonte au dashboard | `scripts/demo-tournage.sh` | script existant |
| **S6** | Infrastructure as Code | 173 ressources déclarées, état protégé — et 3 obstacles à la reproductibilité | [`PREUVES_CHAINE_TERRAFORM.md`](PREUVES_CHAINE_TERRAFORM.md) | à capturer |

---

## 1. Avant de filmer — 10 minutes de préparation

**1.1 Vérifier le compte et le projet.** Un seul compte voit ces ressources :

```bash
gcloud config set account mansour.cheikh2010@gmail.com
gcloud config set project menal-zero-trust-staging
gcloud config list
```

**1.2 Régler le terminal.** Fond sombre, police ≥ 16 px, fenêtre en 100 à 110 colonnes. Au-delà,
les tableaux `gcloud` se replient et deviennent illisibles à l'écran.

**1.3 Corriger les deux écarts connus avant de capturer** — sinon une preuve contredit une autre :

| Écart | Où | Décision |
|---|---|---|
| `sa-cicd` a `WRITER` sur tout le dataset (binding orphelin) | [`PREUVES_CHAINE_IAM.md`](PREUVES_CHAINE_IAM.md) §6 | corriger, **ou** l'assumer explicitement à l'oral |
| Le diagramme annonce l'instance SQL en `10.20.0.0/24` ; elle est en `10.247.0.3` | [`PREUVES_CHAINE_DONNEES.md`](PREUVES_CHAINE_DONNEES.md) §2 | corriger le diagramme |

**1.4 Restaurer la fiche du segment S1** si elle manque dans l'arbre de travail :

```bash
git restore PREUVES_CHAINE_APP_DELIVERY.md
```

---

## 2. Ce qu'il ne faut jamais capturer

| Interdit à l'écran | Pourquoi | À faire à la place |
|---|---|---|
| `gcloud auth print-access-token` | affiche un jeton réutilisable pendant 1 h | ne jamais l'exécuter en captation |
| `gcloud secrets versions access` | affiche la valeur d'un secret en clair | montrer **qui peut le lire** (plan P4), jamais son contenu |
| Un export `.sql` ouvert | contient des données personnelles réelles | montrer les métadonnées de l'export |
| Le fichier `credentials.txt` du dépôt | — | — |

> Le principe : on prouve un **droit d'accès**, jamais la **valeur** protégée par ce droit. Montrer
> qu'un secret est lisible par un seul compte est une preuve ; montrer le secret en détruit une.

---

## 3. Segment S2 — chaîne IAM (5 plans, ≈ 8 min)

### P1 — Les identités sont nommées, aucune n'est par défaut
```bash
gcloud iam service-accounts list --project=menal-zero-trust-staging --format="value(email)"
```
**On voit** : 7 comptes `sa-*`, un par maillon du diagramme.
**Phrase** : « Chaque composant a sa propre identité. Aucun ne tourne sous le compte par défaut du
projet. »

### P2 — Aucune clé n'existe : il n'y a rien à voler
```bash
for sa in sa-api sa-cicd sa-pipeline sa-enrich-job sa-elson sa-dashboard-staging; do
  echo -n "$sa: "
  gcloud iam service-accounts keys list --managed-by=user --project=menal-zero-trust-staging \
    --iam-account=$sa@menal-zero-trust-staging.iam.gserviceaccount.com --format="value(name)" | wc -l
done
```
**On voit** : `0` sur les six lignes.
**Phrase** : « Le risque classique d'une chaîne CI/CD, c'est le fichier de clé qui ne périme jamais.
Ici il n'y en a aucun : uniquement des jetons OIDC de courte durée. »
**C'est le plan le plus fort du segment — le garder plein écran.**

### P3 — Le jeton n'est accepté que pour un dépôt et une branche
```bash
gcloud iam workload-identity-pools providers describe menal-github-provider \
  --project=menal-zero-trust-staging --location=global \
  --workload-identity-pool=menal-github-pool --format="value(attributeCondition)"
```
**On voit** : `assertion.repository == 'Mansour37/menal-zero-trust' && assertion.ref == 'refs/heads/main'`
**Phrase** : « Deux verrous, et ils sont portés par Google, pas par GitHub. Une branche de
fonctionnalité n'obtient jamais l'identité de déploiement — même en modifiant le workflow. »

### P4 — Neuf secrets, un seul lecteur chacun
```bash
for s in $(gcloud secrets list --project=menal-zero-trust-staging --format="value(name)" | tr -d '\r'); do
  printf "%-32s :: " "$s"
  gcloud secrets get-iam-policy "$s" --project=menal-zero-trust-staging --format=json \
    | grep -o 'serviceAccount:sa-[a-z-]*' | sort -u | tr '\n' ' '
  echo
done
```
**On voit** : une colonne de droite où chaque secret n'a qu'un seul compte.
**Phrase** : « `sa-elson` ne peut lire aucun secret MENAL, `sa-api` aucun secret ELSON. Et la
chaîne de livraison, qui déploie les deux, n'en lit aucun. »

### P5 — L'encodeur ML est hors d'atteinte d'Internet
```bash
for s in menal-api-staging menal-dashboard-staging elson-api-staging elson-web-staging menal-ml-embed-staging; do
  printf "%-26s ingress=" "$s"
  gcloud run services describe "$s" --project=menal-zero-trust-staging --region=europe-west1 \
    --format="value(metadata.annotations['run.googleapis.com/ingress'])" | tr -d '\r'
  echo
done
```
**On voit** : 4 services en `internal-and-cloud-load-balancing`, l'encodeur en `internal`.
**Phrase** : « Les URL `run.app` ne répondent pas depuis Internet. Le seul chemin d'entrée est le
répartiteur, donc le WAF. Le WAF ne se contourne pas — il n'y a pas d'autre porte. »

> **Question probable du jury** : « `allUsers` a le rôle `run.invoker`, n'est-ce pas ouvert ? »
> Réponse préparée dans [`PREUVES_CHAINE_IAM.md`](PREUVES_CHAINE_IAM.md) §5 : `allUsers` lève
> l'authentification *IAM* (un visiteur anonyme n'a pas de compte Google) ; `ingress` décide **par
> où** la requête arrive. Le contrôle n'est pas supprimé, il est déplacé au WAF puis au JWT.

---

## 4. Segment S3 — isolation des bases (3 plans, ≈ 5 min)

### P6 — Une seule instance, sans adresse publique
```bash
gcloud sql instances describe menal-db-staging --project=menal-zero-trust-staging \
  --format="value(databaseVersion,settings.ipConfiguration.ipv4Enabled,settings.ipConfiguration.sslMode,ipAddresses[0].ipAddress,ipAddresses[0].type)"

gcloud sql databases list --instance=menal-db-staging --project=menal-zero-trust-staging \
  --format="table(name,charset)"
```
**On voit** : `POSTGRES_15  False  ENCRYPTED_ONLY  10.247.0.3  PRIVATE`, puis les trois bases
`postgres`, `menal_db`, `elson_db`.
**Phrase** : « Pas d'IPv4 publique, adresse privée, TCP en clair rejeté. Et il faut le dire
clairement : **c'est une seule instance**. `menal_db` et `elson_db` partagent la même adresse et le
même port — le réseau ne cloisonne donc rien ici. Tout le cloisonnement tient à la couche des rôles
PostgreSQL, et c'est exactement pour ça qu'il est revérifié toutes les 24 heures. »

> **Piège d'adressage à ne pas subir** : `10.247.0.3` est une **adresse d'hôte**, pas une plage.
> Les plages du projet sont `10.0.2.0/24` (sous-réseau), `10.0.3.0/28` (connecteur Cloud Run) et
> `10.247.0.0/16` (Private Service Access, d'où vient l'adresse de l'instance). Le `10.20.0.0/24`
> du diagramme ne correspond à aucune des trois.

### P7 — Le contrôle d'isolation tourne tous les jours
```bash
gcloud run jobs executions list --project=menal-zero-trust-staging --region=europe-west1 \
  --job=elson-sql-isolation-check-staging --limit=5 \
  --format="table(metadata.name,status.conditions[0].type,status.succeededCount,metadata.creationTimestamp)"
```
**On voit** : des exécutions `Completed`, une par jour à 04:00 UTC.
**Phrase** : « L'isolation est appliquée au runtime, donc hors Terraform. Un `terraform plan`
propre ne prouve rien à son sujet. C'est pour ça qu'elle est revérifiée toutes les 24 heures. »

### P8 — Les six contrôles, dont un test réel de connexion
```bash
gcloud logging read 'resource.labels.job_name="elson-sql-isolation-check-staging"' \
  --project=menal-zero-trust-staging --limit=6 --freshness=2d \
  --format="value(textPayload,jsonPayload)"
```
**On voit** : `isolated=True` et les six contrôles à `ok: True`.
**Phrase, sur la dernière ligne** : « Les cinq premiers contrôles interrogent le catalogue
PostgreSQL. Le sixième **ouvre vraiment** une connexion `elson_user → menal_db` et vérifie qu'elle
est refusée. Une politique peut mentir ; une connexion refusée, non. »
**Plan clé du segment.**

---

### P8bis — Ce que chaque base héberge, et la matrice d'isolation

Une seule commande produit toutes les pièces et les affiche :

```bash
bash scripts/preuve-contenu-bases.sh
```

**On voit** deux tableaux contrastés, puis la matrice :

```
elson_db          62 tables    schema_migrations 76 · profiles 1 · users 1
menal_db           5 tables    audit_logs 9 248 · roles 3 · users 2

elson_user -> elson_db   peut se connecter   conforme
elson_user -> menal_db   REFUSE              conforme
api_user   -> menal_db   peut se connecter   conforme
api_user   -> elson_db   REFUSE              conforme
api_user   / elson_user  membre de cloudsqlsuperuser : non
```

**Phrase** : « Deux bases sur la même instance, et elles n'hébergent pas la même chose. ELSON porte
de l'identité civile — NNI, WhatsApp, date de naissance. MENAL n'en porte aucune : des comptes
d'exploitation avec un secret TOTP, et le journal d'audit où vit la chaîne d'attaque. Quatre
verdicts sur quatre conformes, et aucun des deux rôles ne peut se réarmer en `cloudsqlsuperuser`. »

> Le contraste des colonnes vaut mieux qu'un long discours sur le cloisonnement — projeter les deux
> définitions de `users` côte à côte ([`PREUVES_CHAINE_DONNEES.md`](PREUVES_CHAINE_DONNEES.md) §2.3).
> Le script laisse ses pièces dans `preuves/bases-AAAA-MM-JJ/` : ce sont des métadonnées et des
> agrégats, aucune donnée personnelle, donc montrables et versionnables telles quelles.

---

## 5. Segment S4 — données et BigQuery (4 plans, ≈ 7 min)

### P9 — L'entonnoir : 228 654 lignes brutes → 117 alertes
```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=csv \
'SELECT "raw_logs" t, COUNT(*) n FROM `menal_security_staging.raw_logs`
 UNION ALL SELECT "access_logs", COUNT(*) FROM `menal_security_staging.access_logs`
 UNION ALL SELECT "security_events", COUNT(*) FROM `menal_security_staging.security_events`
 UNION ALL SELECT "detections", COUNT(*) FROM `menal_security_staging.detections`
 UNION ALL SELECT "alert_enrichment", COUNT(*) FROM `menal_security_staging.alert_enrichment`
 UNION ALL SELECT "analyst_verdicts", COUNT(*) FROM `menal_security_staging.analyst_verdicts`
 ORDER BY n DESC'
```
**Phrase** : « Un facteur de réduction de 1 950 entre la trace brute et ce qu'un analyste doit
regarder. C'est la valeur d'un SIEM, et elle se mesure. »

### P10 — Le vrai chiffre du WAF, pas le chiffre gonflé
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
**Phrase** : « La table contient 62 695 blocages. Les deux tiers sont les sondes de disponibilité
de Google refusées par le géo-blocage, et 11 192 viennent de nos propres campagnes de test lancées
depuis GCP. Le chiffre que je défends est celui-ci : **7 154 requêtes de balayage, 24 sources
externes.** »
**C'est le plan qui distingue une démonstration honnête d'une démonstration gonflée. Ne pas le
sauter — c'est lui qui rend tous les autres chiffres crédibles.**

### P11 — Une attaque réelle, dans le détail
```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=csv \
'SELECT source_ip, COUNT(*) requetes, COUNT(DISTINCT target_path) chemins,
        FORMAT_TIMESTAMP("%m-%d %H:%M", MIN(timestamp)) premier,
        FORMAT_TIMESTAMP("%m-%d %H:%M", MAX(timestamp)) dernier
 FROM `menal_security_staging.security_events`
 WHERE NOT REGEXP_CONTAINS(source_ip,
         r"^(34|35|104\.19[6-9]|130\.211|108\.170|136\.11[2-9]|136\.12[0-7])\.")
 GROUP BY 1 HAVING chemins >= 50 ORDER BY requetes DESC LIMIT 5'
```
**Phrase** : « 433 chemins distincts en une minute depuis une seule adresse. Ce n'est pas un
utilisateur, c'est un scanner d'énumération. Cette adresse n'appartient pas au projet : elle vient
réellement d'Internet, et elle a été bloquée. »

> **Le filtre `NOT REGEXP_CONTAINS` n'est pas cosmétique.** Sans lui, les trois premières lignes
> sont `34.81.62.116`, `34.53.30.61` et `136.117.214.122` — toutes en plage Google Cloud, avec la
> signature **exactement identique** de 1 848 requêtes / 1 203 chemins. Ce sont nos propres tests
> rejoués depuis GCP. Les présenter comme des attaques subies serait faux, et la répétition à
> l'identique du chiffre se repère au premier coup d'œil.

### P12 — Le parcours complet d'une alerte : règle, modèle, humain
```bash
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=prettyjson \
'SELECT d.timestamp, d.rule_id, d.rule_name, d.severity, d.entity,
        d.mitre_technique, e.technique_id AS ml_technique,
        ROUND(e.similarity,3) AS ml_similarity, e.model_version, v.verdict
 FROM `menal_security_staging.detections` d
 LEFT JOIN `menal_security_staging.alert_enrichment` e ON d.id = e.detection_id
 LEFT JOIN `menal_security_staging.analyst_verdicts`  v ON d.entity = v.entity
 WHERE v.verdict IS NOT NULL ORDER BY d.timestamp DESC LIMIT 1'
```
**On voit** : `R2` / `T1498` par la règle, `T1204.003` à 0,437 par le modèle, `CONFIRMED` par
l'humain.
**Phrase** : « La règle dit `T1498`, le modèle propose `T1204.003` avec une similarité de 0,437 —
donc faible. Elles divergent, et c'est exactement pour ça que le modèle écrit dans une table
séparée : il propose, il ne tranche pas. Trois tables, trois identités, trois niveaux de
confiance. »

> **Le piège à connaître** : la jointure se fait sur `entity`, pas sur l'identifiant de détection.
> Un verdict posé sur une IP s'applique à toutes ses détections, donc une requête sans `LIMIT`
> affiche des lignes en double. Utiliser le `LIMIT 1` ci-dessus en captation.

---

### P13 — La preuve que la plateforme est réellement utilisée

Celle-ci ne se capture pas en direct : elle vient d'une extraction faite le 08/09/2026, dont les
chiffres sont dans [`PREUVES_CHAINE_DONNEES.md`](PREUVES_CHAINE_DONNEES.md) §4.1. Projeter le
tableau du journal d'audit, et s'arrêter sur ces trois lignes :

```
GET  /siem/incidents/41.188.116.214    92 appels   1 compte   1 jour
GET  /siem/incidents/41.188.115.52     42 appels   1 compte   1 jour
GET  /siem/incidents/41.188.115.124    32 appels   1 compte   1 jour
```

**Phrase** : « 9 248 actions auditées entre le 31 juillet et aujourd'hui, sur 17 journées
distinctes. Et surtout ces trois lignes : ce sont des consultations d'incidents sur **une adresse
précise**. Personne n'automatise ça. Un analyste a ouvert la fiche d'un attaquant — et
`41.188.115.52`, c'est exactement l'entité qui porte le verdict `CONFIRMED` du plan P12. La boucle
est fermée : le WAF bloque, la règle détecte, le modèle propose, l'humain enquête, l'humain
tranche. »

> **La question qui viendra : « et ELSON, il est utilisé ? »** Répondre franchement : 1 compte,
> 0 phrase, 0 contribution. Puis recadrer : ELSON ne prouve pas un usage, il prouve un **accueil**
> — une application tierce intégrée au socle avec son identité, ses 5 secrets cloisonnés et sa base
> isolée revérifiée chaque jour. La multi-tenance se démontre sans aucune donnée métier.
> Ne **jamais** citer « 7 978 requêtes ELSON » comme preuve d'usage : c'est 288/jour très
> exactement, soit une sonde toutes les 5 minutes, et ça se voit au premier regard.

---

## 5bis. Segment S6 — Infrastructure as Code (2 plans, ≈ 4 min)

### P14 — L'infrastructure est déclarée, et l'état est protégé
```bash
bash scripts/preuve-terraform.sh
```
**On voit** : 53 fichiers `.tf`, 16 modules, 5 717 lignes ; **173 ressources**, 222 instances,
56 types, 19 modules ; puis le bucket d'état en UBLA, accès public `enforced`, versioning et
suppression différée 7 jours.

**Phrase** : « 173 ressources déclarées, dont **79 — 46 % — portent sur l'IAM, les secrets et le
chiffrement**. Près d'une ressource sur deux existe pour décider qui a le droit de faire quoi. Ce
n'est pas cliqué dans une console : c'est versionné et diffable. Et l'état, qui contient les mots
de passe générés, est dans un bucket sans accès public, versionné, avec 7 jours de suppression
différée. »

> Le script télécharge l'état, en extrait les compteurs, **puis le supprime** — il contient des
> secrets en clair. À dire en le montrant : c'est la même discipline que pour les exports SQL.

### P15 — Ce que `terraform plan` ne voit pas

C'est le plan qui distingue une soutenance solide d'une soutenance récitée.

```bash
AVEC_PLAN=1 bash scripts/preuve-terraform.sh
```
**On voit** : Terraform refuse d'abord (`Backend configuration block has changed`), puis le
provider plante (`strconv.ParseInt: parsing "1786143883702": value out of range`).

**Phrase** : « Trois obstacles, tous réels : le bloc `backend` du code désigne `menal-tf-state`
alors que l'état vit dans `menal-tf-state-staging` — ça ne marche que grâce au `.terraform/` local,
qui n'est pas versionné ; le binaire est en 32 bits et déborde sur un horodatage en millisecondes ;
et l'identité ADC n'est pas celle de gcloud. Tant que ces trois points tiennent, je ne peux pas
prétendre que l'infrastructure est reproductible depuis le dépôt. »

**Puis enchaîner sur le vrai enseignement** : « Et même si le plan tournait et affichait *aucun
changement*, ça ne prouverait pas l'absence de dérive. Les ressources `google_*_iam_member` sont
**non autoritatives** : Terraform ne signale jamais un binding qu'il ne connaît pas. C'est
exactement le cas de `sa-cicd`, qui a `WRITER` sur tout le dataset sans être ni dans le code ni
dans l'état. **Un audit IAM doit interroger le cloud, pas l'état Terraform.** »

> Ces trois écarts se corrigent en une demi-heure ([`PREUVES_CHAINE_TERRAFORM.md`](PREUVES_CHAINE_TERRAFORM.md) §6).
> Les corriger avant la soutenance est mieux ; les présenter comme des constats d'audit assumés
> reste défendable. Les ignorer ne l'est pas — un jury peut demander un `plan` en direct.

---

## 6. Segment S5 — l'attaque live

Déjà outillé, ne pas réécrire :

```bash
bash scripts/demo-reset.sh      # dashboard vierge (sauvegarde automatique)
bash scripts/demo-tournage.sh   # plans 7 et 8, avec pause avant chaque plan
bash scripts/demo-live.sh       # variante orchestrée, dashboard prêt en ~3 min
```

À enchaîner **après** P12 : les segments S2 à S4 prouvent que l'architecture tient, S5 la montre
en train de fonctionner.

---

## 7. Ordre de montage conseillé

L'ordre de capture n'est pas l'ordre de récit. Monter dans cet ordre :

1. **S5 — l'attaque** (30 s) : accrocher avec le concret, avant toute explication.
2. **S2 — IAM** (P2, P3, P5) : « voici pourquoi cette attaque n'avait aucune autre porte ».
3. **S3 — isolation** (P6, P8) : « et même à l'intérieur, les compartiments tiennent ».
4. **S4 — données** (P9, P10, P12) : « voici ce que la plateforme en a fait ».
5. **S1 — livraison** : « et rien n'entre en production sans passer ces quatre portes ».

Placer **P10 avant P9** si le public est technique : annoncer soi-même la part de bruit avant de
donner les volumes désarme la question, au lieu de la subir.

---

## 8. Checklist finale

- [ ] Compte `mansour.cheikh2010@gmail.com`, projet `menal-zero-trust-staging`
- [ ] Binding orphelin `sa-cicd` : corrigé, ou assumé à l'oral
- [ ] Diagramme :`10.20.2.0/24`
- [ ] `PREUVES_CHAINE_APP_DELIVERY.md` restauré
- [ ] P1 → P12 capturés ; P13 projeté depuis la fiche §4.1 ; P14-P15 (Terraform) capturés
- [ ] Réponse préparée sur ELSON : « 0 contribution » assumé, recadré en preuve d'accueil
- [ ] Aucun jeton, aucune valeur de secret, aucun export `.sql` visible
- [ ] `demo-reset.sh` joué avant la prise de S5
- [ ] Les trois chiffres appris par cœur : **0 clé**, **7 154 balayages externes bloqués (24 sources)**, **228 654 → 117**
- [ ] Ne jamais additionner les 11 192 requêtes d'auto-test GCP aux attaques subies
