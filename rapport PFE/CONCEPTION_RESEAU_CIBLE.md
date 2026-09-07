# Conception réseau cible — socle MENAL

**Statut : proposition d'architecture. Aucun fichier du dépôt n'est modifié.**
Document de conception destiné au chapitre 4 du mémoire. Établi le 29/08/2026 par
relecture croisée de `DOSSIER_TECHNIQUE_MENAL.md` (§2, §3, §5, §8, §11, §16-18) et du
code Terraform réel (`terraform/modules/vpc/`, `terraform/modules/cloud-sql/main.tf`,
`terraform/environments/staging/`). Chaque défaut listé dans la commande a été
recoupé ligne à ligne avec le code : **les onze sont confirmés**, aucune correction
du dossier n'a été nécessaire. Deux constats supplémentaires, absents du dossier,
sont apportés au §0.

---

## 0. Ce que la relecture du code ajoute au diagnostic

Avant de concevoir, trois faits que le dossier ne relève pas et qui commandent la cible.

### 0.1 Le `PRIVATE_RANGES_ONLY` rend le pare-feu structurellement muet

Les six charges rattachées au connecteur portent `egress = "PRIVATE_RANGES_ONLY"`
(`modules/cloud-run/main.tf:199`, `modules/dashboard/main.tf:133`,
`modules/app-service/main.tf:221`, `modules/ml-pipeline/main.tf:112`,
`elson.tf:138`). Ce réglage n'envoie dans le VPC **que** le trafic à destination des
plages RFC 1918. Tout le reste — appels aux API Google, appel du tableau de bord vers
l'équilibreur — sort par le chemin managé de Cloud Run, **hors du VPC, donc hors de
portée de toute règle de pare-feu**.

**Conséquence dimensionnante, à énoncer en soutenance :** poser aujourd'hui une règle
de refus par défaut en sortie ne bloquerait rien d'autre que ce qui est déjà
autorisé nommément (la base). Un canal de commande vers un hôte arbitraire sur
Internet **ne traverserait jamais la règle**. Le défaut n°3 n'est donc pas seulement
« il manque une règle » : c'est « il manque une règle *et* le trafic ne passe pas
là où elle s'appliquerait ». La cible doit corriger les deux, sans quoi le refus par
défaut est une déclaration sans effet.

C'est aussi l'explication du défaut n°4 : la passerelle de sortie ne sert à rien
aujourd'hui non pas seulement parce qu'elle est attachée au mauvais sous-réseau, mais
parce que **presque rien ne transite par le VPC**.

### 0.2 Deux charges sur sept n'ont aucun besoin du réseau privé

| Charge | Dépendance privée réelle | Preuve |
|---|---|---|
| `menal-ml-embed-staging` | **aucune** — aucun rôle BigQuery (ADR-0002, `iam/main.tf:183-196`), aucun accès base, seul `logging.logWriter` | rattachée au connecteur sans raison (`ml-pipeline/main.tf:110-112`) |
| `elson-web-staging` | **aucune** — « frontend Next.js standalone — **sans base ni secret** », URL API figée au build | commentaire d'origine, `elson.tf:261-263`, rattachée quand même (`:284` via le module) |

Les retirer du réseau privé réduit la surface, allège le plan d'adressage et n'a
aucun coût. C'est le geste le moins cher du dossier.

### 0.3 Elson porte des dépendances sortantes non-Google, aujourd'hui dormantes

`grep` sur `elson-main/backend/src/` : `api.openai.com` (`routes/media.ts:474`,
`routes/reviews.ts:42,51`, `services/ai-news.ts:79`), `huggingface.co`
(`services/ai-news.ts:62`), SMTP Zoho (`services/email.ts`, `config.ts:113-118`),
WAHA (`config.ts:122-125`). **Aucune n'est active en `staging`** : ni `OPENAI_API_KEY`,
ni `SMTP_USER`/`SMTP_PASS`, ni `WAHA_API_KEY` n'est passé par Terraform (`grep OPENAI\|SMTP`
sur `terraform/` = 0 occurrence hors binaires de provider), et le code se garde
(`if (!key) return`, `get enabled() { return !!(this.user && this.pass); }`).

**Elles sont donc latentes, pas absentes.** Le jour où l'opérateur pose la clé, un
refus par défaut en sortie coupe la fonctionnalité **sans message d'erreur réseau
lisible**. La cible doit nommer ce cas et prévoir sa procédure — c'est traité au §g
et au §i, étape 9.

---

## a) Principe directeur

> **Le réseau ne transporte que ce qu'une identité nommée a le droit d'émettre, vers
> une destination nommée : la plage d'adresses ne donne aucun droit, l'identité de la
> charge de travail est la seule cible des règles, et tout le reste est refusé et
> journalisé — en entrée comme en sortie.**

Ce principe est la traduction, dans le plan réseau, du principe d'identité du
mémoire. Il a une conséquence vérifiable qui sert de critère d'acceptation : **dans le
module cible, aucune règle d'autorisation ne comporte de plage source.** Une règle qui
autoriserait « 10.0.8.0/26 vers 10.0.8.64/26 » serait de la confiance de zone
(NIST SP 800-207 §2.1) ; une règle qui autorise « l'identité `sa-api` vers l'adresse
de la base, port 5432 » est une décision d'identité qui se trouve s'exprimer dans le
réseau.

---

## b) Plan d'adressage cible

### b.1 Contrainte préalable, non négociable : la plage d'accès privé aux services

`modules/cloud-sql/main.tf:3-10` réserve une plage `/16` **sans champ `address`** :
l'adresse de début est choisie par le fournisseur et n'est pas dans le code
(défaut n°9). Cette plage porte l'adresse privée de l'unique instance Cloud SQL.
**Elle ne peut pas être changée sans recréer l'appairage, donc sans perdre l'instance.**

La cible ne la touche donc pas. Elle fait deux choses :

1. **Pour l'environnement en service** : la plage est *lue* et documentée, jamais
   redéfinie. Le plan d'adressage cible est choisi de façon à ne pas pouvoir entrer en
   collision avec elle. Le raisonnement qui l'autorise est le suivant, et il est
   démontrable : le fournisseur n'alloue jamais une plage d'appairage qui recouvre un
   sous-réseau existant du même réseau virtuel. Or `10.0.1.0/24`, `10.0.2.0/24` et
   `10.0.3.0/28` existent depuis la création. **Aucun `/16` recouvrant `10.0.0.0/16`
   n'a donc pu être alloué.** Toute adresse prise dans `10.0.0.0/16`, hors des trois
   plages ci-dessus, est structurellement sûre. C'est pourquoi le plan cible reste dans
   `10.0.0.0/16`, et non dans un espace « propre » qui, lui, serait un pari.
2. **Pour toute reconstruction depuis zéro** : le module cible déclare `address` et
   `prefix_length` explicitement (`10.0.128.0/20`, cf. tableau), ce qui ferme le
   défaut n°9 pour l'avenir.

> **Étape 0 impérative avant tout `apply`** — relever la valeur réelle :
> `gcloud compute addresses list --global --filter="purpose=VPC_PEERING" --format="table(name,address,prefixLength)"`
> et la reporter dans le mémoire. Tant que cette valeur n'est pas écrite quelque part,
> le défaut n°9 reste ouvert même après cette conception.

### b.2 Le plan

Région unique `europe-west1` — le socle n'a aucune raison d'être multi-région, et
`routing_mode = "REGIONAL"` est déclaré explicitement (défaut n°10).

| Nom | Plage | Région | Rôle | Ce qui l'occupe | Justification du préfixe |
|---|---|---|---|---|---|
| `sn-menal-ew1` | `10.0.8.0/26` | europe-west1 | Interfaces de sortie des charges de la **plateforme MENAL** | `menal-api`, `menal-dashboard`, `menal-enrich-job` (interfaces de sortie réseau directe) | **/26 = 64 adresses, 60 utilisables.** Plafond d'instances déclaré : `menal-api` 3 + `dashboard` 2 + `enrich-job` 1 = **6**. Le fournisseur recommande de dimensionner large parce que les adresses ne sont pas rendues instantanément lors d'un cycle de montée/descente en charge ; **/26 est également le préfixe minimal recommandé pour la sortie réseau directe** (à confirmer, cf. §j-V3). 60 adresses pour 6 instances = **10× de marge** : la charge peut être multipliée par dix sans retoucher le plan. |
| `sn-elson-ew1` | `10.0.8.64/26` | europe-west1 | Interfaces de sortie des charges du **locataire ELSON** | `elson-api` + les deux tâches (`migrate`, `sql-isolation-check`) | Même préfixe minimal. Plafond réel : `elson-api` 1 + 2 tâches ponctuelles = **3**. Marge 20×. L'uniformité du préfixe est un choix assumé : un locataire ne doit pas hériter d'un plafond de croissance inférieur à un autre par accident de plan d'adressage. |
| `sn-t3-ew1` | `10.0.8.128/26` | europe-west1 | **Troisième locataire — plage réservée, sous-réseau créé vide** | rien, tant que le locataire n'existe pas | Un sous-réseau sans ressource ne coûte rien. Le créer d'avance transforme l'onboarding d'un locataire, côté réseau, en **une ligne de `tfvars`** au lieu d'une décision d'adressage prise dans l'urgence. C'est le seuil de bascule déclaré du projet : il doit être *déjà* adressé. |
| *(réserve)* | `10.0.8.192/26` | — | Quatrième locataire | — | Ferme proprement le bloc `10.0.8.0/24`. Au-delà, l'extension se fait sur `10.0.9.0/24` selon la même règle : **un `/24` = quatre locataires**. |
| `google-services-<env>` | *plage d'appairage existante, valeur à relever* — cible pour une reconstruction : `10.0.128.0/20` | réseau | Accès privé aux services : adresse privée de Cloud SQL | l'instance `menal-db-staging` | **/20 = 4096 adresses.** Le `/16` actuel est 16× surdimensionné pour une instance ; le fournisseur exige au minimum un `/24` pour l'accès privé aux services, un `/20` laisse la place à plusieurs instances (le modèle « bridge » du §17.5 prévoit une instance dédiée par locataire sous engagement contractuel) sans immobiliser un `/16` entier. Placé en `10.0.128.0/20`, il est **franchement séparé** du bloc des locataires : une erreur de plan ne peut pas les faire se chevaucher. |
| ~~`subnet-public-staging` `10.0.1.0/24`~~ | — | — | **supprimé** | rien, jamais | Défaut n°1. Aucune ressource ne peut y être créée : le socle n'a ni machine virtuelle ni cluster, et n'en aura pas. Un sous-réseau « public » n'a de sens que pour des ressources à adresse externe — il n'y en a aucune. |
| ~~`subnet-private-staging` `10.0.2.0/24`~~ | — | — | **supprimé** | rien ; sa sortie de module n'est consommée par aucun module | Défaut n°1. Remplacé par les sous-réseaux par locataire, qui, eux, portent réellement du trafic. |
| ~~plage du connecteur `10.0.3.0/28`~~ | — | — | **supprimée avec le connecteur** | — | Défaut n°8, cf. §c. |

**Total occupé : `10.0.8.0/24` + le bloc d'appairage.** Le reste de `10.0.0.0/16`
reste libre, ce qui laisse la place à une éventuelle seconde région ou à un
sous-réseau de services managés futurs sans redécoupage.

---

## c) Le connecteur d'accès sans serveur : suppression, et ce qu'elle coûte

### c.1 Ce que fait la sortie réseau directe

La sortie réseau directe (*Direct VPC egress*, disponible en version générale sur
Cloud Run) remplace le connecteur par des **interfaces réseau attachées directement aux
instances Cloud Run**, prenant leur adresse dans un sous-réseau que l'on choisit. En
Terraform, cela consiste à remplacer, dans le bloc `vpc_access` :

```hcl
vpc_access {
  connector = var.vpc_connector_id      # avant
  egress    = "PRIVATE_RANGES_ONLY"
}
```

par :

```hcl
vpc_access {
  network_interfaces {                  # apres
    network    = <reseau>
    subnetwork = <sous-reseau du locataire>
    tags       = ["sa-api"]             # etiquette = identite (cf. §d.2)
  }
  egress = "ALL_TRAFFIC"
}
```

### c.2 Les quatre gains, dans l'ordre d'importance pour le mémoire

1. **C'est ce qui rend le pare-feu applicable aux charges de travail.** C'est le gain
   principal, et il est architectural, pas économique. Aujourd'hui les charges n'ont
   pas d'adresse dans un sous-réseau : le pare-feu ne peut pas les désigner, ni comme
   cible ni comme source. Avec des interfaces dans un sous-réseau, **chaque instance
   Cloud Run devient une entité que la règle peut nommer**, et le refus par défaut en
   sortie (défaut n°3) devient exécutoire au lieu d'être déclaratif. Sans cette bascule,
   tout le §d resterait un vœu.
2. **Suppression du point de défaillance unique** (défaut n°8) : sept charges tous
   locataires confondus dépendent d'un seul objet dont la perte les coupe toutes
   simultanément. Après bascule, chaque instance porte sa propre interface ; il n'y a
   plus d'objet partagé à perdre.
3. **Suppression d'un coût fixe permanent.** Le connecteur est facturé comme les
   machines qui le composent : `min_instances = 2` de type `e2-micro`, en permanence,
   qu'il y ait du trafic ou non. Ordre de grandeur : `e2-micro` en `europe-west1`
   ≈ **6,5 €/mois**, soit **≈ 13 €/mois de plancher**, et jusqu'à **≈ 65 €/mois** si le
   connecteur monte à ses `max_instances = 10`. La sortie réseau directe **n'ajoute
   aucun coût** au-delà de Cloud Run lui-même. *(Ordres de grandeur, à recouper sur la
   facture — cf. §h et §j-V9. Le chiffre de 12 €/mois pour deux `e2-micro` est cohérent
   avec celui déjà retenu dans `DOSSIER_TECHNIQUE_MENAL.md §17.5`.)*
4. **La ségrégation par locataire devient gratuite.** Le §17.5 du dossier chiffrait la
   « phase 2 — bridge réseau » à *« ~12-15 €/mois par locataire »* précisément parce
   qu'elle supposait **un connecteur par locataire**. Avec la sortie réseau directe, un
   locataire de plus = **un sous-réseau de plus = 0 €**. La recommandation du dossier
   devient applicable à budget constant. C'est, de loin, le meilleur argument de cette
   conception.

### c.3 Le prix payé — il y en a un, et il faut le dire

| Prix | Nature | Comment il est maîtrisé |
|---|---|---|
| **Consommation d'adresses** | Chaque instance active consomme une adresse du sous-réseau. Le connecteur, lui, en consommait 16 en tout et pour tout. Une montée en charge inattendue peut épuiser un `/26`. | Marge de 10× et 20× (§b.2) ; **un sous-réseau par locataire**, donc l'épuisement chez un locataire ne peut pas affamer l'autre — ce que le connecteur unique ne garantissait pas. Alerte à poser sur l'utilisation du sous-réseau (§j-V10). |
| **Le démarrage à froid change de nature** | Le rattachement de l'interface réseau intervient au démarrage de l'instance. La latence de démarrage à froid peut varier. | À **mesurer** avant/après sur `menal-api` (`min_instances = 0`, donc le plus exposé) — protocole §j-V11. `ml-embed`, dont le p99 de démarrage mesuré est de ~94 s et le budget de sonde calibré dessus, **est retiré du réseau privé** (§0.2) : il n'est donc pas concerné. |
| **Une bascule par service, pas globale** | Il faut modifier six définitions Cloud Run. | Chaque bascule crée une nouvelle révision : si elle échoue, Cloud Run **continue de servir la révision précédente**. Le retour arrière est un redéploiement de révision, pas une reconstruction. |
| ~~Dépendance à une capacité de plateforme récente~~ | Le fournisseur `google` doit exposer `network_interfaces` dans `vpc_access`. | **Levé — vérifié le 29/08/2026** sur le fournisseur exactement épinglé par le dépôt (`hashicorp/google` **5.45.2**). `network_interfaces` est présent, sur `google_cloud_run_v2_service` **et** sur `google_cloud_run_v2_job`, avec les champs `network`, `subnetwork`, `tags`. Le module cible passe `terraform validate` contre ce fournisseur. **Le seul prérequis dur du plan est satisfait.** Détail du contrôle : §j-V1. |
| **Perte d'un objet observable** | Le connecteur était un objet unique dont on pouvait lire l'état. Les interfaces sont éphémères. | Compensé par les journaux de flux du sous-réseau, qui deviennent enfin porteurs de sens (défaut n°10 : ils sont aujourd'hui activés sur deux sous-réseaux vides, donc rigoureusement inutiles). |

---

## d) Table des règles de pare-feu cible

### d.1 Les identités en présence

Sept comptes de service existent (`iam/main.tf`, `dashboard/main.tf:3`,
`app-service/main.tf:17`, instancié en `sa-elson` par `elson.tf:55`). Cinq seulement
sont des charges rattachées au réseau ; après les retraits du §0.2, **quatre identités
seulement sont présentes dans le réseau cible** :

| Identité | Charge(s) | Locataire | Sous-réseau | Ce qu'elle doit joindre |
|---|---|---|---|---|
| `sa-api` | `menal-api-staging` | MENAL | `sn-menal-ew1` | Cloud SQL `:5432` ; API du fournisseur (Secret Manager, BigQuery, KMS, journalisation) |
| `sa-dashboard-staging` | `menal-dashboard-staging` | MENAL | `sn-menal-ew1` | **l'équilibreur public uniquement** (`API_URL`, `dashboard/main.tf:92-94`). Ni base, ni entrepôt : le secret est monté par la plateforme, hors du chemin réseau de la charge |
| `sa-enrich-job` | `menal-enrich-job-staging` | MENAL | `sn-menal-ew1` | BigQuery ; le service d'encodage `ml-embed` par son adresse `*.run.app` |
| `sa-elson` | `elson-api-staging`, tâches `migrate` et `sql-isolation-check` | ELSON | `sn-elson-ew1` | Cloud SQL `:5432` ; Secret Manager, Cloud Storage, journalisation |
| *(hors réseau)* `sa-ml-embed` | `menal-ml-embed-staging` | MENAL | — | rien (§0.2) |
| *(hors réseau)* `sa-elson` / `elson-web` | `elson-web-staging` | ELSON | — | rien (§0.2) |
| *(hors réseau)* `sa-pipeline` | requêtes planifiées BigQuery | — | — | n'est pas une charge Cloud Run : aucune présence réseau |

### d.2 Le point délicat, traité de front : `target_service_accounts` est-il applicable ?

Le mémoire gagnerait beaucoup à écrire ses règles en `target_service_accounts` /
`source_service_accounts` : c'est littéralement le principe d'identité inscrit dans le
pare-feu. **Deux faits doivent être distingués :**

- Le pare-feu du fournisseur **supporte** `target_service_accounts` et
  `source_service_accounts` — c'est une fonctionnalité documentée, historiquement
  destinée aux machines virtuelles et aux nœuds de cluster.
- **Ce qui n'est pas établi**, c'est que ce sélecteur *reconnaisse* les interfaces de
  sortie réseau directe de Cloud Run. La documentation de cette capacité mentionne les
  **étiquettes réseau** (`network_interfaces.tags`) comme mécanisme d'application des
  règles ; elle ne confirme pas le sélecteur par compte de service. **Affirmer le
  contraire sans l'avoir testé serait exactement le type d'erreur qu'un jury ne
  pardonne pas.**

**Un indice, qui n'est pas une preuve, va dans le sens du doute.** L'inspection du
schéma du fournisseur 5.45.2 (29/08/2026) montre que le bloc `network_interfaces`
n'expose que trois champs : `network`, `subnetwork` et **`tags`**. Il n'y a **pas** de
champ de compte de service à ce niveau — l'identité d'exécution est déclarée ailleurs,
dans `template.service_account`. Cela n'établit pas que `target_service_accounts` ne
fonctionne pas, mais cela montre que **le seul sélecteur que la plateforme met
explicitement à disposition de ces interfaces est l'étiquette**. C'est exactement le
genre de nuance qu'il faut apporter soi-même : on dit ce que l'on a vu, et on
n'extrapole pas.

**La conception ne parie donc pas.** Elle adopte la convention suivante, qui donne la
propriété recherchée dans les deux cas :

> **Convention d'identité : l'étiquette réseau d'une charge porte le nom du compte de
> service qui l'exécute, et rien d'autre. Une étiquette = une identité. Jamais
> d'étiquette partagée, jamais d'étiquette de rôle (`https-server`, `web`, `db`).**

L'étiquette et le compte de service sont posés **dans le même bloc Terraform**, ce qui
les rend mécaniquement solidaires : on ne peut pas changer l'un sans voir l'autre.
Une règle qui cible `sa-api` cible donc bien une identité, que le moteur la résolve par
étiquette ou par compte de service. Le module cible expose une variable
`use_service_account_targets` (par défaut `false`) qui bascule l'ensemble des règles
vers le sélecteur par compte de service **le jour où le protocole §j-V4 l'aura établi**.
La différence entre les deux formes est alors de deux lignes, pas d'une refonte.

*Ce que ce détour apporte au mémoire :* il montre que le principe d'identité n'est pas
un slogan appliqué de force, mais une contrainte **portée jusqu'au point où la
plateforme s'y oppose**, avec la limite nommée et son protocole de levée.

### d.3 Deux décisions structurantes avant la table

**Décision 1 — `egress = "ALL_TRAFFIC"` sur les charges qui portent de la donnée.**
Sans cela (cf. §0.1), le refus par défaut ne gouverne rien. Avec cela, **tout** le
trafic sortant de la charge traverse le sous-réseau, donc le pare-feu. C'est ce qui
transforme la règle n°9 du tableau ci-dessous d'une déclaration en un contrôle.

**Décision 2 — aucune règle d'autorisation en entrée. Aucune.** Le pare-feu est à
états : le trafic de retour d'une connexion sortante est admis sans règle. Or **rien,
dans le socle, n'initie de connexion vers une charge de travail par le réseau** : les
sondes d'état de l'équilibreur n'atteignent pas les charges par le VPC (groupes de
points de terminaison *serverless*), et l'entrée des services est gouvernée par
`ingress = INTERNAL_LOAD_BALANCER` et Cloud Armor. Le plan d'entrée cible est donc
**un refus général, journalisé, et rien d'autre**. Cela ferme d'un trait les défauts
n°2 et n°7 : `allow-internal`, `allow-https-ingress` et `allow-health-checks` ne sont
pas *remplacées*, elles sont **supprimées sans successeur**, et c'est démontrable.

### d.4 La table

Convention : `SQL_IP` = adresse privée de l'instance, lue par attribut Terraform
(`google_sql_database_instance.postgres.private_ip_address`) — jamais recopiée à la
main. `LB_IP` = `8.232.24.132` (`load-balancer/main.tf:19-22`). `GOOGLE_APIS` =
destination des API du fournisseur, cf. §e.

Journalisation : conforme à l'ADR-0007 déjà en vigueur dans le projet — **les refus
sont journalisés, les autorisations ne le sont pas**, pour ne pas payer un volume
d'ingestion sans valeur de détection. Chaque refus journalisé alimente le puits
`vpc_to_bq` existant (filtre `jsonPayload.disposition="DENIED"`,
`logging/main.tf:36-40`), donc **sans aucune modification du SIEM**.

#### Sortie (EGRESS)

| # | Nom | Prio | Cible (identité) | Destination | Ports | Action | Journal |
|---|---|---|---|---|---|---|---|
| **E1** | `egress-allow-sql-menal` | 1000 | `sa-api` | `SQL_IP/32` | tcp 5432 | ALLOW | non |
| **E2** | `egress-allow-sql-elson` | 1000 | `sa-elson` | `SQL_IP/32` | tcp 5432 | ALLOW | non |
| **E3** | `egress-deny-sql-others` | 1100 | `sa-dashboard-staging`, `sa-enrich-job` | `SQL_IP/32` | tous | **DENY** | **oui** |
| **E4** | `egress-allow-google-apis` | 1200 | `sa-api`, `sa-elson`, `sa-enrich-job` | `GOOGLE_APIS` (§e) | tcp 443 | ALLOW | non |
| **E5** | `egress-allow-lb-dashboard` | 1250 | `sa-dashboard-staging` | `LB_IP/32` | tcp 443 | ALLOW | non |
| **E6** | `egress-allow-mlembed-enrich` | 1300 | `sa-enrich-job` | plages publiques du fournisseur (§e.4) | tcp 443 | ALLOW | non |
| **E7** | `egress-deny-cross-tenant-menal-to-elson` | 1400 | `sa-api`, `sa-dashboard-staging`, `sa-enrich-job` | `10.0.8.64/26` | tous | **DENY** | **oui** |
| **E8** | `egress-deny-cross-tenant-elson-to-menal` | 1400 | `sa-elson` | `10.0.8.0/26` | tous | **DENY** | **oui** |
| **E9** | `egress-deny-all` | **65534** | *(aucune — tout le réseau)* | `0.0.0.0/0` | tous | **DENY** | **oui** |

#### Entrée (INGRESS)

| # | Nom | Prio | Cible (identité) | Source | Ports | Action | Journal |
|---|---|---|---|---|---|---|---|
| **I1** | `ingress-deny-cross-tenant-elson` | 1400 | `sa-elson` | `10.0.8.0/26` | tous | **DENY** | **oui** |
| **I2** | `ingress-deny-cross-tenant-menal` | 1400 | `sa-api`, `sa-dashboard-staging`, `sa-enrich-job` | `10.0.8.64/26` | tous | **DENY** | **oui** |
| **I3** | `ingress-deny-all` | **65534** | *(aucune — tout le réseau)* | `0.0.0.0/0` | tous | **DENY** | **oui** |

**Total : 12 règles, dont 6 autorisations, toutes ciblées sur une identité nommée et
un port nommé.** À comparer aux 4 règles actuelles, dont une (`allow-internal`) ouvre
65 535 ports TCP, 65 535 ports UDP et ICMP entre deux plages sans cible.

### d.5 Lecture des règles — ce qu'il faut savoir en défendre

- **E3, E7, E8, I1, I2 ne changent aucun verdict.** Le refus par défaut E9 les rendrait
  redondantes. **Elles existent pour produire un signal.** Sans elles, une tentative du
  tableau de bord vers la base, ou d'ELSON vers MENAL, serait refusée par E9 et
  journalisée comme un refus banal parmi d'autres. Avec elles, elle est journalisée
  **sous un nom de règle qui dit exactement ce qui s'est passé**, directement
  exploitable comme règle de détection de mouvement latéral dans le SIEM. C'est un
  choix de conception, à énoncer comme tel : *le pare-feu n'est pas seulement un
  organe de blocage, c'est une source de journal nommée.*
- **E5 est la règle la plus parlante du tableau.** Le tableau de bord n'a le droit de
  joindre **qu'une seule adresse IP au monde**, sur un seul port : l'équilibreur par
  lequel il interroge l'API. Il n'a de droit ni sur la base, ni sur l'entrepôt — alors
  même que `sa-dashboard-staging` détient encore, côté IAM, des rôles BigQuery morts
  (§11.2 du dossier). **Le réseau referme ici un écart que l'IAM laisse ouvert** :
  c'est la définition même de la défense en profondeur, et c'est démontrable en une
  commande (§j-V6).
- **E1 et E2 sont les seules règles à `/32` vers la base**, sur le seul port 5432. La
  plage d'appairage entière — un `/16` — n'est jamais autorisée. Un service futur
  ajouté à cette plage ne serait donc pas joignable par accident.
- **La granularité du pare-feu est bornée par celle des identités.** `elson-api` et les
  deux tâches ELSON partagent `sa-elson` : le pare-feu ne peut pas les distinguer.
  Pour aller plus loin, il faudrait **créer des comptes de service distincts** — ce qui
  est la démonstration la plus nette du principe : *améliorer le réseau passe par
  améliorer les identités, pas par ajouter des zones.*

---

## e) Accès aux API du fournisseur — et la mort de la passerelle de sortie

### e.1 Ce que chaque charge doit réellement joindre

| Charge | Points de terminaison requis | Preuve |
|---|---|---|
| `menal-api` | Secret Manager (mot de passe base récupéré **au runtime** par appel applicatif), BigQuery (lecture SIEM + écriture `analyst_verdicts`), Cloud KMS, journalisation | `api/app/config.py:5-9,34-39` ; §11.2 du dossier |
| `menal-dashboard` | **aucun** — le secret est monté par la plateforme (`secret_key_ref`), l'API est jointe par l'équilibreur public | `dashboard/main.tf:92-102` |
| `menal-enrich-job` | BigQuery, journalisation, **et `ml-embed` par son adresse `*.run.app`** | `ml-pipeline/main.tf:178-185` |
| `elson-api` | Secret Manager (4 secrets), Cloud Storage (média), journalisation | `app-service/main.tf:86-129,156-161` |
| `menal-ml-embed` | journalisation seule → **retiré du réseau** | `iam/main.tf:183-196` |

**Aucune charge n'a besoin d'un point de terminaison non-Google en `staging` aujourd'hui**
(§0.3 : les dépendances OpenAI / SMTP / HuggingFace d'ELSON sont dormantes, faute de clés).

### e.2 Le mécanisme retenu : accès privé aux services Google

L'accès privé (`private_ip_google_access = true` sur le sous-réseau) permet à une
interface **sans adresse externe** de joindre les points de terminaison du fournisseur
en empruntant la route par défaut vers la passerelle Internet — **sans passerelle de
traduction d'adresses**. C'est précisément la situation des interfaces de sortie
réseau directe : elles n'ont pas d'adresse externe.

**Deux variantes, à déployer dans cet ordre.**

**Variante B1 — plages publiques du fournisseur (retenue en premier, sans prérequis).**
Destination = les plages publiques du fournisseur, obtenues par source de données
Terraform (`data "google_netblock_ip_ranges"`) plutôt que recopiées. Aucun changement
de résolution de noms n'est nécessaire : `bigquery.googleapis.com` continue de
résoudre normalement. **Ce que cela bloque déjà :** toute destination hors du
fournisseur, c'est-à-dire **tout serveur de commande ou d'exfiltration** — l'objectif
même du défaut n°5. **Ce que cela n'atteint pas :** la destination reste large
(plusieurs dizaines de préfixes).
*Contrainte à surveiller :* une règle accepte au plus **256 plages de destination** —
le nombre de préfixes retournés doit être compté avant l'`apply` (§j-V5).

**Variante B2 — point de terminaison privé `199.36.153.8/30` (cible, sous vérification).**
La destination se réduit alors à **un `/30`**, ce qui est le résultat idéal. Elle exige :
1. une route statique `199.36.153.8/30` → passerelle Internet par défaut (gratuite) ;
2. une zone privée Cloud DNS pour `googleapis.com` (≈ 0,20 $/mois) redirigeant
   `*.googleapis.com` vers ce point de terminaison ;
3. **que la charge Cloud Run utilise bien la résolution de noms du réseau virtuel.**

**Le point 3 est le seul verrou, et il n'est pas établi.** Avec l'ancien connecteur,
la résolution de noms se faisait dans l'environnement d'exécution de Cloud Run, non
dans le VPC — les zones privées n'étaient pas vues. La sortie réseau directe change
possiblement cette propriété. **À vérifier avant tout déploiement de B2**, protocole
§j-V7. Tant que ce n'est pas vérifié, B1 tient, et B1 apporte déjà l'essentiel.

> On n'écrit pas dans le mémoire « le trafic sortant est restreint à un `/30` » avant
> d'avoir exécuté V7. On écrit « le trafic sortant est restreint aux plages du
> fournisseur, avec un resserrement à un `/30` conditionné à la vérification V7 ».

### e.3 La question directe : la passerelle de sortie devient-elle inutile ?

**Oui — et c'est le résultat le plus fort de cette conception, parce qu'il ferme d'un
seul geste les défauts n°4, n°5 et n°6 et supprime un coût.**

Le raisonnement, en trois pas :

1. Les interfaces de sortie réseau directe n'ont pas d'adresse externe. Sans accès
   privé ni traduction d'adresses, elles ne joignent rien hors du réseau.
2. L'accès privé leur donne les points de terminaison du fournisseur — c'est-à-dire
   **la totalité** de ce dont les charges ont besoin (§e.1).
3. Le refus par défaut E9 interdit toute autre destination. **Donc il ne reste aucun
   trafic qu'une passerelle de traduction pourrait avoir à traiter.** Elle n'est pas
   « mal configurée » : elle est **sans objet**.

Les trois défauts tombent ensemble : n°4 (attachement au mauvais sous-réseau), n°5
(journalisation `ERRORS_ONLY` aveugle aux connexions réussies) et n°6 (pas d'adresse
de sortie stable) **cessent d'exister avec l'objet qui les portait**.

**La preuve empirique qu'il faut donner en soutenance, et qui existe déjà.** Aujourd'hui
la tâche d'enrichissement joint `ml-embed` en `*.run.app` **par le connecteur, dont la
plage n'est pas desservie par la passerelle** (le dossier le relève lui-même, §2.1) —
et elle fonctionne. Cela démontre que ce chemin ne passe pas par la traduction
d'adresses. La cible ne fait donc pas un pari : elle **rend explicite et déclaré
(`private_ip_google_access = true` sur un sous-réseau que l'on possède) un chemin qui
est aujourd'hui présumé et non attesté**. C'est un renforcement de la preuve, pas une
prise de risque.

**Ce qui reste néanmoins à vérifier en exécution — sans complaisance :**

| Réf. | À établir | Pourquoi le doute est légitime |
|---|---|---|
| §j-V7 | Résolution de noms dans le VPC (verrou de B2) | Comportement différent entre connecteur et sortie directe, non documenté de façon univoque |
| §j-V8 | L'accès privé couvre bien `*.run.app` (flux E6) | `run.app` n'est pas un point de terminaison `googleapis.com` ; la preuve empirique du §e.3 est forte mais indirecte |
| §j-V2 | Une charge en sortie directe est bien vue comme « interne » par un service en `INGRESS_TRAFFIC_INTERNAL_ONLY` | `ml-embed` est en entrée strictement interne ; si la sortie directe n'était pas comptée comme interne, la tâche d'enrichissement recevrait 404 |
| §j-V5 | Nombre de préfixes retournés < 256 (variante B1) | Limite dure d'une règle de pare-feu |

**Filet de sécurité, à garder écrit :** si V8 échoue, on ne réintroduit pas une
passerelle « au cas où ». On rétablit une passerelle **rattachée au bon sous-réseau
(`sn-menal-ew1`), en `nat_ip_allocate_option = MANUAL_ONLY` avec une adresse réservée,
et `log_config.filter = "ALL"`** — ce qui corrige n°4, n°5 et n°6 au lieu de les
reconduire, pour un coût de l'ordre de **5 à 15 €/mois**. Le solde global reste
favorable (§h).

### e.4 Le cas particulier de la tâche d'enrichissement

C'est le seul flux dont la destination ne se laisse pas resserrer : `*.run.app` n'est
pas adressable par un préfixe stable. Trois options ont été pesées :

| Option | Description | Retenue ? |
|---|---|---|
| **A** | Conserver `ml-embed` en entrée strictement interne, et autoriser E6 vers les plages du fournisseur **pour la seule identité `sa-enrich-job`** | **Oui.** La destination est large, mais la règle **ne s'applique qu'à une identité, pour un usage, et elle est nommée**. La défense en profondeur (entrée interne) est conservée. |
| **B** | Ouvrir `ml-embed` en entrée publique, protégé par la seule autorisation d'invocation IAM (déjà en place, restreinte à `sa-enrich-job`) ; la tâche n'a alors plus besoin du réseau du tout | Non. Cohérente avec le principe d'identité, et elle supprimerait E6 — mais elle retire une couche sans nécessité, et contredit l'affirmation du mémoire « service d'encodage, sans sortie réseau ». **À citer comme alternative pesée**, pas comme choix. |
| **C** | Passer par un point de terminaison privé de service | Non : demande une infrastructure d'attachement de service qui n'existe pas et qu'un mono-opérateur n'entretiendra pas. |

**Formulation honnête pour le mémoire :** *« un flux sur six ne peut pas voir sa
destination resserrée, parce que la plateforme n'expose pas d'adresse stable pour ce
type de point de terminaison ; le contrôle y est reporté sur l'identité émettrice, qui
est unique, et sur l'autorisation d'invocation qui, elle, est nominative. »*

---

## f) Ségrégation entre les deux locataires

### f.1 Ce qui est obtenu

| Plan | Avant | Après | Mécanisme |
|---|---|---|---|
| **Adressage** | Une seule plage de connecteur partagée par sept charges | Un sous-réseau par locataire, disjoint | `sn-menal-ew1` / `sn-elson-ew1` |
| **Chemin de sortie** | Un connecteur unique, mutualisé | Interfaces distinctes, dans des sous-réseaux distincts | Sortie réseau directe |
| **Pare-feu** | `allow-internal` : tout TCP/UDP/ICMP, sans cible | Refus par défaut + 4 règles de refus croisé nommées et journalisées | E7, E8, I1, I2 |
| **Détection** | Aucun signal possible : le trafic inter-locataire ne traverse aucun point de contrôle | Toute tentative croisée produit une ligne dans `raw_logs` avec le nom de la règle | Puits `vpc_to_bq` existant, aucune modification |
| **Épuisement d'adresses** | Un locataire pouvait saturer le connecteur commun | Cloisonné par sous-réseau | Plan d'adressage |
| **Troisième locataire** | Décision d'adressage à improviser | Plage déjà réservée, une ligne de `tfvars` | `sn-t3-ew1` |

### f.2 Le prix

**Coût financier : zéro.** Sous-réseaux et règles de pare-feu classiques ne sont pas
facturés. C'est le renversement complet de l'hypothèse du §17.5 du dossier, qui
chiffrait la ségrégation réseau à 12-15 €/mois par locataire faute d'avoir envisagé la
sortie réseau directe.

**Coût de complexité : faible mais réel.** Le module passe de 4 règles à 12, et de 2
sous-réseaux à 3 (+1 réservé). Le nombre de règles croît **linéairement** avec le nombre
de locataires (2 refus croisés par paire de locataires en sortie, 2 en entrée) : à
quatre locataires, cela ferait 12 règles de refus croisé. **Ce n'est pas tenable
au-delà de trois** — le module cible génère ces règles par boucle (`for_each`), ce qui
maîtrise l'écriture, mais au-delà de trois locataires la bonne réponse n'est plus des
règles croisées, c'est **une politique de pare-feu réseau avec des règles par
locataire** ou, plus haut, la séparation par projet. À nommer comme borne de validité
de la conception.

**Coût opérationnel : une convention à tenir.** Toute nouvelle charge doit recevoir son
étiquette = son compte de service et son sous-réseau de locataire. Une charge déployée
sans étiquette **n'est couverte par aucune autorisation, donc coupée par E9** :
l'erreur est bruyante et immédiate, pas silencieuse. C'est le bon sens de la panne.

### f.3 Ce que la ségrégation réseau **ne** donne **pas**

Elle ne touche **ni la base, ni le SIEM**. Les deux locataires restent sur **une seule
instance Cloud SQL** (`SQL_IP` est la même dans E1 et E2) et **un seul jeu de tables
BigQuery**. Le pare-feu autorise `sa-api` et `sa-elson` à joindre **la même adresse**.
L'étanchéité entre `menal_db` et `elson_db` reste ce qu'elle est : des `REVOKE`
appliqués au runtime, hors Terraform, réversibles par une restauration
(écart M19 du dossier). **La ségrégation réseau ne corrige rien de cela et il ne faut
surtout pas laisser croire l'inverse en soutenance.**

Formulation juste : *« la ségrégation réseau empêche un locataire d'atteindre les
charges de l'autre ; elle ne l'empêche pas d'atteindre le serveur de base de données
que les deux partagent. Le contrôle y est, et reste, au niveau du moteur de base. »*

---

## g) Ce que la cible ne couvre pas

1. **Le partage de l'instance Cloud SQL et du jeu de données BigQuery** — cf. §f.3.
   C'est le plan de la donnée ; il relève des travaux #1 à #4 du §17.4 du dossier, pas
   du réseau.
2. **Le défaut n°9 n'est fermé qu'à moitié.** La plage d'appairage existante ne peut
   pas être redéfinie sans détruire l'instance. La cible la documente et l'évite ; elle
   ne la corrige que pour une reconstruction depuis zéro.
3. **Le trafic entre une charge et les points de terminaison du fournisseur n'est pas
   inspecté.** Il est autorisé ou refusé par destination et par identité, jamais lu.
   Une exfiltration **vers un jeu de données BigQuery contrôlé par l'attaquant** dans
   un autre projet passerait E4 : la destination est légitime, seul le contenu ne l'est
   pas. **Le contrôle qui répond à cela s'appelle VPC Service Controls, et il exige une
   organisation Google Cloud — absente, et hors d'atteinte.** C'est la limite la plus
   sérieuse de la conception et elle doit être annoncée par l'auteur, pas découverte
   par le jury.
4. **Les dépendances sortantes dormantes d'ELSON** (§0.3). Le jour où une clé OpenAI ou
   des identifiants SMTP sont posés, E9 coupe la fonctionnalité. La procédure est
   écrite (§i, étape 9) mais **elle n'est pas automatique** : c'est un piège d'exploitation
   qui doit figurer dans le runbook.
5. **Aucun contrôle applicatif de la sortie.** Ni mandataire filtrant, ni inspection
   TLS. C'est un choix contraint : un mono-opérateur n'entretient pas un tel composant,
   et la contrainte a été posée comme disqualifiante.
6. **Les règles de pare-feu par nom de domaine, par géographie ou par renseignement sur
   les menaces ne sont pas utilisées.** Elles exigent une politique de pare-feu réseau
   de niveau supérieur, **facturée à la règle et au volume traité** : incompatible avec
   la contrainte de quelques dizaines d'euros par mois. La conception s'en tient
   volontairement aux règles de pare-feu classiques, **gratuites**.
7. **Le trafic intra-VPC reste en clair.** La cible ne restaure pas
   l'authentification mutuelle. L'écart H14 (ELSON ne vérifie pas le certificat serveur
   de Cloud SQL) **n'est pas corrigé par le réseau** — il est seulement rendu moins
   exploitable, puisque `allow-internal` disparaît et qu'aucune charge d'un locataire
   ne peut plus se placer sur le chemin de l'autre. **La correction reste applicative**
   (monter la CA de l'instance, `rejectUnauthorized: true`).
8. **La cible ne dit rien du DNS public** (hors Terraform, hors GCP — écart de
   gouvernance du §3.6), ni de l'équilibreur, ni de Cloud Armor : le périmètre s'arrête
   au réseau virtuel.
9. **Un seul projet.** Un opérateur disposant de `roles/owner` traverse toutes les
   frontières décrites ici d'un seul geste. C'est la conclusion déjà écrite au §17.5 du
   dossier et cette conception ne la change pas.

---

## h) Impact sur le coût mensuel

**Avertissement de méthode : tous les chiffres ci-dessous sont des ordres de grandeur
de tarification publique, présentés comme tels. Aucun n'est une mesure de facture.**
Le protocole §j-V9 indique comment les remplacer par des montants réels. Les écarts
sont donnés en euros par mois, arrondis.

| Poste | Existant | Cible | Écart | Base du calcul |
|---|---|---|---|---|
| Connecteur d'accès sans serveur | **≈ 13 €** au plancher (2 × `e2-micro` en permanence), **jusqu'à ≈ 65 €** à `max_instances = 10` | **0 €** | **−13 € garanti, −65 € au pire cas évité** | `e2-micro` `europe-west1` ≈ 6,5 €/mois. Cohérent avec le §17.5 du dossier (« un connecteur ≈ 2×e2-micro ≈ 12 €/mois ») |
| Sortie réseau directe | — | **0 €** | 0 | Aucun supplément au-delà de Cloud Run |
| Passerelle de traduction d'adresses + routeur | quelques € (peu ou pas de trafic la traverse aujourd'hui) | **0 €** (supprimée) — **ou 5 à 15 €** si le filet du §e.3 doit être posé | **−3 € à 0 €**, ou **+5 à +15 €** dans le cas dégradé | Passerelle facturée à l'instance-heure + au volume traité ; adresse externe réservée et utilisée ≈ 3,5 €/mois |
| Sous-réseaux (3 + 1 réservé) | 0 € | **0 €** | 0 | Non facturés |
| Règles de pare-feu classiques (4 → 12) | 0 € | **0 €** | 0 | Non facturées. *(Une politique de pare-feu réseau avec objets de domaine/géo serait, elle, facturée à la règle : écartée pour cette raison, §g-6.)* |
| Journaux de flux | **0 €** — activés sur deux sous-réseaux **vides**, donc aucun journal produit | **quelques centaines de Mo/mois** → **≈ 0,5 à 2 €** | **+0,5 à +2 €** | Ingestion de journaux, ordre de grandeur 0,50 $/Gio. Maîtrisé par `flow_sampling = 0.1` et `metadata = EXCLUDE_ALL_METADATA` en régime permanent (0,5 et métadonnées complètes pendant les phases d'observation du §i) |
| Journalisation des refus de pare-feu | déjà en place (une règle) | **9 règles journalisées**, mais volume identique : **on ne journalise que ce qui est refusé, et en régime nominal rien ne l'est** | ≈ 0 € | Le volume suit les refus, pas les règles |
| Zone DNS privée (variante B2 seule) | — | **≈ 0,20 €** | +0,20 € | 0,20 $/zone/mois + requêtes |
| **Solde** | | | **≈ −11 à −13 €/mois** en cas nominal ; **≈ +2 à +4 €/mois** dans le pire cas (filet du §e.3 posé) | |

**Trois éléments à retenir pour le mémoire :**

- **La cible est moins chère que l'existant en régime nominal**, de l'ordre de
  **11 à 13 €/mois** — sur un budget de quelques dizaines d'euros, c'est une part
  significative, pas une décimale.
- **Le coût évité le plus important n'est pas dans le tableau** : c'est celui de la
  montée en charge du connecteur, jusqu'à ~65 €/mois, qui **disparaît en tant que
  risque**, pas seulement en tant que ligne.
- **Le coût marginal d'un locataire supplémentaire passe de ≈ 12-15 €/mois à 0 €.**
  C'est la conséquence la plus structurante : la ségrégation réseau, présentée comme un
  arbitrage coût/sécurité au §17.5 du dossier, **cesse d'en être un**.

---

## i) Plan de migration

Principe qui commande l'ordre : **on n'interdit jamais avant d'avoir observé, et on
n'observe qu'après avoir fait passer le trafic par l'endroit où on l'observe.** Poser
E9 avant les étapes 5 à 7 couperait tout.

| # | Étape | Risque de coupure | Maîtrise |
|---|---|---|---|
| **0** | **Relever et figer les invariants** : plage d'appairage réelle (`gcloud compute addresses list --global`), adresse privée de l'instance, disponibilité de la sortie réseau directe dans la région. *(V1 — le schéma du fournisseur — est **déjà passé**, cf. §j.1.)* | **Nul** — lecture seule | Aucune écriture. Le seul prérequis bloquant restant est la disponibilité de la capacité dans `europe-west1`, à confirmer par un déploiement d'essai jetable |
| **1** | **Créer les trois sous-réseaux** (`sn-menal-ew1`, `sn-elson-ew1`, `sn-t3-ew1`) avec accès privé activé et journaux de flux à 0,5. Ne rien supprimer. | **Nul** — ajout pur, aucune ressource ne les référence | Vérifier l'absence de chevauchement avec la valeur relevée à l'étape 0 **avant** l'`apply` |
| **2** | **Basculer une charge en sortie réseau directe, en gardant `PRIVATE_RANGES_ONLY`** : commencer par `menal-enrich-job` (tâche planifiée, pas de trafic utilisateur, échec visible et sans impact client) | **Faible** | Une tâche ; en cas d'échec l'exécution suivante repart sur la définition d'avant. Contrôler une exécution complète avant de continuer |
| **3** | **Basculer les autres, une par une, dans cet ordre** : `elson-api`, `menal-dashboard`, `menal-api` (le plus exposé en dernier) | **Faible par service** | Chaque bascule crée une révision : **Cloud Run continue de servir la précédente si la nouvelle ne démarre pas**. Retour arrière = redéploiement de la révision précédente. Contrôler `/health` et une transaction réelle entre chaque |
| **4** | **Détacher `ml-embed` et `elson-web` du réseau** (§0.2) | **Faible** | Vérifier avant : `ml-embed` n'a aucun rôle base/entrepôt (établi), `elson-web` n'a « ni base ni secret » (commentaire d'origine). Contrôler que la tâche d'enrichissement joint toujours `ml-embed` (§j-V2) |
| **5** | **Supprimer le connecteur** — seulement une fois que plus aucune ressource ne le référence | **Moyen si l'étape est anticipée** | `terraform plan` doit montrer **une seule** destruction. Un `grep vpc_connector_id` sur `terraform/` doit ne renvoyer que la déclaration. **C'est ici que les 13 €/mois sont réellement économisés** |
| **6** | **Observer sept jours.** Journaux de flux à 0,5 sur les deux sous-réseaux actifs ; **passer la journalisation de la passerelle en `ALL`** (elle ne coûte rien puisqu'elle ne traite rien) ; construire depuis BigQuery l'inventaire des destinations réellement jointes | **Nul** | C'est l'étape qui **remplace le pari par la mesure**. Elle produit deux preuves : la liste exhaustive des destinations à autoriser, et la démonstration que la passerelle ne traite aucun trafic — ce qui **justifie sa suppression à l'étape 11** |
| **7** | **Poser les règles d'autorisation E1 à E6** — sans aucune règle de refus | **Nul** | Une autorisation n'a aucun effet tant que l'autorisation implicite de sortie existe. Étape sans risque, mais indispensable **avant** l'étape 9 |
| **8** | **Basculer les charges porteuses de donnée en `ALL_TRAFFIC`** (`menal-api`, `elson-api`, `enrich-job`, `dashboard`), une par une | **Moyen** — c'est ici que le trafic change de chemin | Après chaque bascule : contrôler le fonctionnement **et** relire les journaux de flux pour vérifier qu'aucune destination inconnue n'apparaît. Retour arrière = repasser à `PRIVATE_RANGES_ONLY` (une ligne) |
| **9** | **Poser les refus nommés E3, E7, E8, I1, I2** | **Faible** | Ils ne devraient rien refuser. **Si un refus apparaît dans les journaux, c'est un flux légitime non inventorié : le corriger avant l'étape 10.** C'est le dernier filet avant le refus par défaut |
| **10** | **Poser E9, le refus par défaut en sortie** | **ÉLEVÉ — c'est la seule étape réellement dangereuse du plan** | (a) hors heures ouvrées ; (b) commande de retour arrière préparée et testée à blanc (`terraform destroy -target=...` sur la seule règle, ou suppression `gcloud`) ; (c) contrôles de disponibilité et alertes armés ; (d) **délai d'observation de 30 minutes minimum** avant de déclarer l'étape réussie ; (e) rejouer la suite E2E. **Le risque résiduel est celui des flux qui ne surviennent pas dans la fenêtre d'observation de l'étape 6** — typiquement une tâche mensuelle ou un chemin d'erreur. C'est la raison d'être de l'étape 9 |
| **11** | **Supprimer la passerelle, le routeur, les deux anciens sous-réseaux et les trois règles mortes** (`allow-internal`, `allow-https-ingress`, `allow-health-checks`) | **Faible** | La suppression de la passerelle est **justifiée par la mesure de l'étape 6**, pas par une hypothèse. Les trois règles ciblent une étiquette que rien ne porte : `gcloud compute instances list` = vide le confirme en une commande |
| **12** | **Régime permanent** : journaux de flux à 0,1, `EXCLUDE_ALL_METADATA` ; contrôler la facture du mois suivant | **Nul** | Ferme la ligne de coût du §h |

**Durée réaliste pour un mono-opérateur : 3 à 4 jours d'intervention étalés sur 2
semaines**, dont sept jours d'observation passive à l'étape 6. Comparable à l'estimation
« phase 2 — bridge réseau ≈ 5 jours » du §17.5 du dossier, **mais sans le prérequis
organisationnel** que celui-ci supposait.

---

## j) Protocole de vérification

Une propriété par ligne ; une commande qui l'établit. Aucune ligne du §a au §i ne doit
entrer dans le mémoire comme un fait avant que sa vérification soit passée.

### j.1 Prérequis — à exécuter avant d'écrire une ligne de code

| Réf. | Propriété à établir | Commande |
|---|---|---|
| **V1** | Le fournisseur Terraform épinglé expose `network_interfaces` dans `vpc_access` | `terraform providers schema -json \| jq '.provider_schemas["registry.terraform.io/hashicorp/google"].resource_schemas.google_cloud_run_v2_service.block.block_types.template.block.block_types.vpc_access.block.block_types \| keys'` — doit contenir `network_interfaces`. **✅ PASSÉ le 29/08/2026** sur `hashicorp/google` **5.45.2** — la version exacte verrouillée par le dépôt. Présent sur le service **et** sur la tâche, champs `network` / `subnetwork` / `tags`. Le module `terraform_cible_vpc.tf` passe par ailleurs `terraform validate` contre ce même fournisseur. |
| **V3** | Préfixe minimal recommandé pour la sortie réseau directe, et règle de dimensionnement en adresses | `gcloud run deploy --help \| grep -A5 network` et la documentation de la capacité. **À confirmer avant de figer les `/26` du §b.2.** |
| **V5** | Le nombre de préfixes de la variante B1 tient sous la limite de 256 destinations | `terraform console` → `length(data.google_netblock_ip_ranges.google.cidr_blocks_ipv4)` |

### j.2 Après la bascule — propriétés fonctionnelles

| Réf. | Propriété | Commande |
|---|---|---|
| **V2** | Une charge en sortie réseau directe est vue comme « interne » par un service en entrée strictement interne | Déclencher la tâche : `gcloud run jobs execute menal-enrich-job-staging --region europe-west1 --wait` puis `gcloud logging read 'resource.labels.job_name="menal-enrich-job-staging"' --limit 50` — **aucun 403/404 sur l'appel à `ml-embed`** |
| **V7** | La charge utilise la résolution de noms du réseau virtuel (**verrou de la variante B2**) | Créer une zone privée de test, y placer un enregistrement témoin, puis depuis une tâche éphémère en sortie directe : `getent hosts <nom-temoin>` — doit renvoyer l'adresse de la zone. **Tant que ce test n'est pas passé, la variante B2 ne se déploie pas.** |
| **V8** | L'accès privé couvre bien les points de terminaison `*.run.app` (flux E6) | Étape 6 du §i : `SELECT DISTINCT ...` sur les journaux de flux → vérifier que le flux `sa-enrich-job` → `ml-embed` apparaît **accepté**, sans aucun passage par la passerelle (journalisation de celle-ci en `ALL` sur la même fenêtre) |

### j.3 Propriétés de sécurité revendiquées

| Réf. | Propriété revendiquée | Commande qui l'établit |
|---|---|---|
| **V4** | Le sélecteur par compte de service s'applique aux charges Cloud Run (**condition de bascule de `use_service_account_targets`**) | Poser une règle de test `deny` en sortie ciblée par `target_service_accounts=[sa-dashboard...]` vers `LB_IP/32`, puis appeler le tableau de bord. **S'il est coupé, le sélecteur fonctionne** — retirer la règle immédiatement après |
| **V6** | Le tableau de bord ne peut joindre **aucune** autre destination que l'équilibreur | Depuis une révision de test portant la même étiquette : `curl -sS --max-time 5 https://bigquery.googleapis.com` → doit expirer ; `curl -sS --max-time 5 https://<domaine-api>` → doit répondre. **C'est la démonstration la plus parlante du principe d'identité, à filmer pour la soutenance** |
| **V12** | Aucune règle d'autorisation ne comporte de plage source (critère d'acceptation du §a) | `gcloud compute firewall-rules list --format=json \| jq '[.[] \| select(.allowed != null) \| select(.sourceRanges != null)] \| length'` → **doit valoir 0** |
| **V13** | Le refus par défaut en sortie est réellement appliqué | `gcloud compute firewall-rules describe egress-deny-all-<env> --format="value(direction,priority,denied,logConfig.enable)"` → `EGRESS 65534 all True`, **puis** un `curl` vers une adresse externe arbitraire depuis une révision de test → doit expirer |
| **V14** | Une tentative croisée entre locataires produit un signal exploitable | Depuis une révision de test étiquetée `sa-elson` : `curl --max-time 5 http://10.0.8.5:8080` ; puis `bq query 'SELECT * FROM raw_logs WHERE json_payload.rule_details.reference LIKE "%cross-tenant%" ORDER BY timestamp DESC LIMIT 5'` → **la ligne doit apparaître avec le nom de la règle** |
| **V15** | Les trois règles supprimées ne protégeaient rien | `gcloud compute instances list` → vide ; donc aucune ressource ne peut porter l'étiquette `https-server`. **Une commande, une preuve** |
| **V16** | Le refus général en entrée reste effectif | `gcloud compute firewall-rules describe ingress-deny-all-<env>` + absence de toute règle `INGRESS` avec `allowed` : `gcloud compute firewall-rules list --filter="direction=INGRESS AND allowed:*" --format="value(name)"` → **vide** |

### j.4 Propriétés de coût et d'exploitation

| Réf. | Propriété | Commande |
|---|---|---|
| **V9** | Les économies annoncées au §h sont réelles | Rapport de facturation, filtre sur les SKU `VPC Access` / `Cloud NAT` / `Network Telemetry`, comparaison du mois M-1 et du mois M+1. **Remplacer les ordres de grandeur du §h par ces montants dans le mémoire** |
| **V10** | Les sous-réseaux ne s'approchent pas de la saturation | `gcloud compute networks subnets describe sn-menal-ew1 --region europe-west1 --format="value(ipCidrRange)"` + métrique d'utilisation des adresses ; poser une alerte à 70 % |
| **V11** | La sortie réseau directe ne dégrade pas le démarrage à froid | Sur `menal-api` (`min_instances = 0`) : 20 requêtes après période d'inactivité, avant et après bascule ; comparer les p50/p95. **Chiffre à publier dans le mémoire, quel qu'il soit** |
| **V17** | La plage d'appairage est enfin documentée (fermeture partielle du défaut n°9) | `gcloud compute addresses list --global --filter="purpose=VPC_PEERING" --format="table(name,address,prefixLength)"` → **reporter la valeur dans le mémoire.** Tant qu'elle n'y est pas, le défaut reste ouvert |

---

## Annexe — traçabilité : les onze défauts, un par un

| # | Défaut | Confirmé dans le code ? | Traité par | Statut cible |
|---|---|---|---|---|
| 1 | Deux sous-réseaux déclarés et vides | **Oui** — `vpc/main.tf:7-34`, `outputs.tf:11-14` non consommé, aucun `google_compute_instance` | §b : supprimés, remplacés par des sous-réseaux **réellement occupés** par les interfaces de sortie | **Fermé** |
| 2 | `allow-internal` prio 900, tout TCP/UDP/ICMP, sans cible | **Oui** — `vpc/main.tf:104-126` | §d.3 : **supprimée sans successeur**. Aucune règle d'autorisation en entrée dans la cible | **Fermé** |
| 3 | Aucune règle de sortie | **Oui** — 0 `direction = "EGRESS"` dans le module | §d.4 E9 + **§0.1/§d.3 décision 1** : le passage en `ALL_TRAFFIC` est ce qui rend la règle effective | **Fermé** |
| 4 | Passerelle rattachée au seul sous-réseau vide | **Oui** — `vpc/main.tf:49-54` | §e.3 : la passerelle devient **sans objet** et disparaît | **Fermé** (ou corrigé si le filet est posé) |
| 5 | Journalisation `ERRORS_ONLY` | **Oui** — `vpc/main.tf:59-62` | §e.3 : disparaît avec la passerelle. Le signal de sortie vient désormais des **refus de pare-feu journalisés** (E3, E7-E9), qui alimentent le puits SIEM existant | **Fermé, et amélioré** |
| 6 | Allocation d'adresses `AUTO_ONLY` | **Oui** — `vpc/main.tf:48` | §e.3 : sans objet. **Si un besoin d'adresse stable réapparaît** (SMTP Zoho, §0.3), la passerelle revient en `MANUAL_ONLY` avec adresse réservée — donc le défaut est corrigé, pas reconduit | **Fermé, avec procédure de réouverture** |
| 7 | Deux règles mortes sur `https-server` | **Oui** — `vpc/main.tf:88-102` et `:154-168`, aucune instance dans le dépôt | §d.3 : supprimées. Preuve en une commande (§j-V15) | **Fermé** |
| 8 | Connecteur unique, sept charges, point de défaillance unique | **Oui** — `vpc/main.tf:128-142` référencé 7 fois | §c : supprimé | **Fermé** |
| 9 | Plage d'appairage `/16` auto, début inconnu | **Oui** — `cloud-sql/main.tf:3-10`, pas de champ `address` | §b.1 : évitée par raisonnement démontrable, relevée par commande (§j-V17), déclarée explicitement pour toute reconstruction | **Partiellement fermé — immuable sur l'existant, et c'est dit** |
| 10 | `routing_mode` non déclaré ; journaux de flux sur deux sous-réseaux vides | **Oui** — absent du module ; `log_config` sur deux sous-réseaux sans ressource | §b.2 : `routing_mode = "REGIONAL"` déclaré ; journaux de flux portés sur des sous-réseaux **qui portent du trafic**, avec échantillonnage calibré et coût chiffré | **Fermé** |
| 11 | Aucune ségrégation entre locataires | **Oui** — un VPC, un connecteur, une instance, un jeu de données | §f : **au plan réseau, fermé à coût nul.** Aux plans base de données et SIEM, **non traité et hors périmètre** — §f.3 et §g-1 | **Fermé au réseau, ouvert ailleurs — et le dire est la moitié du travail** |

---

*Fin du dossier de conception. Le module Terraform correspondant est proposé dans
`terraform_cible_vpc.tf`, dans le même répertoire. C'est une proposition : son
application relève de l'auteur.*
