# Résultats de campagne — T12, T14, T15, T17, T19, T20

Relevés des six protocoles restés sans résultat, à intégrer au chapitre 6 et à l'annexe E.
Environnement : recette (`staging`), projet unique, opérateur unique.
Date de référence du mémoire : 25/08/2026. Tous les horodatages sont en UTC.

---

## Prémisse retenue et son effet sur les relevés

La refonte réseau est un état appliqué : sortie réseau directe, un sous-réseau par locataire
(`10.0.8.0/26` plateforme, `10.0.8.64/26` application hébergée, `10.0.8.128/26` réservé),
six règles d'autorisation ciblées par étiquette et par port posées le 22/08, refus nommés puis
**refus par défaut en sortie posés le 23/08**, disparition du connecteur et de la passerelle de
traduction d'adresses.

Trois conséquences commandent les relevés qui suivent.

1. **T14 et T20 sont datés après le 23/08** : avant cette date, aucune règle de sortie n'existait
   et une tentative sortante n'aurait produit ni refus ni ligne de journal.
2. **La preuve attendue pour ces deux protocoles est un recoupement de deux horodatages** : celui
   de la tentative, côté charge de travail, et celui de la ligne de refus retrouvée dans
   l'entrepôt. Le sink `menal-vpc-logs-staging` filtre `jsonPayload.disposition="DENIED"` sans
   restriction de direction : il capte les refus en sortie comme il captait les refus en entrée.
3. **Deux charges de travail restent hors du réseau** — le composant d'encodage et l'interface web
   de l'application hébergée, retirés du sous-réseau les 12--14/08 comme n'ayant aucune dépendance
   privée. Leur trafic sortant emprunte le chemin managé de la plateforme d'exécution, **où aucune
   règle de pare-feu ne s'applique**. Ce fait, écrit au chapitre 5, détermine le résultat de T14 :
   il est non conforme, et c'est le relevé qui l'établit plutôt qu'une déduction.

**L'isolation de la base de données n'est pas appliquée.** Aucun relevé ci-dessous ne suppose une
instance dédiée par locataire : la base et l'entrepôt de supervision restent partagés, et le refus
croisé mesuré en T20 établit qu'une identité ne joint pas l'interface d'une autre, non que les deux
n'atteignent pas le même serveur.

**Note méthodologique sur la journalisation.** Le passage des journaux de flux à un échantillonnage
de 0,1 le 25/08 ne s'applique pas à la journalisation des règles de pare-feu, déclarée règle par
règle et non échantillonnée. La ligne de refus de T14, relevée le 25/08, n'est donc pas un survivant
statistique.

---

## a) Relevés, protocole par protocole

### T17 --- Protection de l'état de l'infrastructure (EX17, SO21)

**Date de relevé** : 20/08/2026, 08:41--08:45.

**Protocole** (annexe E, inchangé) : tenter un accès en lecture à l'état avec une identité non
autorisée.

**Critère d'acceptation, énoncé avant exécution** : refus. *Attendu* : le refus d'autorisation
horodaté, avec l'identité employée et le droit manquant nommé.

**Commande de reproduction**

```bash
BUCKET=gs://menal-tf-state-staging/env/staging
SA=PROJECT.iam.gserviceaccount.com

# trois identités de service non autorisées
for id in sa-api sa-enrich-job sa-dashboard-staging; do
  gcloud storage cat "$BUCKET/default.tfstate" --impersonate-service-account="$id@$SA"
done

# le même refus sur l'énumération, qui précède la lecture
gcloud storage ls "$BUCKET/" --impersonate-service-account="sa-api@$SA"

# CONTRÔLE POSITIF — sans lui, trois échecs ne distinguent pas un refus
# d'un chemin erroné ou d'un objet inexistant
gcloud storage ls "$BUCKET/" --impersonate-service-account="sa-cicd@$SA"
```

**Relevé**

| Heure | Identité | Opération | Résultat |
|---|---|---|---|
| 08:41:07 | `sa-api` | lecture de `default.tfstate` | `HTTPError 403` — *does not have `storage.objects.get` access* |
| 08:42:15 | `sa-enrich-job` | lecture | `HTTPError 403` — `storage.objects.get` |
| 08:43:02 | `sa-dashboard-staging` | lecture | `HTTPError 403` — `storage.objects.get` |
| 08:43:44 | `sa-api` | énumération du préfixe | `HTTPError 403` — `storage.objects.list` |
| 08:45:20 | `sa-cicd` | énumération (contrôle positif) | succès, objet `default.tfstate` listé, 412 ko |

Quatre refus réellement observés, chacun nommant l'identité employée et le droit manquant, et un
contrôle positif établissant que le chemin visé est le bon et que l'objet existe.

**Verdict au regard du critère : conforme.** Le critère est un refus ; quatre refus ont été
opposés, à l'instant du relevé, aux trois identités de service susceptibles d'atteindre le
stockage. Preuve de rang 3 --- vérification en direct, datée.

**Réserve** : l'emplacement de l'état est provisionné **hors description en code**. Ni son
versionnement, ni son mode d'accès uniforme, ni sa politique de conservation ne sont déclarés :
une modification de ces propriétés ne serait signalée par aucun contrôle de dérive. Le refus établit
un état à un instant, non sa persistance --- c'est la raison pour laquelle T17 conserve la cadence
de rejeu la plus longue du plan et un déclencheur sur tout changement d'emplacement ou de droits.
Le versionnement de l'emplacement n'a par ailleurs jamais été éprouvé en reprise.

---

### T19 --- Détection d'une consommation anormale (EX19, SO23)

**Prérequis levé le 20/08/2026 à 16:20** : déclaration de la ressource `google_billing_budget` dans
le code d'infrastructure --- budget mensuel de 50,00 €, seuils de notification à 50 %, 90 % et
100 % de la **dépense réelle**, acheminement vers les deux canaux de notification déjà déclarés.
Cette déclaration était identifiée comme le prérequis du protocole ; elle est datée et versionnée.

**Date de relevé** : 21/08/2026, 09:05--18:05.

**Protocole** : provoquer une consommation de ressources nettement supérieure au profil habituel.

**Critère d'acceptation, énoncé avant exécution** : alerte émise. *Attendu* : la notification reçue,
le seuil franchi et le poste de consommation qui l'a provoqué.

**Conception du relevé, et pourquoi elle est ce qu'elle est.** Aux volumes de la recette, aucune
action maîtrisable ne fait franchir un seuil à l'échelle de l'euro dans une fenêtre de test :
l'ingestion de journaux, poste dominant en volume, reste sous le palier gratuit du fournisseur, et
le balayage des requêtes planifiées coûte quelques centimes par jour. Le protocole ramène donc le
budget au voisinage de la dépense du mois en cours, puis provoque un dépassement mesuré. Cette
transformation du dispositif est une borne du relevé, écrite ici avant le résultat.

**Commande de reproduction**

```bash
BA=BILLING_ACCOUNT_ID ; B=BUDGET_ID
gcloud billing budgets describe "$B" --billing-account="$BA" --format='value(amount)'   # 50,00 EUR

# 09:05 — budget ramené à 6,50 EUR ; dépense du mois à cette heure : 6,42 EUR (98,8 %)
gcloud billing budgets update "$B" --billing-account="$BA" --budget-amount=6.50EUR

# 09:20 -> 11:50 — charge : générateur de trafic de recette porté à x20
#   + les douze requêtes planifiées (7 règles + 5 normalisations) rejouées 150 fois chacune
seq 1 150 | xargs -P 8 -I{} sh -c 'for q in scripts/planned/*.sql; do \
    bq query --use_legacy_sql=false --nouse_cache < "$q" >/dev/null; done'

# 18:05 — restauration
gcloud billing budgets update "$B" --billing-account="$BA" --budget-amount=50EUR
```

**Relevé**

| Grandeur | Valeur relevée |
|---|---|
| Dépense du mois à l'ouverture (09:05) | 6,42 € — 98,8 % du budget temporaire de 6,50 € |
| Fenêtre de charge | 09:20 → 11:50 (2 h 30) |
| Volume balayé | 1 800 exécutions, ≈ 41 Go, soit ≈ 23 Mo par exécution, dominés par le **minimum forfaitaire par table** et non par les données |
| Consommation additionnelle facturée | **0,21 €** — entrepôt 0,19 €, exécution 0,02 €, ingestion de journaux **0,00 €** (le volume reste sous le palier gratuit) |
| Dépense en fin de journée | 6,63 € — **102,0 %** du budget temporaire |
| Notification du seuil 90 % | reçue à **12:47** |
| Notification du seuil 100 % | reçue à **17:38** |
| Franchissement réel du seuil 100 % | situé dans la fenêtre 09:20 → 11:50 (non ponctuel : l'attribution de coût est horaire au mieux) |
| **Délai franchissement → notification** | **entre 5 h 48 min et 8 h 18 min** |
| Poste de consommation nommé par la notification | **aucun** — la notification porte le nom du budget, le montant et le pourcentage |

Le troisième élément de l'attendu --- le poste de consommation qui a provoqué le franchissement ---
a été reconstitué après coup depuis la ventilation de coût de la console (entrepôt 0,19 €,
exécution 0,02 €). Cette reconstitution est un geste manuel, extérieur au dispositif d'alerte.

**Verdict au regard du critère : partiellement conforme.** Le critère « alerte émise » est tenu :
deux notifications ont été reçues sur le canal déclaré, pour deux seuils distincts, avec leur
horodatage. La part de l'attendu non couverte est nommée : la notification n'identifie pas le poste
de consommation, et le délai n'est pas borné par le dispositif.

**Réserve** : le budget de facturation est évalué quelques fois par jour ; le délai mesuré est un
**intervalle**, non une valeur, parce que l'instant du franchissement n'est lui-même connu qu'à
l'heure près. Le dispositif est un signal de coût, non un signal de sécurité : un détournement de
ressources fonctionnerait plusieurs heures avant que la première notification ne parte. Enfin, le
relevé a été obtenu sur un budget temporairement ramené au voisinage de la dépense courante :
il établit que la chaîne de notification fonctionne, non qu'une consommation anormale au sens de
SO23 serait détectée à temps.

---

### T12 --- Détection d'une interruption de collecte (EX12, SO14)

**Date de relevé** : 22/08/2026, 09:12--11:20.

**Protocole** : interrompre volontairement la collecte au-delà du seuil d'alerte.

**Critère d'acceptation, énoncé avant exécution** : une alerte est émise. *Attendu* : la
notification effectivement reçue sur le canal déclaré, avec l'heure d'interruption, l'heure de
déclenchement et le délai qui les sépare.

**Conception du relevé.** Le protocole a été exécuté en **deux phases**, parce que l'expression
« interruption de collecte » recouvre deux pannes distinctes que le dispositif ne traite pas de la
même façon : l'arrêt de la **route de journaux** vers l'entrepôt, et l'arrêt du **trafic** qui les
produit. Les deux ont été provoquées séparément.

**Commande de reproduction**

```bash
P=PROJECT

# ---- Phase 1 : la route est coupée, le trafic continue ----
gcloud logging sinks update menal-cloudrun-logs-staging --disabled --project "$P"   # 09:12:00
# ... 68 minutes ...
gcloud logging sinks update menal-cloudrun-logs-staging --no-disabled --project "$P" # 10:20:00

bq query --use_legacy_sql=false '
SELECT COUNT(*) AS lignes
FROM `PROJECT.menal_security_staging.raw_logs`
WHERE timestamp BETWEEN TIMESTAMP("2026-08-22 09:12:00 UTC")
                    AND TIMESTAMP("2026-08-22 10:20:00 UTC")
  AND JSON_VALUE(json_payload, "$.resource.type") = "cloud_run_revision"'

gcloud beta monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"
            AND resource.labels.service_name="menal-api-staging"' \
  --interval-start-time=2026-08-22T09:12:00Z --interval-end-time=2026-08-22T10:20:00Z

# ---- Phase 2 : le trafic est coupé, la route est rétablie ----
# 10:35:00 arrêt du générateur de trafic de recette ; 11:20:00 redémarrage
```

**Relevé --- phase 1 : route de journaux coupée, trafic maintenu**

| Grandeur | Valeur relevée |
|---|---|
| Interruption | 09:12:00 → 10:20:00 (1 h 08) |
| Lignes `cloud_run_revision` écrites dans `raw_logs` sur la fenêtre | **0** |
| Requêtes comptées par la métrique d'exécution sur la même fenêtre | **1 148** |
| Lignes récupérées après rétablissement | **0** — l'acheminement de journaux ne rejoue pas le passé |
| Alertes ouvertes | **aucune** |

**Relevé --- phase 2 : trafic coupé, route rétablie**

| Grandeur | Valeur relevée |
|---|---|
| Heure d'interruption | 10:35:00 |
| Ouverture de l'alerte A9 « Ingestion des journaux à l'arrêt --- `menal-api-staging` » | **11:10:44** |
| Notification reçue sur le canal déclaré | **11:11:19** |
| **Délai interruption → notification** | **36 min 19 s** |
| Décomposition | 30 min de durée de condition + 300 s de période d'alignement + 44 s d'évaluation + 35 s d'acheminement |
| Rétablissement et fermeture automatique | 11:20:00, incident clos à 12:11 (fermeture automatique à 3 600 s) |

**Verdict au regard du critère : partiellement conforme.** Le critère « une alerte est émise » est
tenu pour l'interruption du **trafic** : la notification a été reçue, avec son heure et son délai
mesurés. Il n'est pas tenu pour l'interruption de la **collecte** proprement dite : 1 h 08 de
journaux ont été définitivement perdus, sans qu'aucune politique ne s'ouvre.

**Réserve, et elle est la substance du résultat** : la politique A9 porte le nom « Ingestion des
journaux à l'arrêt » mais s'appuie sur une condition d'absence de la métrique de **requêtes** du
service d'exécution. Elle observe la production des journaux, jamais leur acheminement. La santé du
sink, l'écriture effective dans l'entrepôt et la fraîcheur de `raw_logs` ne sont surveillées par
rien --- la seule métrique de fraîcheur déclarée, l'âge du plus ancien enrichissement, porte sur
l'étape suivante de la chaîne et non sur l'ingestion. Une route coupée pendant une attaque
supprimerait la preuve sans supprimer le signal qui rassure.

---

### T15 --- Comportement de la chaîne d'enrichissement sous charge (EX15, SO18)

**Date de relevé** : 22/08/2026, 13:50--16:30.

**Protocole** : injecter un volume de détections nettement supérieur au volume nominal.

**Critère d'acceptation, énoncé avant exécution** : la tâche se termine sans perte, coût et durée
mesurés. *Attendu* : le volume injecté, le nombre de détections traitées, la durée de la tâche et
l'égalité entre entrées et sorties, relevés sur une même exécution.

**Configuration sous test, rappelée avant le résultat** : la tâche d'enrichissement est déclenchée
toutes les 15 minutes ; elle lit les détections **des deux dernières heures** absentes de la table
d'enrichissement, **par lots de 50** ; son délai d'expiration est de 600 s ; le service d'encodage
démarre à froid en 27 s en moyenne. Le trafic de recette a été suspendu de 13:50 à 16:30 afin que
les lots ne portent que les lignes injectées.

**Commande de reproduction**

```bash
# 14:00:00 — injection de 500 détections horodatées entre 13:55:00 et 13:59:59
bq query --use_legacy_sql=false --parameter='n:INT64:500' '
INSERT INTO `PROJECT.menal_security_staging.detections`
  (id, timestamp, rule_id, rule_name, severity, entity, message, source, service)
SELECT GENERATE_UUID(),
       TIMESTAMP_ADD(TIMESTAMP("2026-08-22 13:55:00 UTC"),
                     INTERVAL CAST(RAND()*299 AS INT64) SECOND),
       "R-LOAD-T15", "Charge T15", "low", CONCAT("t15-", CAST(i AS STRING)),
       "injection de charge T15", "t15-harness", "menal-api-staging"
FROM UNNEST(GENERATE_ARRAY(1, @n)) AS i'

gcloud run jobs executions list --job=menal-enrich-job-staging --region=europe-west1 \
  --format='table(name, createTime, completionTime, status.conditions[0].type)'

bq query --use_legacy_sql=false '
SELECT COUNT(*) AS enrichies
FROM `PROJECT.menal_security_staging.alert_enrichment` e
JOIN `PROJECT.menal_security_staging.detections` d ON d.id = e.detection_id
WHERE d.rule_id = "R-LOAD-T15"'
```

**Relevé --- exécution par exécution**

| Exécution | Détections lues | Lignes écrites | Durée | Note |
|---|---|---|---|---|
| 14:15:03 | 50 | 50 | **96 s** | dont 31 s de démarrage à froid du service d'encodage |
| 14:30:02 | 50 | 50 | 71 s | service chaud |
| 14:45:03 | 50 | 50 | 68 s | |
| 15:00:04 | 50 | 50 | 73 s | |
| 15:15:02 | 50 | 50 | 70 s | |
| 15:30:03 | 50 | 50 | 69 s | |
| 15:45:02 | 50 | 50 | 72 s | |
| 16:00:03 | **0** | 0 | 6 s | fenêtre glissante 14:00 → 16:00 : plus aucune ligne injectée n'est éligible |

| Grandeur | Valeur relevée |
|---|---|
| Volume injecté | **500** détections, soit ≈ 17 fois le volume nominal (≈ 30 par quart d'heure) |
| Détections traitées | **350**, en 7 exécutions |
| Lignes écrites dans la table d'enrichissement | **350** — égalité entrées / sorties sur chaque exécution, aucune en échec, aucune reprise |
| Durée cumulée | 519 s (8 min 39 s) ; durée maximale 96 s, contre un délai d'expiration de 600 s |
| Coût facturé | 21 requêtes au minimum forfaitaire de 10 Mo par table balayée, soit ≈ 0,21 Go ; coût marginal < 0,05 € — **dominé par le forfait, non par le volume** |
| **Détections jamais enrichies** | **150**, sorties de la fenêtre de deux heures avant d'avoir été lues |
| Débit plafond mesuré | 50 par quart d'heure, soit **200 par heure** |
| Capacité d'absorption théorique | 2 h × 200 = **400** détections en attente |
| Écart mesuré / théorique | 350 contre 400 : la différence est la phase entre l'injection et le premier passage de l'ordonnanceur |

**Comportement de l'alerte pendant la charge** --- observation non provoquée, et c'est ce qui lui
donne son poids : la politique « Enrichissement en retard (> 30 min) » s'est ouverte à **14:35:47**,
dès que l'âge du plus ancien enrichissement en attente a dépassé 1 800 s, et s'est refermée
automatiquement à **16:05:12**. Or elle ne s'est pas refermée parce que le retard était résorbé,
mais parce que les lignes en attente étaient **sorties de la fenêtre de deux heures** : l'alerte se
referme à l'instant précis où la perte devient définitive.

**Nettoyage** : les 500 lignes injectées ont été retirées par une suppression bornée
(`DELETE ... WHERE rule_id = "R-LOAD-T15"`) le 22/08 à 16:22. Cette opération de campagne est
elle-même un argument pour le second seuil du chapitre 6 : elle n'est traçable que dans les
journaux d'accès aux données, dont la rétention de trente jours n'est pas verrouillée.

**Verdict au regard du critère : partiellement conforme.** Le critère est tenu au niveau de la
**tâche** : elle se termine sans perte --- 350 entrées, 350 sorties, sept exécutions, aucune en
échec --- et son coût comme sa durée sont mesurés sur les mêmes exécutions. La part non couverte
est la **chaîne** : au-delà de 400 détections en attente, la fenêtre de deux heures écarte les plus
anciennes, qui ne sont jamais enrichies, sans erreur, sans code de retour non nul et sans trace.

**Réserve** : le trafic de recette a été suspendu pendant la mesure, de sorte que les lots ne
portaient que les lignes injectées. En exploitation, le flux nominal partage le même lot de 50 :
le débit plafond de 200 par heure est donc une **borne supérieure**, non un débit garanti. Le
démarrage à froid de 31 s relevé sur la première exécution est en deçà du pic de 94 s mesuré début
août : la mesure ne dit rien du comportement de la chaîne lorsque la charge arrive sur un service
froid au pic.

---

### T20 --- Restriction des sorties réseau (EX20, SO24)

**Date de relevé** : 24/08/2026, 09:12--09:18 --- **après** la pose du refus par défaut en sortie
du 23/08, et **avant** la suppression de la passerelle de traduction d'adresses du 24/08 : les
règles ont été éprouvées avant que l'ancien chemin ne soit démonté.

**Protocole** : depuis une charge de travail applicative, tenter une connexion sortante vers une
destination non autorisée.

**Critère d'acceptation, énoncé avant exécution** : échec de connexion et trace de refus
exploitable. *Attendu* : l'échec de la connexion sortante côté charge de travail, et la ligne de
refus correspondante retrouvée dans l'entrepôt de supervision, les deux horodatages se recoupant.

**Conception du relevé.** La charge de travail est une tâche d'exécution construite pour la
campagne, déployée avec **l'identité de service, l'étiquette, le sous-réseau et le mode de sortie
d'un locataire réel** : c'est une charge de travail applicative au sens du protocole, et non un
substitut. Les destinations retenues sont des adresses de plages de documentation, sans résolution
de nom : une résolution échouerait elle aussi et confondrait une panne de nom avec un refus réseau.
Le refus est évalué en sortie, sur la source : le relevé ne dépend donc pas de l'existence d'un
service à l'écoute côté destination.

**Commande de reproduction**

```bash
R=europe-west1 ; P=PROJECT

gcloud run jobs deploy menal-egress-probe-staging --region="$R" \
  --image="$R-docker.pkg.dev/$P/menal-docker-staging/egress-probe@sha256:..." \
  --service-account="sa-elson@$P.iam.gserviceaccount.com" \
  --network=menal-vpc-staging --subnet=subnet-tenant-elson-staging \
  --network-tags=tag-elson --vpc-egress=all-traffic \
  --args="--,-sS,--max-time,10,https://203.0.113.10/"
gcloud run jobs execute menal-egress-probe-staging --region="$R" --wait

bq query --use_legacy_sql=false '
SELECT timestamp,
       JSON_VALUE(json_payload,"$.rule_details.reference") AS regle,
       JSON_VALUE(json_payload,"$.connection.src_ip")      AS src,
       JSON_VALUE(json_payload,"$.connection.dest_ip")     AS dst,
       JSON_VALUE(json_payload,"$.connection.dest_port")   AS port
FROM `PROJECT.menal_security_staging.raw_logs`
WHERE timestamp BETWEEN TIMESTAMP("2026-08-24 09:10:00 UTC")
                    AND TIMESTAMP("2026-08-24 09:20:00 UTC")
  AND JSON_VALUE(json_payload,"$.disposition") = "DENIED"
ORDER BY timestamp'
```

**Relevé --- trois tentatives, trois refus**

| # | Étiquette / sous-réseau | Destination | Ligne de refus (entrepôt) | Règle opposée | Échec côté charge de travail |
|---|---|---|---|---|---|
| a | `tag-elson` / `10.0.8.64/26` (src `10.0.8.71`) | `203.0.113.10:443`, externe non autorisée | **09:12:33.482** | `deny-all-egress-staging` (65534) | code 28, délai dépassé, **09:12:43.7** |
| b | `tag-elson` / `10.0.8.64/26` | `10.0.8.19:8080`, sous-réseau plateforme | **09:13:49.117** | `deny-cross-tenant-elson-to-menal-staging` (1200) | code 28, **09:13:59.4** |
| c | `tag-dashboard` / `10.0.8.0/26` | adresse privée de l'instance de base, `5432` | **09:15:02.664** | `deny-dashboard-to-db-staging` (1100) | code 28, **09:15:12.9** |

| Grandeur | Valeur relevée |
|---|---|
| Recoupement des deux horodatages | la ligne de refus **précède** l'échec client de 10,2 à 10,3 s, soit exactement le délai d'expiration demandé (`--max-time 10`) plus l'acheminement |
| Latence d'arrivée dans l'entrepôt | les trois lignes interrogeables à **09:18** — de 2 min 55 s à 4 min 12 s après l'événement |
| Contrôle positif | à **09:16:41**, la même sonde portant `tag-enrich-job` atteint la destination autorisée par sa règle et reçoit un code 200 : sans ce contrôle, trois échecs ne distingueraient pas un refus du pare-feu d'une sortie réseau en panne |

**Verdict au regard du critère : conforme.** Le critère demande un échec de connexion **et** une
trace de refus exploitable. Trois refus ont été réellement opposés, dont un refus croisé entre
locataires et un refus nommé vers la base ; les trois lignes correspondantes ont été retrouvées
dans l'entrepôt, avec la règle, la source, la destination et le port ; les horodatages se recoupent
et l'écart entre eux s'explique intégralement. Preuve de rang 3, adossée à une configuration
déclarée en code.

**Réserves --- elles bornent la portée, pas la couverture du critère**

- **L'étiquette se pose dans la définition de la révision.** La frontière est opposable à une
  charge de travail compromise ; elle ne l'est pas à un opérateur capable de déployer, qui pourrait
  poser l'étiquette de l'autre locataire. Ce second cas ne relève pas du réseau mais du resserrement
  du droit de déploiement.
- **Seuls les refus sont journalisés**, par décision de coût. Une sortie **réussie** vers une
  destination autorisée ne laisse aucune trace de sécurité.
- **L'exfiltration par les interfaces du fournisseur n'est pas fermée** : l'autorisation qui rend
  l'entrepôt joignable rend joignable tout entrepôt du même fournisseur. Il y faudrait un périmètre
  de service, donc une organisation cloud dont le projet ne dispose pas.
- **Deux charges de travail ne sont pas derrière ces règles** --- le composant d'encodage et
  l'interface web de l'application hébergée --- et le résultat de T14 en est la conséquence directe.
- La preuve réside dans la table des journaux bruts, non dans la table des détections : elle n'a pas
  été affectée par la suppression administrateur des 24 et 25/08.

---

### T14 --- Absence de sortie réseau du composant d'inférence (EX14, SO17)

**Date de relevé** : 25/08/2026, 10:04--10:18.

**Protocole** : depuis le composant d'encodage, tenter une connexion sortante vers une destination
externe.

**Critère d'acceptation, énoncé avant exécution** : échec de connexion. *Attendu* : l'échec
horodaté d'une connexion sortante émise depuis le composant lui-même, et la trace de refus
correspondante.

**Conception du relevé.** Deux sondes ont été exécutées, différant par un seul paramètre --- le
chemin de sortie --- afin que le résultat désigne une cause et non une corrélation. La sonde A
porte l'identité `sa-ml-embed`, l'étiquette `tag-ml-embed`, le sous-réseau plateforme et la sortie
directe. La sonde B porte la même identité et **la configuration réseau exacte de la révision
déployée** : aucun accès au réseau privé, sortie managée par la plateforme d'exécution.

**Commande de reproduction**

```bash
R=europe-west1 ; P=PROJECT ; SA="sa-ml-embed@$P.iam.gserviceaccount.com"

# Sonde A — dans le sous-réseau, derrière les règles
gcloud run jobs deploy menal-egress-probe-staging --region="$R" --service-account="$SA" \
  --network=menal-vpc-staging --subnet=subnet-platform-staging \
  --network-tags=tag-ml-embed --vpc-egress=all-traffic \
  --args="--,-sS,--max-time,10,https://203.0.113.10/"
gcloud run jobs execute menal-egress-probe-staging --region="$R" --wait

# Sonde B — configuration réseau de la révision réellement déployée
gcloud run jobs deploy menal-egress-probe-managed-staging --region="$R" --service-account="$SA" \
  --clear-network --args="--,-sS,-o,/dev/null,-w,%{http_code},https://CONTROLE_EXTERNE/"
gcloud run jobs execute menal-egress-probe-managed-staging --region="$R" --wait

# Configuration de la révision sous test
gcloud run services describe menal-ml-embed-staging --region="$R" \
  --format='value(spec.template.metadata.annotations, template.vpcAccess)'
```

**Relevé**

| Heure | Sonde | Chemin de sortie | Destination | Résultat |
|---|---|---|---|---|
| 10:04:14.207 | A | sous-réseau plateforme, `tag-ml-embed`, sortie directe | `203.0.113.10:443` | ligne **DENIED**, règle `deny-all-egress-staging`, src `10.0.8.23` |
| 10:04:24.5 | A | — | — | code 28, délai dépassé (écart de 10,3 s avec la ligne de refus) |
| 10:04:26.883 | A | idem | `198.51.100.7:443` | ligne **DENIED**, même règle |
| 10:04:37.1 | A | — | — | code 28 |
| **10:12:38** | **B** | **sortie managée de la plateforme, identique à la révision déployée** | destination externe de contrôle | **HTTP 204 reçu en 412 ms — la connexion aboutit** |
| 10:18 | — | lecture de la révision `menal-ml-embed-staging` sur la plateforme | — | bloc d'accès au réseau **absent** : la révision emprunte le chemin de la sonde B |

**Verdict au regard du critère : non conforme.** Le critère est un échec de connexion depuis le
composant d'encodage. Sur le chemin réellement emprunté par le composant, la connexion **aboutit**.
Aucune règle de pare-feu ne s'applique à ce chemin.

**Ce que le relevé établit tout de même, et il faut le dire précisément** : la règle de refus par
défaut existe et refuse --- la sonde A en fait la démonstration, avec sa ligne de journal et son
recoupement d'horodatages. Le composant n'est pas derrière elle. Le contrôle n'est pas absent : il
est en place, et le composant en a été retiré les 12--14/08 au motif, exact, qu'il n'a aucune
dépendance privée. Ce motif justifiait le retrait pour la sortie *nécessaire* ; il ne le justifiait
pas pour la sortie *possible*.

**Correctif identifié, et son coût** : réintégrer le composant au sous-réseau plateforme en sortie
directe et lui poser une étiquette pour laquelle aucune règle d'autorisation de sortie n'existe ---
une révision, aucun changement applicatif. Contrepartie à écrire : le composant consomme alors des
adresses du `/26` et redevient tributaire de la disponibilité du sous-réseau. Le même correctif vaut
pour l'interface web de l'application hébergée, seconde charge de travail à sortie managée non
gouvernée. Tant qu'il n'est pas appliqué et T14 rejoué, l'exigence EX14 reste ouverte et le scénario
de menace SO17 avec elle.

**Réserve** : le relevé porte sur la capacité de sortie, non sur son usage. L'image du composant ne
comporte aucun appel sortant --- son modèle est embarqué dans l'image et il ne joint aucun service
--- ce qui est établi par lecture du code, preuve de rang 4 qui ne peut fonder aucun verdict de
conformité. La sonde B partage l'identité et le chemin réseau de la révision déployée, non son
binaire.

---

## b) Nouveau bilan chiffré

**Recompte à la main, test par test.**

| Résultat | Protocoles | Compte |
|---|---|---|
| **Conforme** | T2, T5, T7, T8, T11, **T17**, **T20** | **7** |
| **Partiellement conforme** | T3, T4, T6, T9, T10, **T12**, T13, **T15**, T16, T18, **T19** | **11** |
| **Non conforme** | T1, **T14** | **2** |
| **Planifié** | — | **0** |
| **Total** | | **20** |

Vérification : 7 + 11 + 2 + 0 = 20. Protocoles portant une preuve nommée, datée ou rejouée à chaque
livraison : **20 sur 20**.

Évolution : 5 → 7 conformes (+ T17, + T20) ; 8 → 11 partiels (+ T12, + T15, + T19) ; 1 → 2 non
conformes (+ T14) ; 6 → 0 protocoles sans résultat.

**Phrase de synthèse de campagne** (à substituer au bilan actuel du chapitre 6) :

> **Bilan à la date de \dateref** : **7 conformes, 11 partiellement conformes et 2 non conformes**.
> Les vingt protocoles portent désormais une preuve nommée --- refus réellement observé, test
> automatisé rejoué à chaque livraison, vérification en direct datée ou inventaire exhaustif ---
> et le plan de validation continue ne porte plus des protocoles sans résultat, mais la cadence à
> laquelle six d'entre eux sont rejoués.

**Lecture qui accompagne le compte** (esprit du paragraphe existant, à conserver) : le compte reste
sévère, parce que « conforme » exige la couverture intégrale du critère ; les onze résultats partiels
ne sont pas des demi-échecs mais des propriétés établies dont une part précise du critère, nommée
ligne à ligne, n'est pas couverte ; et **la campagne compte désormais deux non-conformités plutôt
qu'une**, ce qui renforce l'argument du mémoire au lieu de l'affaiblir : les protocoles ont été
dérivés de l'analyse de risque avant la conception, et T14 en est la seconde démonstration.

---

## c) Passages à modifier dans le mémoire, fichier par fichier

> Rappel d'outillage : éditer ces fichiers avec Read/Edit/Write. Un *heredoc* bash, `sed` ou `perl`
> mange les antislashs et corrompt le LaTeX en caractères de contrôle invisibles.

### C.1 `latex/chapters/final/ch6_validation.tex`

**C.1.1 --- §6.1, convention à quatre valeurs (l. ≈ 46--48)**

*Avant* : `\textbf{Planifié} : le protocole relève du plan de validation continue (§\ref{sec:plan-validation}), avec sa fréquence et la date de son premier passage.`

*Après* :
```latex
\textbf{Planifié} : le protocole relève du plan de validation continue
(§\ref{sec:plan-validation}), avec sa fréquence et la date de son premier passage. À la date de
\dateref{}, aucun protocole ne porte ce résultat : les six qui le portaient ont été relevés entre
le 20 et le 25/08/2026, et le plan de validation continue en fixe désormais la cadence de rejeu.
La convention est conservée telle qu'elle a été publiée --- la retirer après coup reviendrait à
ajuster la méthode au résultat obtenu.
```
*Raison* : le quatrième verdict n'est plus instancié ; le supprimer serait réviser la convention
a posteriori.

**C.1.2 --- §6.1, dernier paragraphe (l. ≈ 73)**

*Avant* : `Les preuves ponctuelles sont datées jusqu'au 23/08/2026 ;`
*Après* : `Les preuves ponctuelles sont datées jusqu'au 25/08/2026 ;`
*Raison* : T14 est relevé le 25/08.

**C.1.3 --- Tableau de synthèse `tab:synthese-campagne`, légende**

*Avant* : `... (« Partiel » : partiellement conforme ; « Planifié » : plan de validation continue)`
*Après* : `... (« Partiel » : partiellement conforme)`
*Raison* : aucune ligne ne porte plus « Planifié ».

**C.1.4 --- Tableau de synthèse, six lignes à remplacer**

```latex
T12 & EX12 & Partiel & Alerte d'absence de trafic reçue le 22/08/2026, 36~min~19~s après
l'interruption. \emph{Réserve} : une route de journaux coupée 1~h~08 le même jour n'a ouvert
aucune alerte et 1\,148 requêtes n'ont laissé aucune trace \\ \hline
```
```latex
T14 & EX14 & \textbf{Non conforme} & Le 25/08/2026, une sonde portant la configuration réseau de
la révision déployée atteint une destination externe en 412~ms ; le refus par défaut en sortie,
vérifié le même jour sur le sous-réseau, ne s'applique pas au chemin du composant
(§\ref{sec:non-conformite-t1}) \\ \hline
```
```latex
T15 & EX15 & Partiel & 22/08/2026 : 350 détections traitées en 7 exécutions, entrées égales aux
sorties, durée maximale 96~s, coût dominé par le forfait de balayage. \emph{Réserve} : 150 des
500 détections injectées sortent de la fenêtre de deux heures avant d'être lues, sans erreur ni
trace \\ \hline
```
```latex
T17 & EX17 & Conforme & Quatre refus opposés le 20/08/2026 à trois identités de service, chacun
nommant le droit manquant, avec contrôle positif. \emph{Réserve} : emplacement de l'état
provisionné hors description en code \\ \hline
```
```latex
T19 & EX19 & Partiel & Deux notifications de budget reçues le 21/08/2026, seuils 90\,\% et
100\,\%. \emph{Réserve} : délai compris entre 5~h~48 et 8~h~18, et la notification ne nomme pas le
poste de consommation \\ \hline
```
```latex
T20 & EX20 & \textbf{Conforme} & Le 24/08/2026, trois sorties refusées --- externe, croisée entre
locataires, et vers la base --- avec les trois lignes de refus retrouvées dans l'entrepôt, les
horodatages se recoupant à 10,3~s près \\
```

**C.1.5 --- Bilan chiffré et les deux lectures (l. ≈ 149--162)**

*Avant* : `\textbf{Bilan à la date de \dateref} : \textbf{5 conformes, 8 partiellement conformes, 1 non conforme et 6 protocoles rattachés au plan de validation continue}. Quatorze protocoles sur vingt portent donc une preuve nommée, vérifiable et rattachée à une date ou à une exécution automatisée.`

*Après* :
```latex
\textbf{Bilan à la date de \dateref} : \textbf{7 conformes, 11 partiellement conformes et 2 non
conformes}. Les vingt protocoles portent donc une preuve nommée, vérifiable et rattachée à une date
ou à une exécution automatisée ; le plan de validation continue (§\ref{sec:plan-validation}) ne
porte plus des protocoles sans résultat, mais la cadence à laquelle six d'entre eux sont rejoués.
```

Dans le paragraphe suivant : `cinq résultats seulement sont prononcés conformes` → `sept résultats
seulement sont prononcés conformes` ; `les huit résultats partiels ne sont pas des demi-échecs` →
`les onze résultats partiels ne sont pas des demi-échecs`.

**C.1.6 --- Encadré « Une campagne sans non-conformité serait suspecte »**

*Avant* : `La non-conformité de T1 est la conséquence directe de ce choix de méthode : elle est le prix, et la preuve, de l'antériorité des critères.`
*Après* : `Les deux non-conformités, T1 et T14, sont la conséquence directe de ce choix de méthode : elles sont le prix, et la preuve, de l'antériorité des critères. T14 en est l'illustration la plus nette --- son critère, écrit avant la refonte réseau, aurait été trivialement satisfait par une reformulation après coup en « absence de chemin public \emph{vers} le composant ».`

**C.1.7 --- §6.2.1, titre et contenu**

*Avant* (titre et label) : `\subsection{La non-conformité assumée : T1}` / `\label{sec:non-conformite-t1}`
*Après* : `\subsection{Les deux non-conformités assumées : T1 et T14}` --- **conserver le label
`sec:non-conformite-t1`** : il est cité au tableau de synthèse et en §6.5.1.

Ajouter, après l'analyse de T1, le bloc suivant :
```latex
\textbf{T14 --- une non-conformité produite par la refonte, non masquée par elle.} Le protocole
exige l'échec d'une connexion sortante émise depuis le composant d'encodage. Le 25/08/2026, deux
sondes ne différant que par leur chemin de sortie ont été exécutées sous l'identité du composant :
celle qui emprunte le sous-réseau et l'étiquette du composant a été refusée deux fois par la règle
de refus par défaut en sortie, avec ses deux lignes de journal ; celle qui emprunte le chemin de la
révision réellement déployée --- sortie managée par la plateforme d'exécution, sans accès au réseau
privé --- a reçu un code 204 en 412~ms. La règle refuse ; le composant n'est pas derrière elle.
Le composant a été retiré du sous-réseau les 12 au 14/08 au motif, exact, qu'il n'a aucune
dépendance privée : ce motif justifiait le retrait pour la sortie \emph{nécessaire}, non pour la
sortie \emph{possible}. Le correctif est identifié et son coût est d'une révision sans changement
applicatif --- réintégrer le composant au sous-réseau et lui poser une étiquette pour laquelle
aucune règle d'autorisation de sortie n'existe --- au prix de le rendre à nouveau tributaire de la
disponibilité du sous-réseau. Il vaut identiquement pour l'interface web de l'application hébergée,
seconde charge de travail à sortie managée non gouvernée. Tant qu'il n'est pas appliqué et T14
rejoué, l'exigence EX14 reste ouverte et le scénario de menace SO17 avec elle.
```

**C.1.8 --- §6.2.2, dernier paragraphe (l. ≈ 237--239)**

*Avant* : `La journalisation des refus du pare-feu a par ailleurs été activée et vérifiée le 19/08/2026, ce qui clôt l'écart É1 : c'est la condition de recevabilité du protocole T20, non son résultat.`
*Après* : `La journalisation des refus du pare-feu a par ailleurs été activée et vérifiée le 19/08/2026, ce qui clôt l'écart É1 : c'était la condition de recevabilité du protocole T20, dont le résultat a été relevé le 24/08/2026, une fois le refus par défaut en sortie posé.`

Dans le même paragraphe : `T14 relevant d'une autre propriété que cette correction ne touche pas, l'absence de sortie réseau du composant d'encodage` → ajouter `, propriété que le relevé du 25/08/2026 déclare non tenue (§\ref{sec:non-conformite-t1})`.

Plus haut, `Deux des cinq résultats conformes reposent sur des preuves` → `Deux des sept résultats
conformes reposent sur des preuves`.

**C.1.9 --- §6.2.3 Plan de validation continue --- reformulation (l. ≈ 244--250)**

*Avant* : `Six protocoles --- T12, T14, T15, T17, T19 et T20 --- relèvent d'un plan de validation continue, distinct de la campagne initiale par sa nature : la campagne établit qu'un dispositif tient au moment où il est construit, le plan qu'il tient encore après avoir évolué.`

*Après* :
```latex
Six protocoles --- T12, T14, T15, T17, T19 et T20 --- portent un premier relevé daté entre le 20 et
le 25/08/2026 et une \textbf{cadence de rejeu}. C'est l'objet du plan de validation continue, et il
est distinct de la campagne par sa nature : la campagne établit qu'un dispositif tient au moment où
il est construit, le plan qu'il tient encore après avoir évolué. Ces six-là y figurent parce que la
propriété qu'ils vérifient est celle qui se dégrade --- un seuil qui dépend du volume, une règle de
pare-feu qu'une révision peut contourner, un droit sur un emplacement provisionné hors code. Il est
structuré par la fréquence de dérive du contrôle vérifié, non par la commodité
(tableau~\ref{tab:plan-validation}) : un contrôle porté par une configuration que la chaîne de
provisionnement réapplique dérive lentement, un contrôle porté par un seuil dépendant du volume
dérive à chaque changement d'usage.
```

**C.1.10 --- Tableau `tab:plan-validation` --- nouvelle version**

```latex
{\footnotesize
\begin{longtable}{|P{0.8cm}|P{3.7cm}|P{1.8cm}|P{1.9cm}|P{4.2cm}|}
\caption{Plan de validation continue : premier relevé et cadence de rejeu}
\label{tab:plan-validation} \\
\hline
\textbf{Test} & \textbf{Propriété vérifiée} & \textbf{Premier relevé} & \textbf{Cadence de rejeu} &
\textbf{Déclencheur additionnel} \\
\hline
\endfirsthead
\hline
\textbf{Test} & \textbf{Propriété vérifiée} & \textbf{Premier relevé} & \textbf{Cadence de rejeu} &
\textbf{Déclencheur additionnel} \\
\hline
\endhead
T12 & Détection d'une interruption de collecte & 22/08/2026 & Trimestrielle & Toute modification
d'un acheminement de journaux \\ \hline
T14 & Absence de sortie réseau du composant d'inférence & 25/08/2026 & Trimestrielle & Application
du correctif : réintégration du composant au sous-réseau \\ \hline
T15 & Tenue de la chaîne d'enrichissement sous charge & 22/08/2026 & Trimestrielle & Changement de
modèle, de taille de lot ou de cadence de la tâche \\ \hline
T17 & Protection de l'état de l'infrastructure & 20/08/2026 & Semestrielle & Tout changement
d'emplacement ou de droits sur l'état \\ \hline
T19 & Détection d'une consommation anormale & 21/08/2026 & Trimestrielle & Toute révision du
montant ou des seuils du budget déclaré \\ \hline
T20 & Restriction des sorties réseau & 24/08/2026 & Trimestrielle & Ajout d'un locataire ou d'une
destination externe autorisée \\
\hline
\end{longtable}
}
```

**C.1.11 --- Paragraphe suivant le tableau (l. ≈ 280--286)**

*Avant* : `Le premier passage de l'ensemble est fixé au quatrième trimestre 2026. Trois de ces six protocoles portent un prérequis explicite, élément de conception et non délai : T14 suppose la pose d'une règle de refus de sortie par défaut, T19 la déclaration d'une alerte de budget de facturation, et T20 tire parti de la journalisation des refus réseau déjà activée. Aucun résultat, aucune valeur, aucun statut favorable n'est porté au crédit de ces six protocoles avant leur passage : leur attendu est écrit avant exécution en annexe~\ref{ann:protocoles-tests}, ce qui interdit de l'ajuster ensuite au résultat obtenu.`

*Après* :
```latex
Le premier rejeu de l'ensemble est fixé au quatrième trimestre 2026. Les trois prérequis identifiés
avant la campagne ont été levés, et leurs dates comptent autant que les résultats qu'ils rendent
possibles : la règle de refus de sortie par défaut a été posée le 23/08/2026, l'alerte de budget de
facturation déclarée dans le code d'infrastructure le 20/08/2026, et la journalisation des refus
réseau était acquise depuis le 19/08/2026. L'attendu de chacun des six protocoles avait été écrit
avant exécution en annexe~\ref{ann:protocoles-tests} ; il a été confronté au relevé sans être
ajusté, et c'est ce qui donne son poids au seul de ces six qui échoue : le critère de T14, formulé
avant la refonte du réseau, aurait été satisfait par une reformulation après coup, et il ne l'a pas
été.
```

**C.1.12 --- §6.3.2, tableau `tab:lacunes`, deux lignes**

*Avant* (ligne 1) : `Scénarios réseau portés par le plan de validation continue & Journalisation des refus activée le 19/08/2026, protocole T20 à cadence trimestrielle & Couverture des mouvements latéraux et des sorties bloquées non établie \\`

*Après* :
```latex
Refus réseau tracés mais non qualifiés & Les refus en sortie et les refus croisés sont journalisés
et retrouvables (T20, 24/08/2026), mais aucune des sept règles de détection ne les lit & Un
mouvement latéral refusé est \emph{tracé}, il n'est pas \emph{détecté} : il ne produit ni détection,
ni score, ni ligne dans le tableau de bord \\
```

*Avant* (ligne « Exfiltration ») : `Exfiltration & Aucune règle dédiée au canal sortant, et les journaux de traduction d'adresses ne retiennent que les erreurs & Un transfert sortant \emph{réussi} n'est pas qualifié comme incident \\`

*Après* :
```latex
Exfiltration & Aucune règle dédiée au canal sortant ; seuls les refus de sortie sont journalisés,
par décision de coût, et deux charges de travail conservent une sortie managée non gouvernée (T14,
25/08/2026) & Un transfert sortant \emph{réussi} vers une destination autorisée n'est qualifié
comme incident par rien, et l'autorisation qui rend l'entrepôt joignable rend joignable tout
entrepôt du même fournisseur \\
```

**C.1.13 --- §6.4.1, paragraphe « Observabilité de sécurité et observabilité d'exploitation »**

*Avant* : `Trois bornes portent toutes sur le même défaut, qu'une alerte configurée mais jamais provoquée n'est pas une alerte vérifiée : aucune de ces politiques n'a été déclenchée volontairement, T12 et T19 qui s'en chargent relevant du plan de validation continue ; les quatre objectifs de service sont mesurés sans être actionnés, faute de politique d'alerte sur la consommation de leur budget d'erreur ; et aucune alerte de budget de facturation n'est déclarée dans le code d'infrastructure, ce qui est précisément le prérequis de T19.`

*Après* :
```latex
Trois de ces politiques ont depuis été provoquées, et la mesure vaut mieux que la déclaration :
l'alerte d'absence de trafic a été déclenchée volontairement le 22/08/2026 et la notification reçue
36~min~19~s après l'interruption (T12) ; l'alerte de retard d'enrichissement s'est ouverte sans
avoir été provoquée pendant l'essai de charge du même jour (T15) ; et l'alerte de budget de
facturation, déclarée dans le code d'infrastructure le 20/08/2026, a produit deux notifications le
21/08/2026 (T19). Deux bornes subsistent, et elles portent le même défaut : les quatorze autres
politiques n'ont jamais été déclenchées, et les quatre objectifs de service restent mesurés sans
être actionnés, faute de politique d'alerte sur la consommation de leur budget d'erreur.
```

**C.1.14 --- §6.7.2 Réponse aux objectifs, tableau `tab:objectifs-ch6`**

- **O1**, colonne « Acquis » --- remplacer `Portée : l'isolation entre locataires est portée par l'identité, la ségrégation réseau étant le troisième seuil de §\ref{sec:socle-service}` par :
  `Refus croisé entre locataires réellement opposé et journalisé le 24/08/2026 (T20). Portée : la frontière est opposable à une charge de travail compromise, non à un opérateur capable de déployer, l'étiquette se posant dans la définition de la révision ; et deux charges de travail conservent une sortie managée non gouvernée (T14)`.
  Niveau : `Réalisé` → `Réalisé, mesuré en partie`.
- **O4** --- ajouter à la portée : `; une interruption de la route de journaux ne produit aucune alerte (T12)`.
- **O5** --- ajouter à la portée : `; le débit de l'enrichissement plafonne à 200 détections par heure, au-delà desquelles la fenêtre de deux heures écarte les plus anciennes sans erreur (T15, 22/08/2026)`.
- **O6** --- ajouter aux acquis : `plafond de charge de l'enrichissement mesuré le 22/08/2026 ; protection de l'état de l'infrastructure vérifiée par quatre refus le 20/08/2026`.

**C.1.15 --- Conclusion du chapitre**

*Avant* : `La campagne prononce cinq résultats conformes, huit partiellement conformes, une non-conformité assumée et rattache six protocoles à un plan de validation continue daté ; quatorze sur vingt portent une preuve nommée et vérifiable, ...`

*Après* :
```latex
La campagne prononce sept résultats conformes, onze partiellement conformes et deux non-conformités
assumées ; les vingt protocoles portent une preuve nommée et vérifiable, et six d'entre eux portent
en outre une cadence de rejeu au plan de validation continue, ...
```

Plus loin, `la non-conformité de T1, conservée et expliquée, est la contrepartie d'une campagne dérivée de l'analyse de risque avant la conception` → `les deux non-conformités, T1 et T14, conservées et expliquées, sont la contrepartie d'une campagne dérivée de l'analyse de risque avant la conception`.

Et à la liste des points fragiles : `isolation entre locataires portée par l'identité et non par le réseau` → `deux charges de travail dont la sortie réseau échappe encore au pare-feu`.

### C.2 `latex/appendices/annexe_e_protocoles_tests.tex`

**C.2.1 --- §Conditions de mesure**

- `Les preuves ponctuelles sont datées jusqu'au 23/08/2026` → `jusqu'au 25/08/2026`.
- `aucune fenêtre d'observation continue n'est définie --- c'est l'objet du plan de validation continue` → `la fenêtre d'observation continue est définie par les cadences de rejeu du plan de validation continue`.

**C.2.2 --- §Modèle de fiche, dernier paragraphe**

*Avant* : `Les six protocoles rattachés au plan de validation continue portent un champ supplémentaire, l'\textbf{attendu} : ce que la preuve devra rendre visible, énoncé \emph{avant} l'exécution. Cette formulation engage --- un attendu écrit à l'avance ne peut plus être ajusté au résultat obtenu --- et aucune valeur n'est portée au crédit de ces protocoles avant leur passage.`

*Après* :
```latex
Les six protocoles rattachés au plan de validation continue portaient un champ supplémentaire,
l'\textbf{attendu} : ce que la preuve devrait rendre visible, énoncé \emph{avant} l'exécution. Ces
attendus sont reproduits ci-dessous à côté du relevé qui les a confrontés, sans avoir été révisés :
c'est ce qui permet de lire, protocole par protocole, l'écart entre ce qui était espéré et ce qui a
été obtenu --- nul pour T17 et T20, partiel pour T12, T15 et T19, et défavorable pour T14.
```

**C.2.3 --- Les six fiches**

Chaque fiche conserve son en-tête et son protocole ; seuls *Résultat*, *Preuve* et *Réserve*
changent. Rédiger à partir de la section (a) ci-dessus, en respectant le gabarit :

```latex
\textbf{T12 --- Détection d'une interruption de collecte} (EX12, SO14). Interrompre volontairement
la collecte au-delà du seuil d'alerte. \emph{Critère} : une alerte est émise. \emph{Attendu, écrit
avant exécution} : la notification effectivement reçue sur le canal déclaré, avec l'heure
d'interruption, l'heure de déclenchement et le délai qui les sépare. \emph{Résultat} :
partiellement conforme. \emph{Preuve} : le 22/08/2026, le générateur de trafic de recette a été
arrêté à \hms{10:35:00} ; la politique d'absence de signal s'est ouverte à \hms{11:10:44} et la
notification a été reçue à \hms{11:11:19}, soit 36~min~19~s après l'interruption --- 30~minutes de
durée de condition, 300~s de période d'alignement, puis évaluation et acheminement. \emph{Réserve}
: exécutée d'abord sur l'autre panne que recouvre le protocole, l'interruption de l'acheminement
des journaux, la mesure est défavorable --- l'acheminement coupé de \hms{09:12} à \hms{10:20} n'a
ouvert aucune alerte, 1\,148 requêtes comptées par la métrique d'exécution n'ont produit aucune
ligne dans l'entrepôt, et le rétablissement n'a rien rejoué. La politique porte sur la production
des journaux, jamais sur leur acheminement ni sur la fraîcheur de la table qui les reçoit.
```

Les cinq autres fiches suivent la même structure ; le contenu factuel est celui de la section (a) :
T14 (non conforme, deux sondes, 25/08), T15 (partiel, 350 sur 500, 22/08), T17 (conforme, quatre
refus et contrôle positif, 20/08), T19 (partiel, deux notifications, délai en intervalle, 21/08),
T20 (conforme, trois refus recoupés, 24/08).

### C.3 `latex/chapters/final/conclusion_generale.tex`

**C.3.1 --- Résultats chiffrés**

*Avant* : `La campagne de validation établit cinq résultats conformes, huit partiellement conformes et une non-conformité assumée ; six protocoles relèvent du plan de validation continue, dont la cadence et le premier passage sont datés. Quatorze protocoles sur vingt portent ainsi une preuve nommée.`

*Après* :
```latex
La campagne de validation établit sept résultats conformes, onze partiellement conformes et deux
non-conformités assumées ; les vingt protocoles portent une preuve nommée, et six d'entre eux
portent en outre une cadence de rejeu au plan de validation continue, dont le premier relevé est
daté. Trois de ces relevés ont été obtenus après la migration du réseau : un refus de sortie
réellement opposé et journalisé, un refus croisé entre locataires, et la non-conformité du composant
d'inférence, dont la sortie échappe encore au pare-feu.
```

**C.3.2 --- Problèmes rencontrés**

*Avant* : `Le contrôle dynamique des sorties réseau relève du plan de validation continue.`
*Après* : `Le contrôle dynamique des sorties réseau a été mesuré les 24 et 25/08/2026 : il refuse ce qu'il gouverne, et deux charges de travail lui échappent encore.`

**C.3.3 --- Apports**

*Avant* : `L'identité, les secrets et les données sont séparés par locataire ; le réseau privé, le connecteur et l'instance de base de données restent partagés.`
*Après* : `L'identité, les secrets, les données et désormais le réseau sont séparés par locataire, le refus croisé ayant été réellement opposé le 24/08/2026 ; l'instance de base de données, elle, reste partagée.`
*Raison* : cohérence avec la refonte appliquée et avec la non-application de l'isolation de la base. **Ce point relève aussi du périmètre « refonte réseau » : à concilier avec l'agent qui en a la charge.**

### C.4 `latex/frontmatter/resume.tex`

*Avant* : `Les limites principales sont l'absence de segmentation réseau entre locataires --- dont la levée est conçue et chiffrée ---, un motif de traversée de chemin encore partiellement filtré et l'absence de mesures complètes de coût et de qualité sémantique.`

*Après* :
```latex
Les limites principales sont la sortie réseau non gouvernée de deux charges de travail détachées du
sous-réseau, un motif de traversée de chemin encore partiellement filtré, le partage de l'instance
de base de données entre locataires et l'absence de mesures complètes de coût et de qualité
sémantique.
```

Ajouter, avant la dernière phrase, une phrase de résultat cohérente avec le nouveau bilan :
`Le 24/08/2026, une sortie réseau non autorisée et une connexion croisée entre locataires ont été
refusées et journalisées, les deux horodatages se recoupant.`

*Contrainte* : le résumé doit rester à ≈ 200 mots ; la phrase ajoutée compense celle qui est
raccourcie. **Toute modification ici doit être répercutée à l'identique dans l'abstract.**

### C.5 `latex/frontmatter/abstract.tex`

*Avant* : `The main limitations are the lack of per-tenant network segmentation --- for which a costed design is now on record ---, one partially filtered path traversal pattern, and incomplete cost and semantic quality measurements.`

*Après* :
```latex
The main limitations are the ungoverned network egress of two workloads detached from the subnet,
one partially filtered path traversal pattern, the database instance still shared across tenants,
and incomplete cost and semantic quality measurements.
```

Et la phrase de résultat correspondante :
`On 24 August 2026, an unauthorised outbound connection and a cross-tenant connection were both
refused and logged, with matching timestamps on either side.`

### C.6 `latex/appendices/annexe_d_conception_detaillee.tex`

**C.6.1 --- Décision D11 (l. ≈ 76--80)**

*Avant* : `... sa vérification dynamique (T14, T20) relevant du plan de validation continue.`
*Après* : `... sa vérification dynamique a été relevée : T20 est conforme depuis le 24/08/2026, le contrôle étant désormais porté par une règle de pare-feu et non plus par le seul paramètre de sortie de la plateforme d'exécution ; T14 est non conforme, le composant d'encodage ayant été retiré du sous-réseau et n'étant donc atteint par aucune règle.`

**C.6.2 --- Chapeau du tableau `tab:couverture-exigences` (l. ≈ 153--155)**

*Avant* : `... les protocoles dont le premier passage n'est pas encore intervenu sont inscrits au \textbf{plan de validation continue}, de fréquence trimestrielle, dont la première itération est programmée au quatrième trimestre 2026.`
*Après* : `... les protocoles dont la propriété se dégrade avec l'usage sont inscrits au \textbf{plan de validation continue}, avec la date de leur premier relevé et leur cadence de rejeu, dont la première itération est programmée au quatrième trimestre 2026.`

**C.6.3 --- Lignes du tableau `tab:couverture-exigences` relevant des six protocoles**

| Exigence | Avant | Après |
|---|---|---|
| EX12 | `Prévue ; T12 inscrit au plan de validation continue` | `Prévue ; T12 partiellement conforme (22/08/2026)` |
| EX14 | `Prévue ; T14 inscrit au plan de validation continue` | `**Ouverte** : T14 non conforme (25/08/2026), sortie managée non gouvernée` |
| EX15 | `Prévue ; T15 inscrit au plan de validation continue` | `Prévue ; T15 partiellement conforme (22/08/2026)` |
| EX17 | `Prévue ; T17 inscrit au plan de validation continue` | `Prévue ; T17 conforme (20/08/2026)` |
| EX19 | `Prévue ; T19 inscrit au plan de validation continue` | `Prévue ; T19 partiellement conforme (21/08/2026)` |
| EX20 | `Journalisation des refus déployée le 19/08/2026 ; T20 inscrit au plan de validation continue` | `Journalisation des refus déployée le 19/08/2026 ; T20 conforme (24/08/2026)` |

> **Écart préexistant signalé, hors de mon périmètre.** Ce même tableau porte six statuts qui
> contredisent déjà le chapitre 6 avant toute intervention de ma part : EX1 y est dit
> « T1 partiellement conforme » quand le chapitre 6 prononce **non conforme** ; EX4, EX6, EX8, EX10
> et EX13 y sont dits « inscrits au plan de validation continue » quand le chapitre 6 les prononce
> **partiellement conformes** et que le plan ne les a jamais portés. Le propriétaire du registre
> doit trancher : le tableau de synthèse du chapitre 6 fait foi.

### C.7 Autres renvois nommés --- balayage de cohérence

Le plan de validation continue est cité nommément par **seize renvois du chapitre 4** (3 dans
`ch4_conception.tex`, 13 dans son annexe `annexe_d_conception_detaillee.tex`). Il ne disparaît pas :
il change d'objet. Les renvois qui portent sur d'autres protocoles que mes six restent valides tels
quels. Les trois à reformuler :

| Fichier · ligne | Avant | Après |
|---|---|---|
| `ch4_conception.tex` ≈ 1624 | `Les contrôles dynamiques qui les établiraient en propre --- T4, T14, T20 --- relèvent du plan de validation continue, de fréquence trimestrielle, dont le premier passage est programmé au quatrième trimestre 2026.` | `Deux des contrôles dynamiques qui les établiraient en propre ont été relevés : T20 est conforme depuis le 24/08/2026, T14 non conforme depuis le 25/08/2026. Le troisième, T4, relève du plan de validation continue, dont la première itération est programmée au quatrième trimestre 2026.` |
| `ch5_realisation.tex` ≈ 100 | `son inspection exhaustive sous une identité non autorisée est l'objet du protocole T17, rattaché au plan de validation continue du chapitre~6.` | `son inspection sous une identité non autorisée a été tentée le 20/08/2026 et refusée quatre fois : c'est le protocole T17, conforme, rejoué à cadence semestrielle.` |
| `ch5_realisation.tex` ≈ 844 | `Le trajet complet d'un refus jusqu'à la détection est mesuré par le protocole T20, rattaché au plan de validation continue du chapitre~6 ; l'absence de chemin public direct vers le service d'encodage l'est par le protocole T14.` | `Le trajet complet d'un refus jusqu'au journal a été mesuré le 24/08/2026 par le protocole T20, conforme : le refus est opposé et retrouvé dans l'entrepôt, mais aucune règle de détection ne le qualifie. Le protocole T14, relevé le 25/08/2026, établit la conséquence de ce retrait : la sortie du service d'encodage n'est gouvernée par aucune règle, et il est non conforme.` |
| `ch5_realisation.tex` ≈ 1722 | `le test dynamique des sorties réseau relève du plan de validation continue` | `le test dynamique des sorties réseau a été relevé --- conforme pour les charges attachées au sous-réseau, non conforme pour les deux qui en ont été retirées` |

Renvois **à ne pas toucher**, parce qu'ils portent sur d'autres protocoles ou sur des mesures hors
de mon périmètre : `ch2_etat_art.tex` 415, 604, 936, 1006 ; `ch4_conception.tex` 738, 963 ;
`ch5_realisation.tex` 264, 460, 628 ; `annexe_b_extraits_realisation.tex` 212 ;
`annexe_c_modele_menaces.tex` 233 ; `annexe_h_captures.tex` 22 ; et, dans le chapitre 6, les renvois
au plan pour la mesure chronométrée de reconstruction (§6.4.2) et pour le basculement de zone
(§6.4.3).

---

## d) Les décomptes qui basculent

| Grandeur | Avant | Après | Occurrences à corriger |
|---|---|---|---|
| Protocoles **conformes** | 5 | **7** | ch6 bilan ; ch6 « cinq résultats seulement » ; ch6 §6.2.2 « Deux des cinq résultats conformes » ; ch6 conclusion de chapitre ; conclusion générale |
| Protocoles **partiellement conformes** | 8 | **11** | ch6 bilan ; ch6 « les huit résultats partiels » ; ch6 conclusion de chapitre ; conclusion générale |
| Protocoles **non conformes** | 1 | **2** | ch6 bilan ; ch6 encadré ; ch6 §6.2.1 titre ; ch6 conclusion de chapitre ; conclusion générale |
| Protocoles au résultat « **Planifié** » | 6 | **0** | ch6 bilan ; ch6 §6.1 convention ; légende de `tab:synthese-campagne` ; six lignes du tableau |
| « **Quatorze** protocoles sur vingt portent une preuve nommée » | 14 | **20** | ch6 bilan ; ch6 conclusion de chapitre ; conclusion générale (3 occurrences) |
| « **Six protocoles** rattachés au plan de validation continue » | six, **sans résultat** | six, **avec un relevé daté et une cadence de rejeu** | ch6 §6.2.3 ; `tab:plan-validation` ; annexe E §modèle de fiche ; annexe D chapeau du tableau |
| « premier **passage** » du plan | Q4 2026 | « premier **rejeu** », Q4 2026 | ch6 §6.2.3 ; annexe D ≈ 154 ; ch4 ≈ 1624 |
| Prérequis non levés du plan | 3 (T14, T19, T20) | **0** — levés les 19, 20 et 23/08/2026 | ch6 §6.2.3 ; ch6 §6.4.1 |
| « Preuves ponctuelles datées jusqu'au **23/08/2026** » | 23/08 | **25/08/2026** | ch6 §6.1 ; annexe E §conditions de mesure |
| Politiques d'alerte **jamais déclenchées volontairement** | 17 sur 17 | **14 sur 17** (A9, A10 et l'alerte de budget l'ont été) | ch6 §6.4.1 |
| Alerte de budget de facturation dans le code d'infrastructure | absente | **déclarée le 20/08/2026** | ch6 §6.4.1 ; ch6 `tab:plan-validation` (déclencheur de T19) |
| Statuts d'exigences EX12, EX14, EX15, EX17, EX19, EX20 | « inscrit au plan » | résultats datés (voir C.6.3) | `annexe_d` `tab:couverture-exigences` |
| Exigences **ouvertes** après campagne | EX1 | **EX1 et EX14** | ch6 §6.2.1 ; annexe D ; matrice de traçabilité du ch. 3 (à vérifier) |
| Scénarios de menace **rouverts** | SO1 | **SO1 et SO17** | ch6 §6.2.1 ; annexe C (à vérifier) |
| Débit plafond de l'enrichissement | non chiffré | **200 détections/heure**, capacité d'absorption 400 | nouvelle donnée, ch6 §6.3.3 et O5/O6 |
| Délai de notification d'une interruption de trafic | non chiffré | **36 min 19 s** | nouvelle donnée, ch6 §6.4.1 |
| Délai de notification d'un dépassement de budget | non chiffré | **entre 5 h 48 et 8 h 18** | nouvelle donnée, ch6 §6.4.1 |

**Décomptes explicitement inchangés**, vérifiés : vingt protocoles au total ; dix-sept politiques
d'alerte ; quatre objectifs de service ; deux sondes de disponibilité ; sept règles de détection ;
onze écarts recensés au chapitre 4 (leur recompte relève du propriétaire du registre des écarts, la
refonte réseau fermant É2 et É4) ; six objectifs mesurables du projet.

---

## e) Ce que ces résultats ne démontrent pas

**T12.** Le relevé ne démontre pas que le dispositif détecte une interruption de collecte : il
démontre qu'il détecte une interruption de **trafic**, et que ce sont deux pannes différentes. Il
ne dit rien du délai qu'aurait la notification si l'interruption survenait pendant une attaque, la
métrique surveillée étant précisément celle qu'une attaque ferait monter et non baisser. Il ne
mesure pas non plus l'exhaustivité de la perte au-delà de la fenêtre observée : 1 h 08 sans ligne
est un constat, non une borne du volume qu'une panne plus longue détruirait. Enfin il ne démontre
rien sur les trois autres acheminements de journaux, un seul ayant été coupé.

**T14.** Le relevé ne démontre pas que le composant émet effectivement des connexions sortantes : il
démontre qu'il le **pourrait**, la capacité étant établie sur une sonde partageant son identité et
son chemin réseau, non son binaire. Il ne démontre pas non plus que le correctif proposé serait sans
effet de bord : la réintégration au sous-réseau n'a pas été essayée, et son coût en adresses comme
sa dépendance à la disponibilité du sous-réseau restent des estimations. Il ne dit rien de
l'interface web de l'application hébergée, seconde charge de travail dans la même situation, qui n'a
pas été mise à l'épreuve.

**T15.** La mesure ne démontre pas la tenue de la chaîne sous une charge **réelle** : le trafic de
recette a été suspendu pour que les lots ne portent que les lignes injectées, et le débit plafond de
200 par heure est donc une borne supérieure que le flux nominal abaisse. Elle ne démontre pas la
tenue sous charge arrivant sur un service froid au pic : le démarrage à froid relevé est de 31 s,
contre un pic connu de 94 s. Elle ne dit rien de la qualité des rattachements produits sous charge,
seul leur nombre ayant été compté. Elle ne dit rien enfin du comportement au-delà de 500 détections,
ni de ce qui se passerait si plusieurs exécutions se chevauchaient.

**T17.** Les quatre refus ne démontrent pas la confidentialité de l'état : ils démontrent qu'à
l'instant du relevé, trois identités de service nommées n'y accèdent pas. Ils ne disent rien d'un
opérateur humain détenant un rôle étendu sur le projet, qui lit l'état sans opposition --- la
confidentialité repose sur le petit nombre de comptes humains, qu'aucun contrôle n'établit. Ils ne
disent rien de la persistance de la propriété, l'emplacement étant provisionné hors description en
code et échappant donc à la détection de dérive. Ils ne disent rien de l'intégrité ni de la
disponibilité de l'état : le versionnement de l'emplacement n'a jamais été éprouvé en reprise.

**T19.** Les deux notifications ne démontrent pas que le socle détecte une consommation anormale :
elles démontrent que la chaîne de notification d'un budget fonctionne, sur un budget ramené au
voisinage de la dépense courante pour rendre le dépassement provocable. Le délai mesuré est un
intervalle, non une valeur, et il n'est borné par rien. Le dispositif ne nomme pas le poste
responsable, et la ventilation citée a été reconstituée à la main après coup. Surtout, la mesure ne
démontre pas l'utilité du contrôle face au scénario de menace qu'il vise : un détournement de
ressources fonctionnerait plusieurs heures avant la première notification.

**T20.** Les trois refus ne démontrent pas que la sortie réseau du socle est maîtrisée. Ils
démontrent que, pour les charges de travail attachées à un sous-réseau, une tentative vers une
destination non autorisée est refusée et journalisée. Ils ne démontrent rien pour les deux charges
de travail à sortie managée --- T14 démontre l'inverse. Ils ne démontrent pas que la frontière
résiste à un opérateur capable de déployer, l'étiquette se posant dans la définition de la révision.
Ils ne démontrent pas qu'une sortie **réussie** serait vue : seuls les refus sont journalisés. Ils
ne démontrent pas que l'exfiltration par les interfaces du fournisseur est fermée --- l'autorisation
qui rend l'entrepôt joignable rend joignable tout entrepôt du même fournisseur. Ils ne démontrent
pas que la conception passe l'échelle : les refus croisés croissent comme le carré du nombre de
locataires, et la réponse terminale est un projet cloud par locataire. Enfin, un refus tracé n'est
pas un refus détecté : aucune des sept règles ne lit ces lignes.

---

## Arbitrages soumis au propriétaire du document

1. **Déclaration de l'alerte de budget de facturation (20/08/2026)** --- c'est la seule modification
   d'infrastructure que ces relevés supposent. Elle lève un prérequis que le mémoire identifiait
   déjà comme tel. Si le propriétaire préfère ne pas la retenir, T19 devient non conforme et la
   campagne compte trois non-conformités : le reste du document ne change pas, hormis le bilan.
2. **Seconde non-conformité (T14)** --- elle découle du fait, écrit au chapitre 5 et au brief de
   refonte, que le composant d'encodage a été retiré du sous-réseau. La rendre conforme exigerait de
   contredire cette description. La conserver oblige à élargir le récit centré sur T1 : c'est
   l'objet des points C.1.6 et C.1.7.
3. **Périmètre adjacent** --- plusieurs passages du chapitre 6 décrivent encore le réseau
   d'avant la refonte (note de ségrégation réseau à 1/10, connecteur unique comme point de
   défaillance, sortie limitée aux plages privées, sous-réseau public inutilisé, troisième seuil
   « segmenter le réseau »). Ils relèvent de l'intervention « refonte réseau » et non de la mienne ;
   ils sont signalés ici pour que les deux jeux de corrections ne se contredisent pas.
